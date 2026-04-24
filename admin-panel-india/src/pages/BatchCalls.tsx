import React, { useEffect, useState } from 'react';
import { batchCallService } from '../api/batchCallService';
import { companyService } from '../api/companyService';
import { useAuth } from '../Helper/AuthContext';
import { PhoneCall, Plus, Search, Trash2, X, ChevronLeft, ChevronRight, ChevronDown, Play, RefreshCw } from 'lucide-react';
import Toast from '../Component/toaster/Toast';

const PAGE_LIMIT = 15;

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    pending:    { bg: '#fff7ed', color: '#c2410c' },
    running:    { bg: '#eff6ff', color: '#1d4ed8' },
    completed:  { bg: '#f0fdf4', color: '#15803d' },
    failed:     { bg: '#fef2f2', color: '#dc2626' },
    stopped:    { bg: '#f9fafb', color: '#6b7280' },
};

const StatusBadge = ({ status }: { status: any }) => {
    const s = STATUS_COLORS[String(status ?? '').toLowerCase()] || STATUS_COLORS.stopped;
    return (
        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color, textTransform: 'capitalize' }}>
            {status || 'Unknown'}
        </span>
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
        fetchRecords();
    }, [page, companyId]);

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const params: any = { skip: (page - 1) * PAGE_LIMIT, limit: PAGE_LIMIT };
            if (companyId) params.companyId = companyId;
            if (search) params.searchStr = search;
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
        <div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: '#0a0a0a' }}>Batch Calls</h1>
                    <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>Upload contacts and run outbound batch call campaigns.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {isSuperAdmin && companies.length > 0 && (
                        <div style={{ position: 'relative' }}>
                            <select value={companyId} onChange={e => { setCompanyId(e.target.value); setPage(1); }}
                                style={{ ...inputStyle, paddingLeft: '32px', paddingRight: '28px', appearance: 'none', cursor: 'pointer', color: '#0a0a0a' }}>
                                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                            <ChevronDown size={13} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#b0b4ba', pointerEvents: 'none' }} />
                        </div>
                    )}
                    <form onSubmit={handleSearch} style={{ position: 'relative' }}>
                        <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#b0b4ba', pointerEvents: 'none' }} />
                        <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: '34px', width: '200px' }}
                            onFocus={e => { e.target.style.borderColor = '#0a485e'; e.target.style.boxShadow = '0 0 0 3px rgba(10,72,94,0.08)'; }}
                            onBlur={e => { e.target.style.borderColor = '#e2e4e9'; e.target.style.boxShadow = 'none'; }} />
                    </form>
                    <button className="btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={16} /> New Batch
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
                            <table>
                                <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                                    <tr>
                                        <th>Name</th>
                                        <th>Total</th>
                                        <th>Completed</th>
                                        <th>Failed</th>
                                        <th>Status</th>
                                        <th style={{ width: '110px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map(r => (
                                        <tr key={r._id}>
                                            <td style={{ fontWeight: 600, color: '#0a0a0a' }}>{r.name || '–'}</td>
                                            <td>{r.totalContacts ?? r.total ?? '–'}</td>
                                            <td>{r.completedCalls ?? r.completed ?? '–'}</td>
                                            <td>{r.failedCalls ?? r.failed ?? '–'}</td>
                                            <td><StatusBadge status={r.status} /></td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {r.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleStartCall(r)}
                                                            disabled={actionLoading === r._id + '_start'}
                                                            title="Start Call"
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', display: 'flex' }}
                                                            onMouseEnter={e => (e.currentTarget.style.color = '#15803d')}
                                                            onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                                                            <Play size={15} />
                                                        </button>
                                                    )}
                                                    {(r.status === 'failed' || r.status === 'completed') && (
                                                        <button
                                                            onClick={() => handleRetry(r)}
                                                            disabled={actionLoading === r._id + '_retry'}
                                                            title="Retry"
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', display: 'flex' }}
                                                            onMouseEnter={e => (e.currentTarget.style.color = '#0a485e')}
                                                            onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                                                            <RefreshCw size={15} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(r)}
                                                        disabled={actionLoading === r._id + '_delete'}
                                                        title="Delete"
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', display: 'flex' }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={page} total={total} limit={PAGE_LIMIT} onPage={p => setPage(p)} />
                    </>
                )}
            </div>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '460px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>New Batch Call</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
                        </div>
                        <BatchCallForm
                            companyId={companyId}
                            onClose={() => { setShowModal(false); fetchRecords(); }}
                            onError={msg => setToast({ message: msg, type: 'error' })}
                            onSuccess={msg => setToast({ message: msg, type: 'success' })}
                        />
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) { onError('Please select a CSV file.'); return; }
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('name', name);
            fd.append('companyId', companyId);
            await batchCallService.create(fd);
            onSuccess('Batch call created successfully.');
            onClose();
        } catch (err: any) {
            onError(err.response?.data?.message || 'Failed to create batch call.');
        } finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Batch Name *</label>
                <input required style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Campaign June 2025" />
            </div>
            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Contacts CSV *</label>
                <input
                    required
                    type="file"
                    accept=".csv"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    style={{ ...inputStyle, padding: '7px 12px', cursor: 'pointer' }}
                />
                <p style={{ fontSize: '11px', color: '#aaa', marginTop: '6px' }}>CSV must include a phone number column.</p>
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '42px' }}>
                {loading ? 'Uploading...' : 'Create Batch'}
            </button>
        </form>
    );
};

export default BatchCalls;
