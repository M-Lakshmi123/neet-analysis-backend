import React, { useState, useEffect } from 'react';
import { API_URL, ADMIN_WHATSAPP } from '../../utils/apiHelper';
import Modal from '../Modal';
import { db } from '../../firebase';
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Users, Mail, School, CheckCircle, XCircle, Clock, MessageSquare, Edit } from 'lucide-react';
import Select from 'react-select'; // Import Select for campus choosing

const UserApprovals = () => {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [approvedUsers, setApprovedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '', onConfirm: null });

    const [allCampuses, setAllCampuses] = useState([]);
    const [approvalModal, setApprovalModal] = useState({ isOpen: false, user: null, selectedCampuses: [] });

    useEffect(() => {
        fetchUsers();
        fetchCampuses();
    }, []);

    const fetchCampuses = async () => {
        try {
            const res = await fetch(`${API_URL}/api/filters`);
            const data = await res.json();
            if (data.campuses) {
                setAllCampuses(data.campuses.map(c => ({ value: c, label: c })));
            }
        } catch (err) {
            console.error("Error fetching campuses:", err);
        }
    };

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



    const initiationApproval = (user) => {
        // Default to the requested campus as pre-selected
        const defaultSelection = user.campus && user.campus !== 'All'
            ? [{ value: user.campus, label: user.campus }]
            : []; // Or select all if 'All'? Better to let Admin choose.

        setApprovalModal({
            isOpen: true,
            user: user,
            selectedCampuses: defaultSelection
        });
    };

    const confirmApproval = async () => {
        if (!approvalModal.user) return;

        const user = approvalModal.user;
        const allowedCampuses = approvalModal.selectedCampuses.map(c => c.value);

        setApprovalModal({ isOpen: false, user: null, selectedCampuses: [] });

        // Optimistic Update: Move user immediately in UI
        // We update the local object to reflect the new allowedCampuses
        const approvedUser = {
            ...user,
            isApproved: true,
            approvedAt: new Date().toISOString(),
            allowedCampuses: allowedCampuses
        };

        setPendingUsers(prev => prev.filter(u => u.id !== user.id));
        setApprovedUsers(prev => [approvedUser, ...prev]);

        try {
            // 1. Approve in Firestore with allowedCampuses
            await updateDoc(doc(db, "users", user.id), {
                isApproved: true,
                approvedAt: new Date().toISOString(),
                allowedCampuses: allowedCampuses
            });

            // 2. Open WhatsApp Web for notification
            if (user.phone) {
                const campusText = allowedCampuses.length > 5 ? `${allowedCampuses.length} Campuses` : allowedCampuses.join(', ');
                const message = `*Welcome to Sri Chaitanya*\n\nDear *${user.name}*,\n\nWe are pleased to inform you that your request for access to the dashboard has been *APPROVED*.\n\nAccess granted for: *${campusText || "All Campuses"}*\n\nLogin now: https://medical-2025-srichaitanya.web.app/\n\nBest Regards,\n*Anand Dean*\n+91${ADMIN_WHATSAPP}`;
                const whatsappUrl = `https://wa.me/91${user.phone}?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
            }
        } catch (err) {
            // Revert optimistic update
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
                                            {user.phone && <span className="info-sub"><MessageSquare size={12} /> +91 {user.phone}</span>}
                                        </div>
                                        <div className="item-btns">
                                            <button className="approve-small" onClick={() => initiationApproval(user)}>Approve ...</button>
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
                                        <td>
                                            <span className="campus-tag">
                                                {user.allowedCampuses && user.allowedCampuses.length > 0
                                                    ? (user.allowedCampuses.length > 3 ? `${user.allowedCampuses.length} Campuses` : user.allowedCampuses.join(', '))
                                                    : user.campus}
                                            </span>
                                        </td>
                                        <td>{new Date(user.approvedAt).toLocaleDateString()}</td>
                                        <td>
                                            <div className="flex-actions" style={{ display: 'flex', gap: '10px' }}>
                                                <button
                                                    className="edit-btn"
                                                    style={{ color: '#2563eb', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    onClick={() => initiationApproval(user)}
                                                >
                                                    <Edit size={14} /> Edit
                                                </button>
                                                {user.phone && (
                                                    <button
                                                        className="btn-whatsapp"
                                                        onClick={() => {
                                                            const message = `*Welcome to Sri Chaitanya*\n\nDear *${user.name}*,\n\nWe are pleased to inform you that your request for access to the *${user.campus}* dashboard has been *APPROVED*.\n\nLogin now: https://medical-2025-srichaitanya.web.app/\n\nBest Regards,\n*Anand Dean*\n+91${ADMIN_WHATSAPP}`;
                                                            const whatsappUrl = `https://wa.me/91${user.phone}?text=${encodeURIComponent(message)}`;
                                                            window.open(whatsappUrl, '_blank');
                                                        }}
                                                        title="Send WhatsApp Notification"
                                                    >
                                                        <MessageSquare size={14} /> Notify
                                                    </button>
                                                )}
                                                <button
                                                    className="text-danger"
                                                    onClick={() => confirmReject(user.id)}
                                                >
                                                    Revoke
                                                </button>
                                            </div>
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

            {/* Approval Modal with Campus Selection */}
            {approvalModal.isOpen && (
                <div className="modal-overlay">
                    <div className="modal-container" style={{ maxWidth: '500px', width: '90%' }}>
                        <h3>Approve Access for {approvalModal.user?.name}</h3>
                        <p style={{ marginBottom: '1rem', color: '#666' }}>
                            Requested Campus: <strong>{approvalModal.user?.campus}</strong>
                        </p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Grant Access To Campuses:</label>
                            <Select
                                isMulti
                                options={[{ value: 'All', label: 'All Campuses' }, ...allCampuses]}
                                value={approvalModal.selectedCampuses}
                                onChange={(selected) => setApprovalModal(prev => ({ ...prev, selectedCampuses: selected || [] }))}
                                placeholder="Select campuses..."
                                styles={{
                                    control: (base) => ({ ...base, minHeight: '45px' }),
                                    menu: (base) => ({ ...base, zIndex: 9999 })
                                }}
                            />
                            <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '5px' }}>
                                Leave empty or select "All Campuses" to grant full access based on role.
                            </p>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn-secondary"
                                onClick={() => setApprovalModal({ isOpen: false, user: null, selectedCampuses: [] })}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={confirmApproval}
                            >
                                Confirm & Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserApprovals;
