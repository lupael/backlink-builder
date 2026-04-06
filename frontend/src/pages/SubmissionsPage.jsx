import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export default function SubmissionsPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', target_url: '', page: 1 });

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: filters.page, per_page: 25 };
      if (filters.status) params.status = filters.status;
      if (filters.target_url) params.target_url = filters.target_url;
      const { data } = await api.get('/submissions', { params });
      setSubmissions(data.submissions);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      setError('Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/submissions/${id}`, { status });
      fetchSubmissions();
    } catch {
      alert('Failed to update status.');
    }
  };

  const retrySubmission = async (id) => {
    try {
      await api.post(`/submissions/${id}/retry`);
      fetchSubmissions();
    } catch {
      alert('Failed to retry submission.');
    }
  };

  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Submissions</div>
        <div className="topbar-actions">
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {total.toLocaleString()} total
          </span>
        </div>
      </div>

      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Backlink Submissions</h1>
          <p className="page-subtitle">Track the status of all queued and completed backlink submissions.</p>
        </div>

        {/* Filters */}
        <div className="filters-row">
          <div className="form-group">
            <label className="form-label">Filter by Status</label>
            <select
              className="form-select"
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Search URL</label>
            <input
              type="text"
              className="form-input"
              placeholder="Filter by target URL…"
              value={filters.target_url}
              onChange={e => setFilters({ ...filters, target_url: e.target.value, page: 1 })}
            />
          </div>
          <button className="btn btn-ghost" onClick={() => setFilters({ status: '', target_url: '', page: 1 })}>
            Clear
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /><span>Loading…</span></div>
        ) : submissions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <strong>No submissions found</strong>
            <span>Use the Submit URL page to queue your first batch.</span>
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Target URL</th>
                    <th>Directory</th>
                    <th>Category</th>
                    <th>DA</th>
                    <th>Anchor Text</th>
                    <th>Status</th>
                    <th>Retries</th>
                    <th>Date</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(sub => (
                    <tr key={sub.id}>
                      <td className="td-muted font-mono">{sub.id}</td>
                      <td>
                        <a href={sub.target_url} target="_blank" rel="noopener noreferrer"
                          style={{ maxWidth: 200, display: 'block' }} className="truncate">
                          {sub.target_url}
                        </a>
                      </td>
                      <td>
                        {sub.opportunity ? (
                          <a href={sub.opportunity.url} target="_blank" rel="noopener noreferrer"
                            style={{ maxWidth: 180, display: 'block' }} className="truncate">
                            {sub.opportunity.name}
                          </a>
                        ) : <span className="td-muted">—</span>}
                      </td>
                      <td className="td-muted" style={{ textTransform: 'capitalize' }}>
                        {sub.opportunity?.category || '—'}
                      </td>
                      <td className="td-muted">
                        {sub.opportunity?.domain_authority ?? '—'}
                      </td>
                      <td className="td-muted">{sub.anchor_text || '—'}</td>
                      <td><StatusBadge status={sub.status} /></td>
                      <td className="td-muted">{sub.retry_count}</td>
                      <td className="td-muted" style={{ whiteSpace: 'nowrap' }}>
                        {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : '—'}
                      </td>
                      {canEdit && (
                        <td>
                          <div className="flex gap-2">
                            {sub.status === 'pending' && (
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => updateStatus(sub.id, 'submitted')}
                              >Mark Submitted</button>
                            )}
                            {sub.status === 'submitted' && (
                              <>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => updateStatus(sub.id, 'approved')}
                                  style={{ color: 'var(--success)' }}
                                >Approve</button>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => updateStatus(sub.id, 'rejected')}
                                  style={{ color: 'var(--danger)' }}
                                >Reject</button>
                              </>
                            )}
                            {sub.status === 'failed' && (
                              <button className="btn btn-sm btn-secondary" onClick={() => retrySubmission(sub.id)}>
                                Retry
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="pagination">
                <span className="pagination-info">
                  Page {filters.page} of {pages} · {total} total
                </span>
                <div className="pagination-controls">
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={filters.page <= 1}
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                  >← Prev</button>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={filters.page >= pages}
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                  >Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
