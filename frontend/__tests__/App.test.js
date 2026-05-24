import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import App from '../App';

global.fetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const mockSendOtp = () => fetch.mockResolvedValueOnce({
  ok: true, json: async () => ({ message: 'OTP sent' }),
});

const mockVerifyOtp = () => fetch.mockResolvedValueOnce({
  ok: true, json: async () => ({ success: true }),
});

const mockSignupApi = () => fetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ userId: 'user-123', fullName: 'Jane Doe', email: 'jane@example.com', createdAt: '2024-01-01T00:00:00Z' }),
});

const mockLoginApi = () => fetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ userId: 'user-123', fullName: 'Jane Doe', email: 'jane@example.com', createdAt: '2024-01-01T00:00:00Z' }),
});

// ─── Fill helpers ─────────────────────────────────────────────────────────────

const fillSignup = (getByPlaceholderText, overrides = {}) => {
  const f = { fullName: 'Jane Doe', email: 'jane@example.com', password: 'password123', confirmPassword: 'password123', ...overrides };
  fireEvent.changeText(getByPlaceholderText('Jane Doe'), f.fullName);
  fireEvent.changeText(getByPlaceholderText('jane@example.com'), f.email);
  fireEvent.changeText(getByPlaceholderText('Min. 8 characters'), f.password);
  fireEvent.changeText(getByPlaceholderText('Repeat your password'), f.confirmPassword);
};

const fillLogin = (getByPlaceholderText, overrides = {}) => {
  const f = { email: 'jane@example.com', password: 'password123', ...overrides };
  fireEvent.changeText(getByPlaceholderText('jane@example.com'), f.email);
  fireEvent.changeText(getByPlaceholderText('Enter your password'), f.password);
};

// Goes through full signup → OTP → profile flow
const goToProfileViaSignup = async (getByPlaceholderText, getByText) => {
  mockSendOtp();
  fillSignup(getByPlaceholderText);
  await act(async () => { fireEvent.press(getByText('Continue')); });
  await waitFor(() => expect(getByText('Check your email')).toBeTruthy());

  mockVerifyOtp();
  mockSignupApi();
  fireEvent.changeText(getByText('Check your email').parent || { props: {} }, '');
  const otpInput = getByText('Check your email').parent;
  // Fill OTP via the input placeholder
  const { getByPlaceholderText: gp } = { getByPlaceholderText: (p) => getByText(p) };
  fireEvent.changeText(
    require('@testing-library/react-native').within
      ? require('@testing-library/react-native').screen.getByPlaceholderText('000000')
      : getByText('000000') || otpInput,
    '123456'
  );
  await act(async () => { fireEvent.press(getByText('Verify Code')); });
  await waitFor(() => expect(getByText('Edit Profile')).toBeTruthy());
};

// ─── SignUp Screen ────────────────────────────────────────────────────────────

describe('SignUp Screen', () => {
  it('renders all fields and continue button', () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    expect(getByPlaceholderText('Jane Doe')).toBeTruthy();
    expect(getByPlaceholderText('jane@example.com')).toBeTruthy();
    expect(getByPlaceholderText('Min. 8 characters')).toBeTruthy();
    expect(getByPlaceholderText('Repeat your password')).toBeTruthy();
    expect(getByText('Continue')).toBeTruthy();
  });

  it('shows error when full name is empty', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    fillSignup(getByPlaceholderText, { fullName: '' });
    fireEvent.press(getByText('Continue'));
    await waitFor(() => expect(getByText('Full name is required')).toBeTruthy());
  });

  it('shows error for invalid email', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    fillSignup(getByPlaceholderText, { email: 'not-an-email' });
    fireEvent.press(getByText('Continue'));
    await waitFor(() => expect(getByText('Enter a valid email')).toBeTruthy());
  });

  it('shows error when password is too short', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    fillSignup(getByPlaceholderText, { password: 'short', confirmPassword: 'short' });
    fireEvent.press(getByText('Continue'));
    await waitFor(() => expect(getByText('Min. 8 characters')).toBeTruthy());
  });

  it('shows error when passwords do not match', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    fillSignup(getByPlaceholderText, { password: 'password123', confirmPassword: 'different1' });
    fireEvent.press(getByText('Continue'));
    await waitFor(() => expect(getByText('Passwords do not match')).toBeTruthy());
  });

  it('calls send-otp API with email on valid form', async () => {
    mockSendOtp();
    const { getByPlaceholderText, getByText } = render(<App />);
    fillSignup(getByPlaceholderText);
    await act(async () => { fireEvent.press(getByText('Continue')); });

    expect(fetch).toHaveBeenCalledWith('http://localhost:5000/send-otp', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'jane@example.com', purpose: 'signup' }),
    }));
  });

  it('shows OTP screen after valid form submit', async () => {
    mockSendOtp();
    const { getByPlaceholderText, getByText } = render(<App />);
    fillSignup(getByPlaceholderText);
    await act(async () => { fireEvent.press(getByText('Continue')); });
    await waitFor(() => expect(getByText('Check your email')).toBeTruthy());
  });

  it('shows API error when send-otp fails', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'An account with this email already exists' }) });
    const { getByPlaceholderText, getByText } = render(<App />);
    fillSignup(getByPlaceholderText);
    await act(async () => { fireEvent.press(getByText('Continue')); });
    await waitFor(() => expect(getByText('An account with this email already exists')).toBeTruthy());
  });

  it('navigates to login screen when Log in is pressed', () => {
    const { getByText } = render(<App />);
    fireEvent.press(getByText('Log in'));
    expect(getByText('Welcome back')).toBeTruthy();
  });
});

// ─── OTP Screen ───────────────────────────────────────────────────────────────

describe('OTP Screen', () => {
  const goToOtp = async (getByPlaceholderText, getByText) => {
    mockSendOtp();
    fillSignup(getByPlaceholderText);
    await act(async () => { fireEvent.press(getByText('Continue')); });
    await waitFor(() => expect(getByText('Check your email')).toBeTruthy());
  };

  it('shows email address on OTP screen', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToOtp(getByPlaceholderText, getByText);
    expect(getByText('jane@example.com')).toBeTruthy();
  });

  it('shows error when code is incomplete', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToOtp(getByPlaceholderText, getByText);
    fireEvent.press(getByText('Verify Code'));
    await waitFor(() => expect(getByText('Enter the 6-digit code')).toBeTruthy());
  });

  it('calls verify-otp API with correct payload', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToOtp(getByPlaceholderText, getByText);

    mockVerifyOtp();
    mockSignupApi();
    fireEvent.changeText(getByPlaceholderText('000000'), '123456');
    await act(async () => { fireEvent.press(getByText('Verify Code')); });

    expect(fetch).toHaveBeenCalledWith('http://localhost:5000/verify-otp', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'jane@example.com', code: '123456', purpose: 'signup' }),
    }));
  });

  it('shows error on wrong OTP code', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToOtp(getByPlaceholderText, getByText);

    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Incorrect code' }) });
    fireEvent.changeText(getByPlaceholderText('000000'), '999999');
    await act(async () => { fireEvent.press(getByText('Verify Code')); });
    await waitFor(() => expect(getByText('Incorrect code')).toBeTruthy());
  });

  it('navigates to profile after successful OTP verification on signup', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToOtp(getByPlaceholderText, getByText);

    mockVerifyOtp();
    mockSignupApi();
    fireEvent.changeText(getByPlaceholderText('000000'), '123456');
    await act(async () => { fireEvent.press(getByText('Verify Code')); });
    await waitFor(() => expect(getByText('Edit Profile')).toBeTruthy());
  });

  it('goes back to signup when Go back is pressed', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToOtp(getByPlaceholderText, getByText);
    fireEvent.press(getByText('Go back'));
    await waitFor(() => expect(getByText('Create an account')).toBeTruthy());
  });

  it('calls send-otp again when Resend code is pressed', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToOtp(getByPlaceholderText, getByText);

    mockSendOtp();
    await act(async () => { fireEvent.press(getByText('Resend code')); });
    await waitFor(() => expect(getByText('A new code was sent!')).toBeTruthy());
  });
});

// ─── Login Screen ─────────────────────────────────────────────────────────────

describe('Login Screen', () => {
  const goToLogin = (getByText) => fireEvent.press(getByText('Log in'));

  it('renders email, password fields and continue button', () => {
    const { getByText, getByPlaceholderText } = render(<App />);
    goToLogin(getByText);
    expect(getByPlaceholderText('jane@example.com')).toBeTruthy();
    expect(getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(getByText('Continue')).toBeTruthy();
  });

  it('shows error when email is empty', async () => {
    const { getByText } = render(<App />);
    goToLogin(getByText);
    fireEvent.press(getByText('Continue'));
    await waitFor(() => expect(getByText('Email is required')).toBeTruthy());
  });

  it('shows error when password is empty', async () => {
    const { getByText, getByPlaceholderText } = render(<App />);
    goToLogin(getByText);
    fireEvent.changeText(getByPlaceholderText('jane@example.com'), 'jane@example.com');
    fireEvent.press(getByText('Continue'));
    await waitFor(() => expect(getByText('Password is required')).toBeTruthy());
  });

  it('calls login then send-otp on valid credentials', async () => {
    mockLoginApi();
    mockSendOtp();
    const { getByText, getByPlaceholderText } = render(<App />);
    goToLogin(getByText);
    fillLogin(getByPlaceholderText);
    await act(async () => { fireEvent.press(getByText('Continue')); });

    expect(fetch).toHaveBeenNthCalledWith(1, 'http://localhost:5000/login', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(2, 'http://localhost:5000/send-otp', expect.objectContaining({ method: 'POST' }));
  });

  it('shows OTP screen after successful credentials check', async () => {
    mockLoginApi();
    mockSendOtp();
    const { getByText, getByPlaceholderText } = render(<App />);
    goToLogin(getByText);
    fillLogin(getByPlaceholderText);
    await act(async () => { fireEvent.press(getByText('Continue')); });
    await waitFor(() => expect(getByText('Check your email')).toBeTruthy());
  });

  it('shows API error on bad credentials', async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Invalid email or password' }) });
    const { getByText, getByPlaceholderText } = render(<App />);
    goToLogin(getByText);
    fillLogin(getByPlaceholderText);
    await act(async () => { fireEvent.press(getByText('Continue')); });
    await waitFor(() => expect(getByText('Invalid email or password')).toBeTruthy());
  });

  it('navigates to profile after login OTP verified', async () => {
    mockLoginApi();
    mockSendOtp();
    const { getByText, getByPlaceholderText } = render(<App />);
    goToLogin(getByText);
    fillLogin(getByPlaceholderText);
    await act(async () => { fireEvent.press(getByText('Continue')); });
    await waitFor(() => expect(getByText('Check your email')).toBeTruthy());

    mockVerifyOtp();
    fireEvent.changeText(getByPlaceholderText('000000'), '123456');
    await act(async () => { fireEvent.press(getByText('Verify Code')); });
    await waitFor(() => expect(getByText('Edit Profile')).toBeTruthy());
  });

  it('navigates back to signup when Sign up is pressed', () => {
    const { getByText } = render(<App />);
    goToLogin(getByText);
    fireEvent.press(getByText('Sign up'));
    expect(getByText('Create an account')).toBeTruthy();
  });
});

// ─── Profile Screen ───────────────────────────────────────────────────────────

describe('Profile Screen', () => {
  const goToProfile = async (getByPlaceholderText, getByText) => {
    mockSendOtp();
    fillSignup(getByPlaceholderText);
    await act(async () => { fireEvent.press(getByText('Continue')); });
    await waitFor(() => expect(getByText('Check your email')).toBeTruthy());
    mockVerifyOtp();
    mockSignupApi();
    fireEvent.changeText(getByPlaceholderText('000000'), '123456');
    await act(async () => { fireEvent.press(getByText('Verify Code')); });
    await waitFor(() => expect(getByText('Edit Profile')).toBeTruthy());
  };

  it('displays user name and email', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToProfile(getByPlaceholderText, getByText);
    expect(getByText('Jane Doe')).toBeTruthy();
    expect(getByText('jane@example.com')).toBeTruthy();
  });

  it('shows initials avatar', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToProfile(getByPlaceholderText, getByText);
    expect(getByText('JD')).toBeTruthy();
  });

  it('saves without OTP when password is not changed', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToProfile(getByPlaceholderText, getByText);

    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    await act(async () => { fireEvent.press(getByText('Save Changes')); });
    await waitFor(() => expect(getByText('Changes updated!')).toBeTruthy());
  });

  it('sends OTP before saving when password is changed', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToProfile(getByPlaceholderText, getByText);

    fireEvent.changeText(getByPlaceholderText('Leave blank to keep current'), 'newpassword123');
    mockSendOtp();
    await act(async () => { fireEvent.press(getByText('Save Changes')); });
    await waitFor(() => expect(getByText('Check your email')).toBeTruthy());
  });

  it('saves after OTP verified when password is changed', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToProfile(getByPlaceholderText, getByText);

    fireEvent.changeText(getByPlaceholderText('Leave blank to keep current'), 'newpassword123');
    mockSendOtp();
    await act(async () => { fireEvent.press(getByText('Save Changes')); });
    await waitFor(() => expect(getByText('Check your email')).toBeTruthy());

    mockVerifyOtp();
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    fireEvent.changeText(getByPlaceholderText('000000'), '123456');
    await act(async () => { fireEvent.press(getByText('Verify Code')); });
    await waitFor(() => expect(getByText('Changes updated!')).toBeTruthy());
  });

  it('shows success modal after saving', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToProfile(getByPlaceholderText, getByText);

    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    await act(async () => { fireEvent.press(getByText('Save Changes')); });
    await waitFor(() => expect(getByText('Changes updated!')).toBeTruthy());
  });

  it('dismisses success modal when OK is pressed', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(<App />);
    await goToProfile(getByPlaceholderText, getByText);

    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
    await act(async () => { fireEvent.press(getByText('Save Changes')); });
    await waitFor(() => expect(getByText('Changes updated!')).toBeTruthy());
    await act(async () => { fireEvent.press(getByText('OK')); });
    await waitFor(() => expect(queryByText('Changes updated!')).toBeNull());
  });

  it('shows error when name is cleared before saving', async () => {
    const { getByPlaceholderText, getByText, getAllByDisplayValue } = render(<App />);
    await goToProfile(getByPlaceholderText, getByText);

    fireEvent.changeText(getAllByDisplayValue('Jane Doe')[0], '');
    fireEvent.press(getByText('Save Changes'));
    await waitFor(() => expect(getByText('Name is required')).toBeTruthy());
  });

  it('logs out and returns to login screen', async () => {
    const { getByPlaceholderText, getByText } = render(<App />);
    await goToProfile(getByPlaceholderText, getByText);

    fireEvent.press(getByText('Log out'));
    await waitFor(() => expect(getByText('Welcome back')).toBeTruthy());
  });
});
