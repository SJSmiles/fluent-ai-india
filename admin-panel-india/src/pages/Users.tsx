import React, { useEffect, useState } from 'react';
import { userService } from '../api/userService';
import { roleService } from '../api/roleService';
import { companyService } from '../api/companyService';
import { useAuth } from '../Helper/AuthContext';
import { Users as UsersIcon, Plus, Search, Trash2, Building2, ShieldCheck, X, ChevronLeft, ChevronRight, ChevronDown, Pencil, Key } from 'lucide-react';
import Toast from '../Component/toaster/Toast';

const PAGE_LIMIT = 10;

// ─── Pagination ───────────────────────────────────────────────────────────────
const Pagination = ({ page, totalPages, totalRecords, limit, onPage }: {
    page: number; totalPages: number; totalRecords: number; limit: number; onPage: (p: number) => void;
}) => {
    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, totalRecords);
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #f0f1f3' }}>
            <span style={{ fontSize: '12px', color: '#999' }}>Showing {from}–{to} of {totalRecords}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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

// ─── Users Page ───────────────────────────────────────────────────────────────
const Users: React.FC = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ totalRecords: 0, totalPages: 1, currentPage: 1, limit: PAGE_LIMIT });
    const [companiesList, setCompaniesList] = useState<{ _id: string; name: string }[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
    const [editUser, setEditUser] = useState<any>(null);
    const [resetPassUser, setResetPassUser] = useState<any>(null);

    // Step 1: Fetch company filter listing on mount → get default companyId
    useEffect(() => {
        companyService.getFilterListing()
            .then(res => {
                const list = res.data.data || [];
                setCompaniesList(list);
                // Pick current user's companyId as default
                const defaultId = user?.companyId || (list[0]?._id ?? '');
                setSelectedCompanyId(defaultId);
                // selectedCompanyId change triggers Step 2 (user listing)
            })
            .catch(err => console.error(err));
    }, [user?.companyId]);

    // Step 2: Fetch users — runs only after Step 1 sets selectedCompanyId
    // Guard ensures user listing is NOT called before company listing resolves
    useEffect(() => {
        if (!selectedCompanyId) return;
        fetchUsers(page, selectedCompanyId);
    }, [page, selectedCompanyId]);

    const fetchUsers = async (p: number, companyId: string) => {
        setIsLoading(true);
        try {
            const params: any = { page: p, limit: PAGE_LIMIT };
            if (companyId) params.companyId = companyId;
            const res = await userService.getAll(params);
            setUsers(res.data.data || []);
            setPagination(res.data.pagination);
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    const handleCompanyChange = (id: string) => {
        setSelectedCompanyId(id);
        setPage(1);
        setSearchQuery('');
    };

    const archiveUser = async (id: string) => {
        if (!window.confirm('Archive this user?')) return;
        try {
            await userService.delete(id);
            fetchUsers(page, selectedCompanyId);
        } catch (err: any) { alert(err.response?.data?.message || 'Failed'); }
    };

    const filtered = users.filter(u =>
        !searchQuery ||
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handlePageChange = (p: number) => { setPage(p); setSearchQuery(''); };

    const showCompanyDropdown = companiesList.length > 0;

    return (
        <div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: '#0a0a0a' }}>Users</h1>
                    <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>Manage users, assign roles, and control access.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
                    {/* Company Dropdown */}
                    {showCompanyDropdown && (
                        <div style={{ position: 'relative' }}>
                            <Building2 size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#b0b4ba', pointerEvents: 'none' }} />
                            <select
                                value={selectedCompanyId}
                                onChange={e => handleCompanyChange(e.target.value)}
                                style={{ height: '38px', paddingLeft: '32px', paddingRight: '32px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a', cursor: 'pointer', appearance: 'none' }}
                                onFocus={e => { e.target.style.borderColor = '#0a485e'; e.target.style.boxShadow = '0 0 0 3px rgba(10,72,94,0.08)'; }}
                                onBlur={e => { e.target.style.borderColor = '#e2e4e9'; e.target.style.boxShadow = 'none'; }}
                            >
                                {companiesList.map(c => (
                                    <option key={c._id} value={c._id}>{c.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={13} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#b0b4ba', pointerEvents: 'none' }} />
                        </div>
                    )}
                    <div style={{ position: 'relative' }}>
                        <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#b0b4ba', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ height: '38px', paddingLeft: '34px', paddingRight: '12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', fontFamily: 'inherit', width: '200px' }}
                            onFocus={e => { e.target.style.borderColor = '#0a485e'; e.target.style.boxShadow = '0 0 0 3px rgba(10,72,94,0.08)'; }}
                            onBlur={e => { e.target.style.borderColor = '#e2e4e9'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>
                    <button className="btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={16} /> Add User
                    </button>
                </div>
            </div>

            <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                {isLoading ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Loading...</div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa' }}>
                        <UsersIcon size={36} style={{ margin: '0 auto 12px', color: '#ddd', display: 'block' }} />
                        <span style={{ fontSize: '13px' }}>No users found.</span>
                    </div>
                ) : (
                    <>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                        <table>
                            <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                                <tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th style={{ width: '80px' }}>Actions</th></tr>
                            </thead>
                            <tbody>
                                {filtered.map(u => (
                                    <tr key={u._id}>
                                        <td style={{ fontWeight: 600, color: '#0a0a0a' }}>{u.name}</td>
                                        <td>{u.userName}</td>
                                        <td>{u.email || '–'}</td>
                                        <td>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                <ShieldCheck size={13} style={{ color: '#0a485e' }} /> {u.roleId?.name || '–'}
                                            </span>
                                        </td>
                                        <td>
                                            {!u.isArchived && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <button onClick={() => setEditUser(u)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', display: 'flex' }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = '#0a485e')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button onClick={() => setResetPassUser(u)} title="Change Password" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', display: 'flex' }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = '#0a485e')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                                                        <Key size={15} />
                                                    </button>
                                                    <button onClick={() => archiveUser(u._id)} title="Archive" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', display: 'flex' }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        </div>
                        <Pagination
                            page={pagination.currentPage}
                            totalPages={pagination.totalPages}
                            totalRecords={pagination.totalRecords}
                            limit={pagination.limit}
                            onPage={handlePageChange}
                        />
                    </>
                )}
            </div>

            {editUser && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>Edit User</h2>
                            <button onClick={() => setEditUser(null)} style={{ background: 'none', color: '#999', cursor: 'pointer', display: 'flex', border: 'none' }}><X size={20} /></button>
                        </div>
                        <EditUserForm
                            user={editUser}
                            companiesList={companiesList}
                            onClose={() => { setEditUser(null); fetchUsers(page, selectedCompanyId); }}
                            onError={msg => setToast({ message: msg, type: 'error' })}
                            onSuccess={msg => setToast({ message: msg, type: 'success' })}
                        />
                    </div>
                </div>
            )}

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>Create User</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', color: '#999', cursor: 'pointer', display: 'flex', border: 'none' }}><X size={20} /></button>
                        </div>
                        <UserForm
                            selectedCompanyId={selectedCompanyId}
                            companiesList={companiesList}
                            onClose={() => { setShowModal(false); fetchUsers(page, selectedCompanyId); }}
                            onError={msg => setToast({ message: msg, type: 'error' })}
                        />
                    </div>
                </div>
            )}

            {resetPassUser && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '440px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>Reset Password</h2>
                                <p style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>Setting new password for <strong>{resetPassUser.name || resetPassUser.userName}</strong></p>
                            </div>
                            <button onClick={() => setResetPassUser(null)} style={{ background: 'none', color: '#999', cursor: 'pointer', display: 'flex', border: 'none' }}><X size={20} /></button>
                        </div>
                        <ResetPasswordForm user={resetPassUser} onClose={() => setResetPassUser(null)} onError={msg => setToast({ message: msg, type: 'error' })} onSuccess={msg => setToast({ message: msg, type: 'success' })} />
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── User Form ────────────────────────────────────────────────────────────────
const UserForm = ({ onClose, selectedCompanyId, companiesList, onError }: {
    onClose: () => void;
    selectedCompanyId: string;
    companiesList: { _id: string; name: string; domain?: string }[];
    onError: (msg: string) => void;
}) => {
    const [form, setForm] = useState({ name: '', phoneNumber: '', userName: '', password: '', roleId: '' });
    const [emailLocal, setEmailLocal] = useState('');
    const [emailError, setEmailError] = useState('');
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const selectedCompany = companiesList.find(c => c._id === selectedCompanyId);
    const domain = selectedCompany?.domain || '';

    useEffect(() => {
        if (!selectedCompanyId) return;
        roleService.getFilterList({ companyId: selectedCompanyId })
            .then(res => setRoles(res.data.data || []))
            .catch(err => console.error(err));
        setForm(f => ({ ...f, roleId: '' }));
        setEmailLocal('');
        setEmailError('');
    }, [selectedCompanyId]);

    const validateEmailLocal = (val: string) => {
        if (!val) return '';
        if (!/^[a-zA-Z0-9._%+\-]+$/.test(val)) return 'Only letters, numbers, dots, _ + - allowed';
        return '';
    };

    const handleSubmit = async (e: { preventDefault(): void }) => {
        e.preventDefault();
        const err = validateEmailLocal(emailLocal);
        if (err) { setEmailError(err); return; }
        setLoading(true);
        try {
            const email = emailLocal && domain ? `${emailLocal}@${domain}` : emailLocal;
            await userService.create({ ...form, email, companyId: selectedCompanyId });
            onClose();
        }
        catch (err: any) { onError(err.response?.data?.message || 'Failed to create user.'); }
        finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            {/* Role — first */}
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Role *</label>
                <select required style={{ ...inputStyle, appearance: 'auto' as any }} value={form.roleId} onChange={e => setForm({ ...form, roleId: e.target.value })}>
                    <option value="">Select role</option>
                    {roles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
            </div>
            {/* Name + Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Name *</label><input required style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" /></div>
                <div><label style={labelStyle}>Phone *</label><input required style={inputStyle} value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} placeholder="+1234567890" /></div>
            </div>
            {/* Email with @domain suffix */}
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Email</label>
                <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${emailError ? '#dc2626' : '#e2e4e9'}`, borderRadius: '8px', overflow: 'hidden', background: '#f9fafb' }}>
                    <input
                        style={{ flex: 1, padding: '10px 12px', border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontFamily: 'inherit', color: '#0a0a0a' }}
                        value={emailLocal}
                        onChange={e => { setEmailLocal(e.target.value); setEmailError(validateEmailLocal(e.target.value)); }}
                        placeholder="username"
                    />
                    {domain && (
                        <span style={{ padding: '10px 12px', background: '#f0f1f3', color: '#666', fontSize: '13px', borderLeft: '1px solid #e2e4e9', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                            @{domain}
                        </span>
                    )}
                </div>
                {emailError && <p style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>{emailError}</p>}
            </div>
            {/* Username + Password */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div><label style={labelStyle}>Username *</label><input required style={inputStyle} value={form.userName} onChange={e => setForm({ ...form, userName: e.target.value })} placeholder="johndoe" /></div>
                <div><label style={labelStyle}>Password *</label><input required type="password" style={inputStyle} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '42px' }}>
                {loading ? 'Creating...' : 'Create User'}
            </button>
        </form>
    );
};

// ─── Edit User Form ───────────────────────────────────────────────────────────
const EditUserForm = ({ user, companiesList, onClose, onError, onSuccess }: {
    user: any;
    companiesList: { _id: string; name: string; domain?: string }[];
    onClose: () => void;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}) => {
    const { user: currentUser } = useAuth();
    const companyId = user.companyId?._id || user.companyId;
    const companyDomain = companiesList.find(c => c._id === companyId)?.domain || '';
    const isSelf = user._id === currentUser?._id;

    // Parse existing email into localpart
    const existingEmail = user.email || '';
    const existingLocal = existingEmail.includes('@') ? existingEmail.split('@')[0] : existingEmail;

    const [form, setForm] = useState({
        name: user.name || '',
        phoneNumber: user.phoneNumber || '',
        userName: user.userName || '',
        roleId: user.roleId?._id || user.roleId || '',
    });
    const [emailLocal, setEmailLocal] = useState(existingLocal);
    const [emailError, setEmailError] = useState('');
    const [roles, setRoles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!companyId) return;
        roleService.getFilterList({ companyId })
            .then(res => setRoles(res.data.data || []))
            .catch(err => console.error(err));
    }, [companyId]);

    const validateEmailLocal = (val: string) => {
        if (!val) return '';
        if (!/^[a-zA-Z0-9._%+\-]+$/.test(val)) return 'Only letters, numbers, dots, _ + - allowed';
        return '';
    };

    const handleSubmit = async (e: { preventDefault(): void }) => {
        e.preventDefault();
        const err = validateEmailLocal(emailLocal);
        if (err) { setEmailError(err); return; }
        setLoading(true);
        try {
            const email = emailLocal && companyDomain ? `${emailLocal}@${companyDomain}` : emailLocal;
            await userService.update(user._id, { ...form, email });
            onSuccess('User updated successfully.');
            onClose();
        } catch (err: any) { onError(err.response?.data?.message || 'Failed to update user.'); }
        finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            {/* Role — first */}
            {!isSelf && (
                <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>Role *</label>
                    <select required style={{ ...inputStyle, appearance: 'auto' as any }} value={form.roleId} onChange={e => setForm({ ...form, roleId: e.target.value })}>
                        <option value="">Select role</option>
                        {roles.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                    </select>
                </div>
            )}
            {/* Name + Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Name *</label><input required style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" /></div>
                <div><label style={labelStyle}>Phone *</label><input required style={inputStyle} value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} placeholder="+1234567890" /></div>
            </div>
            {/* Email with @domain suffix */}
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Email</label>
                <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${emailError ? '#dc2626' : '#e2e4e9'}`, borderRadius: '8px', overflow: 'hidden', background: '#f9fafb' }}>
                    <input
                        style={{ flex: 1, padding: '10px 12px', border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', fontFamily: 'inherit', color: '#0a0a0a' }}
                        value={emailLocal}
                        onChange={e => { setEmailLocal(e.target.value); setEmailError(validateEmailLocal(e.target.value)); }}
                        placeholder="username"
                    />
                    {companyDomain && (
                        <span style={{ padding: '10px 12px', background: '#f0f1f3', color: '#666', fontSize: '13px', borderLeft: '1px solid #e2e4e9', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                            @{companyDomain}
                        </span>
                    )}
                </div>
                {emailError && <p style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>{emailError}</p>}
            </div>
            {/* Username */}
            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Username *</label>
                <input required style={inputStyle} value={form.userName} onChange={e => setForm({ ...form, userName: e.target.value })} placeholder="johndoe" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '42px' }}>
                {loading ? 'Saving...' : 'Save Changes'}
            </button>
        </form>
    );
};

const ResetPasswordForm = ({ user, onClose, onError, onSuccess }: { user: any; onClose: () => void; onError: (msg: string) => void; onSuccess: (msg: string) => void; }) => {
    const [form, setForm] = useState({ password: '', confirmPassword: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password.length < 6) { onError('Password must be at least 6 characters.'); return; }
        if (form.password !== form.confirmPassword) { onError('Passwords do not match.'); return; }

        setLoading(true);
        try {
            await userService.resetPassword(user._id, form);
            onSuccess('Password updated successfully.');
            onClose();
        } catch (err: any) {
            onError(err.response?.data?.message || 'Failed to update password.');
        } finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>New Password *</label>
                <input required type="password" style={inputStyle} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
            <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Confirm New Password *</label>
                <input required type="password" style={inputStyle} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '42px' }}>
                {loading ? 'Updating...' : 'Set New Password'}
            </button>
        </form>
    );
};

export default Users;
