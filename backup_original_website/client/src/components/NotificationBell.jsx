import React, { useState, useEffect, useRef } from 'react';
import { Bell, FileSpreadsheet, FileText, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NotificationBell = ({ updates, onNotificationClick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const [lastSeenId, setLastSeenId] = useState(() => {
        return parseInt(localStorage.getItem('last_seen_update_id') || '0', 10);
    });

    // Update lastSeenId when localStorage changes (e.g. from popup dismiss)
    useEffect(() => {
        const handleStorageChange = () => {
            setLastSeenId(parseInt(localStorage.getItem('last_seen_update_id') || '0', 10));
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const unreadCount = updates.filter(u => u.id > lastSeenId).length;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        setIsOpen(!isOpen);
        if (!isOpen && updates.length > 0) {
            const maxId = Math.max(...updates.map(u => u.id));
            localStorage.setItem('last_seen_update_id', maxId.toString());
            localStorage.setItem('last_dismissed_popup_id', maxId.toString());
            setLastSeenId(maxId);
            window.dispatchEvent(new Event('storage'));
        }
    };

    const getIcon = (category) => {
        if (category === 'marks') return <FileSpreadsheet size={16} style={{ color: '#10b981' }} />;
        if (category === 'errors') return <FileText size={16} style={{ color: '#6366f1' }} />;
        return <Calendar size={16} style={{ color: '#f59e0b' }} />;
    };

    return (
        <div className="notification-bell-container" ref={dropdownRef}>
            <button className="bell-trigger-btn" onClick={handleToggle} title="Recent Updates">
                <Bell size={20} className={unreadCount > 0 ? "animate-pulse" : ""} />
                {unreadCount > 0 && (
                    <span className="bell-badge">{unreadCount}</span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.15 } }}
                        className="notification-dropdown"
                    >
                        <div className="dropdown-header">
                            <h3>Latest Updates</h3>
                            {unreadCount > 0 && <span className="unread-tag">{unreadCount} new</span>}
                        </div>

                        <div className="dropdown-list">
                            {updates.length === 0 ? (
                                <div className="empty-updates">
                                    <Bell size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                                    <p>No recent updates</p>
                                </div>
                            ) : (
                                updates.map(update => {
                                    const isUnread = update.id > lastSeenId;
                                    return (
                                        <div
                                            key={update.id}
                                            className={`update-item ${isUnread ? 'unread' : ''}`}
                                            onClick={() => {
                                                onNotificationClick(update);
                                                setIsOpen(false);
                                            }}
                                        >
                                            <div className="update-item-icon">
                                                {getIcon(update.category)}
                                            </div>
                                            <div className="update-item-content">
                                                <div className="update-item-title-row">
                                                    <h4>{update.title}</h4>
                                                    {isUnread && <span className="new-dot"></span>}
                                                </div>
                                                <p>{update.description}</p>
                                                <span className="update-time">
                                                    {new Date(update.created_at).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default NotificationBell;
