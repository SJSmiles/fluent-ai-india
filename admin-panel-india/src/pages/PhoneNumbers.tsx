import React, { useEffect, useState } from 'react';
import { phoneNumberService } from '../api/phoneNumberService';
import { companyService } from '../api/companyService';
import { useAuth } from '../Helper/AuthContext';
import { Phone, Plus, Search, Pencil, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
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

const PhoneNumbers: React.FC = () => {
    const { user } = useAuth();
    const [records, setRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [companies, setCompanies] = useState<any[]>([]);
    const [companyId, setCompanyId] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editRecord, setEditRecord] = useState<any>(null);
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

    const isSuperAdmin = user?.isAdmin && user?.isSuperAdmin;

    useEffect(() => {
        if (isSuperAdmin) {
            companyService.getAll().then(res => {
                const list = res.data.data || [];
                setCompanies(list);
                const defaultId = user?.companyId || list[0]?._id || '';
                setCompanyId(defaultId);
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
            const params: any = { skip: (page - 1) * PAGE_LIMIT, limit: PAGE_LIMIT, companyId };
            if (search) params.searchStr = search;
            const res = await phoneNumberService.listing(params);
            setRecords(res.data?.data?.phoneNumbers || []);
            setTotal(res.data?.data?.total || 0);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchRecords();
    };

    const inputStyle: React.CSSProperties = { height: '38px', paddingLeft: '12px', paddingRight: '12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', fontFamily: 'inherit' };

    return (
        <div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: '#0a0a0a' }}>Phone Numbers</h1>
                    <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>Manage phone numbers assigned to your system.</p>
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
                    <button className="btn-primary" onClick={() => { setEditRecord(null); setShowModal(true); }}>
                        <Plus size={16} /> Add Number
                    </button>
                </div>
            </div>

            <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                {isLoading ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Loading...</div>
                ) : records.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa' }}>
                        <Phone size={36} style={{ margin: '0 auto 12px', color: '#ddd', display: 'block' }} />
                        <span style={{ fontSize: '13px' }}>No phone numbers found.</span>
                    </div>
                ) : (
                    <>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            <table>
                                <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                                    <tr><th>Name</th><th>Phone Number</th><th style={{ width: '80px' }}>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {records.map(r => (
                                        <tr key={r._id}>
                                            <td style={{ fontWeight: 600, color: '#0a0a0a' }}>{r.name || '–'}</td>
                                            <td>{r.phoneNumber || '–'}</td>
                                            <td>
                                                <button onClick={() => { setEditRecord(r); setShowModal(true); }} title="Edit"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', display: 'flex' }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = '#0a485e')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                                                    <Pencil size={15} />
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

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '460px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>{editRecord ? 'Edit Phone Number' : 'Add Phone Number'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
                        </div>
                        <PhoneNumberForm
                            record={editRecord}
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

const PhoneNumberForm = ({ record, companyId, onClose, onError, onSuccess }: {
    record: any; companyId: string;
    onClose: () => void; onError: (m: string) => void; onSuccess: (m: string) => void;
}) => {
    const [form, setForm] = useState({ name: record?.name || '', phoneNumber: record?.phoneNumber || '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (record?._id) {
                await phoneNumberService.update({ _id: record._id, ...form });
                onSuccess('Phone number updated successfully.');
            } else {
                await phoneNumberService.create({ ...form, companyId });
                onSuccess('Phone number created successfully.');
            }
            onClose();
        } catch (err: any) {
            onError(err.response?.data?.message || 'Failed to save phone number.');
        } finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Name *</label>
                <input required style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Line" />
            </div>
            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Phone Number *</label>
                <input required style={inputStyle} value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} placeholder="+91XXXXXXXXXX" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '42px' }}>
                {loading ? 'Saving...' : record ? 'Save Changes' : 'Add Phone Number'}
            </button>
        </form>
    );
};

export default PhoneNumbers;
