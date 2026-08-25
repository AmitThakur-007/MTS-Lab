import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { registerInactivityExpiredHandler } from '@/services/api';

// Configuration
const INACTIVITY_TIMEOUT_MS    = 2 * 60 * 60 * 1000;   // 2 hours
const WARNING_BEFORE_MS        = 5 * 60 * 1000;          // warn 5 min before expiry
const WARNING_AT_MS            = INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS; // 1h55m
const STORAGE_KEY              = 'mts_last_activity';
const ACTIVITY_EVENTS          = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;
const THROTTLE_MS              = 10_000; // update localStorage at most once per 10s

function getLastActivity(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  } catch {
    return Date.now();
  }
}

function setLastActivity(ts: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(ts));
  } catch {}
}

function CountdownTimer({ targetMs }: { targetMs: number }) {
  const [remaining, setRemaining] = useState(targetMs);

  useEffect(() => {
    setRemaining(targetMs);
    const id = setInterval(() => {
      setRemaining(r => {
        const next = r - 1000;
        return next < 0 ? 0 : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return (
    <span className="inactivity-countdown">
      {mins}:{secs.toString().padStart(2, '0')}
    </span>
  );
}

interface InactivityGuardProps {
  children: React.ReactNode;
}

export default function InactivityGuard({ children }: InactivityGuardProps) {
  const navigate         = useNavigate();
  const { user, token, logout } = useAuthStore();
  const [showWarning, setShowWarning]   = useState(false);
  const [countdownMs, setCountdownMs]   = useState(WARNING_BEFORE_MS);
  const lastThrottleRef  = useRef<number>(0);
  const warningShownRef  = useRef(false);
  const loggedOutRef     = useRef(false);

  const triggerLogout = useCallback(async (reason: 'inactivity' | 'manual' = 'inactivity') => {
    if (loggedOutRef.current) return;
    loggedOutRef.current = true;

    try {
      const { refreshToken } = useAuthStore.getState();
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include'
      });
    } catch {}

    logout();
    setShowWarning(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    navigate(`/login${reason === 'inactivity' ? '?reason=inactivity' : ''}`, { replace: true });
  }, [logout, navigate]);

  const handleContinue = useCallback(async () => {
    setShowWarning(false);
    warningShownRef.current = false;
    loggedOutRef.current = false;

    const now = Date.now();
    setLastActivity(now);
    lastThrottleRef.current = now;

    try {
      const { token: currentToken } = useAuthStore.getState();
      await fetch('/api/auth/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {})
        },
        credentials: 'include'
      });
    } catch {}
  }, []);

  const handleActivity = useCallback(() => {
    if (!user || !token) return;
    const now = Date.now();
    if (now - lastThrottleRef.current < THROTTLE_MS) return;
    lastThrottleRef.current = now;
    setLastActivity(now);
  }, [user, token]);

  const handleStorageChange = useCallback((e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    if (e.newValue && parseInt(e.newValue, 10) > Date.now() - WARNING_AT_MS) {
      if (showWarning) {
        setShowWarning(false);
        warningShownRef.current = false;
        loggedOutRef.current = false;
      }
    }
  }, [showWarning]);

  useEffect(() => {
    if (!user || !token) return;

    warningShownRef.current = false;
    loggedOutRef.current = false;
    const now = Date.now();
    if (!localStorage.getItem(STORAGE_KEY)) {
      setLastActivity(now);
    }
    lastThrottleRef.current = now;

    registerInactivityExpiredHandler(() => triggerLogout('inactivity'));

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));
    window.addEventListener('storage', handleStorageChange);

    const checkInterval = setInterval(() => {
      const last     = getLastActivity();
      const idle     = Date.now() - last;
      const timeLeft = INACTIVITY_TIMEOUT_MS - idle;

      if (idle >= INACTIVITY_TIMEOUT_MS) {
        clearInterval(checkInterval);
        triggerLogout('inactivity');
      } else if (idle >= WARNING_AT_MS && !warningShownRef.current && !showWarning) {
        warningShownRef.current = true;
        setCountdownMs(Math.max(0, timeLeft));
        setShowWarning(true);
      } else if (idle < WARNING_AT_MS && warningShownRef.current) {
        warningShownRef.current = false;
        setShowWarning(false);
        loggedOutRef.current = false;
      }
    }, 10_000);

    return () => {
      clearInterval(checkInterval);
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity));
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, token, handleActivity, handleStorageChange, triggerLogout, showWarning]);

  if (!user || !token) return <>{children}</>;

  return (
    <>
      {children}

      {showWarning && (
        <>
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 99998,
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              animation: 'inactivity-fadeIn 0.3s ease'
            }}
            aria-hidden="true"
          />

          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="inactivity-title"
            aria-describedby="inactivity-desc"
            style={{
              position: 'fixed', inset: 0, zIndex: 99999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <div style={{
              background: 'linear-gradient(145deg, #1a1f2e 0%, #141824 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '2rem 2.5rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,165,0,0.15)',
              animation: 'inactivity-slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
              textAlign: 'center'
            }}>
              <div style={{
                width: '72px', height: '72px',
                margin: '0 auto 1.25rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(234,88,12,0.2) 100%)',
                border: '2px solid rgba(245,158,11,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'inactivity-pulse 2s ease infinite'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>

              <h2 id="inactivity-title" style={{
                color: '#fff', fontSize: '1.25rem', fontWeight: 700,
                margin: '0 0 0.5rem', letterSpacing: '-0.01em'
              }}>
                Session Expiring Soon
              </h2>

              <p id="inactivity-desc" style={{
                color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem',
                lineHeight: 1.6, margin: '0 0 1.5rem'
              }}>
                Your session will expire in{' '}
                <CountdownTimer targetMs={countdownMs} />{' '}
                due to inactivity. Would you like to continue?
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                <button
                  onClick={() => triggerLogout('inactivity')}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1.25rem',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                >
                  Log Out
                </button>

                <button
                  onClick={handleContinue}
                  autoFocus
                  style={{
                    flex: 1,
                    padding: '0.75rem 1.25rem',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(245,158,11,0.35)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  Continue Session
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes inactivity-fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes inactivity-slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes inactivity-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.3); }
          50%       { box-shadow: 0 0 0 12px rgba(245,158,11,0); }
        }
        .inactivity-countdown {
          font-size: 1rem;
          font-weight: 700;
          color: #f59e0b;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </>
  );
}
