import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setLoading(true);
            setCurrentUser(user);
            if (user) {
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
