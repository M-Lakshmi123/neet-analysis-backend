import React from 'react';
import { auth, db } from '../firebase';
import { useAuth } from './auth/AuthProvider';
import { LogOut, School, Shield, Box } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';

const Header = ({ title, is3DEnabled = true, setIs3DEnabled = () => {} }) => {
    const { currentUser, userData, isAdmin } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            if (userData?.email) {
                await addDoc(collection(db, "activity_logs"), {
                    email: userData.email,
                    name: userData.name,
                    campus: userData.campus,
                    timestamp: new Date().toISOString(),
                    action: 'Logged Out'
                });
            }
        } catch (err) {
            console.error("Failed to log logout activity:", err);
        }

        sessionStorage.removeItem('dashboard_session_active');
        await auth.signOut();
        navigate('/login');
    };

    return (
        <header className="main-header">
            <div className="header-left-area">
                <h1>Medicon Results - {title}</h1>
            </div>

            <div className="header-right-area">
                <div className="user-profile-compact">
                    {/* 3D Spatial Mode Switcher */}
                    <button
                        type="button"
                        className={`header-3d-toggle-btn ${is3DEnabled ? 'active' : ''}`}
                        onClick={() => setIs3DEnabled(prev => !prev)}
                        title={is3DEnabled ? "3D Spatial Mode Active - Click to toggle" : "Switch to 3D Spatial Mode"}
                    >
                        <Box size={15} />
                        <span>{is3DEnabled ? '3D Active' : 'Classic 2D'}</span>
                        {is3DEnabled && <span className="header-3d-toggle-dot" />}
                    </button>

                    <div className="header-user-info">
                        <span className="user-label">
                            {isAdmin ? <Shield size={16} /> : <School size={16} />}
                            <span className="user-name-text">{currentUser?.email || 'User'}</span>
                            <span className="user-role-badge">
                                ({isAdmin ? 'System Admin' : (
                                    (userData?.allowedCampuses?.includes('All') || userData?.campus === 'All') 
                                        ? 'ALL CAMPUSES' 
                                        : (userData?.allowedCampuses?.length > 0 
                                            ? userData.allowedCampuses.join(', ') 
                                            : (userData?.campus || 'Pending'))
                                )})
                            </span>
                        </span>
                    </div>
                    <button className="header-logout-btn" onClick={handleLogout} title="Logout">
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;