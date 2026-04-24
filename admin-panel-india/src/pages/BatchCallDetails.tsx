import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { batchCallService } from '../api/batchCallService';
import { 
    ChevronLeft, Search, Clock, CheckCircle2, XCircle, 
    Calendar, User, PhoneCall, ChevronDown, ChevronUp 
} from 'lucide-react';
import Toast from '../Component/toaster/Toast';

const PAGE_LIMIT = 15;

const RECIPIENT_STATUS: Record<number, { bg: string; color: string; label: string }> = {
    1: { bg: '#f1f5f9', color: '#64748b', label: 'Queued' },
    2: { bg: '#fef2f2', color: '#dc2626', label: 'Unsuccessful' },
    3: { bg: '#f0fdf4', color: '#15803d', label: 'Completed' },
    4: { bg: '#fef2f2', color: '#dc2626', label: 'Dead' },
    5: { bg: '#f8fafc', color: '#94a3b8', label: 'Skipped' },
    6: { bg: '#eff6ff', color: '#1d4ed8', label: 'Calling...' },
    7: { bg: '#fef2f2', color: '#dc2626', label: 'Failed' },
};

const BatchCallDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [records, setRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [analysis, setAnalysis] = useState<any>({});
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
    const [batchInfo, setBatchInfo] = useState<any>(null);
    const [expandedRecipient, setExpandedRecipient] = useState<string | null>(null);

    useEffect(() => {
        fetchDetails();
    }, [id, page, statusFilter]);

    const fetchDetails = async () => {
        setIsLoading(true);
        try {
            const params: any = { 
                batchIds: id, 
                skip: (page - 1) * PAGE_LIMIT, 
                limit: PAGE_LIMIT,
                sortBy: 'callCreatedAt desc'
            };
            if (search) params.searchStr = search;
            if (statusFilter !== 'all') params.statusFilter = statusFilter;
            
            const res = await batchCallService.details(params);
            setRecords(res.data?.data || []);
            setTotal(res.data?.totalCount || 0);
            setAnalysis(res.data?.analysis || {});
            
            if (res.data?.data?.length > 0) {
                const first = res.data.data[0];
                setBatchInfo({
                    name: first.batchName,
                    agent: first.callAgentId,
                    scheduled: first.utcDateTime,
                    started: first.actualStartDateTime,
                    status: first.batchStatus
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchDetails();
    };

    const inputStyle: React.CSSProperties = { height: '38px', paddingLeft: '12px', paddingRight: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none' };

    const StatCard = ({ label, value, icon: Icon, color }: any) => (
        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '16px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${color}15`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={22} />
            </div>
            <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>{value || 0}</div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginTop: '2px' }}>{label}</div>
            </div>
        </div>
    );

    return (
        <div style={{ width: '100%', minHeight: '100%', boxSizing: 'border-box' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button 
                        onClick={() => navigate('/batch-calls')}
                        style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>{batchInfo?.name || 'Campaign Details'}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px', fontSize: '13px', color: '#64748b' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={14} /> {batchInfo?.agent || 'No Agent'}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={14} /> {batchInfo?.scheduled ? new Date(batchInfo.scheduled).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <form onSubmit={handleSearch} style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Search recipients..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: '36px', width: '100%', maxWidth: '300px' }}
                        />
                    </form>
                    <select 
                        value={statusFilter} 
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{ ...inputStyle, minWidth: '140px' }}
                    >
                        <option value="all">All Status</option>
                        <option value="3">Completed</option>
                        <option value="6">Processing</option>
                        <option value="1">Queued</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '32px', width: '100%' }}>
                <StatCard label="Total Leads" value={analysis.total} icon={PhoneCall} color="#6366f1" />
                <StatCard label="Completed" value={analysis.complete} icon={CheckCircle2} color="#22c55e" />
                <StatCard label="In Process" value={analysis.processing} icon={Clock} color="#3b82f6" />
                <StatCard label="Failed" value={analysis.failed} icon={XCircle} color="#ef4444" />
                <StatCard label="Meetings" value={analysis.meeting} icon={Calendar} color="#8b5cf6" />
            </div>

            {/* Table */}
            <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead style={{ background: '#f9fafb' }}>
                            <tr>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Recipient</th>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Duration</th>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Time</th>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Classification</th>
                                <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>History</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Loading recipients...</td></tr>
                            ) : records.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>No recipients found.</td></tr>
                            ) : records.map(r => {
                                const status = RECIPIENT_STATUS[r.recipientStatus] || RECIPIENT_STATUS[1];
                                return (
                                    <React.Fragment key={r._id}>
                                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '16px 20px' }}>
                                                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{r.name || 'Unknown'}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{r.phoneNumber}</div>
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: status.bg, color: status.color, textTransform: 'uppercase' }}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>
                                                {r.callDuration ? `${Math.floor(r.callDuration / 60)}:${(r.callDuration % 60).toString().padStart(2, '0')}` : '—'}
                                            </td>
                                            <td style={{ padding: '16px 20px', fontSize: '13px', color: '#475569' }}>
                                                {r.callCreatedAt ? new Date(r.callCreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
                                                    {r.callLeadStatus ? (
                                                        <span style={{ padding: '4px 8px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', fontWeight: 500 }}>
                                                            {r.callLeadStatus}
                                                        </span>
                                                    ) : '—'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                <button 
                                                    onClick={() => setExpandedRecipient(expandedRecipient === r._id ? null : r._id)}
                                                    style={{ border: 'none', background: 'none', color: '#6366f1', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    View History {expandedRecipient === r._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedRecipient === r._id && (
                                            <tr style={{ background: '#fcfdfe' }}>
                                                <td colSpan={6} style={{ padding: '12px 20px 24px 20px' }}>
                                                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', padding: '16px' }}>
                                                        <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Call History</h4>
                                                        {r.callHistory?.length > 0 ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                {r.callHistory.map((h: any, i: number) => (
                                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                                            <span style={{ fontWeight: 600, color: '#475569' }}>Attempt {h.attempt || i + 1}</span>
                                                                            <span style={{ color: '#94a3b8' }}>{new Date(h.timestamp || h.callCreatedAt).toLocaleString()}</span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                            <span style={{ color: '#64748b' }}>{h.duration || 0}s</span>
                                                                            <span style={{ fontWeight: 600, color: h.status === 'completed' ? '#15803d' : '#dc2626' }}>{h.status || h.disconnectionReason}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '12px' }}>No history found for this recipient.</div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Pagination */}
            {total > PAGE_LIMIT && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
                    <button 
                        onClick={() => setPage(p => Math.max(1, p - 1))} 
                        disabled={page === 1}
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>Page {page} of {Math.ceil(total / PAGE_LIMIT)}</span>
                    <button 
                        onClick={() => setPage(p => p + 1)} 
                        disabled={page >= Math.ceil(total / PAGE_LIMIT)}
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: page >= Math.ceil(total / PAGE_LIMIT) ? 'not-allowed' : 'pointer', opacity: page >= Math.ceil(total / PAGE_LIMIT) ? 0.5 : 1 }}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

const ChevronRight = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);

export default BatchCallDetails;
