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

    const menuItems = [
        { id: 'analysis', label: 'Analysis Report', icon: <BarChart2 size={18} />, roles: ['principal', 'admin', 'co_admin'] },
        { id: 'averages', label: 'Average Marks Report', icon: <ClipboardList size={18} />, roles: ['principal', 'admin'] },
        { id: 'target_vs_achieved', label: 'Target Vs Achieved', icon: <ClipboardList size={18} />, roles: ['principal', 'admin'] },
        { id: 'progress', label: 'Progress Report', icon: <Users size={18} />, roles: ['principal', 'admin'] },
        { id: 'errors', label: 'Error Report', icon: <FileWarning size={18} />, roles: ['principal', 'admin'] },
        { id: 'error_count', label: 'Error Count Report', icon: <ClipboardList size={18} />, roles: ['principal', 'admin', 'co_admin'] }
    ];

    const adminItems = [
        { id: 'error_top', label: 'Error Top 100%', icon: <FileWarning size={18} />, roles: ['admin', 'co_admin'] },
        { id: 'approvals', label: 'User Approvals', icon: <Users size={18} />, roles: ['admin'] },
        { id: 'logs', label: 'Activity Logs', icon: <Activity size={18} />, roles: ['admin'] }
    ];

    const currentItems = [...menuItems, ...(canSeeErrorTop ? adminItems.filter(item => item.roles.includes(isCoAdmin ? 'co_admin' : 'admin')) : [])];

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
