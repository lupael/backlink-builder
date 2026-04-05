import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';

const ROLES = ['admin', 'manager', 'viewer'];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);

  if (currentUser?.role !== 'admin') return <Navigate to="/" replace />;

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data.users);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateUser = async (id, patch) => {
    setSaving(id);
    try {
      await api.patch(`/users/${id}`, patch);
      fetchUsers();
    } catch {
      alert('Failed to update user.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Users</div>
      </div>

      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">Manage team members and their access roles.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /><span>Loading…</span></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-dark)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 'var(--text-xs)', fontWeight: 700, color: '#fff', flexShrink: 0
                        }}>
                          {u.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div style={{ fontWeight: 500 }}>{u.name}</div>
                        {u.id === currentUser.id && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', background: 'var(--accent-glow)', padding: '1px 6px', borderRadius: 4 }}>
                            You
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="td-muted">{u.email}</td>
                    <td>
                      <select
                        className="form-select"
                        style={{ width: 'auto', height: 30, padding: '0 8px', fontSize: 'var(--text-sm)' }}
                        value={u.role}
                        disabled={u.id === currentUser.id || saving === u.id}
                        onChange={e => updateUser(u.id, { role: e.target.value })}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <span style={{
                        color: u.is_active ? 'var(--success)' : 'var(--text-muted)',
                        fontSize: 'var(--text-xs)', fontWeight: 600
                      }}>
                        {u.is_active ? '● Active' : '○ Inactive'}
                      </span>
                    </td>
                    <td className="td-muted">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      {u.id !== currentUser.id && (
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-secondary'}`}
                          disabled={saving === u.id}
                          onClick={() => updateUser(u.id, { is_active: !u.is_active })}
                        >
                          {saving === u.id ? <div className="spinner" /> : (u.is_active ? 'Disable' : 'Enable')}
                        </button>
                      )}
                    </td>
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
