import React, { useEffect, useState } from 'react';
import { phoneNumberService } from '../api/phoneNumberService';
import { companyService } from '../api/companyService';
import { useAuth } from '../Helper/AuthContext';
import { Phone, Plus, Search, Pencil, X, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import Toast from '../Component/toaster/Toast';

const PAGE_LIMIT = 10;

const Pagination = ({ page, totalPages, totalRecords, limit, onPage }: {
    page: number; totalPages: number; totalRecords: number; limit: number; onPage: (p: number) => void;
}) => {
    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, totalRecords);
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>Showing {from}–{to} of {totalRecords} records</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                    onClick={() => onPage(page - 1)} 
                    disabled={page === 1} 
                    style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: page === 1 ? '#cbd5e1' : '#64748b', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                    <ChevronLeft size={18} />
                </button>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button 
                            key={p} 
                            onClick={() => onPage(p)} 
                            style={{ minWidth: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', borderColor: p === page ? '#6366f1' : '#e2e8f0', background: p === page ? '#6366f1' : '#fff', color: p === page ? '#fff' : '#64748b' }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
                <button 
                    onClick={() => onPage(page + 1)} 
                    disabled={page === totalPages} 
                    style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: page === totalPages ? '#cbd5e1' : '#64748b', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                >
                    <ChevronRight size={18} />
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



    return (
        <div style={{ width: '100%' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Phone Numbers</h1>
                    <p style={{ color: '#64748b', fontSize: '15px' }}>Manage phone numbers assigned to your system.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isSuperAdmin && companies.length > 0 && (
                        <div style={{ position: 'relative' }}>
                            <Building2 size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                            <select
                                value={companyId}
                                onChange={e => { setCompanyId(e.target.value); setPage(1); }}
                                style={{ height: '44px', paddingLeft: '36px', paddingRight: '32px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: '#fff', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: '180px' }}
                            >
                                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}
                    <form onSubmit={handleSearch} style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Search numbers..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ height: '44px', paddingLeft: '40px', paddingRight: '16px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', width: '240px', outline: 'none', transition: 'all 0.2s' }}
                            onFocus={e => e.target.style.borderColor = '#6366f1'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </form>
                    <button 
                        onClick={() => { setEditRecord(null); setShowModal(true); }}
                        style={{ height: '44px', padding: '0 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'}
                        onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}
                    >
                        <Plus size={18} /> Add Number
                    </button>
                </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
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
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1, boxShadow: 'inset 0 1px 0 #e2e8f0, inset 0 -1px 0 #e2e8f0' }}>
                                    <tr>
                                        <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                                        <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone Number</th>
                                        <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map(r => (
                                        <tr key={r._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '12px 24px', fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{r.name || '–'}</td>
                                            <td style={{ padding: '12px 24px', color: '#64748b', fontSize: '14px' }}>{r.phoneNumber || '–'}</td>
                                            <td style={{ padding: '12px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <button onClick={() => { setEditRecord(r); setShowModal(true); }} title="Edit"
                                                        style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                                        onMouseEnter={e => e.currentTarget.style.color = '#6366f1'}
                                                        onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
                                                        <Pencil size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={page} totalPages={Math.ceil(total / PAGE_LIMIT)} totalRecords={total} limit={PAGE_LIMIT} onPage={p => setPage(p)} />
                    </>
                )}
            </div>

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '460px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>{editRecord ? 'Edit Phone Number' : 'Add Phone Number'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
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

    const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', background: '#f8fafc', outline: 'none', transition: 'all 0.2s', color: '#1e293b' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Name *</label>
                <input required style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Line" onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            </div>
            <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Phone Number *</label>
                <input required style={inputStyle} value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} placeholder="+91XXXXXXXXXX" onFocus={e => e.target.style.borderColor = '#6366f1'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
            </div>
            <button 
                type="submit" 
                disabled={loading}
                style={{ 
                    width: '100%', 
                    height: '44px', 
                    background: '#6366f1', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '12px', 
                    fontSize: '14px', 
                    fontWeight: 600, 
                    cursor: 'pointer', 
                    boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.2)',
                    transition: 'all 0.2s' 
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
                {loading ? 'Saving...' : record ? 'Save Changes' : 'Add Phone Number'}
            </button>
        </form>
    );
};

export default PhoneNumbers;
