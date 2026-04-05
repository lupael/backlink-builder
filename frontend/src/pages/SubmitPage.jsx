import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function SubmitPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    target_url: '',
    anchor_text: '',
    min_da: 20,
    max_spam: 10,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const { data } = await api.post('/submit', {
        target_url: form.target_url,
        anchor_text: form.anchor_text,
        min_da: Number(form.min_da),
        max_spam: Number(form.max_spam),
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Submit URL</div>
      </div>
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Submit Website URL</h1>
          <p className="page-subtitle">
            Queue your URL across all matching open-source directories and backlink opportunities.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', maxWidth: '900px' }}>
          <div className="card">
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              {result && (
                <div className="alert alert-success">
                  ✅ Queued <strong>{result.queued}</strong> submissions for {form.target_url}.
                  {' '}<button type="button" className="btn btn-sm btn-secondary" onClick={() => navigate('/submissions')}>
                    View submissions →
                  </button>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Target URL *</label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://yourwebsite.com"
                  value={form.target_url}
                  onChange={e => setForm({ ...form, target_url: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Anchor Text</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Your Company Name or Brand"
                  value={form.anchor_text}
                  onChange={e => setForm({ ...form, anchor_text: e.target.value })}
                />
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Optional. Leave blank to use the URL as anchor.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Min Domain Authority</label>
                  <input
                    type="number"
                    className="form-input"
                    min={0}
                    max={100}
                    value={form.min_da}
                    onChange={e => setForm({ ...form, min_da: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Spam Score</label>
                  <input
                    type="number"
                    className="form-input"
                    min={0}
                    max={100}
                    value={form.max_spam}
                    onChange={e => setForm({ ...form, max_spam: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? <><div className="spinner" />Processing…</> : '🚀 Submit to Directories'}
              </button>
            </form>
          </div>

          <div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-title">How It Works</div>
              <ol style={{ paddingLeft: '1.25rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 2 }}>
                <li>Enter your website URL</li>
                <li>Set quality filters (DA, spam score)</li>
                <li>System queues matching directories</li>
                <li>Track status in Submissions</li>
                <li>Export reports when done</li>
              </ol>
            </div>

            <div className="card">
              <div className="card-title">Quality Filters</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Min Domain Authority</strong>
                  <br />Only target high-authority sites. Recommended: 20+
                </div>
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>Max Spam Score</strong>
                  <br />Exclude spammy sites. Recommended: ≤10
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
