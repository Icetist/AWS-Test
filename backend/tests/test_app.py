import pytest
from unittest.mock import patch, MagicMock
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
