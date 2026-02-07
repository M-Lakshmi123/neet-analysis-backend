import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LoadingTimer = ({ isLoading }) => {
    const [seconds, setSeconds] = useState(0);

    // Circle Visualization Constants
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    // We map the circle to 60 seconds loop
    const MAX_TIME = 60;

    useEffect(() => {
        let interval;
        if (isLoading) {
            setSeconds(0);
            interval = setInterval(() => {
                setSeconds(prev => prev + 1);
            }, 1000);
        } else {
            setSeconds(0);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    // Calculate stroke offset
    const progress = Math.min((seconds % MAX_TIME) / MAX_TIME, 1);
    const strokeDashoffset = circumference - (progress * circumference);

    return (
        <AnimatePresence>
            {isLoading && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 99999, /* Extremely high Z-Index */
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '2rem',
                            padding: '2.5rem',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            maxWidth: '400px',
                            width: '90%',
                            position: 'relative'
                        }}
                    >
                        {/* Circle Timer Container */}
                        <div style={{ position: 'relative', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {/* SVG Ring */}
                            <svg width="200" height="200" style={{ transform: 'rotate(-90deg)' }}>
                                {/* Track */}
                                <circle
                                    cx="100" cy="100" r={radius}
                                    stroke="#f3e8ff" // purple-100
                                    strokeWidth="12"
                                    fill="transparent"
                                />
                                {/* Progress */}
                                <circle
                                    cx="100" cy="100" r={radius}
                                    stroke="#8b5cf6" // violet-500
                                    strokeWidth="12"
                                    fill="transparent"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                                />
                            </svg>

                            {/* Timer Text Centered */}
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '3.5rem', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace', letterSpacing: '-2px' }}>
                                    {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                                    {String(seconds % 60).padStart(2, '0')}
                                </span>
                            </div>
                        </div>

                        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '0.5rem', margin: 0 }}>Kindly Wait</h3>
                        <p style={{ color: '#64748b', textAlign: 'center', fontWeight: '500', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                            Data is loading...
                        </p>

                        {/* Render Delay Info Message */}
                        {seconds > 3 && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    backgroundColor: '#f5f3ff', // violet-50
                                    border: '1px solid #ede9fe', // violet-100
                                    borderRadius: '1rem',
                                    padding: '1rem',
                                    width: '100%',
                                    textAlign: 'center'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.25rem', color: '#6d28d9', fontWeight: 'bold' }}>
                                    <span>Server Waking Up 🚀</span>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: '#7c3aed', lineHeight: '1.4', margin: 0, fontWeight: '500' }}>
                                    Free instance spin-up may delay requests by up to 50 seconds.
                                </p>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default LoadingTimer;
