import React from 'react';
import { useAuth } from './auth/AuthProvider';
import {
    BarChart3,
    ClipboardList,
    Users,
    Activity,
    FileWarning
} from 'lucide-react';

const Sidebar = ({ activePage, setActivePage }) => {
    const { isAdmin, isCoAdmin } = useAuth();
    const canSeeErrorTop = isAdmin || isCoAdmin;

    // Base items everyone sees
    const baseItems = [
        { id: 'analysis', label: 'Analysis Report', icon: <BarChart3 size={18} /> },
        { id: 'test_improvements', label: 'Test Wise Improvements', icon: <Activity size={18} /> },
        { id: 'progress', label: 'Progress Report', icon: <Users size={18} /> },
        { id: 'averages', label: 'Average Marks Report', icon: <ClipboardList size={18} /> },
        { id: 'errors', label: 'Error Report', icon: <FileWarning size={18} /> },
        { id: 'target_vs_achieved', label: 'Target Vs Achieved', icon: <ClipboardList size={18} /> },
        { id: 'average_count', label: 'Average Count Report', icon: <ClipboardList size={18} /> },
        { id: 'error_count', label: 'Error Count Report', icon: <ClipboardList size={18} /> },
        { id: 'student_performance', label: 'Student Performance', icon: <Activity size={18} /> }
    ];

    let currentItems = [...baseItems];

    // 'Error Top 100%' is for Admins and Co-Admins, requested to be placed directly after 'Error Report'
    if (isAdmin || isCoAdmin) {
        const insertIdx = currentItems.findIndex(i => i.id === 'errors') + 1;
        currentItems.splice(insertIdx, 0, { id: 'error_top', label: 'Error Top 100%', icon: <FileWarning size={18} /> });
    }

    // Only Admins get User Approvals and Activity Logs
    if (isAdmin) {
        currentItems.push({ id: 'approvals', label: 'User Approvals', icon: <Users size={18} /> });
        currentItems.push({ id: 'logs', label: 'Activity Logs', icon: <Activity size={18} /> });
    }

    // Higher-level access: File Management
    const { userData } = useAuth();
    const isPrincipal = (userData?.role || '').toLowerCase() === 'principal';
    const isSuperAdmin = useAuth().currentUser?.email === 'yenjarappa.s@varsitymgmt.com';

    if (isSuperAdmin || isAdmin || isCoAdmin || isPrincipal) {
        const testIdx = currentItems.findIndex(i => i.id === 'test_improvements');
        if (testIdx !== -1) {
            currentItems.splice(testIdx + 1, 0, {
                id: 'file_management',
                label: 'Schedules & Timetable & Files',
                icon: <ClipboardList size={18} />
            });
        } else {
            currentItems.push({ id: 'file_management', label: 'Schedules & Timetable & Files', icon: <ClipboardList size={18} /> });
        }
    }

    return (
        <aside className="sidebar">
            <div className="branding-wrapper">
                <div className="brand-container">
                    <img src="/logo.png" alt="Sri Chaitanya" className="sidebar-logo" />
                    <h1 className="logo-text">Sri Chaitanya</h1>
                    <p className="logo-subtext">Educational Institutions</p>
                </div>
            </div>

            <div className="sidebar-content">
                <div className="menu-group">
                    <p className="group-label">Reports & Analytics</p>
                    <div className="menu-items">
                        {currentItems.map(item => (
                            <button
                                key={item.id}
                                className={`menu-btn ${activePage === item.id ? 'active' : ''}`}
                                onClick={() => setActivePage(item.id)}
                            >
                                <span className="btn-icon">{item.icon}</span>
                                <span className="btn-label">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
