import React, { useState, useEffect } from 'react';
import { API_URL } from '../../utils/apiHelper';
import Modal from '../Modal';
import { db } from '../../firebase';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Users, Mail, School, CheckCircle, XCircle, Clock } from 'lucide-react';

const UserApprovals = () => {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [approvedUsers, setApprovedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

    useEffect(() => {
        fetchUsers();
    }, []);

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
        // Optimistic Update: Move user immediately in UI
        const approvedUser = { ...user, isApproved: true, approvedAt: new Date().toISOString() };

        setPendingUsers(prev => prev.filter(u => u.id !== user.id));
        setApprovedUsers(prev => [approvedUser, ...prev]);

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

                if (!response.ok) {
                    const data = await response.text();
                    console.error("Failed to send approval email:", data);
                    // Don't show modal for email failure to avoid blocking workflow, just log it
                    // The user is already approved, which is the important part
                } else {
                    console.log("Approval email sent successfully");
                }
            } catch (emailErr) {
                console.error("Email API Connection Error:", emailErr);
            }

            // No need to re-fetch immediately as we did optimistic update
            // fetchUsers(); 
        } catch (err) {
            // Revert optimistic update on error
            setPendingUsers(prev => [...prev, user].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
            setApprovedUsers(prev => prev.filter(u => u.id !== user.id));

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

    return (
        <div className="tab-pane">
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

export default UserApprovals;
