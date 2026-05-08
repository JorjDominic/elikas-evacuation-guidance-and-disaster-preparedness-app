import React, { useState, useEffect, useCallback } from 'react';
import { listAuditLogs } from '../../services/adminService';
import '../../styles/shared/sentinel.css';
import '../../styles/admin/AdminAuditLogsPage.css';

const ACTION_LABELS = {
  'user.invite':     { label: 'User Invited',     color: 'blue' },
  'user.update':     { label: 'User Updated',     color: 'blue' },
  'user.activate':   { label: 'User Activated',   color: 'green' },
  'user.deactivate': { label: 'User Deactivated', color: 'red' },
  'center.create':   { label: 'Center Created',   color: 'green' },
  'center.update':   { label: 'Center Updated',   color: 'blue' },
  'center.delete':   { label: 'Center Deleted',   color: 'red' },
  'alert.create':    { label: 'Alert Created',    color: 'orange' },
  'alert.update':    { label: 'Alert Updated',    color: 'orange' },
  'alert.delete':    { label: 'Alert Deleted',    color: 'red' },
  'guide.create':    { label: 'Guide Created',    color: 'green' },
  'guide.update':    { label: 'Guide Updated',    color: 'blue' },
  'guide.delete':    { label: 'Guide Deleted',    color: 'red' },
  'report.approve':  { label: 'Report Approved',  color: 'green' },
  'report.reject':   { label: 'Report Rejected',  color: 'red' },
};

const PAGE_SIZE = 25;

function csvCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function exportLogsCSV(logs) {
  if (!logs.length) return;
  const headers = ['created_at', 'actor_name', 'action', 'target_type', 'target_id'];
  const rows = logs.map((l) => headers.map((h) => csvCell(l[h])).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function actionBadge(action) {
  const meta = ACTION_LABELS[action] || { label: action, color: 'grey' };
  return <span className={`aalp-badge color-${meta.color}`}>{meta.label}</span>;
}

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function MetaCell({ meta }) {
  if (!meta || Object.keys(meta).length === 0) return <span className="aalp-meta-empty">—</span>;
  const pairs = Object.entries(meta).slice(0, 3);
  return (
    <span className="aalp-meta">
      {pairs.map(([k, v]) => (
        <span key={k} className="aalp-meta-pair">
          <span className="aalp-meta-key">{k}:</span>{' '}
          <span className="aalp-meta-val">{String(v).slice(0, 40)}</span>
        </span>
      ))}
    </span>
  );
}

function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err, count } = await listAuditLogs({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      action: actionFilter,
      search
    });
    if (err) setError(err.message);
    else {
      setLogs(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  }, [page, actionFilter, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [actionFilter, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <section className="app-page">
      <div className="app-shell">
        <div className="page-hero">
          <h1>Audit Logs</h1>
          <p>Full activity trail of all admin actions performed on the platform. Used for accountability and incident review.</p>
          <div className="hero-meta">
            <span className="hero-pill">Immutable Trail</span>
            <span className="hero-pill">{total} Total Events</span>
          </div>
        </div>

        <div className="app-page-head">
          <span className="page-chip">Activity Log</span>
          <button
            type="button"
            className="aalp-btn ghost"
            onClick={() => exportLogsCSV(logs)}
            disabled={logs.length === 0}
          >
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="aalp-filters">
          <input
            type="search"
            className="aalp-search"
            placeholder="Search by admin name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search logs"
          />
          <select
            className="aalp-select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            aria-label="Filter by action"
          >
            <option value="">All Actions</option>
            {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button type="button" className="aalp-btn ghost" onClick={() => { setSearch(''); setActionFilter(''); setPage(0); }}>
            Clear
          </button>
        </div>

        {error && <div className="aalp-error">{error}</div>}
        {loading && <p className="aalp-loading">Loading logs…</p>}

        {!loading && (
          <>
            <div className="table-shell card">
              <table className="aalp-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan="5" className="aalp-empty">No audit logs found.</td></tr>
                  ) : logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr
                        className={`aalp-row ${expandedId === log.id ? 'expanded' : ''}`}
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="aalp-ts">{formatTime(log.created_at)}</td>
                        <td>
                          <div className="aalp-actor">
                            <div className="aalp-avatar" aria-hidden="true">
                              {(log.actor_name || '?')[0].toUpperCase()}
                            </div>
                            <span>{log.actor_name || <em>Unknown</em>}</span>
                          </div>
                        </td>
                        <td>{actionBadge(log.action)}</td>
                        <td>
                          {log.target_type && (
                            <span className="aalp-target">
                              <span className="aalp-target-type">{log.target_type}</span>
                              {log.target_id && <span className="aalp-target-id"> #{String(log.target_id).slice(0, 8)}…</span>}
                            </span>
                          )}
                          {!log.target_type && <span className="aalp-meta-empty">—</span>}
                        </td>
                        <td><MetaCell meta={log.meta} /></td>
                      </tr>
                      {expandedId === log.id && (
                        <tr className="aalp-expanded-row">
                          <td colSpan="5">
                            <div className="aalp-expanded-inner">
                              <div className="aalp-expanded-row-data">
                                <span className="aalp-meta-key">Full ID:</span> {log.id}
                              </div>
                              {log.target_id && (
                                <div className="aalp-expanded-row-data">
                                  <span className="aalp-meta-key">Target ID:</span> {log.target_id}
                                </div>
                              )}
                              {log.meta && Object.keys(log.meta).length > 0 && (
                                <div className="aalp-expanded-row-data">
                                  <span className="aalp-meta-key">Full Metadata:</span>
                                  <pre className="aalp-json">{JSON.stringify(log.meta, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="aalp-pagination">
                <button
                  type="button"
                  className="aalp-btn ghost"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >← Prev</button>
                <span className="aalp-page-info">
                  Page {page + 1} of {totalPages} &nbsp;·&nbsp; {total} events
                </span>
                <button
                  type="button"
                  className="aalp-btn ghost"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default AdminAuditLogsPage;
