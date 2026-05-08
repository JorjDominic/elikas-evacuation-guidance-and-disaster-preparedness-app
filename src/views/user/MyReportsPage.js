import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import '../../styles/shared/sentinel.css';

const STATUS_CLASS = { pending: 'warning', approved: 'open', rejected: 'danger' };
const PAGE_SIZE = 10;

function MyReportsPage() {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pageNum, setPageNum] = useState(0);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    async function fetchMyReports() {
      if (!currentUser?.id) { setLoading(false); return; }
      const { data, error: err } = await supabase
        .from('hazard_reports')
        .select('*')
        .eq('reporter_id', currentUser.id)
        .order('created_at', { ascending: false });
      if (err) setError(err.message);
      else setReports(data || []);
      setLoading(false);
    }
    fetchMyReports();
  }, [currentUser]);

  // Real-time updates for own reports
  useEffect(() => {
    if (!currentUser?.id) return;
    const channel = supabase
      .channel('my-reports-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'hazard_reports', filter: `reporter_id=eq.${currentUser.id}` },
        (payload) => {
          setReports((prev) =>
            prev.map((r) => (r.id === payload.new.id ? payload.new : r))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'hazard_reports', filter: `reporter_id=eq.${currentUser.id}` },
        (payload) => {
          setReports((prev) => prev.filter((r) => r.id !== payload.old.id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const handleDelete = async (reportId) => {
    if (!window.confirm('Cancel and delete this pending report?')) return;
    setDeletingId(reportId);
    const { error: err } = await supabase
      .from('hazard_reports')
      .delete()
      .eq('id', reportId)
      .eq('reporter_id', currentUser.id)
      .eq('status', 'pending');
    setDeletingId(null);
    if (err) {
      setError('Failed to delete report: ' + err.message);
    } else {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    }
  };

  const filtered =
    statusFilter === 'all' ? reports : reports.filter((r) => r.status === statusFilter);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE);

  // Reset page when filter changes
  const handleFilterChange = (s) => { setStatusFilter(s); setPageNum(0); };

  const counts = {
    all: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    approved: reports.filter((r) => r.status === 'approved').length,
    rejected: reports.filter((r) => r.status === 'rejected').length,
  };

  return (
    <section className="app-page">
      <div className="app-shell">
        <div className="page-hero">
          <h1>My Reports</h1>
          <p>Track the review status of hazard incidents you have submitted to the operations team.</p>
          <div className="hero-meta">
            <span className="hero-pill">Submission History</span>
            <span className="hero-pill">{counts.pending} Pending Review</span>
          </div>
        </div>

        <div className="app-page-head">
          <span className="page-chip">My Submissions</span>
        </div>

        {/* Status filter tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {['all', 'pending', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              type="button"
              className={`btn-inline ${statusFilter === s ? 'primary' : ''}`}
              onClick={() => handleFilterChange(s)}
              style={{ textTransform: 'capitalize' }}
            >
              {s === 'all' ? 'All' : s} ({counts[s]})
            </button>
          ))}
        </div>

        {error && <p style={{ color: 'var(--color-danger, red)' }} role="alert" aria-live="polite">{error}</p>}
        {loading && <p>Loading your reports…</p>}

        {!loading && filtered.length === 0 && (
          <div className="info-strip ok">
            <span>📋</span>
            <span>
              {statusFilter === 'all'
                ? "You haven't submitted any hazard reports yet."
                : `No ${statusFilter} reports found.`}
            </span>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="table-shell card">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Description</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr key={r.id}>
                    <td>{r.hazard_type}</td>
                    <td>{r.location}</td>
                    <td
                      style={{
                        maxWidth: '260px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.description}
                    </td>
                    <td>
                      <small>
                        {new Date(r.created_at).toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </small>
                    </td>
                    <td>
                      <span className={`status-pill ${STATUS_CLASS[r.status] || ''}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      {r.status === 'pending' && (
                        <button
                          type="button"
                          className="btn-inline danger"
                          disabled={deletingId === r.id}
                          onClick={() => handleDelete(r.id)}
                          style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                        >
                          {deletingId === r.id ? '…' : 'Delete'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end', padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="btn-inline"
                  disabled={pageNum === 0}
                  onClick={() => setPageNum((p) => p - 1)}
                >← Prev</button>
                <span style={{ fontSize: '0.88rem', color: 'var(--sent-text-muted)' }}>
                  {pageNum + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn-inline"
                  disabled={pageNum >= totalPages - 1}
                  onClick={() => setPageNum((p) => p + 1)}
                >Next →</button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default MyReportsPage;
