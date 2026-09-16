
import React, { useState, useEffect } from 'react';
import { API_URL } from '../../utils/apiHelper';
import { auth, db } from '../../firebase';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Mail, Lock, School, ArrowRight, Award, TrendingUp, Users } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import Select from 'react-select';
import Toast from '../Toast';
import Modal from '../Modal';

const ALL_CAMPUSES = [
    "BALLARI BOYS",
    "BALLARI GIRLS",
    "BANASWADI",
    "BANNERGHATTA ROAD",
    "BASAVESWARA NAGAR COACHING CENTER",
    "BELAGAVI",
    "BELAGAVI COACHING CENTER",
    "BELLANDUR",
    "BHAGATHSINGH NAGAR",
    "DAVANAGERE",
    "DAVANAGERE 2",
    "DR BS RAO VIDYASOUDHA MYSORE",
    "DUNLOP",
    "ECITY NEET BOYS",
    "ELECTRONIC CITY",
    "ELECTRONIC CITY DS",
    "ELECTRONIC CITY INTERNATIONAL",
    "HEBBAL",
    "HEGDENAGAR",
    "HORAMAVU",
    "HSR LAYOUT BANGALORE",
    "HUBLI",
    "HUBLI 2",
    "J P NAGAR",
    "JAYA NAGAR COACHING CENTER",
    "KAGGADASAPURA",
    "KAGGADASPURA",
    "KALYAN NAGAR",
    "KALYAN NAGAR COACHING CENTER",
    "KANAKAPURA ROAD",
    "KOLAR",
    "KORAMANGALA",
    "KR PURAM",
    "KUDLU",
    "KUDLU 2",
    "MAGADI ROAD",
    "MAHALAKSHMI LAYOUT",
    "MANDYA",
    "MANGALORE",
    "MANGALURU",
    "MARTHAHALLI",
    "MARTHAHALLI C-120",
    "MYSORE",
    "NAGARBHAVI",
    "PEENYA DASARAHALLI",
    "RAJAJI NAGAR",
    "RAJAJINAGAR",
    "RAM MURTHY NAGAR 3",
    "SAHAKARA NAGAR",
    "SARJAPURA",
    "SESHADRIPURAM",
    "SHIMOGA",
    "SHIVAMOGGA",
    "SR SECONDARY KARUR",
    "TUMKUR",
    "TUMKUR 3",
    "UDUPI",
    "ULLAL",
    "UTTARAHALLI",
    "VARTHUR",
    "VIDYARANYAPURA",
    "WHITEFIELD",
    "YELAHANKA",
    "YELLAHANKA",
    "YESHWANTHPUR"
].sort();

const RegisterPage = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedCampuses, setSelectedCampuses] = useState([]);
    const [campuses, setCampuses] = useState(ALL_CAMPUSES);
    const [loading, setLoading] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [toast, setToast] = useState(null);
    const navigate = useNavigate();

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
    };

    const slides = [
        {
            image: "/brooke-cagle-g1Kr4Ozfoac-unsplash.jpg",
            quote: "TRANSFORMING DREAMS INTO REALITY THROUGH EXCELLENCE",
            animClass: "anim-fade",
            stats: [
                { icon: <Users size={20} />, label: "NEET QUALIFIED", value: "85,000+" },
                { icon: <Award size={20} />, label: "TOP AIR RANKS", value: "AIR 1, 2, 3" }
            ]
        },
        {
            image: "/pang-yuhao-_kd5cxwZOK4-unsplash.jpg",
            quote: "GLOBAL STANDARDS IN MEDICAL EDUCATION",
            animClass: "anim-zoom",
            stats: [
                { icon: <School size={20} />, label: "LEGACY OF TRUST", value: "38 YEARS" },
                { icon: <TrendingUp size={20} />, label: "MBBS SEATS", value: "25,000+" }
            ]
        },
        {
            image: "/david-schultz-kM97y3aWWQw-unsplash.jpg",
            quote: "WHERE DETERMINATION MEETS WORLD-CLASS MENTORSHIP",
            animClass: "anim-slide",
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
            try {
                // Try dedicated campuses endpoint first, fallback to filters
                let res = await fetch(`${API_URL}/api/campuses`);
                if (!res.ok) {
                    res = await fetch(`${API_URL}/api/filters?academicYear=2026`);
                }
                if (!res.ok) throw new Error("Backend unreachable");
                const data = await res.json();
                if (data.campuses && data.campuses.length > 0) {
                    const merged = Array.from(new Set([...ALL_CAMPUSES, ...data.campuses])).sort();
                    setCampuses(merged);
                }
            } catch (err) {
                console.warn("Using master campus list:", err);
                setCampuses(ALL_CAMPUSES);
            }
        };
        fetchCampuses();
    }, []);

    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    const handleModalClose = async () => {
        setModal({ ...modal, isOpen: false });
        // Navigate to login after success modal closes
        if (modal.type === 'success') {
            await signOut(auth); // Sign out only when user acknowledges success
            navigate('/login');
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            showToast("Passwords do not match", "error");
            return;
        }

        // Restrict Gmail addresses
        if (email.toLowerCase().endsWith('@gmail.com')) {
            showToast("Registration with Gmail is not allowed. Please use your official college email ID.", "error");
            return;
        }

        if (!selectedCampuses || selectedCampuses.length === 0) {
            showToast("Please select at least one campus", "error");
            return;
        }

        const campusList = selectedCampuses.map(c => c.value);
        const campusString = campusList.join(', ');

        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name,
                email,
                phone,
                campus: campusString,
                allowedCampuses: campusList,
                role: 'principal',
                isApproved: false,
                createdAt: new Date().toISOString()
            });

            // Notify Admin via Email (Non-blocking background request)
            fetch(`${API_URL}/api/notify-registration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, campus: campusString, allowedCampuses: campusList, phone, role: 'principal' })
            }).catch(err => console.error("Failed to notify admin:", err));

            // Mark session as active since they are now logged in
            sessionStorage.setItem('NEET_SESSION_ACTIVE', 'true');

            // Show Success Modal immediately
            setModal({
                isOpen: true,
                type: 'success',
                title: 'Request Sent Successfully!',
                message: 'Your registration request has been submitted. Please wait for the admin to approve your request via WhatsApp.',
                confirmText: 'Back to Login'
            });

        } catch (err) {
            if (err.message.includes("permissions")) {
                showToast("Registration access denied by database rules. Please contact Administrator.", "error");
            } else if (err.code === 'auth/email-already-in-use') {
                showToast("This email is already registered", "error");
            } else if (err.code === 'auth/weak-password') {
                showToast("Password should be at least 6 characters", "error");
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
                            <div key={index} className={`slide ${currentSlide === index ? 'active' : ''} `}>
                                {slide.image && (
                                    <img src={slide.image} alt="Slide" className="slide-img" />
                                )}
                                <div className={`slide-content ${slide.animClass}`}>
                                    <h3 className="slide-quote">{slide.quote}</h3>
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

                                    <div className="form-group">
                                        <label>WhatsApp Number</label>
                                        <div className="input-with-icon">
                                            <div className="icon" style={{ fontSize: '14px', fontWeight: 'bold' }}>+91</div>
                                            <input
                                                type="tel"
                                                placeholder="10 digit mobile number"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                pattern="[0-9]{10}"
                                                required
                                            />
                                        </div>
                                        <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                                            Used for sending approval notifications via WhatsApp
                                        </small>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Campus / Campuses</label>
                                    <div className="input-with-icon" style={{ position: 'relative' }}>
                                        <School size={16} className="icon" style={{ zIndex: 2, pointerEvents: 'none', top: '13px', transform: 'none' }} />
                                        <div style={{ flex: 1, width: '100%' }}>
                                            <Select
                                                isMulti
                                                options={campuses.map(c => ({ value: c, label: c }))}
                                                value={selectedCampuses}
                                                onChange={(selected) => setSelectedCampuses(selected || [])}
                                                placeholder="Select campus(es)..."
                                                closeMenuOnSelect={false}
                                                styles={{
                                                    container: (base) => ({
                                                        ...base,
                                                        width: '100%'
                                                    }),
                                                    control: (base, state) => ({
                                                        ...base,
                                                        width: '100%',
                                                        minHeight: '42px',
                                                        paddingLeft: '2.4rem',
                                                        paddingRight: '0.4rem',
                                                        backgroundColor: '#f8fafc',
                                                        border: state.isFocused ? '1.5px solid var(--accent, #6366f1)' : '1.5px solid #e2e8f0',
                                                        borderRadius: '12px',
                                                        boxShadow: state.isFocused ? '0 0 0 4px rgba(99, 102, 241, 0.1)' : 'none',
                                                        fontSize: '0.85rem',
                                                        transition: 'all 0.2s',
                                                        '&:hover': {
                                                            borderColor: '#cbd5e1'
                                                        }
                                                    }),
                                                    valueContainer: (base) => ({
                                                        ...base,
                                                        padding: '2px 0',
                                                        gap: '3px'
                                                    }),
                                                    menu: (base) => ({
                                                        ...base,
                                                        borderRadius: '12px',
                                                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                                                        zIndex: 9999,
                                                        fontSize: '0.85rem',
                                                        border: '1px solid #e2e8f0',
                                                        overflow: 'hidden'
                                                    }),
                                                    menuList: (base) => ({
                                                        ...base,
                                                        maxHeight: '190px',
                                                        padding: '4px'
                                                    }),
                                                    option: (base, state) => ({
                                                        ...base,
                                                        backgroundColor: state.isSelected ? '#eff6ff' : state.isFocused ? '#f1f5f9' : 'transparent',
                                                        color: state.isSelected ? '#1d4ed8' : '#334155',
                                                        fontWeight: state.isSelected ? 600 : 400,
                                                        borderRadius: '8px',
                                                        marginBottom: '2px',
                                                        cursor: 'pointer'
                                                    }),
                                                    multiValue: (base) => ({
                                                        ...base,
                                                        backgroundColor: '#eff6ff',
                                                        borderRadius: '6px',
                                                        border: '1px solid #dbeafe',
                                                        margin: '2px'
                                                    }),
                                                    multiValueLabel: (base) => ({
                                                        ...base,
                                                        color: '#1e40af',
                                                        fontWeight: 600,
                                                        fontSize: '0.72rem',
                                                        padding: '2px 5px'
                                                    }),
                                                    multiValueRemove: (base) => ({
                                                        ...base,
                                                        color: '#3b82f6',
                                                        cursor: 'pointer',
                                                        ':hover': {
                                                            backgroundColor: '#dbeafe',
                                                            color: '#1e40af'
                                                        }
                                                    }),
                                                    placeholder: (base) => ({
                                                        ...base,
                                                        color: '#94a3b8',
                                                        fontSize: '0.85rem'
                                                    })
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Password</label>
                                    <div className="input-with-icon">
                                        <Lock size={16} className="icon" />
                                        <input
                                            type="password"
                                            placeholder=""
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
                                            placeholder=""
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

            <Modal
                isOpen={modal.isOpen}
                onClose={handleModalClose}
                title={modal.title}
                message={modal.message}
                type={modal.type}
                confirmText={modal.confirmText}
            />
        </>
    );
};

export default RegisterPage;
