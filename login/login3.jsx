import { useEffect, useRef, useState } from 'react';
import dashenlogo from '../assets/dashenlogo.png';
import { useAuth } from '../auth/AuthContext.jsx';
import '../styles/login.css';

/* ==========================================================================
   Icons (16x16 grid, currentColor, rounded caps — same language as the app)
   ========================================================================== */
const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="5.2" r="2.6" stroke="currentColor" strokeWidth="1.3" />
    <path d="M2.8 13.2c.6-2.6 2.7-4 5.2-4s4.6 1.4 5.2 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="3.2" y="7.2" width="9.6" height="6.4" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.4 7.2V5.4a2.6 2.6 0 0 1 5.2 0v1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1.6l5.2 1.9v3.9c0 3.4-2.2 5.9-5.2 6.9-3-1-5.2-3.5-5.2-6.9V3.5L8 1.6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M5.8 8l1.6 1.6 2.8-3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const EyeIcon = ({ off }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M1.5 8S3.8 3.5 8 3.5 14.5 8 14.5 8 12.2 12.5 8 12.5 1.5 8 1.5 8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    {off && <path d="M2.5 2.5l11 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />}
  </svg>
);
const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 4.8v3.6M8 10.9h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);


/* ==========================================================================
   Helpers
   ========================================================================== */
const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

/* What to tell the user while the server is still working */
function progressMessage(seconds) {
  if (seconds < 3) return 'Verifying your credentials…';
  if (seconds < 8) return 'Contacting the authentication service…';
  if (seconds < 20) return 'Still working — domain sign-in can take a few seconds.';
  return 'This is taking longer than usual. Please keep this page open.';
}

function errorMessage(err) {
  const status = err?.response?.status;
  if (status === 401) return 'Incorrect username or password.';
  if (status === 403) return err.response?.data?.message || 'Your account is not permitted to sign in. Please contact the administrator.';
  if (status === 423) return err.response?.data?.message || 'Your account is locked. Please contact the administrator.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status >= 500) return 'The service is temporarily unavailable. Please try again shortly.';
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (!err?.response) return 'Network error. Please check your connection.';
  return err.response?.data?.message || 'Sign-in failed. Please try again.';
}

/* ==========================================================================
   LoginScreen
   ========================================================================== */
export default function LoginScreen() {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const passwordRef = useRef(null);
  const submitting = useRef(false); // guards against double submits (Enter + click)

  /* Seconds counter while a sign-in is in flight */
  useEffect(() => {
    if (!loading) { setElapsed(0); return undefined; }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    setError('');

    const user = username.trim();
    if (!user || !password) {
      setError('Please enter both your username and password.');
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      await login(user, password, true);
    } catch (err) {
      setError(errorMessage(err));
      setPassword('');
      setLoading(false);
      submitting.current = false;
      setTimeout(() => passwordRef.current?.focus(), 0);
      return;
    }
    /* On success the app swaps this screen out, so loading stays on until it does. */
    submitting.current = false;
    setLoading(false);
  };

  const slow = loading && elapsed >= 8;

  return (
    <div className="lg-root">


      {/* Brand panel */}
      <aside className="lg-side">
        <div className="lg-side__logo"><img src={dashenlogo} alt="Dashen Bank" /></div>
         <span className="lg-slogan">

                 Always One Step Ahead !
                  </span>
        <div className="lg-side__foot">© {new Date().getFullYear()} Dashen Bank S.C.</div>
      </aside>

      {/* Form panel */}
      <main className="lg-panel">
        <div className="lg-card">
          <div className="lg-eyebrow">Ultimate Beneficial Owner Identification</div>
          <h1 className="lg-title">Ultimate Beneficial Owner Identification &amp; Verification System</h1>
          <p className="lg-sub">Sign in with your domain account to continue.</p>

          <form className="lg-form" onSubmit={handleSubmit} noValidate aria-busy={loading}>
            {error && (
              <div className="lg-error" role="alert" key={error}>
                <AlertIcon /><span>{error}</span>
              </div>
            )}

            <div className="lg-field">
              <label className="lg-label" htmlFor="username">Username</label>
              <div className="lg-wrap">
                <span className="lg-icon"><UserIcon /></span>
                <input
                  id="username" name="username" type="text" className="lg-input"
                  value={username} placeholder="Enter your domain username"
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username" autoCapitalize="none" spellCheck={false}
                  disabled={loading} autoFocus required
                />
              </div>
            </div>

            <div className="lg-field">
              <label className="lg-label" htmlFor="password">
                Password
                {capsOn && <span className="lg-caps" role="status">Caps Lock is on</span>}
              </label>
              <div className="lg-wrap">
                <span className="lg-icon"><LockIcon /></span>
                <input
                  id="password" name="password" ref={passwordRef}
                  type={showPassword ? 'text' : 'password'} className="lg-input lg-input--pw"
                  value={password} placeholder="Enter your password"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCapsOn(e.getModifierState?.('CapsLock') || false)}
                  onBlur={() => setCapsOn(false)}
                  autoComplete="current-password" disabled={loading} required
                />
                <button
                  type="button" className="lg-eye" disabled={loading}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
            </div>

            <button type="submit" className="lg-submit" disabled={loading}>
              {loading
                ? (<><span className="lg-spin" aria-hidden="true" />Signing in…</>)
                : (<>Sign in<span className="lg-submit__arrow" aria-hidden="true">→</span></>)}
            </button>

            {loading && (
              <div className={`lg-progress${slow ? ' lg-progress--slow' : ''}`} role="status" aria-live="polite">
                <div className="lg-progress__bar" />
                <div className="lg-progress__text">
                  <span>{progressMessage(elapsed)}</span>
                  <span className="lg-progress__time">{elapsed}s</span>
                </div>
              </div>
            )}
          </form>

          <div className="lg-foot">
            <span className="lg-foot__badge"><ShieldIcon />In-house system</span>
            <span className="lg-foot__dot" aria-hidden="true">•</span>
            <span>Authorized users only</span>
            {appVersion && (<><span className="lg-foot__dot" aria-hidden="true">•</span><span>v{appVersion}</span></>)}
          </div>
        </div>
      </main>
    </div>
  );
}
