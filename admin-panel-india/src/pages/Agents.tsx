import React, { useEffect, useState } from 'react';
import { agentService } from '../api/agentService';
import { companyService } from '../api/companyService';
import { useAuth } from '../Helper/AuthContext';
import { Cpu, Plus, Search, Trash2, X, ChevronLeft, ChevronRight, Pencil, Clock, Building2, Play, Check } from 'lucide-react';
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
            <span style={{ fontSize: '14px', color: '#64748b' }}>Showing {from}–{to} of {totalRecords} agents</span>
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
    const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    const bgColors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'];
    const randomColor = color || bgColors[Math.abs(name?.length || 0) % bgColors.length];
    
    return (
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: randomColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: 600 }}>
            {initials}
        </div>
    );
};

// ─── Agents Page ──────────────────────────────────────────────────────────────
const Agents: React.FC = () => {
    const { user } = useAuth();
    const [agents, setAgents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [companiesList, setCompaniesList] = useState<{ _id: string; name: string }[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
    const [editAgent, setEditAgent] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [pagination, setPagination] = useState({ totalPages: 1, totalRecords: 0, currentPage: 1, limit: PAGE_LIMIT });

    // Fetch agents on mount and page change
    useEffect(() => {
        fetchAgents(page);
    }, [page, selectedCompanyId]);

    useEffect(() => {
        if (user?.isAdmin || user?.isSuperAdmin) {
            fetchCompanies();
        }
    }, [user]);

    const fetchCompanies = async () => {
        try {
            const res = await companyService.getFilterListing();
            setCompaniesList(res.data.data || []);
        } catch (err) { console.error(err); }
    };


    const fetchAgents = async (p: number) => {
        setIsLoading(true);
        try {
            const params: any = { page: p, limit: PAGE_LIMIT };
            if (selectedCompanyId) params.companyId = selectedCompanyId;
            const res = await agentService.getAll(params);
            const data = res.data.data || [];
            setAgents(data);
            
            // Handle pagination more robustly
            if (res.data.pagination) {
                setPagination(res.data.pagination);
            } else {
                const total = res.data.total || data.length;
                setPagination({
                    totalPages: Math.ceil(total / PAGE_LIMIT),
                    totalRecords: total,
                    currentPage: p,
                    limit: PAGE_LIMIT
                });
            }
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    const deleteAgent = async (id: string) => {
        if (!window.confirm('Delete this agent?')) return;
        try {
            await agentService.delete(id);
            fetchAgents(page);
            setToast({ message: 'Agent deleted', type: 'success' });
        } catch (err: any) { alert(err.response?.data?.message || 'Failed'); }
    };



    const filtered = agents.filter(a =>
        !searchQuery ||
        a.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.agentId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handlePageChange = (p: number) => { setPage(p); setSearchQuery(''); };
    const showCompanyDropdown = companiesList.length > 0;



    return (
        <div style={{ width: '100%' }}>
            <style>
                {`
                    @keyframes modalAppear {
                        from { opacity: 0; transform: scale(0.95); }
                        to { opacity: 1; transform: scale(1); }
                    }
                    .hide-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    .hide-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}
            </style>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Agents</h1>
                    <p style={{ color: '#64748b', fontSize: '15px' }}>Create and manage AI agents for outbound calling.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {showCompanyDropdown && (
                        <div style={{ position: 'relative' }}>
                            <Building2 size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                            <select
                                value={selectedCompanyId}
                                onChange={e => { setSelectedCompanyId(e.target.value); setPage(1); }}
                                style={{ height: '44px', paddingLeft: '36px', paddingRight: '32px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', background: '#fff', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: '180px' }}
                            >
                                <option value="">All Companies</option>
                                {companiesList.map(c => (
                                    <option key={c._id} value={c._id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="Search agents..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ height: '44px', paddingLeft: '40px', paddingRight: '16px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', width: '240px', outline: 'none', transition: 'all 0.2s' }}
                            onFocus={e => e.target.style.borderColor = '#6366f1'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>
                    <button 
                        onClick={() => setShowModal(true)}
                        style={{ height: '44px', padding: '0 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'}
                        onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}
                    >
                        <Plus size={18} /> Add Agent
                    </button>
                </div>
            </div>



            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', overflow: 'hidden' }}>

                {isLoading ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Loading...</div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: '#aaa' }}>
                        <Cpu size={36} style={{ margin: '0 auto 12px', color: '#ddd', display: 'block' }} />
                        <span style={{ fontSize: '13px' }}>No agents found.</span>
                    </div>
                ) : (
                    <>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#f9fafb', zIndex: 1, boxShadow: 'inset 0 1px 0 #e2e8f0, inset 0 -1px 0 #e2e8f0' }}>
                                <tr>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prompt Prefix</th>
                                    <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '120px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(a => (
                                    <tr key={a._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '12px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <Avatar name={a.name} />
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{a.name}</div>
                                                    <div style={{ color: '#64748b', fontSize: '12px' }}>{a.description || 'AI Voice Agent'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <div style={{ fontSize: '13px', color: '#64748b', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {a.prompt || 'No prompt set'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                <button onClick={() => setEditAgent(a)} title="Edit" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#6366f1'} onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => deleteAgent(a._id)} title="Delete" style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
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

            {editAgent && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '1000px', maxHeight: '90vh', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'modalAppear 0.3s ease-out' }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '44px', height: '44px', background: '#6366f1', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                    <Cpu size={24} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>Update Agent</h2>
                                    <p style={{ color: '#64748b', fontSize: '13px' }}>Configure your AI voice agent settings</p>
                                </div>
                            </div>
                            <button onClick={() => setEditAgent(null)} style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}><X size={20} /></button>
                        </div>
                        <EditAgentForm
                            agent={editAgent}
                            onClose={() => { setEditAgent(null); fetchAgents(page); }}
                            onError={msg => setToast({ message: msg, type: 'error' })}
                            onSuccess={msg => setToast({ message: msg, type: 'success' })}
                        />
                    </div>
                </div>
            )}

            {showModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '1000px', maxHeight: '90vh', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'modalAppear 0.3s ease-out' }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: '44px', height: '44px', background: '#6366f1', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                    <Cpu size={24} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>Create Agent</h2>
                                    <p style={{ color: '#64748b', fontSize: '13px' }}>Configure your AI voice agent settings</p>
                                </div>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}><X size={20} /></button>
                        </div>
                        <AgentForm
                            onClose={() => { setShowModal(false); fetchAgents(page); }}
                            onError={msg => setToast({ message: msg, type: 'error' })}
                            onSuccess={msg => setToast({ message: msg, type: 'success' })}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Agent Form ───────────────────────────────────────────────────────────────
// ─── Agent Form ───────────────────────────────────────────────────────────────
const AgentForm = ({ onClose, onError, onSuccess }: {
    onClose: () => void;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}) => {
    const [form, setForm] = useState({ name: '', firstMessage: '', prompt: '', endCallMessage: '', voiceId: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: { preventDefault(): void }) => {
        e.preventDefault();
        setLoading(true);
        try {
            await agentService.create(form);
            onSuccess('Agent created successfully');
            onClose();
        }
        catch (err: any) { onError(err.response?.data?.message || 'Failed to create agent.'); }
        finally { setLoading(false); }
    };

    return <AgentFormBody form={form} setForm={setForm} loading={loading} onSubmit={handleSubmit} onClose={onClose} submitLabel="Create Agent" />;
};

// ─── Edit Agent Form ──────────────────────────────────────────────────────────
const EditAgentForm = ({ agent, onClose, onError, onSuccess }: {
    agent: any;
    onClose: () => void;
    onError: (msg: string) => void;
    onSuccess: (msg: string) => void;
}) => {
    const [form, setForm] = useState({
        name: agent.name || '',
        firstMessage: agent.firstMessage || '',
        prompt: agent.prompt || '',
        endCallMessage: agent.endCallMessage || '',
        voiceId: agent.voiceId || '',
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: { preventDefault(): void }) => {
        e.preventDefault();
        setLoading(true);
        try {
            await agentService.update(agent._id, form);
            onSuccess('Agent updated successfully');
            onClose();
        }
        catch (err: any) { onError(err.response?.data?.message || 'Failed to update agent.'); }
        finally { setLoading(false); }
    };

    return <AgentFormBody form={form} setForm={setForm} loading={loading} onSubmit={handleSubmit} onClose={onClose} submitLabel="Update Agent" />;
};

// ─── Shared Form Body ─────────────────────────────────────────────────────────
const AgentFormBody = ({ form, setForm, loading, onSubmit, onClose, submitLabel }: any) => {
    const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', background: '#f8fafc', outline: 'none', transition: 'all 0.2s', color: '#1e293b' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' };
    const descStyle: React.CSSProperties = { fontSize: '12px', color: '#94a3b8', marginTop: '6px' };

    return (
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left Column: Form Fields */}
                <div className="hide-scrollbar" style={{ width: '35%', padding: '32px', borderRight: '1px solid #f1f5f9', overflowY: 'auto' }}>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>Name *</label>
                        <input required style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sales AI Agent (Sourabh)" />
                    </div>
                    
                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>First Message</label>
                        <textarea 
                            style={{ ...inputStyle, minHeight: '80px', resize: 'none' }} 
                            value={form.firstMessage} 
                            onChange={e => setForm({ ...form, firstMessage: e.target.value })} 
                            placeholder="Hello, kya meri baat [Name] ke responsible person se horahi h?" 
                        />
                        <p style={descStyle}>Call connect hote hi agent yahi bolega.</p>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>End Call Message</label>
                        <textarea 
                            style={{ ...inputStyle, minHeight: '80px', resize: 'none' }} 
                            value={form.endCallMessage} 
                            onChange={e => setForm({ ...form, endCallMessage: e.target.value })} 
                            placeholder="Dhanyawad ji! Aapko WhatsApp jaldi milega. Aapka din shubh rahe!" 
                        />
                        <p style={descStyle}>Call khatam hone se pehle bola jaayega.</p>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                        <label style={labelStyle}>Voice ID</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input style={inputStyle} value={form.voiceId} onChange={e => setForm({ ...form, voiceId: e.target.value })} placeholder="mActWQg9kibLro6Z2ouY" />
                            <button type="button" style={{ width: '44px', height: '44px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <Play size={18} />
                            </button>
                        </div>
                        <p style={descStyle}>ElevenLabs Voice ID.</p>
                    </div>
                </div>

                {/* Right Column: Prompt Editor */}
                <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div>
                            <label style={labelStyle}>System Prompt *</label>
                        </div>
                    </div>
                    
                    <textarea
                        required
                        style={{ ...inputStyle, width: '100%', flex: 1, minHeight: '500px', padding: '16px', lineHeight: '1.6', resize: 'none', border: '1px solid #e2e8f0' }}
                        value={form.prompt}
                        onChange={e => setForm({ ...form, prompt: e.target.value })}
                        placeholder="# AGENT IDENTITY&#10;You are Riya, a loan consultant from Aditya Birla Finance...&#10;&#10;## TONE&#10;- Speak in friendly Hinglish&#10;- Be concise, max 2 sentences per response"
                    />
                    
                </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '24px 32px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '13px' }}>
                    <Clock size={16} />
                    <span>All fields are saved instantly on submit.</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                        type="button" 
                        onClick={onClose}
                        style={{ padding: '10px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        disabled={loading}
                        style={{ 
                            padding: '10px 28px', 
                            borderRadius: '12px', 
                            border: 'none', 
                            background: '#6366f1', 
                            color: '#fff', 
                            fontSize: '14px', 
                            fontWeight: 600, 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                            transition: 'all 0.2s' 
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                    >
                        {loading ? 'Saving...' : (
                            <>
                                <Check size={18} />
                                {submitLabel}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
};

export default Agents;
