import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Minus, Send, FileSpreadsheet, FileText, Calendar, Sparkles } from 'lucide-react';

const NotificationBot = ({ updates, onNotificationClick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showSpeechBubble, setShowSpeechBubble] = useState(false);
    const [latestUpdate, setLatestUpdate] = useState(null);
    const dropdownRef = useRef(null);

    const [lastSeenId, setLastSeenId] = useState(() => {
        return parseInt(localStorage.getItem('last_seen_update_id') || '0', 10);
    });

    // Sync seen status
    useEffect(() => {
        const handleStorageChange = () => {
            setLastSeenId(parseInt(localStorage.getItem('last_seen_update_id') || '0', 10));
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const unreadCount = updates.filter(u => u.id > lastSeenId).length;

    // Listen to changes in updates to display live speech bubbles
    useEffect(() => {
        if (updates.length > 0) {
            const latest = updates[0];
            const currentDismissed = parseInt(localStorage.getItem('last_dismissed_popup_id') || '0', 10);
            
            // Show popup speech bubble if latest is unread/undismissed
            if (latest.id > currentDismissed) {
                setLatestUpdate(latest);
                setShowSpeechBubble(true);
                
                // Auto hide speech bubble after 8 seconds
                const timer = setTimeout(() => {
                    setShowSpeechBubble(false);
                }, 8000);
                return () => clearTimeout(timer);
            }
        }
    }, [updates]);

    // Handle outside clicks to minimize (but not close) the bot chat window
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggleOpen = () => {
        setIsOpen(!isOpen);
        setShowSpeechBubble(false);
        
        if (!isOpen && updates.length > 0) {
            // Mark all as read when opening the chat window
            const maxId = Math.max(...updates.map(u => u.id));
            localStorage.setItem('last_seen_update_id', maxId.toString());
            localStorage.setItem('last_dismissed_popup_id', maxId.toString());
            setLastSeenId(maxId);
            window.dispatchEvent(new Event('storage'));
        }
    };

    const handleDismissSpeechBubble = (e) => {
        e.stopPropagation();
        setShowSpeechBubble(false);
        if (latestUpdate) {
            localStorage.setItem('last_dismissed_popup_id', latestUpdate.id.toString());
            window.dispatchEvent(new Event('storage'));
        }
    };

    const handleViewFromSpeechBubble = () => {
        if (latestUpdate) {
            onNotificationClick(latestUpdate);
            setShowSpeechBubble(false);
            localStorage.setItem('last_seen_update_id', latestUpdate.id.toString());
            localStorage.setItem('last_dismissed_popup_id', latestUpdate.id.toString());
            setLastSeenId(latestUpdate.id);
            window.dispatchEvent(new Event('storage'));
        }
    };

    const handleUpdateClick = (update) => {
        onNotificationClick(update);
        setIsOpen(false);
    };

    const getIcon = (category) => {
        if (category === 'marks') return <FileSpreadsheet size={18} className="text-emerald-500" />;
        if (category === 'errors') return <FileText size={18} className="text-indigo-500" />;
        return <Calendar size={18} className="text-amber-500" />;
    };

    return (
        <div className="notification-bot-root" ref={dropdownRef}>
            {/* 1. Bot Bubble Trigger Button */}
            <button className="bot-bubble-trigger" onClick={handleToggleOpen} title="Medicon Assistant">
                <div className="bot-glow-ring"></div>
                <Bot size={28} className="bot-icon-img" />
                {unreadCount > 0 && (
                    <span className="bot-badge">{unreadCount}</span>
                )}
            </button>

            {/* 2. Chatbot Speech Bubble Toast (Live updates) */}
            <AnimatePresence>
                {showSpeechBubble && latestUpdate && (
                    <motion.div
                        initial={{ opacity: 0, x: 50, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 30, scale: 0.8 }}
                        className="bot-speech-bubble"
                        onClick={handleViewFromSpeechBubble}
                    >
                        <div className="speech-bubble-header">
                            <span className="speech-indicator"></span>
                            <span className="speech-title">New Update!</span>
                            <button className="speech-close-btn" onClick={handleDismissSpeechBubble}>
                                <X size={12} />
                            </button>
                        </div>
                        <div className="speech-bubble-content">
                            <p>Admin uploaded <strong>{latestUpdate.title}</strong>.</p>
                            <span className="speech-link">Click here to view report →</span>
                        </div>
                        <div className="speech-bubble-arrow"></div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 3. Main Chatbot Updates Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.15 } }}
                        className="bot-chat-window"
                    >
                        {/* Chat Header */}
                        <div className="chat-window-header">
                            <div className="chat-header-left">
                                <div className="header-bot-avatar">
                                    <Bot size={18} className="text-white" />
                                    <span className="avatar-online-dot"></span>
                                </div>
                                <div className="header-bot-title">
                                    <h4>Medicon Updates Bot</h4>
                                    <span>Online Updates Helper</span>
                                </div>
                            </div>
                            <div className="chat-header-actions">
                                <button className="header-action-btn" onClick={() => setIsOpen(false)} title="Minimize">
                                    <Minus size={16} />
                                </button>
                                <button className="header-action-btn close" onClick={() => setIsOpen(false)} title="Close">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Chat Body */}
                        <div className="chat-window-body">
                            {/* System Welcome Message */}
                            <div className="chat-message bot">
                                <div className="message-avatar">
                                    <Bot size={14} />
                                </div>
                                <div className="message-bubble">
                                    <p>Hi! I am your Medicon updates bot. 🤖</p>
                                    <p>I'll notify you whenever the Admin publishes new marks, analysis reports, or timetables. Here is what has been updated recently:</p>
                                </div>
                            </div>

                            {/* Updates List as Chat Messages */}
                            {updates.length === 0 ? (
                                <div className="chat-no-updates">
                                    <Sparkles size={24} className="text-slate-300 mb-2" />
                                    <p>Everything is up to date! I'll tell you here when new data arrives.</p>
                                </div>
                            ) : (
                                updates.map((update) => {
                                    const isUnread = update.id > lastSeenId;
                                    return (
                                        <div key={update.id} className="chat-message bot">
                                            <div className="message-avatar">
                                                <Bot size={14} />
                                            </div>
                                            <div className={`message-bubble update-card ${isUnread ? 'unread' : ''}`}>
                                                <div className="update-card-meta">
                                                    <span className="update-card-category-icon">
                                                        {getIcon(update.category)}
                                                    </span>
                                                    <span className="update-card-time">
                                                        {new Date(update.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <h4 className="update-card-title">{update.title}</h4>
                                                <p className="update-card-desc">{update.description}</p>
                                                <button className="update-card-action-btn" onClick={() => handleUpdateClick(update)}>
                                                    <span>Open Report</span>
                                                    <Send size={12} style={{ marginLeft: '4px' }} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Chat Footer */}
                        <div className="chat-window-footer">
                            <span className="footer-status-text">Academic updates monitored live</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default NotificationBot;
