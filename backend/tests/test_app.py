import pytest
from unittest.mock import patch, MagicMock
from decimal import Decimal
import bcrypt
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as c:
        yield c


def hashed(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def make_user(**kwargs):
    base = {
        'userId': 'user-123',
        'fullName': 'Jane Doe',
        'email': 'jane@example.com',
        'passwordHash': hashed('password123'),
        'createdAt': '2024-01-01T00:00:00Z',
    }
    return {**base, **kwargs}


# ─── Signup ───────────────────────────────────────────────────────────────────

class TestSignup:
    @patch('app.table')
    def test_signup_success(self, mock_table, client):
        mock_table.scan.return_value = {'Items': []}
        mock_table.put_item.return_value = {}

        res = client.post('/signup', json={
            'fullName': 'Jane Doe',
            'email': 'jane@example.com',
            'password': 'password123',
        })

        assert res.status_code == 201
        data = res.get_json()
        assert data['email'] == 'jane@example.com'
        assert data['fullName'] == 'Jane Doe'
        assert 'userId' in data
        mock_table.put_item.assert_called_once()

    @patch('app.table')
    def test_signup_duplicate_email(self, mock_table, client):
        mock_table.scan.return_value = {'Items': [make_user()]}

        res = client.post('/signup', json={
            'fullName': 'Jane Doe',
            'email': 'jane@example.com',
            'password': 'password123',
        })

        assert res.status_code == 409
        assert 'already exists' in res.get_json()['error']

    @patch('app.table')
    def test_signup_missing_full_name(self, mock_table, client):
        res = client.post('/signup', json={'email': 'jane@example.com', 'password': 'password123'})
        assert res.status_code == 400

    @patch('app.table')
    def test_signup_missing_email(self, mock_table, client):
        res = client.post('/signup', json={'fullName': 'Jane', 'password': 'password123'})
        assert res.status_code == 400

    @patch('app.table')
    def test_signup_missing_password(self, mock_table, client):
        res = client.post('/signup', json={'fullName': 'Jane', 'email': 'jane@example.com'})
        assert res.status_code == 400

    @patch('app.table')
    def test_signup_stores_hashed_password(self, mock_table, client):
        mock_table.scan.return_value = {'Items': []}
        mock_table.put_item.return_value = {}

        client.post('/signup', json={
            'fullName': 'Jane Doe',
            'email': 'jane@example.com',
            'password': 'password123',
        })

        call_args = mock_table.put_item.call_args[1]['Item']
        assert call_args['passwordHash'] != 'password123'
        assert bcrypt.checkpw(b'password123', call_args['passwordHash'].encode())

    @patch('app.table')
    def test_signup_email_normalized_to_lowercase(self, mock_table, client):
        mock_table.scan.return_value = {'Items': []}
        mock_table.put_item.return_value = {}

        client.post('/signup', json={
            'fullName': 'Jane',
            'email': 'JANE@EXAMPLE.COM',
            'password': 'password123',
        })

        stored = mock_table.put_item.call_args[1]['Item']
        assert stored['email'] == 'jane@example.com'


# ─── Login ────────────────────────────────────────────────────────────────────

class TestLogin:
    @patch('app.table')
    def test_login_success(self, mock_table, client):
        user = make_user()
        mock_table.scan.return_value = {'Items': [user]}

        res = client.post('/login', json={'email': 'jane@example.com', 'password': 'password123'})

        assert res.status_code == 200
        data = res.get_json()
        assert data['userId'] == 'user-123'
        assert data['email'] == 'jane@example.com'
        assert 'passwordHash' not in data

    @patch('app.table')
    def test_login_wrong_password(self, mock_table, client):
        mock_table.scan.return_value = {'Items': [make_user()]}

        res = client.post('/login', json={'email': 'jane@example.com', 'password': 'wrongpassword'})

        assert res.status_code == 401
        assert 'Invalid' in res.get_json()['error']

    @patch('app.table')
    def test_login_nonexistent_email(self, mock_table, client):
        mock_table.scan.return_value = {'Items': []}

        res = client.post('/login', json={'email': 'nobody@example.com', 'password': 'password123'})

        assert res.status_code == 401

    @patch('app.table')
    def test_login_missing_fields(self, mock_table, client):
        res = client.post('/login', json={'email': 'jane@example.com'})
        assert res.status_code == 400

    @patch('app.table')
    def test_login_email_case_insensitive(self, mock_table, client):
        mock_table.scan.return_value = {'Items': [make_user()]}

        res = client.post('/login', json={'email': 'JANE@EXAMPLE.COM', 'password': 'password123'})

        assert res.status_code == 200


# ─── Get User ─────────────────────────────────────────────────────────────────

class TestGetUser:
    @patch('app.table')
    def test_get_user_success(self, mock_table, client):
        mock_table.get_item.return_value = {'Item': make_user()}

        res = client.get('/user/user-123')

        assert res.status_code == 200
        data = res.get_json()
        assert data['userId'] == 'user-123'
        assert data['fullName'] == 'Jane Doe'
        assert 'passwordHash' not in data

    @patch('app.table')
    def test_get_user_not_found(self, mock_table, client):
        mock_table.get_item.return_value = {}

        res = client.get('/user/nonexistent')

        assert res.status_code == 404

    @patch('app.table')
    def test_get_user_excludes_password_hash(self, mock_table, client):
        mock_table.get_item.return_value = {'Item': make_user()}

        res = client.get('/user/user-123')

        assert 'passwordHash' not in res.get_json()


# ─── Update User ──────────────────────────────────────────────────────────────

class TestUpdateUser:
    @patch('app.table')
    def test_update_user_success(self, mock_table, client):
        mock_table.scan.return_value = {'Items': []}
        mock_table.update_item.return_value = {}

        res = client.put('/user/user-123', json={
            'fullName': 'Jane Updated',
            'email': 'jane.new@example.com',
        })

        assert res.status_code == 200
        assert res.get_json()['success'] is True
        mock_table.update_item.assert_called_once()

    @patch('app.table')
    def test_update_user_email_taken_by_other(self, mock_table, client):
        other_user = make_user(userId='other-456', email='taken@example.com')
        mock_table.scan.return_value = {'Items': [other_user]}

        res = client.put('/user/user-123', json={
            'fullName': 'Jane',
            'email': 'taken@example.com',
        })

        assert res.status_code == 409

    @patch('app.table')
    def test_update_user_same_email_allowed(self, mock_table, client):
        same_user = make_user(userId='user-123', email='jane@example.com')
        mock_table.scan.return_value = {'Items': [same_user]}
        mock_table.update_item.return_value = {}

        res = client.put('/user/user-123', json={
            'fullName': 'Jane Updated',
            'email': 'jane@example.com',
        })

        assert res.status_code == 200

    @patch('app.table')
    def test_update_user_with_new_password(self, mock_table, client):
        mock_table.scan.return_value = {'Items': []}
        mock_table.update_item.return_value = {}

        res = client.put('/user/user-123', json={
            'fullName': 'Jane',
            'email': 'jane@example.com',
            'password': 'newpassword123',
        })

        assert res.status_code == 200
        call_kwargs = mock_table.update_item.call_args[1]
        assert ':ph' in call_kwargs['ExpressionAttributeValues']
        stored_hash = call_kwargs['ExpressionAttributeValues'][':ph']
        assert bcrypt.checkpw(b'newpassword123', stored_hash.encode())

    @patch('app.table')
    def test_update_user_missing_fields(self, mock_table, client):
        res = client.put('/user/user-123', json={'fullName': 'Jane'})
        assert res.status_code == 400


# ─── HSC Data ─────────────────────────────────────────────────────────────────

def make_hsc_items(*items):
    """Return a scan response dict for the given list of DynamoDB items."""
    return {'Items': list(items)}


class TestHscData:
    @patch('app.hsc_table')
    def test_returns_correct_top_level_keys(self, mock_hsc, client):
        mock_hsc.scan.return_value = make_hsc_items()

        res = client.get('/hsc-data')

        assert res.status_code == 200
        data = res.get_json()
        assert set(data.keys()) == {'districts', 'boards', 'national'}

    @patch('app.hsc_table')
    def test_national_year_rates_extracted(self, mock_hsc, client):
        mock_hsc.scan.return_value = make_hsc_items(
            {'pk': 'National', 'sk': '2023#All Groups', 'overall_pass_pct': Decimal('77.93')},
            {'pk': 'National', 'sk': '2021#All Groups', 'overall_pass_pct': Decimal('95.57')},
        )

        data = client.get('/hsc-data').get_json()

        assert data['national']['2023'] == pytest.approx(77.93, abs=0.01)
        assert data['national']['2021'] == pytest.approx(95.57, abs=0.01)

    @patch('app.hsc_table')
    def test_board_total_suffix_stripped(self, mock_hsc, client):
        mock_hsc.scan.return_value = make_hsc_items(
            {'pk': 'Dhaka Board Total', 'sk': '2023#All Groups', 'overall_pass_pct': Decimal('79.44')},
            {'pk': 'Sylhet Board Total', 'sk': '2023#All Groups', 'overall_pass_pct': Decimal('51.86')},
        )

        data = client.get('/hsc-data').get_json()

        assert 'Dhaka' in data['boards']
        assert 'Sylhet' in data['boards']
        assert 'Dhaka Board Total' not in data['boards']
        assert data['boards']['Dhaka']['2023'] == pytest.approx(79.44, abs=0.01)

    @patch('app.hsc_table')
    def test_non_all_groups_rows_filtered_out(self, mock_hsc, client):
        mock_hsc.scan.return_value = make_hsc_items(
            {'pk': 'Dhaka', 'sk': '2023#All Groups', 'overall_pass_pct': Decimal('89.01'), 'board': 'Dhaka'},
            {'pk': 'Dhaka', 'sk': '2023#Science', 'overall_pass_pct': Decimal('93.50'), 'board': 'Dhaka'},
            {'pk': 'Dhaka', 'sk': '2023#Humanities', 'overall_pass_pct': Decimal('80.20'), 'board': 'Dhaka'},
        )

        data = client.get('/hsc-data').get_json()

        # Only the 'All Groups' row contributes — one year key only
        dist = data['districts']['Dhaka']
        year_keys = {k for k in dist if k != 'board'}
        assert year_keys == {'2023'}

    @patch('app.hsc_table')
    def test_items_without_pass_pct_skipped(self, mock_hsc, client):
        mock_hsc.scan.return_value = make_hsc_items(
            {'pk': 'Dhaka', 'sk': '2023#All Groups', 'board': 'Dhaka'},          # no overall_pass_pct
            {'pk': 'Rajshahi', 'sk': '2023#All Groups', 'overall_pass_pct': Decimal('84.34'), 'board': 'Rajshahi'},
        )

        data = client.get('/hsc-data').get_json()

        assert 'Dhaka' not in data['districts']
        assert 'Rajshahi' in data['districts']

    @patch('app.hsc_table')
    def test_district_entry_includes_board_field(self, mock_hsc, client):
        mock_hsc.scan.return_value = make_hsc_items(
            {'pk': 'Faridpur', 'sk': '2023#All Groups', 'overall_pass_pct': Decimal('75.30'), 'board': 'Dhaka'},
        )

        data = client.get('/hsc-data').get_json()

        assert data['districts']['Faridpur']['board'] == 'Dhaka'

    @patch('app.hsc_table')
    def test_pagination_followed(self, mock_hsc, client):
        mock_hsc.scan.side_effect = [
            {
                'Items': [{'pk': 'National', 'sk': '2023#All Groups', 'overall_pass_pct': Decimal('77.93')}],
                'LastEvaluatedKey': {'pk': 'National'},
            },
            {
                'Items': [{'pk': 'Dhaka', 'sk': '2023#All Groups', 'overall_pass_pct': Decimal('89.01'), 'board': 'Dhaka'}],
            },
        ]

        data = client.get('/hsc-data').get_json()

        assert '2023' in data['national']
        assert 'Dhaka' in data['districts']
        assert mock_hsc.scan.call_count == 2

    @patch('app.hsc_table')
    def test_returns_500_on_dynamo_exception(self, mock_hsc, client):
        mock_hsc.scan.side_effect = Exception('DynamoDB unavailable')

        res = client.get('/hsc-data')

        assert res.status_code == 500
        assert 'error' in res.get_json()


# ─── Password Reset ───────────────────────────────────────────────────────────

class TestSendOtpPasswordReset:
    @patch('app.otp_table')
    @patch('app.ses')
    @patch('app.table')
    def test_password_reset_otp_sent_for_existing_email(self, mock_table, mock_ses, mock_otp, client):
        mock_table.scan.return_value = {'Items': [make_user()]}
        mock_otp.get_item.return_value = {}
        mock_otp.put_item.return_value = {}
        mock_ses.send_email.return_value = {}

        res = client.post('/send-otp', json={'email': 'jane@example.com', 'purpose': 'password-reset'})

        assert res.status_code == 200
        stored = mock_otp.put_item.call_args[1]['Item']
        assert stored['purpose'] == 'password-reset'

    @patch('app.table')
    def test_password_reset_rejected_for_unknown_email(self, mock_table, client):
        mock_table.scan.return_value = {'Items': []}

        res = client.post('/send-otp', json={'email': 'nobody@example.com', 'purpose': 'password-reset'})

        assert res.status_code == 404
        assert 'No account found' in res.get_json()['error']


class TestResetPassword:
    @patch('app.table')
    def test_reset_password_success(self, mock_table, client):
        mock_table.scan.return_value = {'Items': [make_user()]}
        mock_table.update_item.return_value = {}

        res = client.post('/reset-password', json={
            'email': 'jane@example.com',
            'password': 'newpassword123',
        })

        assert res.status_code == 200
        assert res.get_json()['success'] is True

    @patch('app.table')
    def test_reset_password_hashes_new_password(self, mock_table, client):
        mock_table.scan.return_value = {'Items': [make_user()]}
        mock_table.update_item.return_value = {}

        client.post('/reset-password', json={'email': 'jane@example.com', 'password': 'newpassword123'})

        call_kwargs = mock_table.update_item.call_args[1]
        stored_hash = call_kwargs['ExpressionAttributeValues'][':ph']
        assert stored_hash != 'newpassword123'
        assert bcrypt.checkpw(b'newpassword123', stored_hash.encode())

    @patch('app.table')
    def test_reset_password_unknown_email_returns_404(self, mock_table, client):
        mock_table.scan.return_value = {'Items': []}

        res = client.post('/reset-password', json={
            'email': 'nobody@example.com',
            'password': 'newpassword123',
        })

        assert res.status_code == 404
        assert 'No account found' in res.get_json()['error']

    @patch('app.table')
    def test_reset_password_missing_email_returns_400(self, mock_table, client):
        res = client.post('/reset-password', json={'password': 'newpassword123'})
        assert res.status_code == 400

    @patch('app.table')
    def test_reset_password_missing_password_returns_400(self, mock_table, client):
        res = client.post('/reset-password', json={'email': 'jane@example.com'})
        assert res.status_code == 400

    @patch('app.table')
    def test_reset_password_updates_correct_user(self, mock_table, client):
        mock_table.scan.return_value = {'Items': [make_user(userId='user-123')]}
        mock_table.update_item.return_value = {}

        client.post('/reset-password', json={'email': 'jane@example.com', 'password': 'newpassword123'})

        call_kwargs = mock_table.update_item.call_args[1]
        assert call_kwargs['Key']['userId'] == 'user-123'
