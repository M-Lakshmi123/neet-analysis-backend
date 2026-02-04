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
            const q = query(collection(db, "users"), where("role", "in", ["principal", "co_admin"]));
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
            selectedCampuses: defaultSelection,
            role: user.role || 'principal'
        });
    };

    const confirmApproval = async () => {
        if (!approvalModal.user) return;

        const user = approvalModal.user;
        const allowedCampuses = approvalModal.selectedCampuses.map(c => c.value);
        const role = approvalModal.role;

        setApprovalModal({ isOpen: false, user: null, selectedCampuses: [], role: 'principal' });

        // Optimistic Update: Move user immediately in UI
        // We update the local object to reflect the new allowedCampuses
        const approvedUser = {
            ...user,
            isApproved: true,
            approvedAt: new Date().toISOString(),
            allowedCampuses: allowedCampuses,
            role: role
        };

        // Update Pending List (Remove if present)
        setPendingUsers(prev => prev.filter(u => u.id !== user.id));

        // Update Approved List (Replace if exists, else add to top)
        setApprovedUsers(prev => {
            const exists = prev.some(u => u.id === user.id);
            if (exists) {
                return prev.map(u => u.id === user.id ? approvedUser : u);
            }
            return [approvedUser, ...prev];
        });

        try {
            // 1. Approve in Firestore with allowedCampuses
            await updateDoc(doc(db, "users", user.id), {
                isApproved: true,
                approvedAt: new Date().toISOString(),
                allowedCampuses: allowedCampuses,
                role: role
            });

            // 2. Open WhatsApp Web for notification (Only for new approvals)
            if (!user.isApproved && user.phone) {
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
                        <h4>Approved Users</h4>
                    </div>
                    <div className="table-wrapper">
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
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
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 'bold',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                backgroundColor: user.role === 'co_admin' ? '#f0fdf4' : '#f8fafc',
                                                color: user.role === 'co_admin' ? '#166534' : '#64748b',
                                                border: `1px solid ${user.role === 'co_admin' ? '#bcf0da' : '#e2e8f0'}`
                                            }}>
                                                {user.role === 'co_admin' ? 'Co-Admin' : 'Principal'}
                                            </span>
                                        </td>
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

            {/* Modern Approval Modal */}
            {approvalModal.isOpen && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1.5rem'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff', borderRadius: '16px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.05)',
                        width: '100%', maxWidth: '520px',
                        display: 'flex', flexDirection: 'column', overflow: 'visible',
                        opacity: 1, transform: 'scale(1)', transition: 'all 0.2s'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '1.5rem', borderBottom: '1px solid #f1f5f9',
                            display: 'flex', alignItems: 'center', gap: '1rem',
                            background: 'white', borderTopLeftRadius: '16px', borderTopRightRadius: '16px'
                        }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                backgroundColor: '#eff6ff', color: '#3b82f6',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 2px 4px rgba(59, 130, 246, 0.1)'
                            }}>
                                <School size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                                    Approve Access
                                </h3>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                    Grant access permissions for <span style={{ fontWeight: '700', color: '#0f172a' }}>{approvalModal.user?.name}</span>
                                </p>
                            </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '1.5rem' }}>
                            {/* Summary Card */}
                            <div style={{
                                marginBottom: '1.5rem', padding: '1rem 1.25rem',
                                backgroundColor: '#f8fafc', borderRadius: '10px',
                                border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.25rem'
                            }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    REQUESTED CAMPUS
                                </span>
                                <span style={{ fontSize: '1rem', fontWeight: '700', color: '#334155' }}>
                                    {approvalModal.user?.campus || "N/A"}
                                </span>
                            </div>

                            <div style={{ marginBottom: '0.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>
                                    Grant Access To Campuses
                                </label>
                                <Select
                                    isMulti
                                    options={[{ value: 'All', label: 'All Campuses' }, ...allCampuses]}
                                    value={approvalModal.selectedCampuses}
                                    onChange={(selected) => setApprovalModal(prev => ({ ...prev, selectedCampuses: selected || [] }))}
                                    placeholder="Select campuses..."
                                    styles={{
                                        control: (base, state) => ({
                                            ...base, minHeight: '50px', borderRadius: '10px',
                                            backgroundColor: state.isFocused ? 'white' : 'white',
                                            borderColor: state.isFocused ? '#3b82f6' : '#cbd5e1',
                                            boxShadow: state.isFocused ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none',
                                            transition: 'all 0.2s',
                                            ':hover': { borderColor: '#94a3b8' }
                                        }),
                                        menu: (base) => ({ ...base, borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden', border: '1px solid #e2e8f0', padding: '4px' }),
                                        option: (base, state) => ({
                                            ...base,
                                            backgroundColor: state.isSelected ? '#eff6ff' : state.isFocused ? '#f1f5f9' : 'transparent',
                                            color: state.isSelected ? '#1d4ed8' : '#334155',
                                            fontWeight: state.isSelected ? 600 : 500,
                                            borderRadius: '8px',
                                            marginBottom: '2px',
                                            cursor: 'pointer'
                                        }),
                                        multiValue: (base) => ({ ...base, backgroundColor: '#eff6ff', borderRadius: '6px', border: '1px solid #dbeafe' }),
                                        multiValueLabel: (base) => ({ ...base, color: '#1e40af', fontWeight: 700, fontSize: '0.75rem' }),
                                        multiValueRemove: (base) => ({ ...base, color: '#60a5fa', ':hover': { backgroundColor: '#dbeafe', color: '#1e40af' } })
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '6px', marginTop: '0.75rem', alignItems: 'center' }}>
                                    <Clock size={14} className="text-gray-400" style={{ color: '#94a3b8' }} />
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        Leave empty to grant <b>Single Campus</b> access (or full if Admin).
                                    </span>
                                </div>
                            </div>

                            <div style={{ marginTop: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>
                                    User Role
                                </label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => setApprovalModal(prev => ({ ...prev, role: 'principal' }))}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid',
                                            borderColor: approvalModal.role === 'principal' ? '#0f172a' : '#e2e8f0',
                                            backgroundColor: approvalModal.role === 'principal' ? '#f8fafc' : 'white',
                                            fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem'
                                        }}
                                    >
                                        Principal
                                    </button>
                                    <button
                                        onClick={() => setApprovalModal(prev => ({ ...prev, role: 'co_admin' }))}
                                        style={{
                                            flex: 1, padding: '10px', borderRadius: '8px', border: '2px solid',
                                            borderColor: approvalModal.role === 'co_admin' ? '#0f172a' : '#e2e8f0',
                                            backgroundColor: approvalModal.role === 'co_admin' ? '#f8fafc' : 'white',
                                            fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem'
                                        }}
                                    >
                                        Co-Admin
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px' }}>
                                    {approvalModal.role === 'co_admin'
                                        ? 'Co-Admins have access to the Top 100% Error Report.'
                                        : 'Principals have regular access to dashboard reports.'}
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                            padding: '1.25rem 1.5rem', borderTop: '1px solid #f1f5f9',
                            display: 'flex', justifyContent: 'flex-end', gap: '0.75rem'
                        }}>
                            <button
                                onClick={() => setApprovalModal({ isOpen: false, user: null, selectedCampuses: [] })}
                                style={{
                                    padding: '0.75rem 1.25rem', borderRadius: '10px',
                                    backgroundColor: 'white', border: '1px solid #e2e8f0',
                                    fontWeight: '700', fontSize: '0.85rem', color: '#64748b', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => { e.target.style.backgroundColor = '#f8fafc'; e.target.style.borderColor = '#cbd5e1'; }}
                                onMouseLeave={(e) => { e.target.style.backgroundColor = 'white'; e.target.style.borderColor = '#e2e8f0'; }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmApproval}
                                style={{
                                    padding: '0.75rem 1.5rem', borderRadius: '10px',
                                    backgroundColor: '#0f172a', border: 'none',
                                    fontWeight: '700', fontSize: '0.85rem', color: 'white', cursor: 'pointer',
                                    boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.2)',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    transition: 'all 0.2s', letterSpacing: '0.02em'
                                }}
                                onMouseEnter={(e) => { e.target.style.backgroundColor = '#1e293b'; e.target.style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={(e) => { e.target.style.backgroundColor = '#0f172a'; e.target.style.transform = 'none'; }}
                            >
                                <CheckCircle size={16} strokeWidth={2.5} /> Confirm Approval
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserApprovals;
