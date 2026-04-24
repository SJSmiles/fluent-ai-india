import React, { useEffect, useState } from "react";
import { 
  Building2, Users as UsersIcon, ShieldCheck, 
  MessageSquare, Smartphone, PlusCircle, 
  ArrowRight, Sparkles, UserPlus, LayoutGrid,
  FileText, Contact, Send
} from "lucide-react";
import { overviewService } from "../api/overviewService";
import { useAuth } from "../Helper/AuthContext";
import { useNavigate } from "react-router-dom";

const OverviewGuide = () => {
    const navigate = useNavigate();

    const steps = [
        {
            id: 1,
            title: "Import Your Contacts",
            desc: "Add your business contacts to get started with messaging",
            time: "1 min",
            icon: UserPlus,
            path: "/contacts",
            circleBg: "#eff6ff",
            circleColor: "#3b82f6"
        },
        {
            id: 2,
            title: "Create Message Templates",
            desc: "Build professional templates for your business communication",
            time: "2 min",
            icon: MessageSquare,
            path: "/templates",
            circleBg: "#eff6ff",
            circleColor: "#3b82f6"
        },
        {
            id: 3,
            title: "Create Group",
            desc: "Organize your contacts into manageable groups for campaigns",
            time: "2 min",
            icon: PlusCircle,
            path: "/groups",
            circleBg: "#f0fdf4",
            circleColor: "#22c55e"
        },
        {
            id: 4,
            title: "Connect WhatsApp & Go Live",
            desc: "Link your WhatsApp number and start engaging your audience",
            time: "2 min",
            icon: Smartphone,
            path: "/devices",
            circleBg: "#f0fdf4",
            circleColor: "#22c55e",
            isHighlighted: true
        }
    ];

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Hero Header */}
            <div style={{ 
                background: 'linear-gradient(135deg, #0a485e 0%, #166534 100%)', 
                borderRadius: '20px', 
                padding: '32px 40px', 
                color: '#fff', 
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(10, 72, 94, 0.1)',
                flexShrink: 0
            }}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        background: 'rgba(255,255,255,0.15)', 
                        padding: '6px 12px', 
                        borderRadius: '100px', 
                        fontSize: '11px', 
                        fontWeight: 600,
                        marginBottom: '12px',
                        backdropFilter: 'blur(8px)',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <Sparkles size={12} /> ⚡ Premium Business Messaging
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', fontFamily: 'var(--font-display)' }}>
                        Welcome to your Dashboard! 🚀
                    </h1>
                    <p style={{ fontSize: '14px', opacity: 0.9, lineHeight: 1.5, maxWidth: '600px', marginBottom: '24px' }}>
                        Empower your business with direct WhatsApp engagement. Follow the steps below to set up your account and start sending high-impact messages today.
                    </p>
                    <button 
                        onClick={() => navigate('/devices')}
                        style={{ 
                            background: '#fff', 
                            color: '#0a485e', 
                            padding: '12px 28px', 
                            borderRadius: '10px', 
                            border: 'none', 
                            fontWeight: 750, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '10px', 
                            cursor: 'pointer',
                            fontSize: '14px',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
                        }}
                    >
                        <Smartphone size={18} /> Get Started Now <ArrowRight size={18} />
                    </button>
                </div>
                {/* Abstract background shapes */}
                <div style={{ position: 'absolute', right: '-20px', bottom: '-40px', width: '200px', height: '200px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', zIndex: 1 }} />
                <div style={{ position: 'absolute', right: '100px', top: '-10px', width: '120px', height: '120px', background: 'rgba(255,255,255,0.08)', borderRadius: '50%', zIndex: 1 }} />
            </div>

            {/* Steps Section */}
            <div className="card" style={{ padding: '24px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0a0a0a', fontFamily: 'var(--font-display)' }}>Onboarding Checklist</h2>
                        <p style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>Complete these steps to unlock full potential</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {steps.map((step) => (
                        <div 
                            key={step.id} 
                            onClick={() => navigate(step.path)}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '16px', 
                                padding: '16px', 
                                borderRadius: '14px', 
                                border: step.isHighlighted ? '2px solid #0a485e20' : '1px solid #f0f1f3',
                                background: step.isHighlighted ? '#f8fafc' : '#fff',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                position: 'relative'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = '#0a485e';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = step.isHighlighted ? '#0a485e20' : '#f0f1f3';
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div style={{ 
                                width: '30px', 
                                height: '30px', 
                                background: step.id <= 3 ? '#e2e4e9' : '#0a485e', 
                                color: step.id <= 3 ? '#555' : '#fff', 
                                borderRadius: '8px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                fontWeight: 800, 
                                fontSize: '13px' 
                            }}>
                                {step.id}
                            </div>
                            <div style={{ 
                                width: '40px', 
                                height: '40px', 
                                background: step.circleBg, 
                                color: step.circleColor, 
                                borderRadius: '10px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center' 
                            }}>
                                <step.icon size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0a0a0a', marginBottom: '2px' }}>{step.title}</h4>
                                <p style={{ fontSize: '12px', color: '#666', lineHeight: 1.3 }}>{step.desc}</p>
                            </div>
                            <ArrowRight size={18} style={{ color: step.id <= 3 ? '#ccc' : '#0a485e' }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


const Overview: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const isAdmin = user?.isAdmin;
    const isSuperAdmin = user?.isSuperAdmin;

    useEffect(() => {
        if (!isAdmin) return;

        overviewService.get()
            .then(res => setData(res.data.data))
            .catch(err => console.error("Failed to fetch overview", err))
            .finally(() => setIsLoading(false));
    }, [isAdmin]);

    if (!isAdmin) {
        return <OverviewGuide />;
    }

    const statCards = [
        {
            label: "Active Companies",
            value: data?.companiesCount ?? 0,
            icon: Building2,
            color: "#0a485e",
            show: isSuperAdmin && isAdmin,
            desc: "Active business accounts"
        },
        {
            label: "Active Users",
            value: data?.usersCount ?? 0,
            icon: UsersIcon,
            color: "#7c3aed",
            show: true,
            desc: "Total teammates online"
        },
        {
            label: "Total Groups",
            value: data?.groupsCount ?? 0,
            icon: LayoutGrid,
            color: "#059669",
            show: true,
            desc: "Contact segments created"
        },
        {
            label: "Templates",
            value: data?.templatesCount ?? 0,
            icon: FileText,
            color: "#ea580c",
            show: true,
            desc: "Messaging formats used"
        },
        {
            label: "Total Contacts",
            value: data?.contactsCount ?? 0,
            icon: Contact,
            color: "#2563eb",
            show: true,
            desc: "Direct customer leads"
        },
        {
            label: "Total Campaigns",
            value: data?.campaignsCount ?? 0,
            icon: Send,
            color: "#db2777",
            show: true,
            desc: "Sent message broadcasts"
        },
    ].filter(card => card.show);

    return (
        <div style={{ paddingBottom: '60px' }}>
            {/* 1. Admin Hero Section */}
            <div style={{
                background: 'linear-gradient(135deg, #0a485e 0%, #1e293b 100%)',
                borderRadius: '24px',
                padding: '40px',
                color: '#fff',
                position: 'relative',
                overflow: 'hidden',
                marginBottom: '32px',
                boxShadow: '0 20px 40px rgba(10, 72, 94, 0.15)',
            }}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(255,255,255,0.12)',
                        padding: '8px 16px',
                        borderRadius: '100px',
                        fontSize: '12px',
                        fontWeight: 700,
                        marginBottom: '20px',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        <Sparkles size={14} className="animate-pulse" style={{ color: '#fbbf24' }} /> Admin Control Panel
                    </div>
                    <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)' }}>
                        System Overview Dashboard
                    </h1>
                    <p style={{ fontSize: '16px', opacity: 0.85, lineHeight: 1.6, maxWidth: '650px', marginBottom: '32px', fontWeight: 400 }}>
                        Welcome back, <span style={{ color: '#fff', fontWeight: 700 }}>{user?.name || user?.userName}</span>. monitor your organization's performance, manage users, and track real-time engagement metrics across all modules.
                    </p>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <button
                            onClick={() => navigate('/campaigns')}
                            style={{
                                background: '#fff',
                                color: '#0a485e',
                                padding: '14px 28px',
                                borderRadius: '12px',
                                border: 'none',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                fontSize: '15px',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                            }}
                        >
                            <Send size={18} /> Launch New Campaign
                        </button>
                        <button
                            onClick={() => navigate('/devices')}
                            style={{
                                background: 'transparent',
                                color: '#fff',
                                padding: '14px 28px',
                                borderRadius: '12px',
                                border: '1.5px solid rgba(255,255,255,0.3)',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                fontSize: '15px',
                                transition: 'all 0.2s ease',
                                backdropFilter: 'blur(4px)'
                            }}
                        >
                            <Smartphone size={18} /> Connection Status
                        </button>
                    </div>
                </div>

                {/* Decorative Elements */}
                <div style={{ position: 'absolute', right: '-40px', bottom: '-40px', width: '350px', height: '350px', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)', borderRadius: '50%', zIndex: 1 }} />
                <div style={{ position: 'absolute', right: '150px', top: '-60px', width: '250px', height: '250px', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)', borderRadius: '50%', zIndex: 1 }} />
                <Building2 size={280} color="white" style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.05, transform: 'rotate(-10deg)', zIndex: 0 }} />
            </div>

            {/* 2. Key Metrics Grid */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "24px",
                marginBottom: "32px"
            }}>
                {statCards.map((stat, i) => (
                    <div
                        key={i}
                        className="card"
                        style={{
                            padding: "24px",
                            display: "flex",
                            flexDirection: 'column',
                            gap: "16px",
                            position: 'relative',
                            overflow: 'hidden',
                            border: '1px solid #f0f1f3',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-6px)';
                            e.currentTarget.style.borderColor = stat.color + '40';
                            e.currentTarget.style.boxShadow = `0 12px 24px ${stat.color}08`;
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.borderColor = '#f0f1f3';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{
                                width: "52px",
                                height: "52px",
                                borderRadius: "14px",
                                background: `${stat.color}10`,
                                color: stat.color,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0
                            }}>
                                <stat.icon size={26} style={{ margin: 'auto' }} />
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: "36px", fontWeight: 900, color: "#0a0a0a", fontFamily: "var(--font-display)", lineHeight: 1 }}>
                                    {isLoading ? "–" : stat.value}
                                </div>
                                <div style={{ fontSize: "12px", color: stat.color, fontWeight: 700, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Live
                                </div>
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: "16px", fontWeight: 800, color: "#1e293b", marginBottom: '4px' }}>{stat.label}</div>
                            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>{stat.desc}</p>
                        </div>

                        {/* Background subtle glyph */}
                        <stat.icon size={120} style={{ position: 'absolute', right: '-30px', bottom: '-30px', opacity: 0.02, color: stat.color, pointerEvents: 'none' }} />
                    </div>
                ))}
            </div>

            {/* 3. Analytics Section (Fills empty space) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '7fr 3fr',
                gap: '24px',
                alignItems: 'stretch'
            }}>
                {/* Performance Chart - SVG Visualization */}
                <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0a0a0a', fontFamily: 'var(--font-display)' }}>Engagement Analytics</h3>
                            <p style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>Message delivery trends over the last 7 days</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {['7D', '1M', '3M'].map(t => (
                                <button key={t} style={{
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    background: t === '7D' ? '#0a485e' : '#f0f1f3',
                                    color: t === '7D' ? '#fff' : '#666',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    border: 'none',
                                    cursor: 'pointer'
                                }}>{t}</button>
                            ))}
                        </div>
                    </div>

                    <div style={{ height: '240px', width: '100%', position: 'relative', background: '#f8fafc', borderRadius: '16px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                        <svg viewBox="0 0 800 240" style={{ width: '100%', height: '100%', padding: '20px 0' }}>
                            <defs>
                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#0a485e" stopOpacity="0.2" />
                                    <stop offset="100%" stopColor="#0a485e" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {/* Grid lines */}
                            {[0, 1, 2, 3].map(i => <line key={i} x1="0" y1={240 - (i * 60)} x2="800" y2={240 - (i * 60)} stroke="#e2e8f0" strokeDasharray="4 4" />)}
                            
                            {/* Area Path */}
                            <path
                                d="M 0 200 Q 100 80 200 160 Q 300 40 400 120 Q 500 200 600 80 Q 700 140 800 40 V 240 H 0 Z"
                                fill="url(#chartGradient)"
                            />

                            {/* Line Path */}
                            <path
                                d="M 0 200 Q 100 80 200 160 Q 300 40 400 120 Q 500 200 600 80 Q 700 140 800 40"
                                fill="none"
                                stroke="#0a485e"
                                strokeWidth="3"
                                strokeLinecap="round"
                            />
                            
                            {/* Data Points */}
                            <circle cx="200" cy="160" r="4" fill="#fff" stroke="#0a485e" strokeWidth="2" />
                            <circle cx="400" cy="120" r="4" fill="#fff" stroke="#0a485e" strokeWidth="2" />
                            <circle cx="600" cy="80" r="4" fill="#fff" stroke="#0a485e" strokeWidth="2" />
                        </svg>
                        <div style={{ position: 'absolute', bottom: '12px', width: '100%', display: 'flex', justifyContent: 'space-around', fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>
                            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => <span key={d}>{d}</span>)}
                        </div>
                    </div>
                </div>

                {/* Right Column: Quick Stats / Progress */}
                <div className="card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0a0a0a', fontFamily: 'var(--font-display)' }}>System Health</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {[
                            { label: 'API Performance', val: '99.9%', color: '#22c55e' },
                            { label: 'Message Queue', val: 'Stable', color: '#22c55e' },
                            { label: 'Database Sync', val: 'Active', color: '#22c55e' },
                            { label: 'Storage Used', val: '12.4 GB', color: '#3b82f6' }
                        ].map((s, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>{s.label}</span>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: s.color }}>{s.val}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 'auto', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                            <ShieldCheck size={16} color="#0a485e" />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0a485e' }}>Security Guard</span>
                        </div>
                        <p style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>All systems are operating normally. No security threats detected.</p>
                    </div>
                </div>
            </div>

            {/* 4. Quick Nav Footnote */}
            <div style={{ marginTop: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ height: '1px', flex: 1, background: '#f0f1f3' }} />
                    <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#b0b4ba', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Quick Access</h4>
                    <div style={{ height: '1px', flex: 1, background: '#f0f1f3' }} />
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {[
                        { label: 'Devices', path: '/devices', icon: Smartphone },
                        { label: 'Contacts', path: '/contacts', icon: Contact },
                        { label: 'Templates', path: '/templates', icon: FileText },
                        { label: 'Settings', path: '/users', icon: UsersIcon },
                    ].map((item, idx) => (
                        <div
                            key={idx}
                            onClick={() => navigate(item.path)}
                            style={{
                                flex: 1,
                                minWidth: '150px',
                                padding: '16px 24px',
                                background: '#fff',
                                border: '1px solid #f0f1f3',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = '#0a485e';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.05)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = '#f0f1f3';
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                            }}
                        >
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <item.icon size={16} color="#64748b" />
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{item.label}</span>
                            <ArrowRight size={14} style={{ marginLeft: 'auto', opacity: 0.3 }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Overview;
