import React, { useState, useEffect } from 'react';
import { API_URL } from '../../utils/apiHelper';
import { auth, db } from '../../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, School, ArrowRight, Award, TrendingUp, Users } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Toast from '../Toast';

const RegisterPage = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [campus, setCampus] = useState('');
    const [campuses, setCampuses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentSlide, setCurrentSlide] = useState(0);
    const [toast, setToast] = useState(null);
    const navigate = useNavigate();

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
    };

    const slides = [
        {
            image: "brooke-cagle-g1Kr4Ozfoac-unsplash.jpg",
            quote: "TRANSFORMING DREAMS INTO REALITY THROUGH EXCELLENCE.",
            stats: [
                { icon: <Users size={20} />, label: "NEET QUALIFIED", value: "85,000+" },
                { icon: <Award size={20} />, label: "TOP AIR RANKS", value: "AIR 1, 2, 3" }
            ]
        },
        {
            image: "pang-yuhao-_kd5cxwZOK4-unsplash.jpg",
            quote: "GLOBAL STANDARDS IN MEDICAL EDUCATION.",
            stats: [
                { icon: <School size={20} />, label: "LEGACY OF TRUST", value: "38 YEARS" },
                { icon: <TrendingUp size={20} />, label: "MBBS SEATS", value: "25,000+" }
            ]
        },
        {
            image: "david-schultz-kM97y3aWWQw-unsplash.jpg",
            quote: "WHERE DETERMINATION MEETS WORLD-CLASS MENTORSHIP.",
            stats: [
                { icon: <Users size={20} />, label: "ASPIRING DOCTORS", value: "2 LAC PROJECTED" },
                { icon: <Award size={20} />, label: "STATE TOPPERS", value: "150+" }
            ]
        }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % slides.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchCampuses = async () => {
            const apiUrl = `${API_URL}/api/filters`;
            try {
                const res = await fetch(apiUrl);
                const data = await res.json();
                setCampuses(data.campuses || []);
            } catch (err) {
                console.error("Failed to fetch campuses:", err);
                setError("Could not load campus list. Please ensure backend is running.");
            }
        };
        fetchCampuses();
    }, []);

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            return setError("Passwords do not match");
        }

        if (!campus) {
            return setError("Please select your campus");
        }

        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name,
                email,
                campus,
                role: 'principal',
                isApproved: false,
                createdAt: new Date().toISOString()
            });

            showToast("Registration successful! Pending admin approval.");
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            if (err.message.includes("permissions")) {
                showToast("Registration access denied by database rules. Please contact Administrator.", "error");
            } else {
                showToast(err.message, "error");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="auth-container">
                <div className="auth-card">
                    {/* Left Side: Inspirational Slideshow */}
                    <div className="auth-slides-side">
                        {slides.map((slide, index) => (
                            <div key={index} className={`slide ${currentSlide === index ? 'active' : ''}`}>
                                {slide.image && (
                                    <img src={`/${slide.image}`} alt="Slide" className="slide-img" />
                                )}
                                <div className="slide-content">
                                    <h3 className="slide-quote">"{slide.quote}"</h3>
                                    <div className="slide-stats">
                                        {slide.stats.map((stat, sIndex) => (
                                            <div key={sIndex} className="stat-item">
                                                <h4>{stat.value}</h4>
                                                <p>{stat.label}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right Side: Compact Form */}
                    <div className="auth-form-side compact-form">
                        <div className="auth-form-inner">
                            <div className="auth-header">
                                <div className="auth-logo">
                                    <img src="/logo.png" alt="Sri Chaitanya" />
                                </div>
                                <h2>Principal Registration</h2>
                                <p>Request access to your campus dashboard</p>
                            </div>

                            {/* Toast handles errors now */}

                            <form onSubmit={handleRegister}>
                                <div className="form-group">
                                    <label>Full Name</label>
                                    <div className="input-with-icon">
                                        <UserPlus size={16} className="icon" />
                                        <input
                                            type="text"
                                            placeholder="Full Name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>College Email ID</label>
                                    <div className="input-with-icon">
                                        <Mail size={16} className="icon" />
                                        <input
                                            type="email"
                                            placeholder="email@college.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Campus Name</label>
                                    <div className="input-with-icon">
                                        <School size={16} className="icon" />
                                        <select
                                            value={campus}
                                            onChange={(e) => setCampus(e.target.value)}
                                            required
                                        >
                                            <option value="">Select your campus</option>
                                            {campuses.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Password</label>
                                    <div className="input-with-icon">
                                        <Lock size={16} className="icon" />
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Confirm Password</label>
                                    <div className="input-with-icon">
                                        <Lock size={16} className="icon" />
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="btn-auth" disabled={loading}>
                                    {loading ? "Requesting..." : "Send Request for Approval"}
                                    {!loading && <ArrowRight size={18} />}
                                </button>
                            </form>

                            <div className="auth-footer">
                                Already have an account?
                                <Link to="/login" className="btn-secondary-link">
                                    Login here
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default RegisterPage;
