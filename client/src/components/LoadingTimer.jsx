import React from 'react';
import { motion } from 'framer-motion';

const LoadingTimer = ({ isLoading }) => {
    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white px-8 py-6 rounded-lg shadow-2xl flex items-center gap-4"
            >
                <div className="text-lg font-bold text-slate-800">
                    Loading Data...
                </div>
            </motion.div>
        </div>
    );
};

export default LoadingTimer;
