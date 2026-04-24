import React, { useEffect, useState } from 'react';
import { agentService } from '../api/agentService';
import { companyService } from '../api/companyService';
import { useAuth } from '../Helper/AuthContext';
import { Cpu, Plus, Search, Trash2, X, ChevronLeft, ChevronRight, Pencil, Star } from 'lucide-react';
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
            setAgents(res.data.data || []);
            setPagination(res.data.pagination || { totalPages: 1, totalRecords: 0, currentPage: 1, limit: PAGE_LIMIT });
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

    const setPrimaryAgent = async (id: string) => {
        try {
            await agentService.setPrimary(id);
            fetchAgents(page);
            setToast({ message: 'Primary agent set', type: 'success' });
        } catch (err: any) { setToast({ message: err.response?.data?.message || 'Failed', type: 'error' }); }
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
        <div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: '#0a0a0a' }}>Agents</h1>
                    <p style={{ color: '#888', fontSize: '14px', marginTop: '4px' }}>Create and manage AI agents for outbound calling.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
                    {showCompanyDropdown && (
                        <select
                            value={selectedCompanyId}
                            onChange={e => { setSelectedCompanyId(e.target.value); setPage(1); }}
                            style={{ height: '38px', padding: '0 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', fontFamily: 'inherit', minWidth: '160px' }}
                        >
                            <option value="">All Companies</option>
                            {companiesList.map(c => (
                                <option key={c._id} value={c._id}>{c.name}</option>
                            ))}
                        </select>
                    )}
                    <div style={{ position: 'relative' }}>
                        <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#b0b4ba', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="Search agents..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ height: '38px', paddingLeft: '34px', paddingRight: '12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', fontFamily: 'inherit', width: '200px' }}
                            onFocus={e => { e.target.style.borderColor = '#0a485e'; e.target.style.boxShadow = '0 0 0 3px rgba(10,72,94,0.08)'; }}
                            onBlur={e => { e.target.style.borderColor = '#e2e4e9'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>
                    <button className="btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={16} /> Add Agent
                    </button>
                </div>
            </div>

            <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
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
                            <table>
                                <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                                    <tr><th>Name</th><th>Prompt</th><th style={{ width: '100px' }}>Actions</th></tr>
                                </thead>
                                <tbody>
                                    {filtered.map(a => (
                                        <tr key={a._id}>
                                            <td style={{ fontWeight: 600, color: '#0a0a0a' }}>{a.name}</td>
                                            <td style={{ fontSize: '13px', color: '#666' }}>{a.prompt ? a.prompt.substring(0, 20) + (a.prompt.length > 20 ? '...' : '') : '-'}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {!a.isPrimary && (
                                                        <button onClick={() => setPrimaryAgent(a._id)} title="Set as Primary" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', display: 'flex' }}
                                                            onMouseEnter={e => (e.currentTarget.style.color = '#fbbf24')}
                                                            onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                                                            <Star size={15} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => setEditAgent(a)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', display: 'flex' }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = '#0a485e')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button onClick={() => deleteAgent(a._id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: '4px', display: 'flex' }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>
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
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>Edit Agent</h2>
                            <button onClick={() => setEditAgent(null)} style={{ background: 'none', color: '#999', cursor: 'pointer', display: 'flex', border: 'none' }}><X size={20} /></button>
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
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700 }}>Create Agent</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', color: '#999', cursor: 'pointer', display: 'flex', border: 'none' }}><X size={20} /></button>
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

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Name *</label>
                <input required style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="My Agent" />
            </div>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>First Message</label>
                <input style={inputStyle} value={form.firstMessage} onChange={e => setForm({ ...form, firstMessage: e.target.value })} placeholder="Hello, how can I help you today?" />
            </div>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Prompt</label>
                <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })} placeholder="You are a helpful sales agent..." />
            </div>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>End Call Message</label>
                <input style={inputStyle} value={form.endCallMessage} onChange={e => setForm({ ...form, endCallMessage: e.target.value })} placeholder="Thank you for your time. Goodbye!" />
            </div>
            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Voice ID</label>
                <input style={inputStyle} value={form.voiceId} onChange={e => setForm({ ...form, voiceId: e.target.value })} placeholder="voice_id" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '42px' }}>
                {loading ? 'Creating...' : 'Create Agent'}
            </button>
        </form>
    );
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

    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e2e4e9', borderRadius: '8px', fontSize: '13px', background: '#f9fafb', outline: 'none', fontFamily: 'inherit', color: '#0a0a0a' };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' };

    return (
        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Name *</label>
                <input required style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>First Message</label>
                <input style={inputStyle} value={form.firstMessage} onChange={e => setForm({ ...form, firstMessage: e.target.value })} />
            </div>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>Prompt</label>
                <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })} />
            </div>
            <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>End Call Message</label>
                <input style={inputStyle} value={form.endCallMessage} onChange={e => setForm({ ...form, endCallMessage: e.target.value })} />
            </div>
            <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Voice ID</label>
                <input style={inputStyle} value={form.voiceId} onChange={e => setForm({ ...form, voiceId: e.target.value })} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '42px' }}>
                {loading ? 'Updating...' : 'Update Agent'}
            </button>
        </form>
    );
};

export default Agents;
