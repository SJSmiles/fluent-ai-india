import React, { useEffect, useState } from 'react';
import { companyService } from '../api/companyService';
import { useAuth } from '../Helper/AuthContext';
import { Plus, Search, Building2, Globe, ToggleLeft, ToggleRight, X, AlertCircle, Loader2, Pencil } from 'lucide-react';

// ─── Confirm Modal ────────────────────────────────────────────────────────────
const ConfirmModal = ({
    title, message, confirmLabel, confirmColor, onConfirm, onCancel,
}: {
    title: string; message: string; confirmLabel: string; confirmColor: string;
    onConfirm: () => void; onCancel: () => void;
}) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
        <div style={{ background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ padding: '32px 28px 24px', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: `${confirmColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${confirmColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertCircle size={22} style={{ color: confirmColor }} />
                    </div>
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0a0a0a', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>{title}</h2>
                <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.6 }}>{message}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '0 28px 28px' }}>
                <button onClick={onCancel} style={{ height: '42px', borderRadius: '10px', border: '1px solid #e2e4e9', background: '#f9fafb', color: '#444', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }} onMouseEnter={e => (e.currentTarget.style.background = '#f0f1f3')} onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}>Cancel</button>
                <button onClick={onConfirm} style={{ height: '42px', borderRadius: '10px', border: 'none', background: confirmColor, color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }} onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>{confirmLabel}</button>
            </div>
        </div>
    </div>
);

// ─── Companies Page ───────────────────────────────────────────────────────────
const Companies: React.FC = () => {
    const { user } = useAuth();
    const [companies, setCompanies] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [confirm, setConfirm] = useState<{ company: any; action: 'activate' | 'deactivate' } | null>(null);
    const [editCompany, setEditCompany] = useState<any>(null);

    useEffect(() => { fetchCompanies(); }, []);

    const fetchCompanies = async () => {
        setIsLoading(true);
        try {
            const res = await companyService.getAll();
            setCompanies(res.data.data || []);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    const requestToggle = (company: any) => {
        if (company._id === user?.companyId) return;
        setConfirm({ company, action: company.isActive ? 'deactivate' : 'activate' });
    };

    const handleConfirm = async () => {
        if (!confirm) return;
        const { company } = confirm;
        setConfirm(null);
        setTogglingId(company._id);
        try {
            company.isActive
                ? await companyService.deactivate(company._id)
                : await companyService.activate(company._id);
            await fetchCompanies();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Action failed');
        } finally {
            setTogglingId(null);
        }
    };

    const filtered = companies.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.domain.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: '#0a0a0a' }}>Companies</h1>
                    <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>Manage all companies, toggle status, and create new ones.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#b0b4ba', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="Search by name or domain..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ height: '38px', paddingLeft: '34px', paddingRight: '12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', fontFamily: 'inherit', width: '240px' }}
                            onFocus={e => { e.target.style.borderColor = '#4f46e5'; e.target.style.boxShadow = '0 0 0 3px rgba(10,72,94,0.08)'; }}
                            onBlur={e => { e.target.style.borderColor = '#e2e4e9'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>
                    <button className="btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={16} /> Add Company
                    </button>
                </div>
            </div>

            <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
                {isLoading ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Loading...</div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa' }}>
                        <Building2 size={36} style={{ margin: '0 auto 12px', color: '#ddd', display: 'block' }} />
                        <span style={{ fontSize: '13px' }}>No companies found.</span>
                    </div>
                ) : (
                    <table>
                        <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                            <tr><th>Name</th><th>Domain</th><th>Max Users</th><th>Reseller</th><th>Status</th><th style={{ width: '80px' }}>Actions</th></tr>
                        </thead>
                        <tbody>
                            {filtered.map(company => {
                                const isOwnCompany = company._id === user?.companyId;
                                return (
                                    <tr key={company._id}>
                                        <td style={{ fontWeight: 600, color: '#0a0a0a' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Building2 size={15} style={{ color: '#b0b4ba' }} /> {company.name}</span>
                                        </td>
                                        <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Globe size={13} style={{ color: '#ccc' }} /> {company.domain}</span></td>
                                        <td>{company.maxUsersAllowed}</td>
                                        <td>{company.isReseller ? 'Yes' : 'No'}</td>
                                        <td><span className={`badge ${company.isActive ? 'badge-active' : 'badge-inactive'}`}>{company.isActive ? 'Active' : 'Inactive'}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <button onClick={() => setEditCompany(company)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', display: 'flex' }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = '#4f46e5')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                                                    <Pencil size={15} />
                                                </button>
                                                {!isOwnCompany && (
                                                    <button onClick={() => requestToggle(company)} title={company.isActive ? 'Deactivate' : 'Activate'} disabled={togglingId === company._id} style={{ background: 'none', border: 'none', cursor: togglingId === company._id ? 'not-allowed' : 'pointer', padding: '4px', display: 'flex', opacity: togglingId === company._id ? 0.5 : 1 }}>
                                                        {togglingId === company._id ? <Loader2 size={22} style={{ color: '#4f46e5', animation: 'spin 0.8s linear infinite' }} /> : company.isActive ? <ToggleRight size={22} style={{ color: '#059669' }} /> : <ToggleLeft size={22} style={{ color: '#bbb' }} />}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Create Company Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '560px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 20px', borderBottom: '1px solid #f0f1f3', flexShrink: 0 }}>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>Create Company</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', color: '#999', cursor: 'pointer', display: 'flex', border: 'none' }}><X size={20} /></button>
                        </div>
                        <div style={{ overflowY: 'auto', padding: '24px 28px 28px', flex: 1 }}>
                            <CompanyForm onClose={() => { setShowModal(false); fetchCompanies(); }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Company Modal */}
            {editCompany && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 28px 20px', borderBottom: '1px solid #f0f1f3', flexShrink: 0 }}>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>Edit Company</h2>
                            <button onClick={() => setEditCompany(null)} style={{ background: 'none', color: '#999', cursor: 'pointer', display: 'flex', border: 'none' }}><X size={20} /></button>
                        </div>
                        <div style={{ overflowY: 'auto', padding: '24px 28px 28px', flex: 1 }}>
                            <EditCompanyForm
                                company={editCompany}
                                onClose={() => { setEditCompany(null); fetchCompanies(); }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {confirm && (
                <ConfirmModal
                    title={confirm.action === 'deactivate' ? 'Deactivate Company' : 'Activate Company'}
                    message={confirm.action === 'deactivate' ? `Are you sure you want to deactivate "${confirm.company.name}"? Users of this company will lose access.` : `Are you sure you want to activate "${confirm.company.name}"?`}
                    confirmLabel={confirm.action === 'deactivate' ? 'Deactivate' : 'Activate'}
                    confirmColor={confirm.action === 'deactivate' ? '#dc2626' : '#059669'}
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirm(null)}
                />
            )}
        </div>
    );
};

// ─── Company Form ─────────────────────────────────────────────────────────────
const CompanyForm = ({ onClose }: { onClose: () => void }) => {
    const [form, setForm] = useState({
        name: '', domain: '', maxUsersAllowed: 4, isReseller: false,
        address: { street: '', houseNo: '', city: '', zipCode: '', state: '' },
        user: { name: '', emailLocal: '', userName: '', password: '' },
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
    const setUser = (k: string, v: string) => setForm(p => ({ ...p, user: { ...p.user, [k]: v } }));
    const setAddress = (k: string, v: string) => setForm(p => ({ ...p, address: { ...p.address, [k]: v } }));

    const handleSubmit = async (e: { preventDefault(): void }) => {
        e.preventDefault();
        setLoading(true); setError('');
        const fullEmail = form.user.emailLocal ? `${form.user.emailLocal}@${form.domain}` : '';
        const payload = { ...form, user: { name: form.user.name, email: fullEmail, userName: form.user.userName, password: form.user.password } };
        try { await companyService.create(payload); onClose(); }
        catch (err: any) { setError(err.response?.data?.message || 'Failed to create company'); }
        finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Company Name *</label><input required style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="My Company" /></div>
                <div><label style={labelStyle}>Domain *</label><input required style={inputStyle} value={form.domain} onChange={e => set('domain', e.target.value)} placeholder="mycompany.com" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div><label style={labelStyle}>Max Users</label><input type="number" min="1" style={inputStyle} value={form.maxUsersAllowed} onChange={e => set('maxUsersAllowed', parseInt(e.target.value) || 4)} /></div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                        <input type="checkbox" checked={form.isReseller} onChange={e => set('isReseller', e.target.checked)} style={{ accentColor: '#4f46e5' }} /> Is Reseller
                    </label>
                </div>
            </div>
            <div style={{ borderTop: '1px solid #f0f1f3', paddingTop: '16px', marginBottom: '14px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>Admin User (auto-created)</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Name</label><input style={inputStyle} value={form.user.name} onChange={e => setUser('name', e.target.value)} placeholder="John Doe" /></div>
                <div><label style={labelStyle}>Username *</label><input required style={inputStyle} value={form.user.userName} onChange={e => setUser('userName', e.target.value)} placeholder="johndoe" /></div>
            </div>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Email</label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e4e9', borderRadius: '8px', background: '#f9fafb', overflow: 'hidden' }}>
                    <input style={{ flex: 1, padding: '10px 12px', border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a' }} value={form.user.emailLocal} onChange={e => setUser('emailLocal', e.target.value)} placeholder="john" />
                    <span style={{ padding: '10px 12px 10px 0', fontSize: '13px', color: form.domain ? '#4f46e5' : '#aaa', fontWeight: 500, whiteSpace: 'nowrap' }}>@{form.domain || 'mycompany.com'}</span>
                </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Password *</label>
                <input required type="password" style={inputStyle} value={form.user.password} onChange={e => setUser('password', e.target.value)} placeholder="••••••••" />
            </div>
            <div style={{ borderTop: '1px solid #f0f1f3', paddingTop: '16px', marginBottom: '14px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>Address (optional)</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Street</label><input style={inputStyle} value={form.address.street} onChange={e => setAddress('street', e.target.value)} placeholder="Main St" /></div>
                <div><label style={labelStyle}>House No.</label><input style={inputStyle} value={form.address.houseNo} onChange={e => setAddress('houseNo', e.target.value)} placeholder="42" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div><label style={labelStyle}>City</label><input style={inputStyle} value={form.address.city} onChange={e => setAddress('city', e.target.value)} placeholder="New York" /></div>
                <div><label style={labelStyle}>Zip Code</label><input style={inputStyle} value={form.address.zipCode} onChange={e => setAddress('zipCode', e.target.value)} placeholder="10001" /></div>
                <div><label style={labelStyle}>State</label><input style={inputStyle} value={form.address.state} onChange={e => setAddress('state', e.target.value)} placeholder="NY" /></div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '42px' }}>
                {loading ? 'Creating...' : 'Create Company'}
            </button>
        </form>
    );
};

// ─── Edit Company Form ─────────────────────────────────────────────────────────
const EditCompanyForm = ({ company, onClose }: { company: any; onClose: () => void }) => {
    const [form, setForm] = useState({
        name: company.name || '',
        maxUsersAllowed: company.maxUsersAllowed || 4,
        address: {
            street: company.address?.street || '',
            houseNo: company.address?.houseNo || '',
            city: company.address?.city || '',
            zipCode: company.address?.zipCode || '',
            state: company.address?.state || '',
        },
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const setAddress = (k: string, v: string) => setForm(p => ({ ...p, address: { ...p.address, [k]: v } }));

    const handleSubmit = async (e: { preventDefault(): void }) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            await companyService.update(company._id, { name: form.name, maxUsersAllowed: form.maxUsersAllowed, address: form.address });
            onClose();
        } catch (err: any) { setError(err.response?.data?.message || 'Failed to update company'); }
        finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Company Name *</label><input required style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="My Company" /></div>
                <div><label style={labelStyle}>Max Users</label><input type="number" min="1" style={inputStyle} value={form.maxUsersAllowed} onChange={e => setForm(p => ({ ...p, maxUsersAllowed: parseInt(e.target.value) || 4 }))} /></div>
            </div>
            <div style={{ borderTop: '1px solid #f0f1f3', paddingTop: '16px', marginBottom: '14px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>Address (optional)</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Street</label><input style={inputStyle} value={form.address.street} onChange={e => setAddress('street', e.target.value)} placeholder="Main St" /></div>
                <div><label style={labelStyle}>House No.</label><input style={inputStyle} value={form.address.houseNo} onChange={e => setAddress('houseNo', e.target.value)} placeholder="42" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div><label style={labelStyle}>City</label><input style={inputStyle} value={form.address.city} onChange={e => setAddress('city', e.target.value)} placeholder="New York" /></div>
                <div><label style={labelStyle}>Zip Code</label><input style={inputStyle} value={form.address.zipCode} onChange={e => setAddress('zipCode', e.target.value)} placeholder="10001" /></div>
                <div><label style={labelStyle}>State</label><input style={inputStyle} value={form.address.state} onChange={e => setAddress('state', e.target.value)} placeholder="NY" /></div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '42px' }}>
                {loading ? 'Saving...' : 'Save Changes'}
            </button>
        </form>
    );
};

export default Companies;
