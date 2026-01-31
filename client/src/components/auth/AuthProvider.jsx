import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../../firebase';
import { onAuthStateChanged, setPersistence, browserSessionPersistence, signOut } from 'firebase/auth';
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
            // IMMEDIATE SECURITY CHECK for existing sessions being restored
            if (user) {
                const isSessionActive = sessionStorage.getItem('NEET_SESSION_ACTIVE');

                if (!isSessionActive) {
                    console.error("⛔ SECURITY: Session flag missing. Forcing logout sequence.");

                    // 1. Immediately nullify local state to prevent UI rendering
                    setUserData(null);
                    setCurrentUser(null);

                    // 2. Force Firebase SignOut
                    try {
                        await signOut(auth);
                        // Double tap: Set persistence to none to clear any indexedDB tokens
                        // await setPersistence(auth, inMemoryPersistence); 
                    } catch (e) {
                        console.error("SignOut failed", e);
                    }

                    setLoading(false);
                    return; // STOP EXECUTION HERE
                }
            }

            if (user) {
                // Happy path: User is logged in AND has the session flag
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
