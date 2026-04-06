import { useState } from 'react';
import api from '../utils/api';

export default function ReportsPage() {
  const [filters, setFilters] = useState({ format: 'csv', status: '', target_url: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleExport = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const params = { format: filters.format };
      if (filters.status) params.status = filters.status;
      if (filters.target_url) params.target_url = filters.target_url;

      const response = await api.get('/reports/export', {
        params,
        responseType: 'blob',
      });

      const ext = filters.format === 'json' ? 'json' : 'csv';
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `backlink_report_${new Date().toISOString().slice(0, 10)}.${ext}`;
      link.click();
      window.URL.revokeObjectURL(url);
      setMessage(`Report exported as ${ext.toUpperCase()}.`);
    } catch {
      setMessage('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Reports</div>
      </div>

      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Export Reports</h1>
          <p className="page-subtitle">
            Generate and download submission reports in CSV or JSON format for SEO audits.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', maxWidth: '800px' }}>
          <div className="card">
            <div className="card-title">Generate Report</div>

            {message && (
              <div className={`alert ${message.includes('failed') ? 'alert-error' : 'alert-success'}`}>
                {message}
              </div>
            )}

            <form onSubmit={handleExport}>
              <div className="form-group">
                <label className="form-label">Export Format</label>
                <select
                  className="form-select"
                  value={filters.format}
                  onChange={e => setFilters({ ...filters, format: e.target.value })}
                >
                  <option value="csv">CSV — Excel / Google Sheets</option>
                  <option value="json">JSON — Developer / API import</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Filter by Status</label>
                <select
                  className="form-select"
                  value={filters.status}
                  onChange={e => setFilters({ ...filters, status: e.target.value })}
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
                <label className="form-label">Filter by Target URL</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. yourwebsite.com"
                  value={filters.target_url}
                  onChange={e => setFilters({ ...filters, target_url: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? <><div className="spinner" />Generating…</> : `📥 Export ${filters.format.toUpperCase()}`}
              </button>
            </form>
          </div>

          <div>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-title">Report Columns</div>
              <ul style={{ paddingLeft: '1.25rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 2 }}>
                <li>Submission ID & Date</li>
                <li>Target URL & Anchor Text</li>
                <li>Directory Name & URL</li>
                <li>Category</li>
                <li>Domain Authority & Spam Score</li>
                <li>Status</li>
                <li>Retry Count</li>
                <li>Submitted By</li>
              </ul>
            </div>

            <div className="card">
              <div className="card-title">Use Cases</div>
              <ul style={{ paddingLeft: '1.25rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 2 }}>
                <li>SEO audit documentation</li>
                <li>Client reporting</li>
                <li>Link building review</li>
                <li>Compliance records</li>
                <li>Team performance tracking</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
