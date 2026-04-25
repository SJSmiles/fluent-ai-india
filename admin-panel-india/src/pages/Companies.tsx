import React, { useEffect, useState } from 'react';
import { companyService } from '../api/companyService';
import { useAuth } from '../Helper/AuthContext';
import { Plus, Search, Building2, Globe, X, AlertCircle, Loader2, Pencil, ToggleRight, ToggleLeft, Eye, EyeOff } from 'lucide-react';
import Toast from '../Component/toaster/Toast';

const PAGE_LIMIT = 10;

// ─── Pagination ───────────────────────────────────────────────────────────────
const Pagination = ({ page, totalPages, totalRecords, limit, onPage }: {
    page: number; totalPages: number; totalRecords: number; limit: number; onPage: (p: number) => void;
}) => {
    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, totalRecords);
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>Showing {from}–{to} of {totalRecords} companies</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                    onClick={() => onPage(page - 1)} 
                    disabled={page === 1} 
                    style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: page === 1 ? '#cbd5e1' : '#64748b', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                    <ToggleLeft size={18} />
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
                    <ToggleRight size={18} />
                </button>
            </div>
        </div>
    );
};

// ─── Companies Page ───────────────────────────────────────────────────────────
const Companies: React.FC = () => {
    const { user } = useAuth();
    const [companies, setCompanies] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ totalRecords: 0, totalPages: 1, currentPage: 1, limit: PAGE_LIMIT });
    const [confirmToggleCompany, setConfirmToggleCompany] = useState<any>(null);
    const [editCompany, setEditCompany] = useState<any>(null);
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

    useEffect(() => { fetchCompanies(page); }, [page]);

    const fetchCompanies = async (p: number) => {
        setIsLoading(true);
        try {
            const res = await companyService.getAll({ skip: (p - 1) * PAGE_LIMIT, limit: PAGE_LIMIT });
            const raw = res.data?.data?.companies || res.data?.companies || res.data?.data || [];
            const pag = res.data?.data?.pagination || res.data?.pagination || { total: raw.length };
            
            setCompanies(Array.isArray(raw) ? raw : []);
            setPagination({
                totalRecords: pag.total || raw.length,
                totalPages: Math.ceil((pag.total || raw.length) / PAGE_LIMIT),
                currentPage: p,
                limit: PAGE_LIMIT
            });
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    const handleToggleStatus = (company: any) => {
        if (company._id === user?.companyId) {
            setToast({ message: "You cannot deactivate your own company", type: 'error' });
            return;
        }
        setConfirmToggleCompany(company);
    };

    const confirmToggleStatus = async () => {
        if (!confirmToggleCompany) return;
        const newStatus = !confirmToggleCompany.isActive;
        try {
            await companyService.toggleStatus({ _id: confirmToggleCompany._id, isActive: newStatus });
            setToast({ message: `Company ${newStatus ? 'activated' : 'deactivated'} successfully`, type: 'success' });
            fetchCompanies(page);
        } catch (err: any) { alert(err.response?.data?.message || 'Failed to update status'); }
        finally { setConfirmToggleCompany(null); }
    };

    const filtered = companies.filter(c =>
        !searchQuery ||
        (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.domain || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const inputStyle: React.CSSProperties = { height: '44px', paddingLeft: '40px', paddingRight: '16px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', width: '280px', outline: 'none', transition: 'all 0.2s' };

    return (
        <div style={{ width: '100%' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Confirmation Modal */}
            {confirmToggleCompany && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: confirmToggleCompany.isActive ? '#fef2f2' : '#f0fdf4', color: confirmToggleCompany.isActive ? '#ef4444' : '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <Building2 size={24} />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                                {confirmToggleCompany.isActive ? 'Deactivate Company?' : 'Activate Company?'}
                            </h3>
                            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
                                {confirmToggleCompany.isActive ? (
                                    <>Are you sure you want to deactivate <b>{confirmToggleCompany.name}</b>? All associated users will lose access.</>
                                ) : (
                                    <>Are you sure you want to activate this company?</>
                                )}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setConfirmToggleCompany(null)} style={{ flex: 1, height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={confirmToggleStatus} style={{ flex: 1, height: '40px', borderRadius: '10px', border: 'none', background: confirmToggleCompany.isActive ? '#ef4444' : '#4f46e5', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                                {confirmToggleCompany.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Companies</h1>
                    <p style={{ color: '#64748b', fontSize: '15px' }}>Manage organizational entities and global configurations.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Search companies..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#6366f1'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>
                    <button 
                        onClick={() => setShowModal(true)}
                        style={{ height: '44px', padding: '0 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                    >
                        <Plus size={18} /> Add Company
                    </button>
                </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                {isLoading ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                        <Building2 size={36} style={{ margin: '0 auto 12px', color: '#cbd5e1', display: 'block' }} />
                        <span>No companies found.</span>
                    </div>
                ) : (
                    <>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#f9fafb' }}>
                                <tr>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Company</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Domain</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Created</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', width: '100px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(c => (
                                    <tr key={c._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px 24px' }}>
                                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{c.name}</div>
                                            <div style={{ color: '#64748b', fontSize: '12px' }}>{c.description?.slice(0, 40) || 'No description'}</div>
                                        </td>
                                        <td style={{ padding: '12px 24px', color: '#64748b', fontSize: '14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Globe size={14} /> {c.domain}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 24px', color: '#64748b', fontSize: '13px' }}>
                                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            {c._id === user?.companyId ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: '#f0fdf4', color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>
                                                    Active
                                                </div>
                                            ) : (
                                                <div 
                                                    onClick={() => handleToggleStatus(c)}
                                                    style={{ width: '40px', height: '22px', background: c.isActive ? '#4f46e5' : '#cbd5e1', borderRadius: '20px', padding: '2px', cursor: 'pointer', position: 'relative', transition: 'all 0.3s' }}
                                                >
                                                    <div style={{ width: '18px', height: '18px', background: '#fff', borderRadius: '50%', position: 'absolute', left: c.isActive ? '20px' : '2px', transition: 'all 0.3s' }} />
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <button onClick={() => setEditCompany(c)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                    <Pencil size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <Pagination 
                            page={pagination.currentPage} 
                            totalPages={pagination.totalPages} 
                            totalRecords={pagination.totalRecords} 
                            limit={pagination.limit} 
                            onPage={setPage} 
                        />
                    </>
                )}
            </div>

            {/* Create Company Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '650px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Add Company</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                        </div>
                        <CompanyForm onClose={() => { setShowModal(false); fetchCompanies(page); }} onError={msg => setToast({ message: msg, type: 'error' })} />
                    </div>
                </div>
            )}

            {/* Edit Company Modal */}
            {editCompany && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '650px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Edit Company</h2>
                            <button onClick={() => setEditCompany(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                        </div>
                        <EditCompanyForm company={editCompany} onClose={() => { setEditCompany(null); fetchCompanies(page); }} onError={msg => setToast({ message: msg, type: 'error' })} />
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Company Form ─────────────────────────────────────────────────────────────
const CompanyForm = ({ onClose, onError }: { onClose: () => void; onError: (msg: string) => void }) => {
    const [form, setForm] = useState({
        name: '', description: '', domain: '', 
        plivoAuthId: '', plivoAuthToken: '', 
        elevenLabsApiKey: '', deepgramApiKey: '',
        firstName: '', lastName: '', email: '', password: '',
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...form,
                email: `${form.email}@${form.domain}`
            };
            await companyService.create(payload);
            onClose();
        } catch (err: any) { onError(err.response?.data?.message || 'Failed'); }
        finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Company Name *</label><input required style={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Company Name" /></div>
                <div><label style={labelStyle}>Domain *</label><input required style={inputStyle} value={form.domain} onChange={e => setForm({...form, domain: e.target.value})} placeholder="company.com" /></div>
            </div>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Description *</label>
                <textarea required style={{ ...inputStyle, height: '60px', resize: 'none' }} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Brief description..." />
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>API Configurations</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Plivo Auth ID *</label><input required style={inputStyle} value={form.plivoAuthId} onChange={e => setForm({...form, plivoAuthId: e.target.value})} placeholder="Auth ID" /></div>
                <div><label style={labelStyle}>Plivo Token *</label><input required style={inputStyle} value={form.plivoAuthToken} onChange={e => setForm({...form, plivoAuthToken: e.target.value})} placeholder="Auth Token" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>ElevenLabs API Key *</label><input required style={inputStyle} value={form.elevenLabsApiKey} onChange={e => setForm({...form, elevenLabsApiKey: e.target.value})} placeholder="API Key" /></div>
                <div><label style={labelStyle}>Deepgram API Key *</label><input required style={inputStyle} value={form.deepgramApiKey} onChange={e => setForm({...form, deepgramApiKey: e.target.value})} placeholder="API Key" /></div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Admin User Account</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Admin First Name *</label><input required style={inputStyle} value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} placeholder="First Name" /></div>
                <div><label style={labelStyle}>Admin Last Name *</label><input required style={inputStyle} value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} placeholder="Last Name" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                    <label style={labelStyle}>Admin Email *</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f9fafb', overflow: 'hidden' }}>
                        <input 
                            required 
                            style={{ flex: 1, padding: '10px 12px', border: 'none', background: 'transparent', fontSize: '13px', outline: 'none' }} 
                            value={form.email} 
                            onChange={e => setForm({...form, email: e.target.value})} 
                            placeholder="admin" 
                        />
                        <span style={{ padding: '0 12px', fontSize: '13px', color: form.domain ? '#6366f1' : '#94a3b8', background: '#f1f5f9', height: '100%', display: 'flex', alignItems: 'center', fontWeight: 600, borderLeft: '1px solid #e2e8f0' }}>
                            @{form.domain || 'domain.com'}
                        </span>
                    </div>
                </div>
                <div>
                    <label style={labelStyle}>Admin Password *</label>
                    <div style={{ position: 'relative' }}>
                        <input 
                            required 
                            type={showPassword ? "text" : "password"} 
                            style={{ ...inputStyle, paddingRight: '40px' }} 
                            value={form.password} 
                            onChange={e => setForm({...form, password: e.target.value})} 
                            placeholder="••••••••" 
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
            </div>

            <button type="submit" disabled={loading} style={{ width: '100%', height: '44px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>
                {loading ? 'Creating...' : 'Create Company'}
            </button>
        </form>
    );
};

// ─── Edit Company Form ─────────────────────────────────────────────────────────
const EditCompanyForm = ({ company, onClose, onError }: { company: any; onClose: () => void; onError: (msg: string) => void }) => {
    const [form, setForm] = useState({
        _id: company._id,
        name: company.name || '',
        description: company.description || '',
        domain: company.domain || '',
        plivoAuthId: company.plivoAuthId || '',
        plivoAuthToken: company.plivoAuthToken || '',
        elevenLabsApiKey: company.elevenLabsApiKey || '',
        deepgramApiKey: company.deepgramApiKey || '',
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await companyService.update(form);
            onClose();
        } catch (err: any) { onError(err.response?.data?.message || 'Failed'); }
        finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Company Name *</label><input required style={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div><label style={labelStyle}>Domain *</label><input required style={inputStyle} value={form.domain} onChange={e => setForm({...form, domain: e.target.value})} /></div>
            </div>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Description *</label>
                <textarea required style={{ ...inputStyle, height: '60px', resize: 'none' }} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Plivo Auth ID *</label><input required style={inputStyle} value={form.plivoAuthId} onChange={e => setForm({...form, plivoAuthId: e.target.value})} /></div>
                <div><label style={labelStyle}>Plivo Token *</label><input required style={inputStyle} value={form.plivoAuthToken} onChange={e => setForm({...form, plivoAuthToken: e.target.value})} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div><label style={labelStyle}>ElevenLabs API Key *</label><input required style={inputStyle} value={form.elevenLabsApiKey} onChange={e => setForm({...form, elevenLabsApiKey: e.target.value})} /></div>
                <div><label style={labelStyle}>Deepgram API Key *</label><input required style={inputStyle} value={form.deepgramApiKey} onChange={e => setForm({...form, deepgramApiKey: e.target.value})} /></div>
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', height: '44px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>
                {loading ? 'Saving...' : 'Save Changes'}
            </button>
        </form>
    );
};

export default Companies;
