import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import './index.css';

import Header from './components/Header';
import FilterBar from './components/FilterBar';
import AnalysisReport from './components/AnalysisReport';
import AverageReport from './components/AverageReport';
import AverageMarksReport from './components/AverageMarksReport';
import ErrorReport from './components/ErrorReport';
import ErrorTop100 from './components/ErrorTop100';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import AdminDashboard from './components/admin/AdminDashboard';
import { AuthProvider, useAuth } from './components/auth/AuthProvider';

import Sidebar from './components/Sidebar';
import UserApprovals from './components/admin/UserApprovals';
import ActivityLogs from './components/admin/ActivityLogs';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
    const { currentUser, userData, loading, isAdmin } = useAuth();

    // Combined loading state for Auth or User Data
    const isLoading = loading || (currentUser && !userData);

    // Show the Timer if loading
    // Note: We render children hidden or null while loading? 
    // Actually, we should just return the Timer if loading, 
    // but the timer needs to handle the unmount.
    // However, the LoadingTimer component returns null if !isLoading.
    // So we can return <LoadingTimer /> AND the rest?
    // No, if we want to BLOCK the view, we should return the timer.
    // But if we want the timer component to handle the "cutting", 
    // it's cleaner to use it as a conditional return.

    if (isLoading) return <div className="loading-state">Loading...</div>;

    // No user -> straight to login
    if (!currentUser) return <Navigate to="/login" replace />;

    // Authorization checks
    if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;
    if (!userData?.isApproved && !isAdmin) return <Navigate to="/login" replace />;

    return children;
};

const Dashboard = () => {
    const { userData, isAdmin } = useAuth();
    // Initialize from sessionStorage or default to 'analysis'
    const [activePage, setActivePage] = useState(() => {
        const stored = sessionStorage.getItem('dashboard_active_page');
        // Security check: If stored page is admin-only but user is not admin, default to analysis
        if (stored && ['approvals', 'logs'].includes(stored) && !isAdmin) {
            return 'analysis';
        }
        return stored || 'analysis';
    });

    // Ensure non-admins are redirected from admin pages if state changes
    useEffect(() => {
        if (!isAdmin && ['approvals', 'logs'].includes(activePage)) {
            setActivePage('analysis');
        }
    }, [isAdmin, activePage]);

    // Update sessionStorage whenever activePage changes
    useEffect(() => {
        sessionStorage.setItem('dashboard_active_page', activePage);
    }, [activePage]);

    const userAllowedCampuses = userData?.allowedCampuses || (userData?.campus && userData.campus !== 'All' ? [userData.campus] : []);
    const isRestricted = !isAdmin && userAllowedCampuses.length > 0 && !userAllowedCampuses.includes('All');

    const initialFilters = {
        campus: isRestricted ? userAllowedCampuses : [],
        stream: [],
        testType: [],
        test: [],
        topAll: [],
        studentSearch: []
    };

    const [analysisFilters, setAnalysisFilters] = useState({ ...initialFilters });
    const [averagesFilters, setAveragesFilters] = useState({ ...initialFilters });
    const [progressFilters, setProgressFilters] = useState({ ...initialFilters });

    const hasLoggedSession = React.useRef(false);

    useEffect(() => {
        // Log "Opened Dashboard" only once per browser session per login
        const sessionKey = 'dashboard_session_active';
        const isSessionActive = sessionStorage.getItem(sessionKey);

        if (!isAdmin && userData?.email && !hasLoggedSession.current && !isSessionActive) {
            const logActivity = async () => {
                try {
                    hasLoggedSession.current = true;
                    sessionStorage.setItem(sessionKey, 'true'); // Mark session as active

                    await addDoc(collection(db, "activity_logs"), {
                        email: userData.email,
                        name: userData.name,
                        campus: userData.campus,
                        timestamp: new Date().toISOString(),
                        action: 'Opened Dashboard'
                    });
                } catch (err) {
                    hasLoggedSession.current = false;
                    sessionStorage.removeItem(sessionKey); // Retry on next attempt if failed
                    console.error("Failed to log activity:", err);
                }
            };
            logActivity();
        }
    }, [userData, isAdmin]);



    const renderPageContent = () => {
        switch (activePage) {
            case 'analysis':
                return (
                    <>
                        <FilterBar
                            filters={analysisFilters}
                            setFilters={setAnalysisFilters}
                            restrictedCampus={isRestricted ? userAllowedCampuses : null}
                        />
                        <div className="report-sections">
                            <AnalysisReport filters={analysisFilters} />
                        </div>
                    </>
                );
            case 'averages':
                return (
                    <>
                        <FilterBar
                            filters={averagesFilters}
                            setFilters={setAveragesFilters}
                            restrictedCampus={isRestricted ? userAllowedCampuses : null}
                        />
                        <div className="report-sections">
                            <AverageMarksReport filters={averagesFilters} />
                        </div>
                    </>
                );
            case 'progress':
                return (
                    <>
                        <FilterBar
                            filters={progressFilters}
                            setFilters={setProgressFilters}
                            restrictedCampus={isRestricted ? userAllowedCampuses : null}
                        />
                        <div className="report-sections">
                            <AverageReport filters={progressFilters} />
                        </div>
                    </>
                );
            case 'errors':
                return <ErrorReport />;
            case 'error_top':
                return (isAdmin || isCoAdmin) ? <ErrorTop100 /> : <div className="p-4">Access Denied</div>;
            case 'approvals':
                return isAdmin ? <UserApprovals /> : <div className="p-4">Access Denied</div>;
            case 'logs':
                return isAdmin ? <ActivityLogs /> : <div className="p-4">Access Denied</div>;
            default:
                return <div>Select a page from the sidebar</div>;
        }
    };

    return (
        <div className="dashboard-root">
            <Sidebar activePage={activePage} setActivePage={setActivePage} />
            <main className="dashboard-main-content">
                <Header title={
                    activePage === 'analysis' ? 'Analysis Report' :
                        activePage === 'averages' ? 'Average Marks Report' :
                            activePage === 'progress' ? 'Progress Report' :
                                activePage === 'errors' ? 'Error Report' :
                                    activePage === 'error_top' ? 'Error Top 100%' :
                                        activePage === 'approvals' ? 'User Approvals' : 'Activity Logs'
                } />
                <div className="content-inner">
                    {renderPageContent()}
                </div>
            </main>
        </div>
    );
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
                    <h2>Something went wrong.</h2>
                    <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', textAlign: 'left', background: '#fef2f2', padding: '1rem' }}>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                    <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

const App = () => {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <Router>
                    <div className="app-container">
                        <Routes>
                            <Route path="/login" element={<LoginRedirect><LoginPage /></LoginRedirect>} />
                            <Route path="/register" element={<RegisterPage />} />
                            <Route path="/" element={
                                <ProtectedRoute>
                                    <Dashboard />
                                </ProtectedRoute>
                            } />
                            {/* Fallback */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </div>
                </Router>
            </AuthProvider>
        </ErrorBoundary>
    );
};

// Simple component to prevent logged-in users from seeing the login page
const LoginRedirect = ({ children }) => {
    const { currentUser, userData, loading } = useAuth();
    if (!loading && currentUser && userData?.isApproved) return <Navigate to="/" replace />;
    return children;
};

export default App;
