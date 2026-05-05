import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import '../../styles/shared/sentinel.css';

const STATUS_CLASS = { pending: 'warning', approved: 'open', rejected: 'danger' };

function MyReportsPage() {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const filtered =
    statusFilter === 'all' ? reports : reports.filter((r) => r.status === statusFilter);

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
              onClick={() => setStatusFilter(s)}
              style={{ textTransform: 'capitalize' }}
            >
              {s === 'all' ? 'All' : s} ({counts[s]})
            </button>
          ))}
        </div>

        {error && <p style={{ color: 'var(--color-danger, red)' }}>{error}</p>}
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default MyReportsPage;
