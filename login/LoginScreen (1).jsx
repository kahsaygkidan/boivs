import { useEffect, useRef, useState } from 'react';
import dashenlogo from '../assets/dashenlogo.png';
import { useAuth } from '../auth/AuthContext.jsx';
import '../styles/login.css';

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3.5 17c.7-3.2 3.1-4.9 6.5-4.9s5.8 1.7 6.5 4.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="3.8" y="8.5" width="12.4" height="8.2" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6.5 8.5V6.2a3.5 3.5 0 0 1 7 0v2.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 2.1 16 4.3v4.5c0 4-2.5 7-6 8.2-3.5-1.2-6-4.2-6-8.2V4.3l6-2.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="m7.3 9.7 1.8 1.8 3.7-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeIcon = ({ off }) => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M1.8 10s2.9-5 8.2-5 8.2 5 8.2 5-2.9 5-8.2 5-8.2-5-8.2-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.5" />
    {off && <path d="m3 3 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
  </svg>
);

const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 6.2v4.2m0 3h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

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
  const submitting = useRef(false);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return undefined;
    }
    const id = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(id);
  }, [loading]);

  const handleSubmit = async (event) => {
    event.preventDefault();
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
      window.setTimeout(() => passwordRef.current?.focus(), 0);
      return;
    }

    // On success the application replaces this screen.
    submitting.current = false;
    setLoading(false);
  };

  const slow = loading && elapsed >= 8;

  return (
    <div className="lg-root">
      <aside className="lg-side" aria-label="Dashen Bank">
        <div className="lg-side__pattern" aria-hidden="true" />

        <div className="lg-side__top">
          <div className="lg-side__logo">
            <img src={dashenlogo} alt="Dashen Bank" />
          </div>
        </div>

        <div className="lg-side__center">
          <span className="lg-side__kicker">Corporate security platform</span>
          <div className="lg-side__divider" aria-hidden="true" />
          <h2 className="lg-side__tagline">
            Ultimate Beneficial Owner
            <span>Identification &amp; Verification</span>
          </h2>
          <p className="lg-side__slogan">Always One Step Ahead!</p>
        </div>

        <div className="lg-side__foot">
          <span className="lg-side__foot-line" />
          <span>© {new Date().getFullYear()} Dashen Bank S.C.</span>
        </div>
      </aside>

      <main className="lg-panel">
        <div className="lg-panel__glow" aria-hidden="true" />

        <section className="lg-card" aria-labelledby="login-title">
          <div className="lg-card__topline" aria-hidden="true" />

          <div className="lg-card__intro">
            <div className="lg-eyebrow">
              <span className="lg-eyebrow__dot" />
              Secure access
            </div>
            <h1 className="lg-title" id="login-title">Welcome back</h1>
            <p className="lg-sub">Sign in with your domain account to continue to your workspace.</p>
          </div>

          <form className="lg-form" onSubmit={handleSubmit} noValidate aria-busy={loading}>
            {error && (
              <div className="lg-error" role="alert" key={error}>
                <AlertIcon />
                <span>{error}</span>
              </div>
            )}

            <div className="lg-field">
              <label className="lg-label" htmlFor="username">Username</label>
              <div className="lg-wrap">
                <span className="lg-icon"><UserIcon /></span>
                <input
                  id="username"
                  name="username"
                  type="text"
                  className="lg-input"
                  value={username}
                  placeholder="Enter your domain username"
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={loading}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="lg-field">
              <div className="lg-label-row">
                <label className="lg-label" htmlFor="password">Password</label>
                {capsOn && <span className="lg-caps" role="status">Caps Lock is on</span>}
              </div>
              <div className="lg-wrap">
                <span className="lg-icon"><LockIcon /></span>
                <input
                  id="password"
                  name="password"
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  className="lg-input lg-input--password"
                  value={password}
                  placeholder="Enter your password"
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyUp={(event) => setCapsOn(event.getModifierState?.('CapsLock') || false)}
                  onBlur={() => setCapsOn(false)}
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="lg-eye"
                  disabled={loading}
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <EyeIcon off={showPassword} />
                </button>
              </div>
            </div>

            <button type="submit" className="lg-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="lg-spin" aria-hidden="true" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <span className="lg-submit__arrow" aria-hidden="true">→</span>
                </>
              )}
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

          <footer className="lg-foot">
            <div className="lg-foot__security">
              <span className="lg-foot__badge"><ShieldIcon />Protected environment</span>
              <span className="lg-foot__dot" aria-hidden="true">•</span>
              <span>Authorized users only</span>
            </div>
            {appVersion && <span className="lg-foot__version">Version {appVersion}</span>}
          </footer>
        </section>

        <p className="lg-panel__copyright">Dashen Bank S.C. <span>·</span> Secure enterprise access</p>
      </main>
    </div>
  );
}
