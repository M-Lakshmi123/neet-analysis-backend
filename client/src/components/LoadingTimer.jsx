import React, { useState, useEffect } from 'react';
import { Timer, Server, Database, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LoadingTimer = ({ isLoading, initialDuration = 50 }) => {
    const [progress, setProgress] = useState(0);
    const [timeLeft, setTimeLeft] = useState(initialDuration);
    const [messageIndex, setMessageIndex] = useState(0);

    const messages = [
        { text: "Connecting to server...", icon: <Server size={20} /> },
        { text: "Verifying credentials...", icon: <Database size={20} /> },
        { text: "Fetching updated records...", icon: <Loader2 size={20} className="animate-spin" /> },
        { text: "Preparing your dashboard...", icon: <CheckCircle size={20} /> }
    ];

    useEffect(() => {
        if (!isLoading) return;

        // Timer Logic
        const startTime = Date.now();
        const endTime = startTime + (initialDuration * 1000);

        const timerInterval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
            const elapsed = initialDuration - remaining;
            const newProgress = Math.min(95, (elapsed / initialDuration) * 100); // Cap at 95% until actually loaded

            setTimeLeft(remaining);
            setProgress(newProgress);

            if (remaining <= 0) {
                clearInterval(timerInterval);
            }
        }, 100);

        // Message Rotation
        const messageInterval = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % messages.length);
        }, 3000);

        return () => {
            clearInterval(timerInterval);
            clearInterval(messageInterval);
        };
    }, [isLoading, initialDuration]);

    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white/95 p-8 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-white/20 relative overflow-hidden"
            >
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-100 rounded-full blur-3xl opacity-50 pointer-events-none" />

                <div className="flex flex-col items-center text-center space-y-6 relative z-10">
                    
                    {/* Timer Circle */}
                    <div className="relative w-24 h-24 mb-2">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-slate-100"
                            />
                            <motion.circle
                                cx="48"
                                cy="48"
                                r="40"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={251.2}
                                strokeDashoffset={251.2 - (251.2 * progress) / 100}
                                strokeLinecap="round"
                                className="text-indigo-600 transition-all duration-300 ease-linear"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-slate-700">{timeLeft}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Seconds</span>
                        </div>
                    </div>

                    {/* Text Messages */}
                    <div className="h-12 flex flex-col items-center justify-center w-full">
                        <AnimatePresence mode='wait'>
                            <motion.div
                                key={messageIndex}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex items-center gap-2 text-slate-600 font-medium"
                            >
                                {messages[messageIndex].icon}
                                <span>{messages[messageIndex].text}</span>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Explanation Text */}
                    <p className="text-xs text-slate-400 px-4">
                        We are spinning up the secure servers. This typically takes about 50 seconds for the first login.
                    </p>

                    {/* Progress Bar (Visual Flair) */}
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                        <motion.div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default LoadingTimer;
