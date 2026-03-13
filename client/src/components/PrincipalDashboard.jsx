import React, { useState, useEffect } from 'react';
import {
    BarChart,
    Users,
    Activity,
    Target,
    TrendingUp,
    TrendingDown,
    Calendar,
    School,
    ArrowUpRight,
    Search,
    Loader2
} from 'lucide-react';
import { API_URL } from '../utils/apiHelper';
import AnalysisReport from './AnalysisReport';

const PrincipalDashboard = ({ filters }) => {
    return (
        <div className="principal-dashboard-container">
            <div className="welcome-section mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Campus Overview</h2>
                <p className="text-slate-500">High-level insights for your assigned campuses</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="stat-card p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <Users size={20} />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-500 text-sm font-medium">Total Students</span>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">--</h3>
                    </div>
                </div>

                <div className="stat-card p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <Target size={20} />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-500 text-sm font-medium">Avg Score</span>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">--</h3>
                    </div>
                </div>

                <div className="stat-card p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-500 text-sm font-medium">Campus Rank</span>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">--</h3>
                    </div>
                </div>

                <div className="stat-card p-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                            <Activity size={20} />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-500 text-sm font-medium">Test Participation</span>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">--%</h3>
                    </div>
                </div>
            </div>

            <div className="dashboard-content">
                <AnalysisReport filters={filters} isMini={true} />
            </div>

            <style jsx>{`
                .principal-dashboard-container {
                    padding: 0;
                }
                .grid { display: grid; }
                .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
                @media (min-width: 768px) { .md\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
                @media (min-width: 1024px) { .lg\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
                .gap-6 { gap: 1.5rem; }
                .mb-6 { margin-bottom: 1.5rem; }
                .mb-8 { margin-bottom: 2rem; }
                .p-6 { padding: 1.5rem; }
                .bg-white { background-color: #ffffff; }
                .rounded-2xl { border-radius: 1rem; }
                .border { border-width: 1px; }
                .border-slate-100 { border-color: #f1f5f9; }
                .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
                .flex { display: flex; }
                .items-center { align-items: center; }
                .justify-between { justify-content: space-between; }
                .mb-4 { margin-bottom: 1rem; }
                .p-2 { padding: 0.5rem; }
                .bg-blue-50 { background-color: #eff6ff; }
                .text-blue-600 { color: #2563eb; }
                .bg-green-50 { background-color: #f0fdf4; }
                .text-green-600 { color: #16a34a; }
                .bg-purple-50 { background-color: #faf5ff; }
                .text-purple-600 { color: #9333ea; }
                .bg-orange-50 { background-color: #fff7ed; }
                .text-orange-600 { color: #ea580c; }
                .flex-col { flex-direction: column; }
                .text-slate-500 { color: #64748b; }
                .text-sm { font-size: 0.875rem; }
                .font-medium { font-weight: 500; }
                .text-2xl { font-size: 1.5rem; }
                .font-bold { font-weight: 700; }
                .text-slate-800 { color: #1e293b; }
                .mt-1 { margin-top: 0.25rem; }
            `}</style>
        </div>
    );
};

export default PrincipalDashboard;
