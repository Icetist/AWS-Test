# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack app with a **Flask REST API** (`backend/`) and an **Expo React Native frontend** (`frontend/`). Auth is email-OTP based (no sessions/JWTs). AWS DynamoDB stores users and OTPs; AWS SES sends OTP emails. The app currently has signup, login, and profile-update screens.

There is also a data pipeline (`collect_hsc.py`) that scrapes HSC exam pass-rate statistics and uploads them to DynamoDB.

---

## Commands

### Backend

All Python work uses the venv at `./venv/`:

```bash
source venv/bin/activate
```

```bash
# Run the Flask dev server (port 5000)
python backend/app.py

# Run all backend tests
pytest backend/tests/

# Run a single test file or test
pytest backend/tests/test_app.py::TestSignup::test_signup_success
```

### Frontend

```bash
cd frontend
npm install       # first time
npm start         # Expo dev server (choose web/iOS/Android from the menu)
npm test          # Jest test suite
npx jest --testNamePattern="saves after OTP"   # run a single test by name
```

### Data pipeline

```bash
source venv/bin/activate
python collect_hsc.py          # scrape & write ./Data/hsc_pass_rates.xlsx
```

---

## AWS / DynamoDB

Region: `us-west-2`. Credentials are in `~/.aws/credentials`.

| Table | Purpose |
|---|---|
| `tt-saahil-users` | User accounts (`userId` PK) |
| `tt-saahil-otps` | In-flight OTPs (`email` PK) |
| `tt-saahil-hsc-pass-rates` | HSC pass-rate statistics (`pk`=district, `sk`=`year#group`) |

The HSC table key pattern: `pk` = district/scope name (e.g. `"Dhaka"`, `"Barisal Board Total"`, `"National"`); `sk` = `"<year>#<group>"` (e.g. `"2023#All Groups"`).

---

## Architecture

### Auth flow

OTP is always verified client-side before the actual API action is taken. The flow for every protected action is:

1. Frontend calls `POST /send-otp` → backend stores OTP in `tt-saahil-otps` and emails it via SES.
2. User enters code → frontend calls `POST /verify-otp`.
3. Frontend then calls the real endpoint (`POST /signup`, `POST /login`, or `PUT /user/:id`).

There is a 60-second rate limit on resending OTPs.

### Frontend navigation (App.js)

Navigation is **pure state** — no router library. `App()` holds `screen` (string) and `otpState` (object or null). The active screen is selected by conditionals at the bottom of `App()`.

The OTP screen is shown when `otpState !== null`. After the user verifies, `handleOtpVerified` in `App()` inspects `otpState.onVerified`:

- **Function** → signup: calls `completeSignup(form)` to hit `POST /signup`.
- **Object `{ type: 'save', userId, body }`** → password-change: calls `PUT /user/:id`, then sets `savedAt = Date.now()`.
- **User data object** → login: sets `user` state directly.

`ProfileScreen` receives `savedAt` as a prop and uses a `useEffect([savedAt])` to show the success modal whenever it changes.

### Backend (backend/app.py)

Single-file Flask app. DynamoDB resources are module-level globals. `table.scan()` is used for email lookups (no GSI — acceptable at current scale).

### Tests

**Backend** (`pytest`): mocks `app.table` and `app.otp_table` at the module level using `@patch('app.table')`. No real AWS calls are made.

**Frontend** (`jest-expo` + `@testing-library/react-native`): mocks `global.fetch`. Tests render `<App />` and drive interactions through the component tree. The `jest` config is in `frontend/package.json`.

---

## Expo note

Expo version is **56**. Read versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any Expo-specific code.
