import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, X } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose, duration = 5000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [onClose, duration]);

    const colors = {
        success: {
            bg: '#ffffff',
            border: '#10b981',
            icon: '#10b981',
            glow: 'rgba(16, 185, 129, 0.1)'
        },
        error: {
            bg: '#ffffff',
            border: '#f43f5e',
            icon: '#f43f5e',
            glow: 'rgba(244, 63, 94, 0.1)'
        }
    };

    const config = colors[type] || colors.success;

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className="modern-toast"
            style={{
                position: 'fixed',
                bottom: '2rem',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 1.5rem',
                borderRadius: '1rem',
                backgroundColor: config.bg,
                borderLeft: `4px solid ${config.border}`,
                minWidth: '320px',
                boxShadow: `0 10px 40px -10px ${config.glow}, 0 20px 50px rgba(0,0,0,0.1)`
            }}
        >
            <div style={{ color: config.icon, display: 'flex' }}>
                {type === 'success' ? <CheckCircle size={24} strokeWidth={2.5} /> : <XCircle size={24} strokeWidth={2.5} />}
            </div>

            <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', margin: 0, lineHeight: 1.25 }}>
                    {type === 'success' ? 'Success' : 'Attention'}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0.25rem 0 0 0', fontWeight: 500 }}>
                    {message}
                </p>
            </div>

            <button
                onClick={onClose}
                style={{
                    padding: '0.25rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                    borderRadius: '50%'
                }}
                className="toast-close-btn"
            >
                <X size={18} />
            </button>
        </motion.div>
    );
};

export default Toast;
