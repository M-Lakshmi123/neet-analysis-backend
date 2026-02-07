import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const LoadingTimer = ({ isLoading }) => {
    const [seconds, setSeconds] = useState(0);

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

    return (
        <AnimatePresence>
            {isLoading && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ duration: 0.3, type: "spring" }}
                        className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 border border-slate-100"
                    >
                        {/* Animated Spinner with Gradient */}
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-25"></div>
                            <div className="relative bg-blue-50 p-4 rounded-full">
                                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-slate-800 mb-2">Loading Data</h3>

                        <p className="text-slate-500 text-center text-sm mb-6">
                            Please wait while we fetch the latest reports...
                        </p>

                        {/* Timer & Slow Network Message */}
                        <div className="w-full bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                            <div className="text-2xl font-mono font-bold text-blue-600 mb-1">
                                {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                                {String(seconds % 60).padStart(2, '0')}
                            </div>
                            <p className="text-xs text-slate-400 font-medium">Time Elapsed</p>

                            {/* Show friendly message if taking longer than expected (e.g., > 3s) */}
                            {seconds > 3 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-3 pt-3 border-t border-slate-200"
                                >
                                    <p className="text-xs text-amber-600 font-medium px-2 leading-relaxed">
                                        Server might be waking up.<br />This can take up to 50 seconds.
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default LoadingTimer;
