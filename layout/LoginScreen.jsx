import { useEffect, useRef, useState } from 'react';
import dashenlogo from '../assets/dashenlogo.png';
import { useAuth } from '../auth/AuthContext.jsx';

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
   Styles (scoped with the lg- prefix)
   ========================================================================== */
const css = `
.lg-root { --lg-brand:#283375; --lg-brand-2:#3b4aa8; --lg-accent:#7ea6ff; --lg-text:#0f172a; --lg-muted:#64748b; --lg-border:#dfe3ee;
  display:grid; grid-template-columns:minmax(360px, 46%) 1fr; min-height:100vh; min-height:100dvh; box-sizing:border-box;
  font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:var(--lg-text); background:#f5f7fc; }
.lg-root *, .lg-root *::before, .lg-root *::after { box-sizing:border-box; }

/* Brand panel */
.lg-side { position:relative; overflow:hidden; display:flex; flex-direction:column; align-items:flex-start; justify-content:space-between; padding:48px 56px;
  color:#fff; background:linear-gradient(155deg, #3342a0 0%, #283375 48%, #1b2354 100%); }
.lg-side::before, .lg-side::after { content:''; position:absolute; border-radius:50%; pointer-events:none; }
.lg-side::before { width:520px; height:520px; right:-200px; top:-160px; background:radial-gradient(circle, rgba(126,166,255,.30), transparent 68%); }
.lg-side::after { width:460px; height:460px; left:-180px; bottom:-200px; background:radial-gradient(circle, rgba(255,255,255,.10), transparent 70%); }
.lg-side__logo { position:relative; z-index:1; display:inline-flex; align-items:center; padding:12px 16px; border-radius:16px;
  background:rgba(255,255,255,.10); box-shadow:inset 0 0 0 1px rgba(255,255,255,.16); backdrop-filter:blur(6px); }
.lg-side__logo img { display:block; height:40px; width:auto; object-fit:contain; }
.lg-side__hero { position:relative; z-index:1; max-width:420px; }
.lg-slogan { display:flex; flex-direction:column; line-height:1.05; letter-spacing:-.03em; }
.lg-slogan span { font-size:22px; font-weight:500; color:#c9d3ff; letter-spacing:-.01em; margin-bottom:6px; }
.lg-slogan strong { font-size:60px; font-weight:800; color:#fff; }
.lg-side__lead { margin:20px 0 0; font-size:14.5px; line-height:1.6; color:#b9c3ef; }
.lg-side__foot { position:relative; z-index:1; font-size:12px; color:#8f9bd0; }

/* Form panel */
.lg-panel { display:flex; align-items:center; justify-content:center; padding:40px 24px; }
.lg-card { width:100%; max-width:430px; }
.lg-eyebrow { font-size:12px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--lg-brand-2); margin-bottom:8px; }
.lg-title { margin:0; font-size:27px; font-weight:750; letter-spacing:-.025em; line-height:1.2; }
.lg-sub { margin:8px 0 26px; font-size:14px; line-height:1.55; color:var(--lg-muted); }

.lg-form { display:flex; flex-direction:column; gap:18px; }
.lg-error { display:flex; align-items:flex-start; gap:10px; padding:11px 14px; border-radius:12px; font-size:13.5px; line-height:1.45;
  color:#b91c1c; background:rgba(220,38,38,.07); border:1px solid rgba(220,38,38,.25); animation:lg-shake .35s ease; }
.lg-error svg { flex-shrink:0; margin-top:1px; }

.lg-field { display:flex; flex-direction:column; gap:7px; }
.lg-label { display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:650; color:#1e293b; }
.lg-caps { font-size:11.5px; font-weight:650; color:#b45309; }
.lg-wrap { position:relative; }
.lg-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); display:inline-flex; color:#94a3b8; pointer-events:none; transition:color .15s; }
.lg-input { width:100%; height:48px; padding:0 14px 0 42px; border:1px solid var(--lg-border); border-radius:12px; background:#fff; font:inherit; font-size:14.5px; color:var(--lg-text);
  transition:border-color .15s, box-shadow .15s, background .15s; }
.lg-input::placeholder { color:#a3adc2; }
.lg-input:hover:not(:disabled) { border-color:#c3cadf; }
.lg-input:focus { outline:none; border-color:var(--lg-brand-2); box-shadow:0 0 0 4px rgba(59,74,168,.14); }
.lg-wrap:focus-within .lg-icon { color:var(--lg-brand-2); }
.lg-input:disabled { background:#f1f4fa; color:#7c879f; cursor:not-allowed; }
.lg-input--pw { padding-right:46px; }
.lg-eye { position:absolute; right:6px; top:50%; transform:translateY(-50%); display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px;
  border:0; border-radius:9px; background:transparent; color:#7c879f; cursor:pointer; }
.lg-eye:hover:not(:disabled) { background:#eef1f8; color:var(--lg-brand); }
.lg-eye:focus-visible { outline:2px solid var(--lg-brand-2); }

.lg-submit { position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; gap:10px; width:100%; height:50px; margin-top:4px;
  border:0; border-radius:12px; cursor:pointer; font:inherit; font-size:15px; font-weight:650; letter-spacing:.01em; color:#fff;
  background:linear-gradient(135deg, var(--lg-brand-2) 0%, var(--lg-brand) 100%); box-shadow:0 8px 20px rgba(40,51,117,.28);
  transition:transform .15s, box-shadow .15s, opacity .15s; }
.lg-submit:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 12px 26px rgba(40,51,117,.34); }
.lg-submit:active:not(:disabled) { transform:translateY(0); }
.lg-submit:focus-visible { outline:3px solid rgba(59,74,168,.4); outline-offset:2px; }
.lg-submit:disabled { cursor:progress; opacity:.92; }
.lg-submit__arrow { transition:transform .15s; }
.lg-submit:hover:not(:disabled) .lg-submit__arrow { transform:translateX(3px); }
.lg-spin { width:18px; height:18px; border-radius:50%; border:2.5px solid rgba(255,255,255,.35); border-top-color:#fff; animation:lg-spin .7s linear infinite; }

/* Progress feedback while signing in */
.lg-progress { margin-top:2px; }
.lg-progress__bar { height:4px; border-radius:999px; background:#e4e8f4; overflow:hidden; }
.lg-progress__bar::after { content:''; display:block; height:100%; width:40%; border-radius:inherit; background:linear-gradient(90deg, var(--lg-brand-2), var(--lg-accent)); animation:lg-slide 1.3s ease-in-out infinite; }
.lg-progress__text { display:flex; justify-content:space-between; gap:12px; margin-top:9px; font-size:12.5px; color:var(--lg-muted); }
.lg-progress__time { font-variant-numeric:tabular-nums; color:#94a3b8; }
.lg-progress--slow .lg-progress__text span:first-child { color:#b45309; }

.lg-foot { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:8px 12px; margin-top:30px; padding-top:20px; border-top:1px solid #e6e9f3; font-size:12px; color:var(--lg-muted); }
.lg-foot__badge { display:inline-flex; align-items:center; gap:7px; padding:4px 11px; border-radius:999px; font-weight:600; color:var(--lg-brand); background:rgba(40,51,117,.07); }
.lg-foot__dot { color:#c3cadf; }

@keyframes lg-spin { to { transform:rotate(360deg); } }
@keyframes lg-slide { 0% { transform:translateX(-110%); } 100% { transform:translateX(270%); } }
@keyframes lg-shake { 0%,100% { transform:translateX(0); } 25% { transform:translateX(-5px); } 75% { transform:translateX(5px); } }

@media (max-width:900px) {
  .lg-root { grid-template-columns:1fr; grid-template-rows:auto 1fr; }
  .lg-side { flex-direction:row; align-items:center; padding:20px 24px; }
  .lg-side__hero, .lg-side__foot { display:none; }
  .lg-side__logo img { height:32px; }
  .lg-panel { align-items:flex-start; padding-top:32px; }
}
@media (prefers-reduced-motion: reduce) { .lg-spin, .lg-progress__bar::after, .lg-error { animation:none; } .lg-submit, .lg-input { transition:none; } }
`;

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
      <style>{css}</style>

      {/* Brand panel */}
      <aside className="lg-side">
        <div className="lg-side__logo"><img src={dashenlogo} alt="Dashen Bank" /></div>
        <div className="lg-side__hero">
          <div className="lg-slogan">
            <span>Always One Step</span>
            <strong>Ahead !</strong>
          </div>
          <p className="lg-side__lead">
            Identify, verify and monitor beneficial owners in line with Regulation No. 592/2026 — one secure registry for the whole bank.
          </p>
        </div>
        <div className="lg-side__foot">© {new Date().getFullYear()} Dashen Bank S.C.</div>
      </aside>

      {/* Form panel */}
      <main className="lg-panel">
        <div className="lg-card">
          <div className="lg-eyebrow">UBO Registry</div>
          <h1 className="lg-title">Beneficial Owner Identification &amp; Verification System</h1>
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
