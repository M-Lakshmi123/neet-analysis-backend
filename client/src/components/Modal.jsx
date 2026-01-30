import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, Check, Loader2 } from 'lucide-react';

const Modal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'info',
    confirmText = 'OK',
    cancelText = 'Cancel',
    loading = false
}) => {
    if (!isOpen) return null;

    const colors = {
        info: {
            icon: <AlertCircle className="text-blue-500" size={32} />,
            accent: '#3b82f6',
            bg: 'rgba(59, 130, 246, 0.1)'
        },
        danger: {
            icon: <AlertCircle className="text-red-500" size={32} />,
            accent: '#ef4444',
            bg: 'rgba(239, 68, 68, 0.1)'
        },
        success: {
            icon: <Check className="text-emerald-500" size={32} />,
            accent: '#10b981',
            bg: 'rgba(16, 185, 129, 0.1)'
        }
    };

    const style = colors[type] || colors.info;

    return (
        <AnimatePresence>
            <div className="modal-overlay">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="modal-container"
                >
                    <button className="modal-close" onClick={onClose} disabled={loading}>
                        <X size={20} />
                    </button>

                    <div className="modal-body">
                        <div className="modal-icon-wrapper" style={{ backgroundColor: style.bg }}>
                            {style.icon}
                        </div>

                        <div className="modal-content">
                            <h3 className="modal-title">{title}</h3>
                            <p className="modal-message">{message}</p>
                        </div>
                    </div>

                    <div className="modal-footer">
                        {onConfirm ? (
                            <>
                                <button
                                    className="btn-modal-cancel"
                                    onClick={onClose}
                                    disabled={loading}
                                >
                                    {cancelText}
                                </button>
                                <button
                                    className={`btn-modal-confirm ${type === 'danger' ? 'danger' : ''}`}
                                    onClick={onConfirm}
                                    disabled={loading}
                                    style={type !== 'danger' ? { backgroundColor: style.accent } : {}}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : confirmText}
                                </button>
                            </>
                        ) : (
                            <button
                                className="btn-modal-confirm"
                                onClick={onClose}
                                style={{ backgroundColor: style.accent, width: '100%' }}
                            >
                                {confirmText}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default Modal;
