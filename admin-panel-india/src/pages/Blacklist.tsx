import React, { useEffect, useState } from 'react';
import { blacklistService } from '../api/blacklistService';
import { companyService } from '../api/companyService';
import { useAuth } from '../Helper/AuthContext';
import { Ban, Search, Trash2, X, AlertCircle, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import Toast from '../Component/toaster/Toast';

const PAGE_LIMIT = 15;

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
                <button onClick={() => onPage(page + 1)} disabled={page === totalPages} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e4e9', borderRadius: '8px', background: page === totalPages ? '#f9fafb' : '#fff', color: page === totalPages ? '#ccc' : '#555', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
                    <ChevronRight size={15} />
                </button>
            </div>
        </div>
    );
};

const ConfirmModal = ({ number, onConfirm, onCancel }: { number: string; onConfirm: () => void; onCancel: () => void }) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
        <div style={{ background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '32px 28px 24px', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <AlertCircle size={26} style={{ color: '#dc2626' }} />
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0a0a0a', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Whitelist Number?</h2>
                <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.6 }}>Are you sure you want to whitelist <strong>{number}</strong>? This action cannot be undone.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '0 28px 28px' }}>
                <button onClick={onCancel} style={{ height: '42px', borderRadius: '10px', border: '1px solid #e2e4e9', background: '#f9fafb', color: '#444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={onConfirm} style={{ height: '42px', borderRadius: '10px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Whitelist</button>
            </div>
        </div>
    </div>
);

const Blacklist: React.FC = () => {
    const { user } = useAuth();
    const [records, setRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [companies, setCompanies] = useState<any[]>([]);
    const [companyId, setCompanyId] = useState('');
    const [confirm, setConfirm] = useState<any>(null);
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

    const isSuperAdmin = user?.isAdmin && user?.isSuperAdmin;

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
        if (!companyId) return;
        fetchRecords();
    }, [page, companyId]);

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const params: any = { skip: (page - 1) * PAGE_LIMIT, limit: PAGE_LIMIT, companyId, sortBy: 'updatedAt desc' };
            if (search) params.searchStr = search;
            const res = await blacklistService.listing(params);
            setRecords(res.data?.data || []);
            setTotal(res.data?.totalCount || 0);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchRecords();
    };

    const handleWhitelist = async () => {
        if (!confirm) return;
        try {
            await blacklistService.unBlacklist(confirm._id);
            setToast({ message: 'Number whitelisted successfully.', type: 'success' });
            setConfirm(null);
            fetchRecords();
        } catch (err: any) {
            setToast({ message: err.response?.data?.message || 'Failed to whitelist number.', type: 'error' });
            setConfirm(null);
        }
    };

    const inputStyle: React.CSSProperties = { height: '38px', paddingLeft: '12px', paddingRight: '12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', fontFamily: 'inherit' };

    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';

    return (
        <div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirm && <ConfirmModal number={confirm.toNumber} onConfirm={handleWhitelist} onCancel={() => setConfirm(null)} />}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: '#0a0a0a' }}>Blacklist</h1>
                    <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>View and manage blacklisted numbers.</p>
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
                        <input type="text" placeholder="Search number or email..." value={search} onChange={e => setSearch(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: '34px', width: '220px' }}
                            onFocus={e => { e.target.style.borderColor = '#0a485e'; e.target.style.boxShadow = '0 0 0 3px rgba(10,72,94,0.08)'; }}
                            onBlur={e => { e.target.style.borderColor = '#e2e4e9'; e.target.style.boxShadow = 'none'; }} />
                    </form>
                </div>
            </div>

            <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                {isLoading ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Loading...</div>
                ) : records.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa' }}>
                        <Ban size={36} style={{ margin: '0 auto 12px', color: '#ddd', display: 'block' }} />
                        <span style={{ fontSize: '13px' }}>No blacklisted numbers found.</span>
                    </div>
                ) : (
                    <>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            <table>
                                <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                                    <tr><th>Phone Number</th><th>Email</th><th>Name</th><th>Client ID</th><th>Updated At</th><th style={{ width: '80px' }}>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {records.map(r => (
                                        <tr key={r._id}>
                                            <td style={{ fontWeight: 600, color: '#0a0a0a' }}>{r.toNumber || '–'}</td>
                                            <td>{r.email || '–'}</td>
                                            <td>{r.clientName || '–'}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#666' }}>{r.bmbyId || '–'}</td>
                                            <td style={{ fontSize: '12px', color: '#888' }}>{formatDate(r.updatedAt)}</td>
                                            <td>
                                                <button onClick={() => setConfirm(r)} title="Whitelist"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', display: 'flex' }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                                                    <Trash2 size={15} />
                                                </button>
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
        </div>
    );
};

export default Blacklist;
