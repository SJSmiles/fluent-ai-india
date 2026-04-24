import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Helper/AuthContext';
import { motion } from 'framer-motion';
import { AlertCircle, Eye, EyeOff, Lock, User } from 'lucide-react';
import bgImg from '../assets/login-bg.png';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
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
            setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0a485e 0%, #062a36 50%, #021318 100%)' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full max-w-[1000px] overflow-hidden flex flex-col md:flex-row min-h-[580px]"
                style={{
                    background: '#fff',
                    borderRadius: '24px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                }}
            >
                {/* Visual Side (Left) */}
                <div className="hidden md:block md:w-[45%] relative overflow-hidden">
                    <img
                        src={bgImg}
                        className="absolute inset-0 w-full h-full object-cover"
                        alt="Background"
                    />
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.7) 100%)' }} />

                    <div className="relative z-10 h-full flex flex-col justify-between" style={{ padding: '32px 36px 40px' }}>
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'rgba(255,255,255,0.15)',
                                        backdropFilter: 'blur(12px)',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                    }}
                                >
                                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: '#fff', letterSpacing: '-0.02em' }}>WM</span>
                                </div>
                                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '16px', color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.01em' }}>
                                    WhatsApp Manager
                                </span>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.6, ease: 'easeOut' }}
                        >
                            <h1
                                style={{
                                    fontFamily: 'var(--font-display)',
                                    fontSize: '32px',
                                    lineHeight: 1.15,
                                    fontWeight: 700,
                                    letterSpacing: '-0.025em',
                                    color: '#fff',
                                }}
                            >
                                Manage your<br />
                                communications<br />
                                seamlessly.
                            </h1>
                            <p style={{
                                fontFamily: 'var(--font-sans)',
                                color: 'rgba(255,255,255,0.65)',
                                fontSize: '15px',
                                fontWeight: 400,
                                marginTop: '14px',
                                lineHeight: 1.55,
                                maxWidth: '300px',
                                letterSpacing: '-0.01em',
                            }}>
                                Streamline WhatsApp messaging across your organization with powerful tools.
                            </p>
                        </motion.div>
                    </div>
                </div>

                {/* Form Side (Right) */}
                <div className="w-full md:w-[55%] flex flex-col items-center justify-center px-8 sm:px-16 py-12" style={{ background: '#fff' }}>
                    <div className="w-full max-w-[360px]">
                        {/* Mobile logo */}
                        <div className="md:hidden flex items-center gap-2.5 mb-8">
                            <div className="w-9 h-9 flex items-center justify-center" style={{ background: '#0a485e', borderRadius: '10px' }}>
                                <span className="text-white text-sm" style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>WM</span>
                            </div>
                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '15px', color: '#0a485e' }}>
                                WhatsApp Manager
                            </span>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                        >
                            <h2 style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: '30px',
                                fontWeight: 800,
                                color: '#0a0a0a',
                                letterSpacing: '-0.03em',
                                marginBottom: '6px',
                                lineHeight: 1.2,
                            }}>
                                Welcome back
                            </h2>
                            <p style={{
                                fontFamily: 'var(--font-sans)',
                                color: '#888',
                                fontSize: '14px',
                                fontWeight: 400,
                                marginBottom: '32px',
                            }}>
                                Enter your credentials to access your account
                            </p>
                        </motion.div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{
                                        padding: '14px',
                                        background: '#fef2f2',
                                        border: '1px solid #fee2e2',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '10px',
                                        color: '#dc2626',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        lineHeight: 1.4,
                                    }}
                                >
                                    <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                                    {error}
                                </motion.div>
                            )}

                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#333',
                                    marginBottom: '8px',
                                    letterSpacing: '-0.01em',
                                    fontFamily: 'var(--font-sans)',
                                }}>
                                    Email
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <User size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#b0b0b0', pointerEvents: 'none' }} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        style={{
                                            width: '100%',
                                            height: '48px',
                                            paddingLeft: '40px',
                                            paddingRight: '16px',
                                            background: '#f8f8f9',
                                            border: '1px solid #e4e4e7',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontFamily: 'var(--font-sans)',
                                            color: '#0a0a0a',
                                            outline: 'none',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#0a485e';
                                            e.target.style.boxShadow = '0 0 0 3px rgba(10,72,94,0.1)';
                                            e.target.style.background = '#fff';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#e4e4e7';
                                            e.target.style.boxShadow = 'none';
                                            e.target.style.background = '#f8f8f9';
                                        }}
                                        placeholder="Enter your email"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#333',
                                    marginBottom: '8px',
                                    letterSpacing: '-0.01em',
                                    fontFamily: 'var(--font-sans)',
                                }}>
                                    Password
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <Lock size={17} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#b0b0b0', pointerEvents: 'none' }} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={{
                                            width: '100%',
                                            height: '48px',
                                            paddingLeft: '40px',
                                            paddingRight: '44px',
                                            background: '#f8f8f9',
                                            border: '1px solid #e4e4e7',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontFamily: 'var(--font-sans)',
                                            color: '#0a0a0a',
                                            outline: 'none',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#0a485e';
                                            e.target.style.boxShadow = '0 0 0 3px rgba(10,72,94,0.1)';
                                            e.target.style.background = '#fff';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#e4e4e7';
                                            e.target.style.boxShadow = 'none';
                                            e.target.style.background = '#f8f8f9';
                                        }}
                                        placeholder="Enter your password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '14px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: '#b0b0b0',
                                            background: 'transparent',
                                            border: 'none',
                                            padding: 0,
                                            cursor: 'pointer',
                                            display: 'flex',
                                        }}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                style={{
                                    width: '100%',
                                    height: '48px',
                                    background: isLoading ? '#0d5a73' : '#0a485e',
                                    color: '#fff',
                                    borderRadius: '12px',
                                    fontSize: '14px',
                                    fontFamily: 'var(--font-sans)',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    border: 'none',
                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                    marginTop: '4px',
                                    boxShadow: '0 2px 8px rgba(10,72,94,0.25)',
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => { if (!isLoading) (e.target as HTMLElement).style.background = '#083d50'; }}
                                onMouseLeave={(e) => { if (!isLoading) (e.target as HTMLElement).style.background = '#0a485e'; }}
                            >
                                {isLoading ? (
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: '#fff',
                                        borderRadius: '50%',
                                        animation: 'spin 0.6s linear infinite',
                                    }} />
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>

                        <p style={{
                            textAlign: 'center',
                            fontSize: '13px',
                            color: '#aaa',
                            marginTop: '32px',
                            fontFamily: 'var(--font-sans)',
                        }}>
                            Secured with enterprise-grade encryption
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
