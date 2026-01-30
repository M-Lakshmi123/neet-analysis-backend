import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDhONjzDiINtqOJVUpuNZm0dyDq38XZiH8",
    authDomain: "medical-2025-srichaitanya.firebaseapp.com",
    projectId: "medical-2025-srichaitanya",
    storageBucket: "medical-2025-srichaitanya.firebasestorage.app",
    messagingSenderId: "71567440242",
    appId: "1:71567440242:web:e20af55a0a5ba2a9a185eb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
