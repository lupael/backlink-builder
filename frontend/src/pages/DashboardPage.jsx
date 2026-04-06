import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../utils/api';

const STATUS_COLORS = {
  pending:   '#f5a623',
  submitted: '#4f8ef7',
  approved:  '#3ecf8e',
  rejected:  '#e5534b',
  failed:    '#e5534b',
};

const PIE_COLORS = ['#4f8ef7', '#3ecf8e', '#f5a623', '#e5534b', '#a78bfa'];

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : {}}>{value}</div>
      {sub && <div className="stat-subtext">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-overlay"><div className="spinner" /><span>Loading dashboard…</span></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  const statusPieData = [
    { name: 'Pending',   value: data.pending },
    { name: 'Submitted', value: data.submitted },
    { name: 'Approved',  value: data.approved },
    { name: 'Rejected',  value: data.rejected },
    { name: 'Failed',    value: data.failed },
  ].filter(d => d.value > 0);

  return (
    <div className="page-container">
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>
      </div>

      <div style={{ paddingTop: '1.5rem' }}>
        {/* Stats */}
        <div className="stat-grid">
          <StatCard
            label="Total Submissions"
            value={data.total_submissions.toLocaleString()}
            sub="All time"
          />
          <StatCard
            label="Approved"
            value={data.approved.toLocaleString()}
            accent="var(--success)"
            sub={`${data.success_rate}% success rate`}
          />
          <StatCard
            label="Pending"
            value={data.pending.toLocaleString()}
            accent="var(--warning)"
            sub="Awaiting review"
          />
          <StatCard
            label="Submitted"
            value={data.submitted.toLocaleString()}
            accent="var(--info)"
            sub="In progress"
          />
          <StatCard
            label="Avg Domain Authority"
            value={data.avg_domain_authority || '—'}
            sub="Approved & submitted"
          />
          <StatCard
            label="Directories"
            value={data.total_opportunities.toLocaleString()}
            sub="Active opportunities"
          />
        </div>

        {/* Charts */}
        <div className="chart-grid">
          {/* Daily submissions bar chart */}
          <div className="card">
            <div className="card-title">Daily Submissions (Last 14 Days)</div>
            {data.daily_submissions.length > 0 ? (
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily_submissions} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      tickFormatter={v => v.slice(5)}
                    />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }}
                      cursor={{ fill: 'rgba(79,142,247,0.08)' }}
                    />
                    <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Submissions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-state-icon">📉</div><span>No data yet</span></div>
            )}
          </div>

          {/* Status pie chart */}
          <div className="card">
            <div className="card-title">Submission Status</div>
            {statusPieData.length > 0 ? (
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusPieData.map((entry, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(v) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{v}</span>}
                    />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-state-icon">🥧</div><span>No data yet</span></div>
            )}
          </div>
        </div>

        {/* Category distribution */}
        {data.category_distribution.length > 0 && (
          <div className="card" style={{ marginBottom: 'var(--space-8)' }}>
            <div className="card-title">Backlinks by Category</div>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.category_distribution}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 40, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="category" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }}
                    cursor={{ fill: 'rgba(79,142,247,0.08)' }}
                  />
                  <Bar dataKey="count" fill="var(--success)" radius={[0, 4, 4, 0]} name="Submissions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
