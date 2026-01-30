import React, { useState, useEffect } from 'react';
import { API_URL } from '../../utils/apiHelper';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import {
    Users, CheckCircle, XCircle, LogOut, Shield, Mail, School,
    BarChart3, Activity, Clock, Search, Filter as FilterIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FilterBar from '../FilterBar';
import AnalysisReport from '../AnalysisReport';
import AverageReport from '../AverageReport';
import Modal from '../Modal';
import { useAuth } from '../auth/AuthProvider';

const AdminDashboard = () => {
    const { currentUser } = useAuth();

    // Initialize from sessionStorage or default to 'users'
    const [activeTab, setActiveTab] = useState(() => {
        return sessionStorage.getItem('admin_active_tab') || 'users';
    });

    // Update sessionStorage whenever activeTab changes
    useEffect(() => {
        sessionStorage.setItem('admin_active_tab', activeTab);
    }, [activeTab]);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [approvedUsers, setApprovedUsers] = useState([]);
    const [activityLogs, setActivityLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        campus: [],
        stream: [],
        testType: [],
        test: []
    });
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });
    const navigate = useNavigate();

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
            return;
        }

        if (activeTab === 'logs') {
            const q = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"), limit(50));
            setLoading(true);
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setActivityLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setLoading(false);
            }, (error) => {
                console.error("Error fetching logs:", error);
                setLoading(false);
            });
            return () => unsubscribe();
        }
    }, [activeTab]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "users"), where("role", "==", "principal"));
            const querySnapshot = await getDocs(q);
            const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setPendingUsers(users.filter(u => !u.isApproved).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
            setApprovedUsers(users.filter(u => u.isApproved).sort((a, b) => new Date(b.approvedAt) - new Date(a.approvedAt)));
        } catch (err) {
            console.error("Error fetching users:", err);
        } finally {
            setLoading(false);
        }
    };


    const handleApprove = async (user) => {
        try {
            // 1. Approve in Firestore
            await updateDoc(doc(db, "users", user.id), {
                isApproved: true,
                approvedAt: new Date().toISOString()
            });

            // 2. Send Email Notification via Backend
            try {
                const response = await fetch(`${API_URL}/api/send-approval-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: user.email,
                        name: user.name,
                        campus: user.campus
                    })
                });

                const contentType = response.headers.get("content-type");
                let responseData;
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    responseData = await response.json();
                } else {
                    responseData = await response.text();
                }

                if (!response.ok) {
                    console.error("Failed to send approval email:", responseData);
                    setModal({
                        isOpen: true,
                        type: 'info',
                        title: 'Email Failed',
                        message: `User approved, but failed to send email.Server says: ${JSON.stringify(responseData)} `,
                        onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
                    });
                } else {
                    console.log("Approval email sent successfully", responseData);
                }
            } catch (emailErr) {
                console.error("Email API Connection Error:", emailErr);
                setModal({
                    isOpen: true,
                    type: 'danger',
                    title: 'Network Error',
                    message: "Technical error sending email: " + emailErr.message,
                    onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
                });
            }

            fetchUsers();
        } catch (err) {
            setModal({
                isOpen: true,
                type: 'danger',
                title: 'Error',
                message: "Error approving user: " + err.message,
                onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
            });
        }
    };

    const confirmReject = (userId) => {
        setModal({
            isOpen: true,
            type: 'danger',
            title: 'Reject Request?',
            message: 'Are you sure you want to reject this request? This cannot be undone.',
            confirmText: 'Reject',
            onConfirm: () => performReject(userId),
            onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
        });
    };

    const performReject = async (userId) => {
        setModal(prev => ({ ...prev, loading: true }));
        try {
            await deleteDoc(doc(db, "users", userId));
            setModal(prev => ({ ...prev, isOpen: false, loading: false }));
            fetchUsers();
        } catch (err) {
            setModal({
                isOpen: true,
                type: 'danger',
                title: 'Error',
                message: "Error rejecting user: " + err.message,
                onClose: () => setModal(prev => ({ ...prev, isOpen: false })),
                loading: false
            });
        }
    };

    const handleLogout = async () => {
        sessionStorage.removeItem('dashboard_session_active');
        await auth.signOut();
        navigate('/login');
    };

    return (
        <div className="admin-dashboard-root">
            {/* Top Navigation Bar */}
            <nav className="admin-navbar">
                <div className="nav-branding">
                    <Shield size={24} className="icon-shield" />
                    <div className="brand-text">
                        <h2>Admin Dashboard</h2>
                        <span>Sri Chaitanya Control Panel</span>
                        <div style={{ fontSize: '0.8rem', color: '#6366f1', marginTop: '2px' }}>
                            {currentUser?.email}
                        </div>
                    </div>

                </div>

                <div className="nav-tabs">
                    <button
                        className={`nav - tab ${activeTab === 'users' ? 'active' : ''} `}
                        onClick={() => setActiveTab('users')}
                    >
                        <Users size={18} /> Principal Access
                    </button>
                    <button
                        className={`nav - tab ${activeTab === 'analytics' ? 'active' : ''} `}
                        onClick={() => setActiveTab('analytics')}
                    >
                        <BarChart3 size={18} /> Analytics & Reports
                    </button>
                    <button
                        className={`nav - tab ${activeTab === 'logs' ? 'active' : ''} `}
                        onClick={() => setActiveTab('logs')}
                    >
                        <Activity size={18} /> Live Activity
                    </button>
                </div>

                <div className="nav-actions">
                    <button className="nav-logout-btn" onClick={handleLogout}>
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </nav>

            {/* Content Area */}
            <main className="admin-main-content">
                {activeTab === 'users' && (
                    <div className="tab-pane">
                        <div className="pane-header">
                            <div>
                                <h3>Principal Management</h3>
                                <p>Approve or manage campus access requests</p>
                            </div>
                        </div>

                        <div className="admin-grid">
                            <section className="admin-card">
                                <div className="card-header">
                                    <Clock size={18} />
                                    <h4>Pending Requests ({pendingUsers.length})</h4>
                                </div>
                                <div className="card-body">
                                    {loading ? <div className="loader">Updating...</div> : (
                                        <div className="pending-list">
                                            {pendingUsers.length === 0 ? (
                                                <p className="empty-msg">No pending requests</p>
                                            ) : pendingUsers.map(user => (
                                                <div key={user.id} className="request-item">
                                                    <div className="item-info">
                                                        <h5>{user.name}</h5>
                                                        <span className="info-sub"><Mail size={12} /> {user.email}</span>
                                                        <span className="info-sub"><School size={12} /> {user.campus}</span>
                                                    </div>
                                                    <div className="item-btns">
                                                        <button className="approve-small" onClick={() => handleApprove(user)}>Approve</button>
                                                        <button className="reject-small" onClick={() => confirmReject(user.id)}>Reject</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="admin-card full-width">
                                <div className="card-header">
                                    <CheckCircle size={18} />
                                    <h4>Approved Principals</h4>
                                </div>
                                <div className="table-wrapper">
                                    <table className="modern-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Email</th>
                                                <th>Campus Assigned</th>
                                                <th>Approved Date</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {approvedUsers.map(user => (
                                                <tr key={user.id}>
                                                    <td>{user.name}</td>
                                                    <td>{user.email}</td>
                                                    <td><span className="campus-tag">{user.campus}</span></td>
                                                    <td>{new Date(user.approvedAt).toLocaleDateString()}</td>
                                                    <td>
                                                        <button
                                                            className="text-danger"
                                                            onClick={() => confirmReject(user.id)}
                                                        >
                                                            Revoke
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="tab-pane analytics-pane">
                        <div className="analytics-sidebar">
                            <div className="sidebar-title">
                                <FilterIcon size={16} /> Filters
                            </div>
                            <FilterBar onFilterChange={setFilters} />
                        </div>
                        <div className="analytics-content">
                            <div className="reports-container">
                                <AnalysisReport filters={filters} />
                                <AverageReport filters={filters} />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="tab-pane">
                        <div className="pane-header">
                            <div>
                                <h3>Live Activity Logs</h3>
                                <p>Track which principals are accessing the dashboard in real-time</p>
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
                                        {activityLogs.map(log => (
                                            <tr key={log.id}>
                                                <td className="font-bold">{log.name}</td>
                                                <td>{log.campus}</td>
                                                <td>
                                                    <div className="time-display">
                                                        <span className="date">{new Date(log.timestamp).toLocaleDateString()}</span>
                                                        <span className="time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                    </div>
                                                </td>
                                                <td><span className="action-tag">{log.action}</span></td>
                                                <td><span className="online-indicator"></span> Live</td>
                                            </tr>
                                        ))}
                                        {activityLogs.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="text-center py-8">No activity recorded yet</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <Modal
                isOpen={modal.isOpen}
                onClose={modal.onClose}
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

export default AdminDashboard;
