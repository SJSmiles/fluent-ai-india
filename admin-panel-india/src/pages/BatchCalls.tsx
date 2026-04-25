import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { batchCallService } from '../api/batchCallService';
import { companyService } from '../api/companyService';
import { useAuth } from '../Helper/AuthContext';
import { PhoneCall, Plus, Search, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, Play, RefreshCw, Calendar, Clock, Upload, Trash, Info } from 'lucide-react';
import { agentService } from '../api/agentService';
import { phoneNumberService } from '../api/phoneNumberService';
import Toast from '../Component/toaster/Toast';
import * as XLSX from 'xlsx';

const PAGE_LIMIT = 15;

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
    '1': { bg: '#f1f5f9', color: '#64748b', label: 'Draft' },
    '3': { bg: '#fff7ed', color: '#c2410c', label: 'Scheduled' },
    '4': { bg: '#eff6ff', color: '#1d4ed8', label: 'Running' },
    '5': { bg: '#f0fdf4', color: '#15803d', label: 'Completed' },
    '6': { bg: '#fef2f2', color: '#dc2626', label: 'Failed' },
    '7': { bg: '#fef2f2', color: '#dc2626', label: 'Error' },
    'pending':   { bg: '#f1f5f9', color: '#64748b', label: 'Draft' },
    'running':   { bg: '#eff6ff', color: '#1d4ed8', label: 'Running' },
    'completed': { bg: '#f0fdf4', color: '#15803d', label: 'Completed' },
    'failed':    { bg: '#fef2f2', color: '#dc2626', label: 'Failed' },
    'stopped':   { bg: '#f9fafb', color: '#6b7280', label: 'Stopped' },
};

const StatusBadge = ({ status }: { status: any }) => {
    const key = String(status ?? '').toLowerCase();
    const s = STATUS_COLORS[key] || STATUS_COLORS.stopped;
    return (
        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            {s.label}
        </span>
    );
};

const ProgressBar = ({ total, completed, failed }: { total: number; completed: number; failed: number }) => {
    if (!total || total === 0) return (
        <div style={{ width: '120px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#cbd5e1', marginBottom: '4px', fontWeight: 600 }}>
                <span>0%</span>
                <span>0/0</span>
            </div>
            <div style={{ height: '6px', width: '100%', background: '#f1f5f9', borderRadius: '3px' }} />
        </div>
    );
    const progress = Math.round(((completed + failed) / total) * 100);
    const completedWidth = Math.round((completed / total) * 100);
    const failedWidth = Math.round((failed / total) * 100);

    return (
        <div style={{ width: '120px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: 600 }}>
                <span>{progress}%</span>
                <span>{completed + failed}/{total}</span>
            </div>
            <div style={{ height: '6px', width: '100%', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${completedWidth}%`, height: '100%', background: '#22c55e' }} />
                <div style={{ width: `${failedWidth}%`, height: '100%', background: '#ef4444' }} />
            </div>
        </div>
    );
};

const Pagination = ({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) => {
    const totalPages = Math.ceil(total / limit);
    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);
    if (totalPages <= 1) return null;
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #f0f1f3' }}>
            <span style={{ fontSize: '12px', color: '#999' }}>Showing {from}–{to} of {total}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => onPage(page - 1)} disabled={page === 1} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e4e9', borderRadius: '8px', background: page === 1 ? '#f9fafb' : '#fff', color: page === 1 ? '#ccc' : '#555', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
                    <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => onPage(p)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', borderColor: p === page ? '#0a485e' : '#e2e4e9', background: p === page ? '#0a485e' : '#fff', color: p === page ? '#fff' : '#555' }}>
                        {p}
                    </button>
                ))}
                <button onClick={() => onPage(page + 1)} disabled={page === Math.ceil(total / limit)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e4e9', borderRadius: '8px', background: page === Math.ceil(total / limit) ? '#f9fafb' : '#fff', color: page === Math.ceil(total / limit) ? '#ccc' : '#555', cursor: page === Math.ceil(total / limit) ? 'not-allowed' : 'pointer' }}>
                    <ChevronRight size={15} />
                </button>
            </div>
        </div>
    );
};

const BatchCalls: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [records, setRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [companies, setCompanies] = useState<any[]>([]);
    const [companyId, setCompanyId] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [statusFilter, setStatusFilter] = useState('');
    const [agentFilter, setAgentFilter] = useState('');
    const [agents, setAgents] = useState<any[]>([]);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const isSuperAdmin = user?.isAdmin && user?.isSuperAdmin;

    const inputStyle: React.CSSProperties = { height: '38px', paddingLeft: '12px', paddingRight: '12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', fontFamily: 'inherit' };

    useEffect(() => {
        if (isSuperAdmin) {
            companyService.getAll().then(res => {
                const list = res.data.data || [];
                setCompanies(list);
                setCompanyId(user?.companyId || list[0]?._id || '');
            }).catch(console.error);
        } else {
            setCompanyId(user?.companyId || '');
        }
    }, []);

    useEffect(() => {
        // Prevent double call on mount: wait for companyId to be initialized
        if (companyId || !isSuperAdmin) {
            fetchRecords();
        }
    }, [page, companyId, statusFilter, agentFilter]);

    useEffect(() => {
        if (companyId) {
            agentService.filterListing({ companyId }).then(res => {
                setAgents(res.data.data || []);
            }).catch(console.error);
        }
    }, [companyId]);

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const params: any = { skip: (page - 1) * PAGE_LIMIT, limit: PAGE_LIMIT };
            if (companyId) params.companyId = companyId;
            if (search) params.searchStr = search;
            if (statusFilter) params.status = statusFilter;
            if (agentFilter) params.agentId = agentFilter;
            const res = await batchCallService.listing(params);
            setRecords(res.data?.data || []);
            setTotal(res.data?.totalCount || 0);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchRecords(); };

    const handleStartCall = async (record: any) => {
        setActionLoading(record._id + '_start');
        try {
            await batchCallService.startCall(record._id, { companyId });
            setToast({ message: 'Batch call started.', type: 'success' });
            fetchRecords();
        } catch (err: any) {
            setToast({ message: err.response?.data?.message || 'Failed to start call.', type: 'error' });
        } finally { setActionLoading(null); }
    };

    const handleDelete = async (record: any) => {
        if (!window.confirm(`Delete batch "${record.name || record._id}"?`)) return;
        setActionLoading(record._id + '_delete');
        try {
            await batchCallService.deleteCall(record._id, 'batch');
            setToast({ message: 'Batch deleted.', type: 'success' });
            fetchRecords();
        } catch (err: any) {
            setToast({ message: err.response?.data?.message || 'Failed to delete.', type: 'error' });
        } finally { setActionLoading(null); }
    };

    const handleRetry = async (record: any) => {
        setActionLoading(record._id + '_retry');
        try {
            await batchCallService.retryBatch({ batchCallId: record._id, companyId });
            setToast({ message: 'Retry initiated.', type: 'success' });
            fetchRecords();
        } catch (err: any) {
            setToast({ message: err.response?.data?.message || 'Failed to retry.', type: 'error' });
        } finally { setActionLoading(null); }
    };

    return (
        <div style={{ width: '100%' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Batch Calls</h1>
                    <p style={{ color: '#64748b', fontSize: '15px' }}>Upload contacts and run outbound batch call campaigns.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <form onSubmit={handleSearch}>
                            <input
                                type="text"
                                placeholder="Search campaigns..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ ...inputStyle, paddingLeft: '36px', width: '240px' }}
                            />
                        </form>
                    </div>

                    {isSuperAdmin && companies.length > 0 && (
                        <select 
                            value={companyId} 
                            onChange={e => { setCompanyId(e.target.value); setPage(1); }}
                            style={{ ...inputStyle, minWidth: '160px' }}
                        >
                            {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                    )}

                    <select 
                        value={statusFilter} 
                        onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        style={{ ...inputStyle, minWidth: '130px' }}
                    >
                        <option value="">All Status</option>
                        <option value="1">Draft</option>
                        <option value="3">Scheduled</option>
                        <option value="4">Running</option>
                        <option value="5">Completed</option>
                        <option value="6">Failed</option>
                    </select>

                    <select 
                        value={agentFilter} 
                        onChange={e => { setAgentFilter(e.target.value); setPage(1); }}
                        style={{ ...inputStyle, minWidth: '150px' }}
                    >
                        <option value="">All Agents</option>
                        {agents.map(a => <option key={a._id} value={a.agentId}>{a.agentName}</option>)}
                    </select>

                    <button 
                        onClick={() => setShowModal(true)}
                        style={{ height: '40px', padding: '0 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                    >
                        <Plus size={18} />
                        New Batch
                    </button>
                </div>
            </div>

            <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                {isLoading ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Loading...</div>
                ) : records.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa' }}>
                        <PhoneCall size={36} style={{ margin: '0 auto 12px', color: '#ddd', display: 'block' }} />
                        <span style={{ fontSize: '13px' }}>No batch calls found.</span>
                    </div>
                ) : (
                    <>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 10 }}>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Campaign</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Agent</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Progress</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                                        <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map(r => (
                                        <React.Fragment key={r._id}>
                                            <tr 
                                                onClick={() => navigate(`/batch-calls/${r._id}/details`)}
                                                style={{ cursor: 'pointer', transition: 'background 0.2s', borderBottom: '1px solid #f1f5f9' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                <td style={{ padding: '16px 20px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        {r.followups?.length > 0 && (
                                                            <div 
                                                                onClick={(e) => { e.stopPropagation(); toggleRow(r._id); }}
                                                                style={{ transform: expandedRows[r._id] ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'flex', padding: '4px', borderRadius: '4px', background: '#f1f5f9' }}
                                                            >
                                                                <ChevronDown size={14} color="#94a3b8" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{r.name || 'Untitled Campaign'}</div>
                                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>ID: {r._id.slice(-8).toUpperCase()}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 20px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                                                            {String(r.agentName || 'A')[0].toUpperCase()}
                                                        </div>
                                                        <span style={{ fontSize: '13px', color: '#475569' }}>{r.agentName || 'Default Agent'}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 20px' }}>
                                                    <ProgressBar 
                                                        total={r.totalContacts ?? r.total ?? 0} 
                                                        completed={r.completedCalls ?? r.completed ?? 0} 
                                                        failed={r.failedCalls ?? r.failed ?? 0} 
                                                    />
                                                </td>
                                                <td style={{ padding: '16px 20px' }}>
                                                    <StatusBadge status={r.status} />
                                                </td>
                                                <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                                                        {(r.status === 'pending' || r.status === 1) && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleStartCall(r); }}
                                                                disabled={actionLoading === r._id + '_start'}
                                                                title="Start Campaign"
                                                                style={{ padding: '6px', borderRadius: '8px', border: 'none', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', display: 'flex' }}>
                                                                <Play size={14} fill="currentColor" />
                                                            </button>
                                                        )}
                                                        {(r.status === 'failed' || r.status === 6 || r.status === 'completed' || r.status === 5) && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRetry(r); }}
                                                                disabled={actionLoading === r._id + '_retry'}
                                                                title="Retry Campaign"
                                                                style={{ padding: '6px', borderRadius: '8px', border: 'none', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', display: 'flex' }}>
                                                                <RefreshCw size={14} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); navigate(`/batch-calls/${r._id}/details`); }}
                                                            title="View Details"
                                                            style={{ padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer', display: 'flex' }}>
                                                            <Info size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(r); }}
                                                            disabled={actionLoading === r._id + '_delete'}
                                                            title="Delete"
                                                            style={{ padding: '6px', borderRadius: '8px', border: 'none', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', display: 'flex' }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedRows[r._id] && r.followups?.map((f: any, idx: number) => (
                                                <tr key={f._id} style={{ background: '#fcfdfe' }}>
                                                    <td colSpan={5} style={{ padding: '0' }}>
                                                        <div style={{ padding: '12px 20px 12px 52px', borderLeft: '3px solid #6366f1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                                                                    Follow-up #{idx + 1}
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
                                                                    <RefreshCw size={12} />
                                                                    {f.date} at {f.time}
                                                                </div>
                                                                <StatusBadge status={f.status} />
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                {f.status === 6 && (
                                                                    <button
                                                                        onClick={() => {/* TODO: handleRetryFollowup(r._id, f._id) */}}
                                                                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '11px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                                                                        Retry This
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={page} total={total} limit={PAGE_LIMIT} onPage={p => setPage(p)} />
                    </>
                )}
            </div>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', overflowY: 'auto' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '1200px', minHeight: '600px', height: 'fit-content', maxHeight: 'calc(100% - 40px)', margin: 'auto', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>Create New Campaign</h2>
                                <p style={{ fontSize: '14px', color: '#64748b', marginTop: '2px' }}>Configure your outbound batch call settings.</p>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <BatchCallForm
                                companyId={companyId}
                                onClose={() => { setShowModal(false); fetchRecords(); }}
                                onError={msg => setToast({ message: msg, type: 'error' })}
                                onSuccess={msg => setToast({ message: msg, type: 'success' })}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const BatchCallForm = ({ companyId, onClose, onError, onSuccess }: {
    companyId: string;
    onClose: () => void;
    onError: (m: string) => void;
    onSuccess: (m: string) => void;
}) => {
    const [name, setName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [agents, setAgents] = useState<any[]>([]);
    const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
    const [selectedAgent, setSelectedAgent] = useState('');
    const [selectedPhone, setSelectedPhone] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [followups, setFollowups] = useState<any[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [previewData, setPreviewData] = useState<any[][]>([]);

    useEffect(() => {
        if (companyId) {
            agentService.filterListing({ companyId }).then(res => setAgents(res.data.data || []));
            phoneNumberService.filterListing({ companyId }).then(res => setPhoneNumbers(res.data.data || []));
        }
    }, [companyId]);

    const addFollowup = () => {
        if (followups.length >= 10) return;
        setFollowups([...followups, { date: '', time: '', phoneNumberId: selectedPhone }]);
    };

    const removeFollowup = (idx: number) => {
        setFollowups(followups.filter((_, i) => i !== idx));
    };

    const updateFollowup = (idx: number, key: string, val: any) => {
        const next = [...followups];
        next[idx][key] = val;
        setFollowups(next);
    };

    const handleFile = (f: File) => {
        if (!f.name.endsWith('.csv') && !f.name.endsWith('.xlsx')) {
            onError('Please upload a CSV or Excel file.');
            return;
        }
        setFile(f);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                setPreviewData(json.filter(row => row.length > 0).slice(0, 6));
            } catch (err) {
                console.error('Error parsing file:', err);
                setPreviewData([]);
            }
        };
        reader.readAsArrayBuffer(f);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) { onError('Please select a contacts file.'); return; }
        if (!selectedAgent) { onError('Please select an agent.'); return; }
        if (!selectedPhone) { onError('Please select a phone number.'); return; }
        
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('name', name);
            fd.append('agentId', selectedAgent);
            fd.append('phoneNumberId', selectedPhone);
            fd.append('schedule', 'true');
            fd.append('date', scheduledDate);
            fd.append('time', scheduledTime);
            if (followups.length > 0) {
                fd.append('followUpsDetails', JSON.stringify(followups));
            }
            
            await batchCallService.create(fd);
            onSuccess('Campaign created successfully.');
            onClose();
        } catch (err: any) {
            onError(err.response?.data?.message || 'Failed to create campaign.');
        } finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', height: '38px', padding: '0 10px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', color: '#1e293b', outline: 'none', background: '#fff' };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', height: '100%', minHeight: 0 }}>
            {/* Left Column: All Configuration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: '#fcfdfe', borderRight: '1px solid #eef2ff', padding: '24px', overflowY: 'auto' }}>
                <section>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Campaign Details</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#fff', padding: '20px', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '6px', display: 'block' }}>Campaign Name</label>
                            <input required style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q4 Sales Outreach" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Select Agent</label>
                                <select required style={inputStyle} value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}>
                                    <option value="">Select Agent...</option>
                                    {agents.map(a => <option key={a._id} value={a.agentId}>{a.agentName || a.agentId}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Phone Number</label>
                                <select required style={inputStyle} value={selectedPhone} onChange={e => setSelectedPhone(e.target.value)}>
                                    <option value="">Select Phone...</option>
                                    {phoneNumbers.map(p => <option key={p._id} value={p._id}>{p.phoneNumber} ({p.name})</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Scheduling</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#fff', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={12} /> Date</label>
                            <input type="date" required style={inputStyle} value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={12} /> Time</label>
                            <input type="time" required style={inputStyle} value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
                        </div>
                    </div>
                </section>

                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Follow-ups</h3>
                        <button type="button" onClick={addFollowup} style={{ border: 'none', background: 'none', color: '#6366f1', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Plus size={14} /> Add
                        </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '8px', scrollbarWidth: 'thin' }}>
                        {followups.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '12px', background: '#fff', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                                No follow-ups scheduled yet.
                            </div>
                        ) : followups.map((f, idx) => (
                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr auto', gap: '8px', padding: '10px', background: '#fff', borderRadius: '10px', border: '1px solid #eef2ff', alignItems: 'end' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <label style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Date</label>
                                    <input type="date" style={{ ...inputStyle, height: '32px', fontSize: '11px', padding: '0 6px' }} value={f.date} onChange={e => updateFollowup(idx, 'date', e.target.value)} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <label style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Time</label>
                                    <input type="time" style={{ ...inputStyle, height: '32px', fontSize: '11px', padding: '0 6px' }} value={f.time} onChange={e => updateFollowup(idx, 'time', e.target.value)} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <label style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Phone</label>
                                    <select style={{ ...inputStyle, height: '32px', fontSize: '11px', padding: '0 6px' }} value={f.phoneNumberId} onChange={e => updateFollowup(idx, 'phoneNumberId', e.target.value)}>
                                        <option value="">Select...</option>
                                        {phoneNumbers.map(p => <option key={p._id} value={p._id}>{p.phoneNumber}</option>)}
                                    </select>
                                </div>
                                <button type="button" onClick={() => removeFollowup(idx)} style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                    <Trash size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Right Column: Upload & Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', overflowY: 'auto' }}>
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contacts Upload</h3>
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                const csvContent = "name,phone\nJohn Doe,+1234567890\nJane Smith,+0987654321";
                                const blob = new Blob([csvContent], { type: 'text/csv' });
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'sample_contacts.csv';
                                a.click();
                            }}
                            style={{ border: 'none', background: 'none', color: '#6366f1', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            Download Sample
                        </button>
                    </div>
                    <div 
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
                        style={{ height: '140px', border: '2px dashed', borderColor: isDragging ? '#6366f1' : '#e2e8f0', borderRadius: '20px', background: isDragging ? '#f5f7ff' : '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                        onClick={() => document.getElementById('file-upload')?.click()}
                    >
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                            <Upload size={20} color="#6366f1" />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                                {file ? file.name : 'Choose a file or drag & drop'}
                            </span>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Supports CSV and Excel files</span>
                        </div>
                        <input type="file" id="file-upload" hidden onChange={e => e.target.files && handleFile(e.target.files[0])} accept=".csv,.xlsx" />
                    </div>

                    {file && (
                        <div style={{ marginTop: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Uploaded Contacts</span>
                                    <span style={{ fontSize: '11px', padding: '2px 8px', background: '#eef2ff', color: '#6366f1', borderRadius: '6px', fontWeight: 700 }}>{previewData.length > 0 ? `${previewData.length - 1} records` : 'Processing...'}</span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => { setFile(null); setPreviewData([]); }} 
                                    style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Trash size={14} /> Clear Selection
                                </button>
                            </div>
                            <div style={{ border: '1px solid #eef2ff', borderRadius: '20px', background: '#fff', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02)' }}>
                                {previewData.length > 0 ? (
                                    <div style={{ overflowX: 'auto', maxHeight: '240px', overflowY: 'auto' }}>
                                        <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                            <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                                                <tr>
                                                    {previewData[0].map((col: any, i: number) => (
                                                        <th key={i} style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{col || `Column ${i+1}`}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewData.slice(1).map((row: any[], i: number) => (
                                                    <tr key={i} style={{ transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#fcfdfe'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                        {row.map((cell: any, j: number) => (
                                                            <td key={j} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', color: '#1e293b' }}>{cell}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div style={{ padding: '48px', textAlign: 'center' }}>
                                        <div style={{ width: '24px', height: '24px', border: '3px solid #f1f5f9', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                                        <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>Reading file content...</span>
                                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                                    </div>
                                )}
                            </div>
                            {previewData.length >= 6 && (
                                <div style={{ marginTop: '12px', color: '#94a3b8', fontSize: '11px', textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                    <Info size={12} />
                                    Showing the first 5 records. Scroll to see more.
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <div style={{ marginTop: 'auto', display: 'flex', gap: '16px', paddingTop: '32px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ flex: 1 }} /> {/* Spacer to push buttons to the right */}
                    <button type="button" onClick={onClose} style={{ width: '140px', height: '48px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                        Cancel
                    </button>
                    <button type="submit" disabled={loading} style={{ width: '220px', height: '48px', borderRadius: '12px', border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)', transition: 'all 0.2s' }}>
                        {loading ? 'Creating...' : 'Create Campaign'}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default BatchCalls;
