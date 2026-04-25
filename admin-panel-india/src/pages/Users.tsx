import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { userService } from '../api/userService';
import { companyService } from '../api/companyService';
import { useAuth } from '../Helper/AuthContext';
import { Users as UsersIcon, Plus, Search, Trash2, X, ChevronLeft, ChevronRight, Pencil, Eye, EyeOff } from 'lucide-react';
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
            <span style={{ fontSize: '14px', color: '#64748b' }}>Showing {from}–{to} of {totalRecords} users</span>
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

const Avatar = ({ name, color }: { name: string; color?: string }) => {
    const initials = (name || '').split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    const bgColors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
    const randomColor = color || bgColors[Math.abs(name?.length || 0) % bgColors.length];
    
    return (
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: randomColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: 600 }}>
            {initials}
        </div>
    );
};

// ─── Users Page ───────────────────────────────────────────────────────────────
const Users: React.FC = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
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
    const [confirmToggleUser, setConfirmToggleUser] = useState<any>(null);

    const isSuperAdmin = user?.superAdmin || user?.isSuperAdmin;

    const inputStyle: React.CSSProperties = { height: '44px', paddingLeft: '12px', paddingRight: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#fff', transition: 'all 0.2s' };

    // Step 1: Fetch company listing on mount → get default companyId
    useEffect(() => {
        // If NOT superAdmin, we don't need to fetch company list
        if (!isSuperAdmin) {
            const defaultId = user?.companyId || '';
            setSelectedCompanyId(defaultId);
            return;
        }

        companyService.getFilterListing()
            .then(res => {
                const raw = res.data?.data?.companies || res.data?.companies || res.data?.data || res.data || [];
                const list = Array.isArray(raw) ? raw : [];
                setCompaniesList(list);
                
                // 1. Priority: URL param
                // 2. Fallback: current user's companyId
                // 3. Last fallback: first company in list
                const urlCompanyId = searchParams.get('companyId');
                const defaultId = urlCompanyId || user?.companyId || (list[0]?._id ?? '');
                
                setSelectedCompanyId(defaultId);
                if (urlCompanyId !== defaultId) {
                    setSearchParams({ companyId: defaultId }, { replace: true });
                }
            })
            .catch(err => console.error(err));
    }, [isSuperAdmin, user?.companyId]);

    const handleCompanyChange = (id: string) => {
        setSelectedCompanyId(id);
        setSearchParams({ companyId: id });
        setPage(1);
    };

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
            if (res.data.pagination) {
                setPagination(res.data.pagination);
            }
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };



    const archiveUser = async (id: string) => {
        if (!window.confirm('Delete this user?')) return;
        try {
            await userService.delete(id);
            fetchUsers(page, selectedCompanyId);
        } catch (err: any) { alert(err.response?.data?.message || 'Failed'); }
    };

    const handleToggleStatus = async (user: any) => {
        setConfirmToggleUser(user);
    };

    const confirmToggleStatus = async () => {
        if (!confirmToggleUser) return;
        const newStatus = confirmToggleUser.status === 1 ? 0 : 1;
        try {
            await userService.toggleStatus({ _id: confirmToggleUser._id, status: newStatus });
            setToast({ message: `User ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`, type: 'success' });
            fetchUsers(page, selectedCompanyId);
        } catch (err: any) { alert(err.response?.data?.message || 'Failed to update status'); }
        finally { setConfirmToggleUser(null); }
    };

    const filtered = (users || []).filter(u =>
        !searchQuery ||
        (u.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.lastName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handlePageChange = (p: number) => { setPage(p); setSearchQuery(''); };





    return (
        <div style={{ width: '100%' }}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Confirmation Modal for Toggle Status */}
            {confirmToggleUser && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: confirmToggleUser.status === 1 ? '#fef2f2' : '#f0fdf4', color: confirmToggleUser.status === 1 ? '#ef4444' : '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <UsersIcon size={24} />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                                {confirmToggleUser.status === 1 ? 'Deactivate User?' : 'Activate User?'}
                            </h3>
                            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
                                {confirmToggleUser.status === 1 ? (
                                    <>Are you sure you want to deactivate <b>{confirmToggleUser.firstName} {confirmToggleUser.lastName}</b> ({confirmToggleUser.email})?</>
                                ) : (
                                    <>Are you sure you want to activate this user?</>
                                )}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setConfirmToggleUser(null)} style={{ flex: 1, height: '40px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={confirmToggleStatus} style={{ flex: 1, height: '40px', borderRadius: '10px', border: 'none', background: confirmToggleUser.status === 1 ? '#ef4444' : '#4f46e5', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                                {confirmToggleUser.status === 1 ? 'Deactivate' : 'Activate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Users</h1>
                    <p style={{ color: '#64748b', fontSize: '15px' }}>Manage users, assign roles, and control access.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ height: '44px', paddingLeft: '40px', paddingRight: '16px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', width: '280px', outline: 'none', transition: 'all 0.2s' }}
                            onFocus={e => e.target.style.borderColor = '#6366f1'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>

                    {!!isSuperAdmin && (
                        <select 
                            value={selectedCompanyId} 
                            onChange={e => handleCompanyChange(e.target.value)}
                            style={{ ...inputStyle, minWidth: '180px' }}
                        >
                            {(!companiesList || !Array.isArray(companiesList) || companiesList.length === 0) && <option value="">Loading Companies...</option>}
                            {Array.isArray(companiesList) && companiesList.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                    )}

                    <button 
                        onClick={() => setShowModal(true)}
                        style={{ height: '44px', padding: '0 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'}
                        onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}
                    >
                        <Plus size={18} /> Add User
                    </button>
                </div>
            </div>



            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>

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
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1, boxShadow: 'inset 0 1px 0 #e2e8f0, inset 0 -1px 0 #e2e8f0' }}>
                                <tr>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Phone</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Created At</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Updated At</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(u => (
                                    <tr key={u._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '12px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Avatar name={u.firstName} />
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{u.firstName} {u.lastName}</div>
                                                    <div style={{ color: '#64748b', fontSize: '12px' }}>{u.email || u.userName}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: u.isAdmin ? '#eef2ff' : '#f1f5f9', color: u.isAdmin ? '#6366f1' : '#64748b' }}>
                                                {u.isAdmin ? 'Admin' : 'User'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 24px', color: '#64748b', fontSize: '14px' }}>
                                            {u.phoneNumber || '—'}
                                        </td>
                                        <td style={{ padding: '12px 24px', color: '#64748b', fontSize: '13px' }}>
                                            {u.createdAt ? new Date(u.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                        </td>
                                        <td style={{ padding: '12px 24px', color: '#64748b', fontSize: '13px' }}>
                                            {u.updatedAt ? new Date(u.updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            {u._id === user?._id ? (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: '#f0fdf4', color: '#22c55e', fontSize: '12px', fontWeight: 600 }}>
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                                                    Active
                                                </div>
                                            ) : (
                                                <div 
                                                    onClick={() => handleToggleStatus(u)}
                                                    style={{ 
                                                        width: '40px', 
                                                        height: '22px', 
                                                        background: u.status === 1 ? '#4f46e5' : '#cbd5e1', 
                                                        borderRadius: '20px', 
                                                        padding: '2px', 
                                                        cursor: 'pointer', 
                                                        position: 'relative', 
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
                                                    }}
                                                >
                                                    <div style={{ 
                                                        width: '18px', 
                                                        height: '18px', 
                                                        background: '#fff', 
                                                        borderRadius: '50%', 
                                                        position: 'absolute', 
                                                        left: u.status === 1 ? '20px' : '2px', 
                                                        top: '2px', 
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)' 
                                                    }} />
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <button onClick={() => setEditUser(u)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#6366f1'} onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => archiveUser(u._id)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
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
    const { user: currentUser } = useAuth();
    const [form, setForm] = useState({ firstName: '', lastName: '', phoneNumber: '', password: '', isAdmin: false });
    const [emailLocal, setEmailLocal] = useState('');
    const [emailError, setEmailError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const currentUserEmailDomain = (currentUser as any)?.email?.includes('@') ? (currentUser as any).email.split('@')[1] : '';
    const selectedCompany = companiesList.find(c => c._id === selectedCompanyId);
    const domain = selectedCompany?.domain || (currentUser as any)?.domain || currentUserEmailDomain || '';

    useEffect(() => {
        setForm(f => ({ ...f, isAdmin: false }));
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
            const payload = {
                firstName: form.firstName,
                lastName: form.lastName,
                phoneNumber: form.phoneNumber,
                password: form.password,
                isAdmin: form.isAdmin,
                email: email,
                companyId: selectedCompanyId
            };
            console.log('📤 DEBUG - Create User Payload:', payload);
            await userService.create(payload);
            onClose();
        }
        catch (err: any) { onError(err.response?.data?.message || 'Failed to create user.'); }
        finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>First Name *</label><input required style={inputStyle} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="John" /></div>
                <div><label style={labelStyle}>Last Name *</label><input required style={inputStyle} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Doe" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} placeholder="+1234567890" /></div>
                <div>
                    <label style={labelStyle}>Role *</label>
                    <select required style={{ ...inputStyle, appearance: 'auto' as any }} value={form.isAdmin ? 'true' : 'false'} onChange={e => setForm({ ...form, isAdmin: e.target.value === 'true' })}>
                        <option value="false">User</option>
                        <option value="true">Admin</option>
                    </select>
                </div>
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
            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Password *</label>
                <div style={{ position: 'relative' }}>
                    <input 
                        required 
                        type={showPassword ? "text" : "password"} 
                        style={{ ...inputStyle, paddingRight: '40px' }} 
                        value={form.password} 
                        onChange={e => setForm({ ...form, password: e.target.value })} 
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
    const { user: currentUser } = useAuth() as any;
    const currentUserEmailDomain = currentUser?.email?.includes('@') ? currentUser.email.split('@')[1] : '';
    const companyId = user.companyId?._id || user.companyId;
    const companyDomain = companiesList.find(c => c._id === companyId)?.domain || currentUser?.domain || currentUserEmailDomain || '';
    const isSelf = user._id === currentUser?._id;

    // Parse existing email into localpart
    const existingEmail = user.email || '';
    const existingLocal = existingEmail.includes('@') ? existingEmail.split('@')[0] : existingEmail;

    const [form, setForm] = useState({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phoneNumber: user.phoneNumber || '',
        isAdmin: user.isAdmin || false,
        status: user.status ?? 1,
    });
    const [emailLocal, setEmailLocal] = useState(existingLocal);
    const [emailError, setEmailError] = useState('');
    const [loading, setLoading] = useState(false);

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
            const payload = {
                firstName: form.firstName,
                lastName: form.lastName,
                phoneNumber: form.phoneNumber,
                isAdmin: form.isAdmin,
                status: form.status,
                email: email,
                _id: user._id
            };
            console.log('📤 DEBUG - Update User Payload:', payload);
            await userService.update(payload);
            onSuccess('User updated successfully.');
            onClose();
        } catch (err: any) { onError(err.response?.data?.message || 'Failed to update user.'); }
        finally { setLoading(false); }
    };

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>First Name *</label><input required style={inputStyle} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="John" /></div>
                <div><label style={labelStyle}>Last Name *</label><input required style={inputStyle} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Doe" /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} placeholder="+1234567890" /></div>
                {!isSelf && (
                    <div>
                        <label style={labelStyle}>Role *</label>
                        <select required style={{ ...inputStyle, appearance: 'auto' as any }} value={form.isAdmin ? 'true' : 'false'} onChange={e => setForm({ ...form, isAdmin: e.target.value === 'true' })}>
                            <option value="false">User</option>
                            <option value="true">Admin</option>
                        </select>
                    </div>
                )}
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
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '42px' }}>
                {loading ? 'Saving...' : 'Save Changes'}
            </button>
        </form>
    );
};

const ResetPasswordForm = ({ user, onClose, onError, onSuccess }: { user: any; onClose: () => void; onError: (msg: string) => void; onSuccess: (msg: string) => void; }) => {
    const [form, setForm] = useState({ password: '', confirmPassword: '' });
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.password.length < 6) { onError('Password must be at least 6 characters.'); return; }
        if (form.password !== form.confirmPassword) { onError('Passwords do not match.'); return; }

        setLoading(true);
        try {
            await userService.resetPassword({ _id: user._id, newPassword: form.password });
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
                <div style={{ position: 'relative' }}>
                    <input 
                        required 
                        type={showPass ? "text" : "password"} 
                        style={{ ...inputStyle, paddingRight: '40px' }} 
                        value={form.password} 
                        onChange={e => setForm({ ...form, password: e.target.value })} 
                        placeholder="••••••••" 
                    />
                    <button 
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Confirm New Password *</label>
                <div style={{ position: 'relative' }}>
                    <input 
                        required 
                        type={showConfirmPass ? "text" : "password"} 
                        style={{ ...inputStyle, paddingRight: '40px' }} 
                        value={form.confirmPassword} 
                        onChange={e => setForm({ ...form, confirmPassword: e.target.value })} 
                        placeholder="••••••••" 
                    />
                    <button 
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                        {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '42px' }}>
                {loading ? 'Updating...' : 'Set New Password'}
            </button>
        </form>
    );
};

export default Users;
