import React, { useState, useEffect, useRef } from 'react';
import { Lock, AlertCircle, Users, X } from 'lucide-react';

interface PasswordPromptProps {
  onAuthenticated: () => void;
  onClose?: () => void;
}

const CORRECT_PASSWORD_HASH = 'df8a1593149056ff967f548883ba994fcf431e6dd4d2074223a454115d20cf84';

export const PasswordPrompt: React.FC<PasswordPromptProps> = ({ onAuthenticated, onClose }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus password input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  async function hashPassword(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsLoading(true);
    setError('');

    try {
      const hash = await hashPassword(password);
      if (hash === CORRECT_PASSWORD_HASH) {
        sessionStorage.setItem('mapAuthenticated', 'true');
        onAuthenticated();
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch (err) {
      setError('An error occurred during authentication.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container} onClick={onClose}>
      {/* Animated background blobs */}
      <div style={styles.blob1} />
      <div style={styles.blob2} />
      
      <div 
        className="glass-panel" 
        style={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button 
            onClick={onClose} 
            style={styles.closeBtn} 
            title="Cancel"
            aria-label="Close password modal"
          >
            <X size={18} color="var(--text-secondary)" />
          </button>
        )}

        <div style={styles.logoContainer}>
          <div style={styles.logoCircle}>
            <Users size={32} color="#a78bfa" />
          </div>
        </div>
        
        <h2 style={styles.title}>Unlock People</h2>
        <p style={styles.subtitle}>Enter access password to view people data</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputContainer}>
            <Lock size={18} style={styles.inputIcon} />
            <input
              ref={inputRef}
              type="password"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              style={styles.input}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={styles.errorContainer}>
              <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
              <span style={styles.errorText}>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password}
            style={{
              ...styles.button,
              opacity: isLoading || !password ? 0.6 : 1,
              cursor: isLoading || !password ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Verifying...' : 'Unlock People Layer'}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 5, 22, 0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 10000,
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute',
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, rgba(139, 92, 246, 0) 70%)',
    top: '20%',
    left: '25%',
    animation: 'float 8s ease-in-out infinite',
    pointerEvents: 'none',
  },
  blob2: {
    position: 'absolute',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0) 70%)',
    bottom: '15%',
    right: '20%',
    animation: 'float 12s ease-in-out infinite alternate',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    width: '90%',
    maxWidth: '400px',
    padding: '40px 32px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  logoContainer: {
    marginBottom: '20px',
  },
  logoCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    border: '1px solid rgba(139, 92, 246, 0.25)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '26px',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.025em',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '28px',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputContainer: {
    position: 'relative',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    color: 'var(--text-secondary)',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '14px 14px 14px 44px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid var(--border-glass)',
    borderRadius: '10px',
    fontSize: '15px',
    color: '#ffffff',
    outline: 'none',
    transition: 'all 0.2s',
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    borderRadius: '8px',
    textAlign: 'left',
  },
  errorText: {
    fontSize: '13px',
    color: '#ef4444',
  },
  button: {
    width: '100%',
    padding: '14px',
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 600,
    boxShadow: '0 4px 14px var(--primary-glow)',
    transition: 'all 0.2s',
  }
};

