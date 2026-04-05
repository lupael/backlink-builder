import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const CATEGORIES = ['directory', 'blog', 'forum', 'citation'];

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ category: '', min_da: '', max_spam: '' });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', category: 'directory', domain_authority: '', spam_score: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.category) params.category = filters.category;
      if (filters.min_da !== '') params.min_da = filters.min_da;
      if (filters.max_spam !== '') params.max_spam = filters.max_spam;
      const { data } = await api.get('/opportunities', { params });
      setOpportunities(data.opportunities);
    } catch {
      setError('Failed to load opportunities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOpportunities(); }, [filters]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/opportunities', {
        ...form,
        domain_authority: Number(form.domain_authority) || 0,
        spam_score: Number(form.spam_score) || 0,
      });
      setShowForm(false);
      setForm({ name: '', url: '', category: 'directory', domain_authority: '', spam_score: '', description: '' });
      fetchOpportunities();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create opportunity.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (opp) => {
    try {
      await api.patch(`/opportunities/${opp.id}`, { is_active: !opp.is_active });
      fetchOpportunities();
    } catch {
      alert('Failed to update.');
    }
  };

  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Directories</div>
        {canEdit && (
          <div className="topbar-actions">
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              + Add Directory
            </button>
          </div>
        )}
      </div>

      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Backlink Directories</h1>
          <p className="page-subtitle">
            Manage the catalogue of open-source directories and backlink opportunity sites.
          </p>
        </div>

        {/* Add form */}
        {showForm && canEdit && (
          <div className="card mb-6">
            <div className="card-title">Add New Directory</div>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input type="text" className="form-input" required value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Directory name" />
                </div>
                <div className="form-group">
                  <label className="form-label">URL *</label>
                  <input type="url" className="form-input" required value={form.url}
                    onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
                </div>
                <div className="form-group">
                  <label className="form-label">Domain Authority</label>
                  <input type="number" className="form-input" min={0} max={100} value={form.domain_authority}
                    onChange={e => setForm({ ...form, domain_authority: e.target.value })} placeholder="0–100" />
                </div>
                <div className="form-group">
                  <label className="form-label">Spam Score</label>
                  <input type="number" className="form-input" min={0} max={100} value={form.spam_score}
                    onChange={e => setForm({ ...form, spam_score: e.target.value })} placeholder="0–100" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <input type="text" className="form-input" value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><div className="spinner" />Saving…</> : 'Save Directory'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="filters-row">
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={filters.category}
              onChange={e => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All categories</option>
              {CATEGORIES.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Min DA</label>
            <input type="number" className="form-input" placeholder="0" min={0} max={100}
              value={filters.min_da} onChange={e => setFilters({ ...filters, min_da: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Max Spam</label>
            <input type="number" className="form-input" placeholder="100" min={0} max={100}
              value={filters.max_spam} onChange={e => setFilters({ ...filters, max_spam: e.target.value })} />
          </div>
          <button className="btn btn-ghost" onClick={() => setFilters({ category: '', min_da: '', max_spam: '' })}>
            Clear
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /><span>Loading…</span></div>
        ) : opportunities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🗂️</div>
            <strong>No directories found</strong>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>URL</th>
                  <th>Category</th>
                  <th>DA</th>
                  <th>Spam</th>
                  <th>Auto Submit</th>
                  <th>Status</th>
                  {canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {opportunities.map(opp => (
                  <tr key={opp.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{opp.name}</div>
                      {opp.description && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                          {opp.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <a href={opp.url} target="_blank" rel="noopener noreferrer"
                        style={{ maxWidth: 220, display: 'block' }} className="truncate text-sm">
                        {opp.url}
                      </a>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: 'var(--text-xs)', fontWeight: 600,
                        background: 'var(--bg-hover)', color: 'var(--text-secondary)'
                      }}>{opp.category}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: opp.domain_authority >= 50 ? 'var(--success)' : opp.domain_authority >= 30 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                        {opp.domain_authority}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: opp.spam_score <= 5 ? 'var(--success)' : opp.spam_score <= 15 ? 'var(--warning)' : 'var(--danger)' }}>
                        {opp.spam_score}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: opp.auto_submit ? 'var(--success)' : 'var(--text-muted)' }}>
                        {opp.auto_submit ? '✓ Yes' : '— No'}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: opp.is_active ? 'var(--success)' : 'var(--text-muted)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        {opp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEdit && (
                      <td>
                        <button
                          className={`btn btn-sm ${opp.is_active ? 'btn-ghost' : 'btn-secondary'}`}
                          onClick={() => toggleActive(opp)}
                        >
                          {opp.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
