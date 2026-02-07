import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LoadingTimer = ({ isLoading }) => {
    const [seconds, setSeconds] = useState(0);

    // Circle Visualization Constants
    const radius = 80;
    const circumference = 2 * Math.PI * radius;
    // We map the circle to 50 seconds (typical Render delay)
    // After 50s, it stays full or resets. Let's make it loop slowly or stay full.
    // Let's loop 60s for standard clock feel.
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
    // Progress 0 -> 1
    const progress = Math.min((seconds % MAX_TIME) / MAX_TIME, 1);
    const strokeDashoffset = circumference - (progress * circumference);

    return (
        <AnimatePresence>
            {isLoading && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="bg-white p-8 rounded-[2rem] shadow-2xl flex flex-col items-center max-w-sm w-full mx-4"
                    >
                        {/* Circle Timer Container */}
                        <div className="relative mb-6 flex items-center justify-center">
                            {/* SVG Ring */}
                            <svg width="200" height="200" className="transform -rotate-90">
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
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-5xl font-bold text-violet-600 font-mono tracking-tighter">
                                    {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                                    {String(seconds % 60).padStart(2, '0')}
                                </span>
                            </div>
                        </div>

                        <h3 className="text-2xl font-bold text-slate-800 mb-2">Kindly Wait</h3>
                        <p className="text-slate-500 text-center font-medium mb-6 px-4">
                            Data is loading...
                        </p>

                        {/* Render Delay Info Message */}
                        {seconds > 3 && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-violet-50 border border-violet-100 rounded-xl p-4 w-full text-center"
                            >
                                <div className="flex items-center justify-center gap-2 mb-1 text-violet-700 font-bold">
                                    <span>Server Waking Up 🚀</span>
                                </div>
                                <p className="text-xs text-violet-600 leading-relaxed font-medium">
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
