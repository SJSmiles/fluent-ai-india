import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ToastProps {
    message: string;
    type: 'error' | 'success';
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    const [visible, setVisible] = useState(false);
    const isError = type === 'error';

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
        const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 300); }, 4000);
        return () => clearTimeout(t);
    }, []);

    const dismiss = () => { setVisible(false); setTimeout(onClose, 300); };

    return (
        <div style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 1000,
            transform: visible ? 'translateX(0)' : 'translateX(calc(100% + 32px))',
            opacity: visible ? 1 : 0,
            transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
            background: '#fff', borderRadius: '14px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
            padding: '16px 18px', display: 'flex', alignItems: 'flex-start', gap: '14px',
            maxWidth: '360px', minWidth: '280px',
            border: `1px solid ${isError ? '#fee2e2' : '#d1fae5'}`,
        }}>
            <div style={{
                width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0,
                background: isError ? '#fef2f2' : '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {isError
                    ? <AlertCircle size={20} style={{ color: '#dc2626' }} />
                    : <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
                }
            </div>
            <div style={{ flex: 1, paddingTop: '2px' }}>
                <p style={{ fontWeight: 700, fontSize: '14px', color: '#0a0a0a', margin: 0, marginBottom: '3px' }}>
                    {isError ? 'Error' : 'Success'}
                </p>
                <p style={{ fontSize: '13px', color: '#666', margin: 0, lineHeight: '1.45' }}>{message}</p>
            </div>
            <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: '2px', display: 'flex', flexShrink: 0 }}>
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast;
