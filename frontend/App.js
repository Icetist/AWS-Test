import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Modal,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

const API = 'http://localhost:5000';
const SW = Dimensions.get('window').width;

// ─── Analytics Constants ──────────────────────────────────────────────────────

const YEARS = ['2019', '2021', '2022', '2023'];

const CHART_COLORS = [
  '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
  '#8b5cf6', '#ec4899', '#84cc16', '#f97316',
];

const DIVISION_MAP = {
  'Dhaka':      ['Dhaka', 'Gazipur', 'Narayanganj', 'Narsingdi', 'Manikganj', 'Munshiganj', 'Faridpur', 'Rajbari', 'Madaripur', 'Shariatpur', 'Gopalganj', 'Kishoreganj', 'Tangail'],
  'Chittagong': ['Chattogram', "Cox's Bazar", 'Rangamati', 'Khagrachhari', 'Bandarban', 'Cumilla', 'Brahmanbaria', 'Chandpur', 'Lakshmipur', 'Feni', 'Noakhali'],
  'Rajshahi':   ['Rajshahi', 'Chapainawabganj', 'Naogaon', 'Natore', 'Pabna', 'Sirajganj', 'Bogura', 'Joypurhat'],
  'Khulna':     ['Khulna', 'Bagerhat', 'Satkhira', 'Jashore', 'Narail', 'Magura', 'Jhenaidah', 'Meherpur', 'Chuadanga', 'Kushtia'],
  'Barisal':    ['Barishal', 'Bhola', 'Pirojpur', 'Jhalokathi', 'Patuakhali', 'Barguna'],
  'Sylhet':     ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
  'Rangpur':    ['Rangpur', 'Gaibandha', 'Nilphamari', 'Lalmonirhat', 'Kurigram', 'Dinajpur', 'Thakurgaon', 'Panchagarh'],
  'Mymensingh': ['Mymensingh', 'Netrokona', 'Jamalpur', 'Sherpur'],
};

function getRateColor(rate) {
  if (rate >= 90) return '#10b981';
  if (rate >= 80) return '#4f46e5';
  if (rate >= 70) return '#f59e0b';
  if (rate >= 60) return '#f97316';
  return '#ef4444';
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substr(0, 2), 16),
    g: parseInt(h.substr(2, 2), 16),
    b: parseInt(h.substr(4, 2), 16),
  };
}

const BASE_CHART_CONFIG = {
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#f8f9ff',
  backgroundGradientFromOpacity: 1,
  backgroundGradientToOpacity: 1,
  color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
  strokeWidth: 2.5,
  barPercentage: 0.62,
  decimalPlaces: 1,
  propsForBackgroundLines: { stroke: '#f3f4f6', strokeWidth: 1 },
  propsForDots: { r: '5', strokeWidth: '2', stroke: '#4f46e5', fill: '#fff' },
};

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

function AlertModal({ visible, message, onClose }) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { borderTopWidth: 4, borderTopColor: '#ef4444' }]}>
          <Text style={[styles.modalIcon, { color: '#ef4444' }]}>!</Text>
          <Text style={styles.modalTitle}>{message}</Text>
          <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#ef4444' }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.modalButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Analytics UI Components ─────────────────────────────────────────────────

function ChartCard({ title, subtitle, note, children }) {
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartCardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.chartCardSubtitle}>{subtitle}</Text> : null}
      <View>{children}</View>
      {note ? (
        <View style={styles.chartNote}>
          <Text style={styles.chartNoteText}>{note}</Text>
        </View>
      ) : null}
    </View>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <View style={[styles.statBadge, { borderLeftColor: color }]}>
      <Text style={[styles.statBadgeValue, { color }]}>{value}%</Text>
      <Text style={styles.statBadgeLabel}>{label}</Text>
    </View>
  );
}

function RankingRow({ rank, name, rate }) {
  const color = getRateColor(rate);
  const barPct = Math.min(rate, 100);
  return (
    <View style={styles.rankingRow}>
      <View style={styles.rankingHeader}>
        <Text style={styles.rankingRank}>#{rank}</Text>
        <Text style={styles.rankingName} numberOfLines={1}>{name}</Text>
        <Text style={[styles.rankingRate, { color }]}>{rate.toFixed(1)}%</Text>
      </View>
      <View style={styles.rankingBarBg}>
        <View style={[styles.rankingBar, { width: `${barPct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function BoardStatCard({ name, rate }) {
  const color = getRateColor(rate);
  return (
    <View style={styles.boardStatCard}>
      <View style={[styles.boardStatRing, { borderColor: color }]}>
        <Text style={[styles.boardStatRate, { color }]}>{rate.toFixed(1)}</Text>
        <Text style={[styles.boardStatPct, { color }]}>%</Text>
      </View>
      <Text style={styles.boardStatName} numberOfLines={2}>{name}</Text>
    </View>
  );
}

function FilterChips({ options, selected, onSelect }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.filterChip, selected === opt && styles.filterChipActive]}
          onPress={() => onSelect(opt)}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterChipText, selected === opt && styles.filterChipTextActive]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
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
    'password-reset': 'password reset',
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

function SignUpScreen({ onNavigateLogin, onOtpRequired, onSignedUp, popupError }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showAlert, setShowAlert] = useState(!!popupError);

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
      <AlertModal
        visible={showAlert}
        message={popupError || ''}
        onClose={() => setShowAlert(false)}
      />
    </Card>
  );
}

// ─── Log In ──────────────────────────────────────────────────────────────────

function LoginScreen({ onNavigateSignUp, onOtpRequired, onForgotPassword }) {
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
      const loginRes = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) { setApiError(loginData.error || 'Login failed'); return; }

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
          right={
            <TouchableOpacity onPress={() => onForgotPassword(form.email)} activeOpacity={0.7}>
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </TouchableOpacity>
          }>
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

// ─── Forgot Password ─────────────────────────────────────────────────────────

function ForgotPasswordScreen({ initialEmail, onBack, onOtpRequired }) {
  const [email, setEmail] = useState(initialEmail || '');
  const [error, setError] = useState('');
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) { setError('Email is required'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email'); return; }
    setError('');
    setApiError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), purpose: 'password-reset' }),
      });
      const data = await res.json();
      if (!res.ok) { setApiError(data.error || 'Failed to send code'); return; }
      onOtpRequired(email.trim().toLowerCase(), 'password-reset', { type: 'reset', email: email.trim().toLowerCase() });
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
        <Text style={styles.title}>Forgot password?</Text>
        <Text style={styles.subtitle}>Enter your email and we'll send a verification code</Text>
      </View>
      <View style={styles.form}>
        {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}
        <Field label="Email" error={error}>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            placeholderTextColor="#adb5bd"
            placeholder="jane@example.com"
            value={email}
            onChangeText={(v) => { setEmail(v); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>
        <PrimaryButton label="Send Code" onPress={handleSend} loading={loading} />
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <Text style={[styles.switchText, { marginTop: 0 }]}>
            Back to{' '}
            <Text style={styles.switchLink}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ─── Reset Password ───────────────────────────────────────────────────────────

function ResetPasswordScreen({ email, onDone }) {
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const focus = (key) => () => setFocused(key);
  const blur = () => setFocused(null);

  const validate = () => {
    const e = {};
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
      const res = await fetch(`${API}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) { setApiError(data.error || 'Reset failed'); return; }
      setShowSuccess(true);
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
        <Text style={styles.title}>Set new password</Text>
        <Text style={styles.subtitle}>Choose a new password for</Text>
        <Text style={styles.otpEmail}>{email}</Text>
      </View>
      <View style={styles.form}>
        {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}
        <Field label="New Password" error={errors.password}>
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
        <PrimaryButton label="Update Password" onPress={handleSubmit} loading={loading} />
      </View>
      <SuccessModal
        visible={showSuccess}
        message="Password updated! You can now log in."
        onClose={onDone}
      />
    </Card>
  );
}

// ─── Profile Dashboard ────────────────────────────────────────────────────────

function ProfileScreen({ user, onLogout, onOtpRequired, savedAt, onNavigateAnalytics }) {
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

          {/* Analytics CTA */}
          <TouchableOpacity style={styles.analyticsCta} onPress={onNavigateAnalytics} activeOpacity={0.8}>
            <View>
              <Text style={styles.analyticsCtaTitle}>HSC Analytics Dashboard</Text>
              <Text style={styles.analyticsCtaSubtitle}>Bangladesh pass rates · 64 districts · 2019–2023</Text>
            </View>
            <Text style={styles.analyticsCtaArrow}>›</Text>
          </TouchableOpacity>

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

// ─── Analytics Screen ─────────────────────────────────────────────────────────

function AnalyticsScreen({ user, onLogout, onBack }) {
  const [hscData, setHscData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedYear, setSelectedYear] = useState('2023');
  const [selectedDivision, setSelectedDivision] = useState('All');

  const CW = Math.min(SW - 32, 440);

  const doFetch = () => {
    setLoading(true);
    setFetchError('');
    fetch(`${API}/hsc-data`)
      .then((r) => r.json())
      .then((d) => { setHscData(d); setLoading(false); })
      .catch(() => { setFetchError('Could not load data. Is the backend running?'); setLoading(false); });
  };

  useEffect(() => { doFetch(); }, []);

  // ── Computed values ──────────────────────────────────────────────────────────

  const nationalTrend = useMemo(() => {
    if (!hscData?.national) return null;
    const vals = YEARS.map((y) => hscData.national[y] || 0);
    if (vals.every((v) => v === 0)) return null;
    return {
      labels: YEARS,
      datasets: [{ data: vals, color: (o = 1) => `rgba(79, 70, 229, ${o})`, strokeWidth: 3 }],
    };
  }, [hscData]);

  const boardComparison = useMemo(() => {
    if (!hscData?.boards) return [];
    return Object.entries(hscData.boards)
      .map(([name, data]) => ({ name, rate: data[selectedYear] || 0 }))
      .filter((e) => e.rate > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [hscData, selectedYear]);

  const boardTrends = useMemo(() => {
    if (!hscData?.boards) return null;
    const entries = Object.entries(hscData.boards);
    return {
      labels: YEARS,
      datasets: entries.map(([, data], i) => {
        const { r, g, b } = hexToRgb(CHART_COLORS[i % CHART_COLORS.length]);
        return {
          data: YEARS.map((y) => data[y] || 0),
          color: (o = 1) => `rgba(${r}, ${g}, ${b}, ${o})`,
          strokeWidth: 2.5,
        };
      }),
      legend: entries.map(([name]) => name),
    };
  }, [hscData]);

  const divisionAverages = useMemo(() => {
    if (!hscData?.districts) return [];
    return Object.entries(DIVISION_MAP)
      .map(([div, districts]) => {
        const rates = districts
          .map((d) => hscData.districts[d]?.[selectedYear])
          .filter((r) => r != null && r > 0);
        const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
        return { div, avg: parseFloat(avg.toFixed(2)), count: rates.length };
      })
      .filter((d) => d.avg > 0)
      .sort((a, b) => b.avg - a.avg);
  }, [hscData, selectedYear]);

  const districtRanking = useMemo(() => {
    if (!hscData?.districts) return [];
    let entries = Object.entries(hscData.districts)
      .map(([name, data]) => ({ name, rate: data[selectedYear] || 0, board: data.board }))
      .filter((e) => e.rate > 0);
    if (selectedDivision !== 'All') {
      const divDists = DIVISION_MAP[selectedDivision] || [];
      entries = entries.filter((e) => divDists.includes(e.name));
    }
    return entries.sort((a, b) => b.rate - a.rate);
  }, [hscData, selectedYear, selectedDivision]);

  const passRateDistribution = useMemo(() => {
    if (!hscData?.districts) return null;
    let rates = Object.entries(hscData.districts)
      .map(([, data]) => data[selectedYear])
      .filter((r) => r != null && r > 0);
    if (selectedDivision !== 'All') {
      const divDists = DIVISION_MAP[selectedDivision] || [];
      rates = Object.entries(hscData.districts)
        .filter(([name]) => divDists.includes(name))
        .map(([, data]) => data[selectedYear])
        .filter((r) => r != null && r > 0);
    }
    const bins = [
      { label: '≥ 90%', min: 90, max: 101, color: '#10b981' },
      { label: '80–89%', min: 80, max: 90, color: '#4f46e5' },
      { label: '70–79%', min: 70, max: 80, color: '#f59e0b' },
      { label: '60–69%', min: 60, max: 70, color: '#f97316' },
      { label: '< 60%', min: 0, max: 60, color: '#ef4444' },
    ];
    return bins
      .map((bin) => ({
        name: bin.label,
        value: rates.filter((r) => r >= bin.min && r < bin.max).length,
        color: bin.color,
        legendFontColor: '#374151',
        legendFontSize: 12,
      }))
      .filter((d) => d.value > 0);
  }, [hscData, selectedYear, selectedDivision]);

  // ── Tab renders ──────────────────────────────────────────────────────────────

  const renderOverview = () => {
    const nat = hscData?.national || {};
    return (
      <View>
        {/* National stat badges */}
        <Text style={styles.analyticsSectionLabel}>NATIONAL PASS RATES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {[...YEARS].reverse().map((y) => (
            <StatBadge key={y} label={`HSC ${y}`} value={nat[y] ? nat[y].toFixed(1) : '—'} color={getRateColor(nat[y] || 0)} />
          ))}
        </ScrollView>

        {/* National trend line */}
        {nationalTrend && (
          <ChartCard
            title="National Pass Rate Trend"
            subtitle="All boards combined · 2019–2023"
            note="2021 pass rate (95.57%) is elevated due to an abbreviated COVID-19 syllabus — not comparable with other years."
          >
            <LineChart
              data={nationalTrend}
              width={CW}
              height={210}
              chartConfig={BASE_CHART_CONFIG}
              bezier
              yAxisSuffix="%"
              style={styles.chart}
              withShadow={false}
              withInnerLines
            />
          </ChartCard>
        )}

        {/* Board comparison */}
        {boardComparison.length > 0 && (
          <ChartCard title="Board Performance" subtitle={`Pass rate by education board · ${selectedYear}`}>
            <FilterChips options={YEARS} selected={selectedYear} onSelect={setSelectedYear} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              <BarChart
                data={{
                  labels: boardComparison.map((b) => b.name.slice(0, 7)),
                  datasets: [{ data: boardComparison.map((b) => b.rate) }],
                }}
                width={Math.max(boardComparison.length * 74, CW)}
                height={230}
                chartConfig={BASE_CHART_CONFIG}
                style={styles.chart}
                yAxisSuffix="%"
                fromZero={false}
                showValuesOnTopOfBars
              />
            </ScrollView>
          </ChartCard>
        )}

        {/* Distribution pie */}
        {passRateDistribution && passRateDistribution.length > 0 && (
          <ChartCard
            title="District Pass Rate Distribution"
            subtitle={`All 64 districts grouped by category · ${selectedYear}`}
          >
            <PieChart
              data={passRateDistribution}
              width={CW}
              height={200}
              chartConfig={BASE_CHART_CONFIG}
              accessor="value"
              backgroundColor="transparent"
              paddingLeft="16"
              style={styles.chart}
              absolute
            />
          </ChartCard>
        )}
      </View>
    );
  };

  const renderDistricts = () => (
    <View>
      {/* Filters */}
      <View style={styles.analyticsFilters}>
        <Text style={styles.analyticsFilterLabel}>YEAR</Text>
        <FilterChips options={YEARS} selected={selectedYear} onSelect={setSelectedYear} />
        <Text style={[styles.analyticsFilterLabel, { marginTop: 10 }]}>DIVISION</Text>
        <FilterChips
          options={['All', ...Object.keys(DIVISION_MAP)]}
          selected={selectedDivision}
          onSelect={setSelectedDivision}
        />
      </View>

      {/* Division averages — shown only when 'All' selected */}
      {selectedDivision === 'All' && divisionAverages.length > 0 && (
        <ChartCard
          title="Division Average Pass Rates"
          subtitle={`Average across all districts in each division · ${selectedYear}`}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <BarChart
              data={{
                labels: divisionAverages.map((d) => d.div.slice(0, 6)),
                datasets: [{ data: divisionAverages.map((d) => d.avg) }],
              }}
              width={Math.max(divisionAverages.length * 72, CW)}
              height={230}
              chartConfig={BASE_CHART_CONFIG}
              style={styles.chart}
              yAxisSuffix="%"
              fromZero={false}
              showValuesOnTopOfBars
            />
          </ScrollView>
        </ChartCard>
      )}

      {/* Top districts ranking */}
      {districtRanking.length > 0 && (
        <ChartCard
          title={`Top Districts${selectedDivision !== 'All' ? ` — ${selectedDivision}` : ''}`}
          subtitle={`Highest pass rates · ${selectedYear}`}
        >
          {districtRanking.slice(0, 10).map((d, i) => (
            <RankingRow key={d.name} rank={i + 1} name={d.name} rate={d.rate} />
          ))}
        </ChartCard>
      )}

      {/* Bottom districts */}
      {districtRanking.length > 10 && (
        <ChartCard
          title={`Bottom Districts${selectedDivision !== 'All' ? ` — ${selectedDivision}` : ''}`}
          subtitle={`Lowest pass rates · ${selectedYear}`}
        >
          {[...districtRanking]
            .reverse()
            .slice(0, Math.min(10, districtRanking.length - 10))
            .map((d, i) => (
              <RankingRow key={d.name} rank={districtRanking.length - i} name={d.name} rate={d.rate} />
            ))}
        </ChartCard>
      )}

      {/* Distribution pie */}
      {passRateDistribution && passRateDistribution.length > 0 && (
        <ChartCard
          title={`Pass Rate Categories${selectedDivision !== 'All' ? ` — ${selectedDivision}` : ''}`}
          subtitle={`How districts are distributed · ${selectedYear}`}
        >
          <PieChart
            data={passRateDistribution}
            width={CW}
            height={200}
            chartConfig={BASE_CHART_CONFIG}
            accessor="value"
            backgroundColor="transparent"
            paddingLeft="16"
            style={styles.chart}
            absolute
          />
        </ChartCard>
      )}
    </View>
  );

  const renderBoards = () => (
    <View>
      {/* Year filter */}
      <View style={styles.analyticsFilters}>
        <Text style={styles.analyticsFilterLabel}>YEAR</Text>
        <FilterChips options={YEARS} selected={selectedYear} onSelect={setSelectedYear} />
      </View>

      {/* Board stat grid */}
      {boardComparison.length > 0 && (
        <ChartCard title="Board Rankings" subtitle={`Pass rate by education board · ${selectedYear}`}>
          <View style={styles.boardGrid}>
            {boardComparison.map((b) => (
              <BoardStatCard key={b.name} name={b.name} rate={b.rate} />
            ))}
          </View>
        </ChartCard>
      )}

      {/* Board trends multi-line */}
      {boardTrends && (
        <ChartCard
          title="Board Trends Over Time"
          subtitle="All 9 education boards · 2019–2023"
          note="2021 values are elevated due to the COVID-19 abbreviated syllabus — Dinajpur, Mymensingh and Sylhet dropped significantly in 2023."
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              data={boardTrends}
              width={Math.max(CW, 520)}
              height={300}
              chartConfig={BASE_CHART_CONFIG}
              bezier={false}
              yAxisSuffix="%"
              style={styles.chart}
              withShadow={false}
              withDots
              withLegend
            />
          </ScrollView>
        </ChartCard>
      )}

      {/* Board ranking list */}
      {boardComparison.length > 0 && (
        <ChartCard title="Detailed Board Ranking" subtitle={`Sorted by pass rate · ${selectedYear}`}>
          {boardComparison.map((b, i) => (
            <RankingRow key={b.name} rank={i + 1} name={`${b.name} Board`} rate={b.rate} />
          ))}
        </ChartCard>
      )}
    </View>
  );

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.analyticsWrapper}>
      {/* Header */}
      <View style={styles.analyticsHeader}>
        <TouchableOpacity style={styles.analyticsBackBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.analyticsBackText}>{'←'}</Text>
        </TouchableOpacity>
        <View style={styles.analyticsHeaderCenter}>
          <Text style={styles.analyticsTitle}>HSC Analytics</Text>
          <Text style={styles.analyticsHeaderSub}>Bangladesh · 2019–2023</Text>
        </View>
        <TouchableOpacity style={styles.analyticsLogoutBtn} onPress={onLogout} activeOpacity={0.7}>
          <Text style={styles.analyticsLogoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.analyticsTabBar}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'districts', label: 'Districts' },
          { key: 'boards', label: 'Boards' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.analyticsTab, activeTab === tab.key && styles.analyticsTabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.analyticsTabText, activeTab === tab.key && styles.analyticsTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.analyticsCenter}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.analyticsLoadingText}>Loading analytics data…</Text>
          <Text style={styles.analyticsLoadingHint}>Fetching from AWS DynamoDB</Text>
        </View>
      ) : fetchError ? (
        <View style={styles.analyticsCenter}>
          <Text style={styles.analyticsErrorText}>{fetchError}</Text>
          <TouchableOpacity style={[styles.button, { marginTop: 16, width: 140 }]} onPress={doFetch}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.analyticsScroll}
          contentContainerStyle={styles.analyticsScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'districts' && renderDistricts()}
          {activeTab === 'boards' && renderBoards()}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
      <StatusBar style="light" />
    </View>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('signup');
  const [user, setUser] = useState(null);
  const [otpState, setOtpState] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');

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
      setScreen('profile');
      try {
        const res = await fetch(`${API}/user/${onVerified.userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(onVerified.body),
        });
        if (res.ok) setSavedAt(Date.now());
      } catch { /* network error */ }
    } else if (onVerified && typeof onVerified === 'object' && onVerified.type === 'reset') {
      setResetEmail(onVerified.email);
      setScreen('reset-password');
    } else if (typeof onVerified === 'function') {
      onVerified();
    } else {
      setUser(onVerified);
      setScreen('profile');
    }
  };

  // ── Forgot / reset password ───────────────────────────────────────────────
  if (screen === 'forgot-password') {
    return (
      <ForgotPasswordScreen
        initialEmail={forgotEmail}
        onBack={() => setScreen('login')}
        onOtpRequired={(email, purpose, onVerified) => handleOtpRequired(email, purpose, onVerified)}
      />
    );
  }

  if (screen === 'reset-password') {
    return (
      <ResetPasswordScreen
        email={resetEmail}
        onDone={() => setScreen('login')}
      />
    );
  }

  // ── Auth guard for analytics ──────────────────────────────────────────────
  if (screen === 'analytics' && !user) {
    return (
      <SignUpScreen
        onNavigateLogin={() => setScreen('login')}
        onOtpRequired={(email, purpose, onVerified) => handleOtpRequired(email, purpose, onVerified)}
        onSignedUp={(form) => completeSignup(form)}
        popupError="Please sign up or log in to view this page."
      />
    );
  }

  if (screen === 'analytics' && user) {
    return (
      <AnalyticsScreen
        user={user}
        onLogout={() => { setUser(null); setScreen('login'); }}
        onBack={() => setScreen('profile')}
      />
    );
  }

  if (screen === 'otp' && otpState) {
    return (
      <OtpScreen
        email={otpState.email}
        purpose={otpState.purpose}
        onVerified={handleOtpVerified}
        onBack={() => {
          setOtpState(null);
          setScreen(
            otpState.purpose === 'login' ? 'login'
              : otpState.purpose === 'password-change' ? 'profile'
                : otpState.purpose === 'password-reset' ? 'forgot-password'
                  : 'signup'
          );
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
        onNavigateAnalytics={() => setScreen('analytics')}
      />
    );
  }

  if (screen === 'login') {
    return (
      <LoginScreen
        onNavigateSignUp={() => setScreen('signup')}
        onOtpRequired={(email, purpose, userData) => handleOtpRequired(email, purpose, userData)}
        onForgotPassword={(email) => { setForgotEmail(email); setScreen('forgot-password'); }}
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
  // ── Auth screens ────────────────────────────────────────────────────────────
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
  profileHeader: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  memberSince: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 20, marginTop: 4 },
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

  // ── Analytics CTA in Profile ─────────────────────────────────────────────
  analyticsCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ede9fe', borderRadius: 14, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#c4b5fd',
  },
  analyticsCtaTitle: { fontSize: 14, fontWeight: '700', color: '#4f46e5' },
  analyticsCtaSubtitle: { fontSize: 12, color: '#7c3aed', marginTop: 2 },
  analyticsCtaArrow: { fontSize: 24, color: '#4f46e5', fontWeight: '700' },

  // ── Analytics Screen ────────────────────────────────────────────────────────
  analyticsWrapper: { flex: 1, backgroundColor: '#f0f2f5' },
  analyticsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#4f46e5',
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 16, paddingHorizontal: 16,
  },
  analyticsHeaderCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  analyticsTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  analyticsHeaderSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  analyticsBackBtn: { padding: 4, minWidth: 36 },
  analyticsBackText: { fontSize: 22, color: '#ffffff', fontWeight: '600' },
  analyticsLogoutBtn: {
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)',
  },
  analyticsLogoutText: { fontSize: 12, color: '#ffffff', fontWeight: '600' },

  analyticsTabBar: {
    flexDirection: 'row', backgroundColor: '#ffffff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  analyticsTab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  analyticsTabActive: { borderBottomColor: '#4f46e5' },
  analyticsTabText: { fontSize: 14, fontWeight: '500', color: '#9ca3af' },
  analyticsTabTextActive: { color: '#4f46e5', fontWeight: '700' },

  analyticsScroll: { flex: 1 },
  analyticsScrollContent: { padding: 16 },

  analyticsCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  analyticsLoadingText: { marginTop: 14, fontSize: 15, fontWeight: '600', color: '#374151' },
  analyticsLoadingHint: { marginTop: 4, fontSize: 12, color: '#9ca3af' },
  analyticsErrorText: { fontSize: 14, color: '#ef4444', textAlign: 'center', lineHeight: 22 },

  analyticsSectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#6b7280',
    letterSpacing: 0.8, marginBottom: 8,
  },
  analyticsFilters: { marginBottom: 4 },
  analyticsFilterLabel: {
    fontSize: 11, fontWeight: '700', color: '#6b7280',
    letterSpacing: 0.8, marginBottom: 6,
  },

  // ── Chart cards ─────────────────────────────────────────────────────────────
  chartCard: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  chartCardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  chartCardSubtitle: { fontSize: 12, color: '#6b7280', marginBottom: 10 },
  chart: { borderRadius: 10, marginTop: 4 },
  chartNote: {
    marginTop: 12, padding: 10, backgroundColor: '#fffbeb',
    borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#f59e0b',
  },
  chartNoteText: { fontSize: 11, color: '#92400e', lineHeight: 16 },

  // ── Stat badges ─────────────────────────────────────────────────────────────
  statBadge: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginRight: 10,
    borderLeftWidth: 4, minWidth: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statBadgeValue: { fontSize: 24, fontWeight: '800' },
  statBadgeLabel: { fontSize: 11, color: '#6b7280', marginTop: 3, fontWeight: '500' },

  // ── Filter chips ─────────────────────────────────────────────────────────────
  filterRow: { marginBottom: 4 },
  filterChip: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, marginRight: 8,
    backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: '#e5e7eb',
  },
  filterChipActive: { backgroundColor: '#ede9fe', borderColor: '#4f46e5' },
  filterChipText: { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  filterChipTextActive: { color: '#4f46e5', fontWeight: '700' },

  // ── District ranking rows ────────────────────────────────────────────────────
  rankingRow: { marginBottom: 10 },
  rankingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rankingRank: { fontSize: 11, fontWeight: '700', color: '#d1d5db', width: 26, marginRight: 2 },
  rankingName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
  rankingRate: { fontSize: 14, fontWeight: '800' },
  rankingBarBg: { height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden' },
  rankingBar: { height: 6, borderRadius: 3 },

  // ── Board stat cards (3-column grid) ────────────────────────────────────────
  boardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  boardStatCard: {
    width: '30%', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4,
    backgroundColor: '#f8f9ff', borderRadius: 12,
  },
  boardStatRing: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 4,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  boardStatRate: { fontSize: 16, fontWeight: '800', lineHeight: 18 },
  boardStatPct: { fontSize: 10, fontWeight: '600', lineHeight: 12 },
  boardStatName: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center' },
});
