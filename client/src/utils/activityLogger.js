
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Logs a user activity to Firestore activity_logs collection.
 * 
 * @param {Object} userData - User object containing email, name, campus
 * @param {string} action - The action being performed (e.g., 'Viewed Analysis Report')
 * @param {Object} details - Optional extra details (e.g., filters applied, student ID)
 */
export const logActivity = async (userData, action, details = null) => {
    if (!userData || !userData.email) return;

    try {
        await addDoc(collection(db, "activity_logs"), {
            email: userData.email,
            name: userData.name || 'Unknown',
            campus: userData.campus || 'Not Set',
            action: action,
            details: details,
            timestamp: new Date().toISOString(), // Keeping ISO string for compatibility with existing code
            serverTimestamp: serverTimestamp() // Better for sorting in some cases
        });
    } catch (err) {
        console.error("Activity Logging failed:", err);
    }
};
