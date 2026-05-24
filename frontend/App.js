import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Modal, ActivityIndicator,
} from 'react-native';
import { useState, useEffect } from 'react';

const API = 'http://localhost:5000';

// ─── Shared UI ───────────────────────────────────────────────────────────────

function Card({ children }) {
  return (
    <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>{children}</View>
      </ScrollView>
      <StatusBar style="dark" />
    </KeyboardAvoidingView>
  );
}

function Logo() {
  return (
    <View style={styles.logo}>
      <Text style={styles.logoText}>T</Text>
    </View>
  );
}

function Field({ label, error, right, children }) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {right}
      </View>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function Input({ field, focused, error, onFocus, onBlur, ...props }) {
  return (
    <TextInput
      style={[styles.input, focused === field && styles.inputFocused, error && styles.inputError]}
      placeholderTextColor="#adb5bd"
      onFocus={onFocus}
      onBlur={onBlur}
      {...props}
    />
  );
}

function PrimaryButton({ label, onPress, loading }) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.85} disabled={loading}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function SuccessModal({ visible, message, onClose }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalIcon}>✓</Text>
          <Text style={styles.modalTitle}>{message}</Text>
          <TouchableOpacity style={styles.modalButton} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── OTP Screen ───────────────────────────────────────────────────────────────

function OtpScreen({ email, purpose, onVerified, onBack }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resendMsg, setResendMsg] = useState('');

  const purposeLabels = {
    signup: 'sign up',
    login: 'login',
    'password-change': 'password change',
  };

  const handleVerify = async () => {
    if (code.length !== 6) { setError('Enter the 6-digit code'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, purpose }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Verification failed'); return; }
      onVerified();
    } catch {
      setError('Could not reach server.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendMsg('');
    setError('');
    setResending(true);
    try {
      const res = await fetch(`${API}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to resend'); return; }
      setResendMsg('A new code was sent!');
      setCode('');
    } catch {
      setError('Could not reach server.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Card>
      <View style={styles.header}>
        <Logo />
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to verify your {purposeLabels[purpose]}
        </Text>
        <Text style={styles.otpEmail}>{email}</Text>
      </View>

      <View style={styles.form}>
        {error ? <Text style={styles.apiError}>{error}</Text> : null}
        {resendMsg ? <Text style={styles.resendSuccess}>{resendMsg}</Text> : null}

        <TextInput
          style={styles.otpInput}
          value={code}
          onChangeText={(v) => { setCode(v.replace(/[^0-9]/g, '')); setError(''); }}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          placeholderTextColor="#d1d5db"
          textAlign="center"
        />

        <PrimaryButton label="Verify Code" onPress={handleVerify} loading={loading} />

        <View style={styles.otpFooter}>
          <TouchableOpacity onPress={handleResend} disabled={resending}>
            <Text style={styles.switchLink}>
              {resending ? 'Sending...' : 'Resend code'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.switchText}> · </Text>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.switchLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

// ─── Sign Up ─────────────────────────────────────────────────────────────────

function SignUpScreen({ onNavigateLogin, onOtpRequired, onSignedUp }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const focus = (key) => () => setFocused(key);
  const blur = () => setFocused(null);

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Min. 8 characters';
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    return e;
  };

  const handleSubmit = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setApiError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, purpose: 'signup' }),
      });
      const data = await res.json();
      if (!res.ok) { setApiError(data.error || 'Failed to send code'); return; }
      onOtpRequired(form.email, 'signup', () => onSignedUp(form));
    } catch {
      setApiError('Could not reach server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <View style={styles.header}>
        <Logo />
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.subtitle}>Sign up to get started</Text>
      </View>
      <View style={styles.form}>
        {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}
        <Field label="Full Name" error={errors.fullName}>
          <Input field="fullName" focused={focused} error={errors.fullName}
            placeholder="Jane Doe" value={form.fullName}
            onChangeText={set('fullName')} onFocus={focus('fullName')} onBlur={blur} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input field="email" focused={focused} error={errors.email}
            placeholder="jane@example.com" value={form.email}
            onChangeText={set('email')} onFocus={focus('email')} onBlur={blur}
            keyboardType="email-address" autoCapitalize="none" />
        </Field>
        <Field label="Password" error={errors.password}>
          <Input field="password" focused={focused} error={errors.password}
            placeholder="Min. 8 characters" value={form.password}
            onChangeText={set('password')} onFocus={focus('password')} onBlur={blur}
            secureTextEntry />
        </Field>
        <Field label="Confirm Password" error={errors.confirmPassword}>
          <Input field="confirmPassword" focused={focused} error={errors.confirmPassword}
            placeholder="Repeat your password" value={form.confirmPassword}
            onChangeText={set('confirmPassword')} onFocus={focus('confirmPassword')} onBlur={blur}
            secureTextEntry />
        </Field>
        <PrimaryButton label="Continue" onPress={handleSubmit} loading={loading} />
        <Text style={styles.switchText}>
          Already have an account?{' '}
          <Text style={styles.switchLink} onPress={onNavigateLogin}>Log in</Text>
        </Text>
      </View>
    </Card>
  );
}

// ─── Log In ──────────────────────────────────────────────────────────────────

function LoginScreen({ onNavigateSignUp, onOtpRequired }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const focus = (key) => () => setFocused(key);
  const blur = () => setFocused(null);

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    setApiError('');
    setLoading(true);
    try {
      // Step 1 — verify credentials
      const loginRes = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) { setApiError(loginData.error || 'Login failed'); return; }

      // Step 2 — send OTP
      const otpRes = await fetch(`${API}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, purpose: 'login' }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) { setApiError(otpData.error || 'Failed to send code'); return; }

      onOtpRequired(form.email, 'login', loginData);
    } catch {
      setApiError('Could not reach server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <View style={styles.header}>
        <Logo />
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to your account</Text>
      </View>
      <View style={styles.form}>
        {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}
        <Field label="Email" error={errors.email}>
          <Input field="email" focused={focused} error={errors.email}
            placeholder="jane@example.com" value={form.email}
            onChangeText={set('email')} onFocus={focus('email')} onBlur={blur}
            keyboardType="email-address" autoCapitalize="none" />
        </Field>
        <Field label="Password" error={errors.password}
          right={<Text style={styles.forgotLink}>Forgot password?</Text>}>
          <Input field="password" focused={focused} error={errors.password}
            placeholder="Enter your password" value={form.password}
            onChangeText={set('password')} onFocus={focus('password')} onBlur={blur}
            secureTextEntry />
        </Field>
        <PrimaryButton label="Continue" onPress={handleSubmit} loading={loading} />
        <Text style={styles.switchText}>
          Don't have an account?{' '}
          <Text style={styles.switchLink} onPress={onNavigateSignUp}>Sign up</Text>
        </Text>
      </View>
    </Card>
  );
}

// ─── Profile Dashboard ────────────────────────────────────────────────────────

function ProfileScreen({ user, onLogout, onOtpRequired, savedAt }) {
  const [form, setForm] = useState({ fullName: user.fullName, email: user.email, password: '' });
  const [focused, setFocused] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (savedAt) {
      setForm((f) => ({ ...f, password: '' }));
      setShowSuccess(true);
    }
  }, [savedAt]);

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const focus = (key) => () => setFocused(key);
  const blur = () => setFocused(null);

  const initials = (form.fullName || '')
    .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const validate = () => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (form.password && form.password.length < 8) e.password = 'Min. 8 characters';
    return e;
  };

  const doSave = async () => {
    setApiError('');
    setLoading(true);
    try {
      const body = { fullName: form.fullName, email: form.email };
      if (form.password) body.password = form.password;
      const res = await fetch(`${API}/user/${user.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setApiError(data.error || 'Update failed'); return; }
      setForm((f) => ({ ...f, password: '' }));
      setShowSuccess(true);
    } catch {
      setApiError('Could not reach server.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});

    // If changing password, require OTP first
    if (form.password) {
      setLoading(true);
      try {
        const res = await fetch(`${API}/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, purpose: 'password-change' }),
        });
        const data = await res.json();
        if (!res.ok) { setApiError(data.error || 'Failed to send code'); return; }
        const saveBody = { fullName: form.fullName, email: form.email, password: form.password };
        onOtpRequired(user.email, 'password-change', { type: 'save', userId: user.userId, body: saveBody });
      } catch {
        setApiError('Could not reach server.');
      } finally {
        setLoading(false);
      }
    } else {
      await doSave();
    }
  };

  return (
    <KeyboardAvoidingView style={styles.wrapper} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.title}>{user.fullName}</Text>
            <Text style={styles.subtitle}>{user.email}</Text>
            {user.createdAt ? (
              <Text style={styles.memberSince}>
                Member since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
            ) : null}
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Edit Profile</Text>

          <View style={styles.form}>
            {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}
            <Field label="Full Name" error={errors.fullName}>
              <Input field="fullName" focused={focused} error={errors.fullName}
                value={form.fullName} onChangeText={set('fullName')}
                onFocus={focus('fullName')} onBlur={blur} />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input field="email" focused={focused} error={errors.email}
                value={form.email} onChangeText={set('email')}
                onFocus={focus('email')} onBlur={blur}
                keyboardType="email-address" autoCapitalize="none" />
            </Field>
            <Field label="New Password" error={errors.password}>
              <Input field="password" focused={focused} error={errors.password}
                placeholder="Leave blank to keep current"
                value={form.password} onChangeText={set('password')}
                onFocus={focus('password')} onBlur={blur}
                secureTextEntry />
            </Field>
            <Text style={styles.otpHint}>
              A verification code will be sent to your email when changing your password.
            </Text>
            <PrimaryButton label="Save Changes" onPress={handleSave} loading={loading} />
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout} activeOpacity={0.7}>
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <SuccessModal visible={showSuccess} message="Changes updated!" onClose={() => setShowSuccess(false)} />
      <StatusBar style="dark" />
    </KeyboardAvoidingView>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('signup');
  const [user, setUser] = useState(null);
  const [otpState, setOtpState] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  // otpState: { email, purpose, onVerified }

  // Called after OTP verified on signup — create the account
  const completeSignup = async (form) => {
    try {
      const res = await fetch(`${API}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: form.fullName, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setScreen('signup'); return; }
      setUser(data);
      setScreen('profile');
    } catch {
      setScreen('signup');
    }
  };

  const handleOtpRequired = (email, purpose, onVerified) => {
    setOtpState({ email, purpose, onVerified });
    setScreen('otp');
  };

  const handleOtpVerified = async () => {
    const { onVerified } = otpState;
    setOtpState(null);
    if (onVerified && typeof onVerified === 'object' && onVerified.type === 'save') {
      // password-change: perform PUT at App level, then signal ProfileScreen via savedAt
      setScreen('profile');
      try {
        const res = await fetch(`${API}/user/${onVerified.userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(onVerified.body),
        });
        if (res.ok) setSavedAt(Date.now());
      } catch {
        // network error — ProfileScreen will remain visible without modal
      }
    } else if (typeof onVerified === 'function') {
      // signup: call completeSignup(form)
      onVerified();
    } else {
      // login: onVerified is user data
      setUser(onVerified);
      setScreen('profile');
    }
  };

  if (screen === 'otp' && otpState) {
    return (
      <OtpScreen
        email={otpState.email}
        purpose={otpState.purpose}
        onVerified={handleOtpVerified}
        onBack={() => {
          setOtpState(null);
          setScreen(otpState.purpose === 'login' ? 'login' : otpState.purpose === 'password-change' ? 'profile' : 'signup');
        }}
      />
    );
  }

  if (screen === 'profile' && user) {
    return (
      <ProfileScreen
        user={user}
        savedAt={savedAt}
        onLogout={() => { setUser(null); setScreen('login'); }}
        onOtpRequired={(email, purpose, onVerified) => handleOtpRequired(email, purpose, onVerified)}
      />
    );
  }

  if (screen === 'login') {
    return (
      <LoginScreen
        onNavigateSignUp={() => setScreen('signup')}
        onOtpRequired={(email, purpose, userData) => handleOtpRequired(email, purpose, userData)}
      />
    );
  }

  return (
    <SignUpScreen
      onNavigateLogin={() => setScreen('login')}
      onOtpRequired={(email, purpose, onVerified) => handleOtpRequired(email, purpose, onVerified)}
      onSignedUp={(form) => completeSignup(form)}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f0f2f5' },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48, paddingHorizontal: 16 },
  card: {
    width: '100%', maxWidth: 440, backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 36, paddingVertical: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6,
  },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  otpEmail: { fontSize: 14, fontWeight: '600', color: '#4f46e5', marginTop: 6 },
  otpInput: {
    fontSize: 32, fontWeight: '700', letterSpacing: 10, color: '#4f46e5',
    borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 14,
    paddingVertical: 18, textAlign: 'center', backgroundColor: '#fafafa',
    outlineStyle: 'none',
  },
  otpFooter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  otpHint: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: -4 },
  resendSuccess: { fontSize: 13, color: '#10b981', backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, textAlign: 'center' },
  profileHeader: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  memberSince: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 16 },
  form: { gap: 16 },
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  forgotLink: { fontSize: 12, color: '#4f46e5', fontWeight: '600' },
  input: {
    height: 46, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15, color: '#111827', backgroundColor: '#fafafa',
    outlineStyle: 'none',
  },
  inputFocused: { borderColor: '#4f46e5', backgroundColor: '#fff' },
  inputError: { borderColor: '#ef4444' },
  error: { fontSize: 12, color: '#ef4444' },
  apiError: { fontSize: 13, color: '#ef4444', backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, textAlign: 'center' },
  button: { height: 48, backgroundColor: '#4f46e5', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  logoutButton: { height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  logoutText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  switchText: { textAlign: 'center', fontSize: 13, color: '#6b7280', marginTop: 4 },
  switchLink: { color: '#4f46e5', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', width: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 10 },
  modalIcon: { fontSize: 36, color: '#4f46e5', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 20, textAlign: 'center' },
  modalButton: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 32 },
  modalButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
