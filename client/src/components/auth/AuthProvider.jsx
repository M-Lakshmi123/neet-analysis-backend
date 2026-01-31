import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../../firebase';
import { onAuthStateChanged, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Enforce session persistence (logout on window close)
        setPersistence(auth, browserSessionPersistence).catch(error => {
            console.error("Failed to set auth persistence:", error);
        });

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Check if this is a valid session
                // If the user closes the window, sessionStorage is cleared.
                // When they reopen, 'NEET_SESSION_ACTIVE' will be missing.
                // We force logout in that case.
                const isSessionActive = sessionStorage.getItem('NEET_SESSION_ACTIVE');

                if (!isSessionActive) {
                    // Valid logic to prevent race condition on initial login:
                    // If the user just logged in via LoginPage, the flag is set there.
                    // If the user is reopening a closed tab, the flag is missing -> Logout.
                    console.log("No active session flag found. Logging out...");
                    await auth.signOut();
                    setUserData(null);
                    setCurrentUser(null);
                    setLoading(false);
                    return;
                }

                setLoading(true);
                setCurrentUser(user);

                // Fetch extra user data from Firestore (campus, role, isApproved)
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    setUserData(userDoc.data());
                } else {
                    // This could be the master admin if not in Firestore, or some error
                    // For the provided admin email, we can mock it as admin
                    if (user.email === "yenjarappa.s@varsitymgmt.com") {
                        setUserData({ role: 'admin', campus: 'All', isApproved: true, email: user.email });
                    } else {

                        setUserData(null);
                    }
                }
            } else {
                setUserData(null);
                setCurrentUser(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userData,
        loading,
        isAdmin: userData?.role === 'admin',
        isPrincipal: userData?.role === 'principal',
        isApproved: userData?.isApproved
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
