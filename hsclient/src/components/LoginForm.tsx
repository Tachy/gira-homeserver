import { useState } from 'react';
import { DEFAULT_CLIENT } from '../api/hsClient';
import type { HsCredentials } from '../api/types';

const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'GIRA Homeserver';

export function LoginForm({
  onSubmit,
  error,
  pending,
}: {
  onSubmit: (creds: HsCredentials) => void;
  error?: string | null;
  pending?: boolean;
}) {
  const [user, setUser] = useState('');
  const [pw, setPw] = useState('');
  const [cl, setCl] = useState(DEFAULT_CLIENT);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#edb678',
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ user, pw, cl });
        }}
        style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <h1 style={{ color: '#edb678', letterSpacing: 2 }}>{APP_TITLE}</h1>
        <label>
          Benutzer
          <input value={user} onChange={(e) => setUser(e.target.value)} required style={inputStyle} />
        </label>
        <label>
          Passwort
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <label>
          Client
          <input value={cl} onChange={(e) => setCl(e.target.value)} required style={inputStyle} />
        </label>
        {error && <p style={{ color: '#ed2024' }}>{error}</p>}
        <button type="submit" disabled={pending} style={buttonStyle}>
          {pending ? 'Verbinde...' : 'Verbinden'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 8,
  marginTop: 4,
  background: '#111',
  color: '#fff',
  border: '1px solid #9199d4',
  borderRadius: 4,
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 16px',
  background: '#edb678',
  color: '#000',
  border: 'none',
  borderRadius: 999,
  fontWeight: 700,
  cursor: 'pointer',
};
