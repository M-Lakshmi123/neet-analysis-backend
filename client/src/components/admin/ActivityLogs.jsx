import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { db } from '../../firebase';
import { collection, query, orderBy, limit, getDocs, onSnapshot, where, writeBatch, doc } from 'firebase/firestore';
import { Calendar, Trash2, RotateCcw } from 'lucide-react';

const ActivityLogs = () => {
    const [activityLogs, setActivityLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [modal, setModal] = useState({
        isOpen: false,
        type: 'info',
        title: '',
        message: '',
        onConfirm: null,
        loading: false
    });

    useEffect(() => {
        let unsubscribe = () => { };

        const setupListener = () => {
            setLoading(true);
            try {
                let q = collection(db, "activity_logs");
                let constraints = [orderBy("timestamp", "desc")];

                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    constraints.push(where("timestamp", ">=", start.toISOString()));
                }

                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    constraints.push(where("timestamp", "<=", end.toISOString()));
                }

                if (!startDate && !endDate) {
                    constraints.push(limit(100)); // Default limit
                }

                const finalQuery = query(q, ...constraints);

                unsubscribe = onSnapshot(finalQuery, (snapshot) => {
                    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setActivityLogs(logs);
                    setLoading(false);
                }, (error) => {
                    console.error("Error listening to logs:", error);
                    setLoading(false);
                });

            } catch (err) {
                console.error("Error setting up log listener:", err);
                setLoading(false);
            }
        };

        setupListener();

        return () => unsubscribe();
    }, [startDate, endDate]);

    const confirmClearAll = () => {
        setModal({
            isOpen: true,
            type: 'danger',
            title: 'Delete All Logs?',
            message: 'This will permanently delete ALL activity logs. This action cannot be undone.',
            confirmText: 'Yes, Delete All',
            onConfirm: performClearAll,
            loading: false
        });
    };

    const performClearAll = async () => {
        setModal(prev => ({ ...prev, loading: true }));
        try {
            const querySnapshot = await getDocs(collection(db, "activity_logs"));
            const batch = writeBatch(db);

            querySnapshot.docs.forEach((d) => {
                batch.delete(doc(db, "activity_logs", d.id));
            });

            await batch.commit();
            setActivityLogs([]);

            setModal({
                isOpen: true,
                type: 'success',
                title: 'Success',
                message: 'All logs cleared successfully.',
                onClose: () => setModal(prev => ({ ...prev, isOpen: false })),
                loading: false
            });
        } catch (err) {
            console.error("Failed to clear logs:", err);
            setModal({
                isOpen: true,
                type: 'danger',
                title: 'Error',
                message: 'Failed to clear logs. Please try again.',
                onClose: () => setModal(prev => ({ ...prev, isOpen: false })),
                loading: false
            });
        }
    };

    const resetFilters = () => {
        setStartDate('');
        setEndDate('');
    };

    return (
        <div className="tab-pane">
            <div className="admin-toolbar">
                <div className="filter-controls">
                    <div className="date-input-group">
                        <Calendar size={16} />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="admin-date-picker"
                        />
                        <span className="date-to">to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="admin-date-picker"
                        />
                    </div>
                    <button className="toolbar-btn secondary" onClick={resetFilters}>
                        <RotateCcw size={16} />
                    </button>
                </div>

                <div className="action-controls">
                    <button className="toolbar-btn danger" onClick={confirmClearAll}>
                        <Trash2 size={16} /> Clear All Logs
                    </button>
                </div>
            </div>

            <div className="admin-card full-width no-padding">
                <div className="table-wrapper">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th>Principal Name</th>
                                <th>Campus</th>
                                <th>Date & Time</th>
                                <th>Action</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activityLogs.map(log => {
                                const logTime = new Date(log.timestamp).getTime();
                                const now = new Date().getTime();
                                const isRecent = (now - logTime) < (5 * 60 * 1000); // 5 minutes window
                                const isLive = isRecent && log.action === 'Opened Dashboard';

                                return (
                                    <tr key={log.id}>
                                        <td className="font-bold">{log.name}</td>
                                        <td>{log.campus}</td>
                                        <td>
                                            <div className="time-display">
                                                <span className="date">{new Date(log.timestamp).toLocaleDateString()}</span>
                                                <span className="time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`action-tag ${log.action === 'Logged Out' ? 'tag-red' : ''}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td>
                                            {isLive ? (
                                                <span className="status-badge live">
                                                    <span className="online-indicator"></span> Live
                                                </span>
                                            ) : (
                                                <span className="status-badge offline">
                                                    <span className="offline-indicator"></span> Offline
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {activityLogs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="5" className="text-center py-8">No activity recorded yet</td>
                                </tr>
                            )}
                            {loading && (
                                <tr>
                                    <td colSpan="5" className="text-center py-8">Loading logs...</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                onConfirm={modal.onConfirm}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                confirmText={modal.confirmText}
                loading={modal.loading}
            />
        </div>
    );
};

export default ActivityLogs;
