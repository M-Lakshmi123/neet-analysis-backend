import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ArrowRight, FileSpreadsheet, FileText } from 'lucide-react';

const AdminUpdateNotification = ({ newUpdate, onClose, onView }) => {
    if (!newUpdate) return null;

    const getIcon = (category) => {
        if (category === 'marks') return <FileSpreadsheet className="text-emerald-500" size={24} />;
        if (category === 'errors') return <FileText className="text-indigo-500" size={24} />;
        return <Bell className="text-amber-500" size={24} />;
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, x: 100, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.95, transition: { duration: 0.2 } }}
                className="admin-update-popup-card"
            >
                <div className="popup-card-header">
                    <div className="popup-card-title-container">
                        <span className="pulse-indicator"></span>
                        <span className="popup-badge">Latest Update</span>
                    </div>
                    <button className="popup-close-btn" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                <div className="popup-card-body">
                    <div className="popup-icon-container">
                        {getIcon(newUpdate.category)}
                    </div>
                    <div className="popup-text-container">
                        <h4>{newUpdate.title}</h4>
                        <p>{newUpdate.description}</p>
                    </div>
                </div>

                <div className="popup-card-footer">
                    <button className="popup-view-btn" onClick={() => onView(newUpdate)}>
                        <span>View Now</span>
                        <ArrowRight size={14} className="view-btn-arrow" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AdminUpdateNotification;
