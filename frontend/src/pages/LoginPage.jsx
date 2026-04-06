import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Backlink Builder</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enterprise Edition</div>
          </div>
        </div>

        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">Access your backlink management dashboard</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              type="email"
              className="form-input"
              placeholder="admin@company.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? <><div className="spinner" />Signing in…</> : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'center' }}>
          No account?{' '}
          <Link to="/register">Create one</Link>
        </p>

        <div className="alert alert-info" style={{ marginTop: '1.5rem', marginBottom: 0 }}>
          <span>🔑</span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>Demo credentials</div>
            <div>admin@backlink.io / Admin@123!</div>
          </div>
        </div>
      </div>
    </div>
  );
}
