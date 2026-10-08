import { useState } from "react";
import dashenlogo from "../assets/dashenlogo.png";
import { useAuth } from "../auth/AuthContext.jsx";
import "./login.css";

/* Field icons drawn in the same stroke language as the app's NavIcons /
   SearchIcon / BellIcon set: 16x16, currentColor, ~1.3 stroke, rounded caps. */

function UserFieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5.2" r="2.6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M2.8 13.2c.6-2.6 2.7-4 5.2-4s4.6 1.4 5.2 4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockFieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3.2" y="7.2" width="9.6" height="6.4" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.4 7.2V5.4a2.6 2.6 0 0 1 5.2 0v1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ShieldFieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.6l5.2 1.9v3.9c0 3.4-2.2 5.9-5.2 6.9-3-1-5.2-3.5-5.2-6.9V3.5L8 1.6z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M5.8 8l1.6 1.6 2.8-3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoginScreen() {
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter both your username and password.");
      return;
    }

    setLoading(true);
    try {
      await login(username, password, true);
    } catch (err) {
      const status = err.response?.status;
      setError(
        status === 401
          ? "Incorrect username or password."
          : err.response?.data?.message ||
              "Network error. Please check your connection."
      );
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="boivs-login">
      {/* Left navy panel with logo */}
      <div className="boivs-login__side">
        <img src={dashenlogo} alt="Dashen Bank" />
        <div className="boivs-login__slogan">
        <span>Always One Step</span>
        <strong>Ahead !</strong>
        </div>
      </div>

      {/* Right content panel */}
      <div className="boivs-login__panel">
        <div className="boivs-login__content">
          <div className="boivs-login__brand">
            <span className="boivs-login__title">
              Beneficial Owner Identification &amp; Verification System
            </span>
          </div>

          <form className="boivs-login__form" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="boivs-login__error" role="alert">
                {error}
              </div>
            )}

            <div className="boivs-login__field">
              <label htmlFor="username">Domain username</label>
              <div className="boivs-login__input-wrap">
                <span className="boivs-login__input-icon">
                  <UserFieldIcon />
                </span>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  placeholder="Enter your domain username"
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={loading}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="boivs-login__field boivs-login__field--password">
              <label htmlFor="password">Password </label>
              <div className="boivs-login__input-wrap">
                <span className="boivs-login__input-icon">
                  <LockFieldIcon />
                </span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  placeholder="Enter your password"
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button type="submit" className="boivs-login__submit" disabled={loading}>
              {loading ? "signing in…" : "sign in"}
              <span className="boivs-login__submit-icon">→</span>
            </button>
          </form>

          <div className="boivs-login__footer">
            <div className="boivs-login__footer-badge">
              <ShieldFieldIcon />
              <span>In-House System </span><span className="boivs-login__footer-divider" aria-hidden="true">•</span>
              
              <span> Authorized  Only</span>
            </div>
            <span className="boivs-login__footer-divider" aria-hidden="true">•</span>
            <span className="boivs-login__footer-version">v{__APP_VERSION__}</span>
          </div>
        </div>
      </div>
    </div>
  );
}