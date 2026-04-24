import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Helper/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import logoIcon from '../assets/logo-icon.svg';
const testimonials = [
    "The integration was seamless and results immediate. Our sales team can now handle 5x more calls with the same headcount. Fluent is a must-have for growing business.",
    "Fluent transformed our outreach. The AI voices are incredibly natural and our pickup rates have doubled.",
    "Setup was effortless. We were running batch campaigns within an hour. Highly recommend.",
];

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeTestimonial, setActiveTestimonial] = useState(1);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            await login({ email, password });
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Invalid email or password');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Segoe UI', sans-serif" }}>

            {/* LEFT — exactly 50% */}
            <div style={{ flex: '0 0 50%', width: '50%', background: '#f0f2f8', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '60px' }}>
                    <img src={logoIcon} alt="Fluent logo" width={18} height={18} style={{ display: 'block' }} />
                    <span style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', letterSpacing: '-0.03em' }}>fluent</span>
                </div>
                <div>
                    <h1 style={{ fontSize: '40px', fontWeight: 800, color: '#1a1a2e', lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: '20px' }}>Automate Your Calls with AI</h1>
                    <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: 1.65, marginBottom: '32px' }}>
                        Experience seamless communication with Fluent, the AI phone assistant that sounds human-like. Automate calls and provide customers with natural conversations.
                    </p>
                    {['Batch Calls', 'Custom Voices', '& more'].map(f => (
                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '15px', color: '#374151', fontWeight: 500, marginBottom: '10px' }}>
                            <span style={{ color: '#3b5bdb' }}>✓</span> {f}
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT — exactly 50% background, but constrained content */}
            <div style={{ 
                flex: '0 0 50%', 
                width: '50%', 
                background: '#ffffff', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center', // Centers the form area horizontally
                padding: '48px 20px', 
                boxShadow: '-4px 0 40px rgba(0,0,0,0.06)' 
            }}>
                {/* INNER WRAPPER — This makes the form area smaller/less wide */}
                <div style={{ width: '100%', maxWidth: '440px' }}>
                    <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a2e', letterSpacing: '-0.025em', marginBottom: '28px' }}>Sign in to fluent</h2>

                    {error && (
                        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '18px', fontSize: '13px', color: '#dc2626' }}>{error}</div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '18px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '7px' }}>Email</label>
                            <input
                                type="email" value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="Enter email" required
                                style={{ width: '100%', height: '46px', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '0 14px', fontSize: '14px', color: '#1a1a2e', background: '#fafafa', outline: 'none', fontFamily: 'inherit' }}
                                onFocus={e => { e.target.style.borderColor = '#3b5bdb'; e.target.style.background = '#fff'; }}
                                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#fafafa'; }}
                            />
                        </div>

                        <div style={{ marginBottom: '18px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '7px' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'} value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter Password" required
                                    style={{ width: '100%', height: '46px', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '0 42px 0 14px', fontSize: '14px', color: '#1a1a2e', background: '#fafafa', outline: 'none', fontFamily: 'inherit' }}
                                    onFocus={e => { e.target.style.borderColor = '#3b5bdb'; e.target.style.background = '#fff'; }}
                                    onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#fafafa'; }}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={isLoading}
                            style={{ width: '100%', height: '46px', background: isLoading ? '#7b8fcc' : '#3b5bdb', color: '#fff', fontSize: '15px', fontWeight: 600, border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: '8px', transition: 'background 0.2s' }}>
                            {isLoading ? 'Signing in...' : 'Login'}
                        </button>
                    </form>

                    <p style={{ marginTop: '14px', fontSize: '13px', color: '#6b7280' }}>
                        Don't have an account? <a href="/register" style={{ color: '#3b5bdb', fontWeight: 600, textDecoration: 'none' }}>Register here</a>
                    </p>

                    {/* Social Proof */}
                    <div style={{ marginTop: '48px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a2e', marginBottom: '12px' }}>Join 250+ satisfied users</p>
                        <div style={{ display: 'flex', gap: '3px', marginBottom: '10px' }}>
                            {[...Array(5)].map((_, i) => <span key={i} style={{ color: '#f59e0b', fontSize: '16px' }}>★</span>)}
                        </div>
                        <div style={{ background: '#f5f7ff', borderRadius: '10px', padding: '14px 16px', fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
                            {testimonials[activeTestimonial]}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', justifyContent: 'center' }}>
                            {testimonials.map((_, i) => (
                                <div key={i} onClick={() => setActiveTestimonial(i)}
                                    style={{ width: '7px', height: '7px', borderRadius: '50%', background: i === activeTestimonial ? '#3b5bdb' : '#d1d5db', cursor: 'pointer' }} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;