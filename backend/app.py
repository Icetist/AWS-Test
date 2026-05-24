from flask import Flask, request, jsonify
from flask_cors import CORS
import boto3
from boto3.dynamodb.conditions import Attr
import bcrypt
import uuid
import random
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)

SENDER_EMAIL = 'noreply@sddigitalmediaclub.com'
OTP_EXPIRY_SECONDS = 600  # 10 minutes

dynamodb = boto3.resource('dynamodb', region_name='us-west-2')
ses = boto3.client('ses', region_name='us-west-2')
table = dynamodb.Table('tt-saahil-users')
otp_table = dynamodb.Table('tt-saahil-otps')


# ─── Helpers ──────────────────────────────────────────────────────────────────

def generate_otp():
    return str(random.randint(100000, 999999))


def otp_email_html(code, purpose_label):
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px;">
        <tr><td align="center">
          <table width="440" cellpadding="0" cellspacing="0"
            style="background:#fff;border-radius:20px;padding:40px;max-width:440px;">
            <tr><td align="center" style="padding-bottom:24px;">
              <div style="width:52px;height:52px;background:#4f46e5;border-radius:14px;
                display:inline-flex;align-items:center;justify-content:center;">
                <span style="color:#fff;font-size:24px;font-weight:700;line-height:52px;
                  display:block;width:52px;text-align:center;">T</span>
              </div>
            </td></tr>
            <tr><td align="center" style="padding-bottom:8px;">
              <h2 style="margin:0;font-size:22px;font-weight:700;color:#111827;">
                Verify your {purpose_label}
              </h2>
            </td></tr>
            <tr><td align="center" style="padding-bottom:32px;">
              <p style="margin:0;font-size:14px;color:#6b7280;">
                Enter this code to complete your {purpose_label.lower()}.
              </p>
            </td></tr>
            <tr><td align="center" style="padding-bottom:32px;">
              <div style="background:#f3f4f6;border-radius:14px;padding:24px 40px;display:inline-block;">
                <span style="font-size:40px;font-weight:700;color:#4f46e5;letter-spacing:10px;">
                  {code}
                </span>
              </div>
            </td></tr>
            <tr><td align="center" style="padding-bottom:16px;">
              <p style="margin:0;font-size:13px;color:#6b7280;">
                This code expires in <strong>10 minutes</strong>.
              </p>
            </td></tr>
            <tr><td align="center">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """


# ─── OTP ──────────────────────────────────────────────────────────────────────

@app.route('/send-otp', methods=['POST'])
def send_otp():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    purpose = data.get('purpose', '')

    if not email or purpose not in ('signup', 'login', 'password-change'):
        return jsonify({'error': 'Invalid request'}), 400

    if purpose == 'signup':
        existing = table.scan(FilterExpression=Attr('email').eq(email))
        if existing.get('Items'):
            return jsonify({'error': 'An account with this email already exists'}), 409

    if purpose in ('login', 'password-change'):
        existing = table.scan(FilterExpression=Attr('email').eq(email))
        if not existing.get('Items'):
            return jsonify({'error': 'No account found with this email'}), 404

    # Rate limit — don't resend if last OTP was sent under 60 seconds ago
    existing_otp = otp_table.get_item(Key={'email': email}).get('Item')
    if existing_otp:
        created_at = existing_otp.get('createdAt', 0)
        if int(time.time()) - int(created_at) < 60:
            return jsonify({'error': 'Please wait before requesting another code'}), 429

    code = generate_otp()
    now = int(time.time())

    otp_table.put_item(Item={
        'email': email,
        'code': code,
        'purpose': purpose,
        'expiresAt': now + OTP_EXPIRY_SECONDS,
        'createdAt': now,
    })

    purpose_labels = {
        'signup': 'Sign Up',
        'login': 'Login',
        'password-change': 'Password Change',
    }

    try:
        ses.send_email(
            Source=SENDER_EMAIL,
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': f"Your TIMA verification code"},
                'Body': {
                    'Html': {'Data': otp_email_html(code, purpose_labels[purpose])},
                    'Text': {'Data': f"Your TIMA verification code is: {code}. It expires in 10 minutes."},
                },
            },
        )
    except Exception as e:
        return jsonify({'error': f'Failed to send email: {str(e)}'}), 500

    return jsonify({'message': 'OTP sent'}), 200


@app.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    code = data.get('code', '').strip()
    purpose = data.get('purpose', '')

    if not email or not code or not purpose:
        return jsonify({'error': 'All fields are required'}), 400

    item = otp_table.get_item(Key={'email': email}).get('Item')

    if not item:
        return jsonify({'error': 'No code found for this email — request a new one'}), 400

    if item.get('purpose') != purpose:
        return jsonify({'error': 'Invalid code'}), 400

    if int(time.time()) > item.get('expiresAt', 0):
        otp_table.delete_item(Key={'email': email})
        return jsonify({'error': 'Code has expired — request a new one'}), 400

    if item.get('code') != code:
        return jsonify({'error': 'Incorrect code'}), 400

    otp_table.delete_item(Key={'email': email})
    return jsonify({'success': True}), 200


# ─── Auth ─────────────────────────────────────────────────────────────────────

@app.route('/signup', methods=['POST'])
def signup():
    data = request.json or {}
    full_name = data.get('fullName', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not full_name or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400

    existing = table.scan(FilterExpression=Attr('email').eq(email))
    if existing.get('Items'):
        return jsonify({'error': 'An account with this email already exists'}), 409

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user_id = str(uuid.uuid4())

    table.put_item(Item={
        'userId': user_id,
        'fullName': full_name,
        'email': email,
        'passwordHash': password_hash,
        'createdAt': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
    })

    return jsonify({'userId': user_id, 'fullName': full_name, 'email': email,
                    'createdAt': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')}), 201


@app.route('/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    result = table.scan(FilterExpression=Attr('email').eq(email))
    items = result.get('Items', [])

    if not items or not bcrypt.checkpw(password.encode(), items[0]['passwordHash'].encode()):
        return jsonify({'error': 'Invalid email or password'}), 401

    user = items[0]
    return jsonify({
        'userId': user['userId'],
        'fullName': user['fullName'],
        'email': user['email'],
        'createdAt': user.get('createdAt', ''),
    }), 200


# ─── User ─────────────────────────────────────────────────────────────────────

@app.route('/user/<user_id>', methods=['GET'])
def get_user(user_id):
    result = table.get_item(Key={'userId': user_id})
    user = result.get('Item')
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'userId': user['userId'],
        'fullName': user['fullName'],
        'email': user['email'],
        'createdAt': user.get('createdAt', ''),
    }), 200


@app.route('/user/<user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.json or {}
    full_name = data.get('fullName', '').strip()
    email = data.get('email', '').strip().lower()
    new_password = data.get('password', '').strip()

    if not full_name or not email:
        return jsonify({'error': 'Name and email are required'}), 400

    existing = table.scan(FilterExpression=Attr('email').eq(email))
    for item in existing.get('Items', []):
        if item['userId'] != user_id:
            return jsonify({'error': 'Email already in use by another account'}), 409

    update_expr = 'SET fullName = :fn, email = :em'
    expr_vals = {':fn': full_name, ':em': email}

    if new_password:
        expr_vals[':ph'] = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        update_expr += ', passwordHash = :ph'

    table.update_item(
        Key={'userId': user_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_vals,
    )

    return jsonify({'success': True}), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)
