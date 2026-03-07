import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import './index.css';

import Header from './components/Header';
import FilterBar from './components/FilterBar';
import AnalysisReport from './components/AnalysisReport';
import TestWiseImprovements from './components/TestWiseImprovements';
import AverageReport from './components/AverageReport';
import AverageMarksReport from './components/AverageMarksReport';
import AverageCountReport from './components/AverageCountReport';
import ErrorReport from './components/ErrorReport';
import ErrorTop100 from './components/ErrorTop100';
import ErrorCountReport from './components/ErrorCountReport';
import TargetVsAchieved from './components/TargetVsAchieved';
import StudentPerformance from './components/StudentPerformance';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import AdminDashboard from './components/admin/AdminDashboard';
import { AuthProvider, useAuth, AuthContext } from './components/auth/AuthProvider';

import Sidebar from './components/Sidebar';
import UserApprovals from './components/admin/UserApprovals';
import ActivityLogs from './components/admin/ActivityLogs';
import FileManagement from './components/FileManagement';
import { logActivity } from './utils/activityLogger';

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
    const { userData, isAdmin, isCoAdmin } = useAuth();
    // Initialize from sessionStorage or default to 'analysis'
    const [activePage, setActivePage] = useState(() => {
        const stored = sessionStorage.getItem('dashboard_active_page');
        // Security check: If stored page is admin-only but user is not admin, default to analysis
        if (stored && ['approvals', 'logs'].includes(stored) && !isAdmin) {
            return 'analysis';
        }
        return stored || 'analysis';
    });

    const [academicYear, setAcademicYear] = useState(() => {
        return sessionStorage.getItem('academic_year') || '2025';
    });

    useEffect(() => {
        sessionStorage.setItem('academic_year', academicYear);
    }, [academicYear]);

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

    const userAllowedCampuses = React.useMemo(() => {
        return userData?.allowedCampuses || (userData?.campus && userData.campus !== 'All' ? [userData.campus] : []);
    }, [userData]);

    // STRICT RULE: Only Super Admins (isAdmin) have unrestricted access. 
    // Principals and Co-Admins are restricted to their assigned campuses unless specifically granted 'All'.
    const isRestricted = React.useMemo(() => {
        const userRole = (userData?.role || '').toLowerCase();
        return !isAdmin && (userRole === 'principal' || userRole === 'user' || !userAllowedCampuses.includes('All'));
    }, [isAdmin, userData, userAllowedCampuses]);

    const initialFilters = React.useMemo(() => ({
        campus: isRestricted ? userAllowedCampuses : [],
        stream: [],
        testType: [],
        test: [],
        topAll: [],
        studentSearch: []
    }), [isRestricted, userAllowedCampuses]);

    // Separate filters for each page to allow independent selections
    const [pageFilters, setPageFilters] = useState(() => {
        const stored = sessionStorage.getItem('dashboard_page_filters');
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { return {}; }
        }
        return {};
    });

    // Persist page filters to sessionStorage
    useEffect(() => {
        sessionStorage.setItem('dashboard_page_filters', JSON.stringify(pageFilters));
    }, [pageFilters]);

    // Current page's filters with fallback to initial filters
    const rawBaseFilters = pageFilters[activePage] || initialFilters;

    // Inject academicYear into filters so it is sent with every request
    const baseFilters = React.useMemo(() => ({
        ...rawBaseFilters,
        academicYear: academicYear
    }), [rawBaseFilters, academicYear]);

    // Helper to check if two campus arrays are logically identical
    const areCampusesSame = (arr1, arr2) => {
        if (arr1 === arr2) return true;
        if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;
        const sorted1 = [...arr1].sort();
        const sorted2 = [...arr2].sort();
        return sorted1.every((v, i) => v === sorted2[i]);
    };

    // STRICT ENFORCEMENT: If restricted, the campus filter MUST contain only allowed campuses
    // and CANNOT be empty or include unauthorized campuses.
    const globalFilters = React.useMemo(() => {
        if (!isRestricted) return baseFilters;

        const currentCampus = baseFilters.campus || [];
        // Filter current selection to only include allowed ones
        let restrictedSelection = currentCampus.filter(c =>
            userAllowedCampuses.some(allowed => allowed.trim().toUpperCase() === c.trim().toUpperCase())
        );

        // If selection became empty or was empty, force to ALL allowed campuses
        if (restrictedSelection.length === 0) {
            restrictedSelection = userAllowedCampuses;
        }

        // Stability check: if logically the same as base, return base
        if (areCampusesSame(currentCampus, restrictedSelection)) {
            return baseFilters;
        }

        return {
            ...baseFilters,
            campus: restrictedSelection
        };
    }, [baseFilters, isRestricted, userAllowedCampuses]);

    const setGlobalFilters = (updater) => {
        setPageFilters(prev => {
            const current = prev[activePage] || initialFilters;
            let next = typeof updater === 'function' ? updater(current) : updater;

            // Apply restriction here too for immediate state consistency
            if (isRestricted) {
                const nextCampus = next.campus || [];
                let restrictedSelection = nextCampus.filter(c =>
                    userAllowedCampuses.some(allowed => allowed.trim().toUpperCase() === c.trim().toUpperCase())
                );
                if (restrictedSelection.length === 0) {
                    restrictedSelection = userAllowedCampuses;
                }

                // Only update campus if it's actually different to avoid redundant re-renders
                if (!areCampusesSame(nextCampus, restrictedSelection)) {
                    next = { ...next, campus: restrictedSelection };
                }
            }

            // check if next is actually different from current
            if (next === current) return prev;

            return {
                ...prev,
                [activePage]: next
            };
        });
    };

    const hasLoggedSession = React.useRef(false);

    useEffect(() => {
        // Log "Session Started" only once per browser session per login
        const sessionKey = 'dashboard_session_active';
        const isSessionActive = sessionStorage.getItem(sessionKey);

        if (userData?.email && !hasLoggedSession.current && !isSessionActive) {
            hasLoggedSession.current = true;
            sessionStorage.setItem(sessionKey, 'true'); // Mark session as active
            logActivity(userData, 'Logged In', { method: 'automatic' });
        }
    }, [userData]);

    // Tracking Page Changes
    useEffect(() => {
        if (userData?.email) {
            const pageNames = {
                'analysis': 'Analysis Report',
                'test_improvements': 'Test Wise Improvements',
                'averages': 'Average Marks Report',
                'average_count': 'Average Count Report',
                'progress': 'Progress Report',
                'errors': 'Error Report',
                'error_top': 'Error Top 100%',
                'error_count': 'Error Count Report',
                'student_performance': 'Student Performance'
            };
            const pageName = pageNames[activePage] || activePage;
            logActivity(userData, `Opened ${pageName}`);
        }
    }, [activePage, userData]);



    const renderPageContent = () => {
        switch (activePage) {
            case 'analysis':
                return (
                    <div className="report-sections">
                        <AnalysisReport filters={globalFilters} />
                    </div>
                );
            case 'test_improvements':
                return (
                    <div className="report-sections">
                        <TestWiseImprovements filters={globalFilters} />
                    </div>
                );
            case 'averages':
                return (
                    <div className="report-sections">
                        <AverageMarksReport filters={globalFilters} />
                    </div>
                );
            case 'average_count':
                return (
                    <div className="report-sections">
                        <AverageCountReport filters={globalFilters} />
                    </div>
                );
            case 'progress':
                return (
                    <div className="report-sections">
                        <AverageReport filters={globalFilters} />
                    </div>
                );
            case 'errors':
                return <ErrorReport filters={globalFilters} setFilters={setGlobalFilters} />;
            case 'error_top':
                return (isAdmin || isCoAdmin) ? <ErrorTop100 filters={globalFilters} setFilters={setGlobalFilters} /> : <div className="p-4">Access Denied</div>;
            case 'error_count':
                return (
                    <div className="report-sections">
                        <ErrorCountReport filters={globalFilters} />
                    </div>
                );
            case 'target_vs_achieved':
                return (
                    <div className="report-sections">
                        <TargetVsAchieved filters={globalFilters} />
                    </div>
                );
            case 'student_performance':
                return (
                    <div className="report-sections">
                        <StudentPerformance filters={globalFilters} />
                    </div>
                );
            case 'approvals':
                return isAdmin ? <UserApprovals /> : <div className="p-4">Access Denied</div>;
            case 'logs':
                return isAdmin ? <ActivityLogs /> : <div className="p-4">Access Denied</div>;
            case 'file_management':
                return userData?.email === 'yenjarappa.s@varsitymgmt.com' ? <FileManagement academicYear={academicYear} /> : <div className="p-4">Access Denied</div>;
            default:
                return <div>Select a page from the sidebar</div>;
        }
    };

    const showFilterBar = ['analysis', 'test_improvements', 'averages', 'average_count', 'progress', 'errors', 'error_top', 'error_count', 'target_vs_achieved', 'student_performance'].includes(activePage);

    return (
        <div className="dashboard-root">
            <Sidebar activePage={activePage} setActivePage={setActivePage} />
            <main className="dashboard-main-content">
                <Header title={
                    activePage === 'analysis' ? 'Analysis Report' :
                        activePage === 'test_improvements' ? 'Test Wise Improvements' :
                            activePage === 'averages' ? 'Average Marks Report' :
                                activePage === 'average_count' ? 'Average Count Report' :
                                    activePage === 'progress' ? 'Progress Report' :
                                        activePage === 'errors' ? 'Error Report' :
                                            activePage === 'error_top' ? 'Error Top 100%' :
                                                activePage === 'error_count' ? 'Error Count Report' :
                                                    activePage === 'target_vs_achieved' ? 'Target Vs Achieved' :
                                                        activePage === 'student_performance' ? 'Student Performance' :
                                                            activePage === 'approvals' ? 'User Approvals' :
                                                                activePage === 'file_management' ? 'Schedules & Timetable & Files' : 'Activity Logs'
                } />
                <div className="content-inner">

                    {showFilterBar && (
                        <FilterBar
                            filters={globalFilters}
                            setFilters={setGlobalFilters}
                            academicYear={academicYear}
                            onYearChange={(year) => {
                                setAcademicYear(year);
                                setPageFilters({});
                            }}
                            restrictedCampus={isRestricted ? userAllowedCampuses : null}
                            apiEndpoints={
                                ['errors', 'error_top', 'error_count'].includes(activePage)
                                    ? { filters: '/api/erp/filters', students: '/api/erp/students' }
                                    : { filters: '/api/filters', students: '/api/studentsByCampus' }
                            }
                        />
                    )}
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
                <AuthContext.Consumer>
                    {({ isAdmin }) => {
                        if (isAdmin) {
                            return (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626', background: '#fff', height: '100vh' }}>
                                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Something went wrong.</h2>
                                    <div style={{ textAlign: 'left', margin: '0 auto', maxWidth: '800px', background: '#fef2f2', padding: '1.5rem', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                        <p style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: '#991b1b' }}>Debug Information (Admin Only):</p>
                                        <details style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#450a0a' }}>
                                            <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>View Stack Trace</summary>
                                            {this.state.error && this.state.error.toString()}
                                            <br />
                                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                                        </details>
                                    </div>
                                    <button
                                        onClick={() => window.location.reload()}
                                        style={{ marginTop: '2rem', padding: '0.75rem 1.5rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                        Reload Application
                                    </button>
                                </div>
                            );
                        }

                        // Professional message for Principals / Co-Admins
                        return (
                            <div style={{
                                height: '100vh',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#f8fafc',
                                padding: '1rem'
                            }}>
                                <div style={{
                                    background: 'white',
                                    padding: '3rem',
                                    borderRadius: '16px',
                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                    textAlign: 'center',
                                    maxWidth: '500px',
                                    width: '100%'
                                }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        background: '#eff6ff',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 1.5rem'
                                    }}>
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                                        </svg>
                                    </div>
                                    <h2 style={{ color: '#1e293b', fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>
                                        System Maintenance
                                    </h2>
                                    <p style={{ color: '#64748b', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                                        We are currently performing scheduled maintenance to optimize your experience. Please try logging back in after some time.
                                    </p>
                                    <button
                                        onClick={() => window.location.assign('/login')}
                                        style={{
                                            width: '100%',
                                            padding: '0.875rem',
                                            background: '#3b82f6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        Back to Login
                                    </button>
                                </div>
                            </div>
                        );
                    }}
                </AuthContext.Consumer>
            );
        }

        return this.props.children;
    }
}

const App = () => {
    return (
        <AuthProvider>
            <ErrorBoundary>
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
            </ErrorBoundary>
        </AuthProvider>
    );
};

// Simple component to prevent logged-in users from seeing the login page
const LoginRedirect = ({ children }) => {
    const { currentUser, userData, loading } = useAuth();
    if (!loading && currentUser && userData?.isApproved) return <Navigate to="/" replace />;
    return children;
};

export default App;
