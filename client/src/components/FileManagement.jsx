import React, { useState, useEffect, useRef } from 'react';
import {
    Upload,
    FileText,
    Table as ExcelIcon,
    Download,
    X,
    Calendar,
    BarChart,
    Loader2,
    Trash2,
    ChevronDown,
    ChevronRight,
    FileCode
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { motion, AnimatePresence } from 'framer-motion';

const FileManagement = ({ academicYear }) => {
    const [categories, setCategories] = useState([
        { id: 'schedules', label: 'Schedule & Time Tables', icon: <Calendar size={24} />, emoji: '📅', color: '#6366f1' },
        { id: 'average_files', label: 'Average Files from CO-HYD', icon: <BarChart size={24} />, emoji: '📊', color: '#10b981' }
    ]);

    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(null);
    const [previewFile, setPreviewFile] = useState(null);
    const [excelData, setExcelData] = useState(null);
    const [expandedCategory, setExpandedCategory] = useState('schedules'); // Default expanded

    const fileInputRef = useRef(null);
    const [activeCategoryForUpload, setActiveCategoryForUpload] = useState(null);

    useEffect(() => {
        fetchFiles();
    }, [academicYear]);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/files?academicYear=${academicYear}`);
            const data = await response.json();
            setFiles(data);
        } catch (err) {
            console.error('Failed to fetch files:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeCategoryForUpload) return;

        setUploading(activeCategoryForUpload);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', activeCategoryForUpload);

        try {
            const response = await fetch(`/api/files/upload?academicYear=${academicYear}`, {
                method: 'POST',
                body: formData
            });
            if (response.ok) {
                fetchFiles();
            } else {
                alert('Upload failed');
            }
        } catch (err) {
            console.error('Upload error:', err);
            alert('Upload error');
        } finally {
            setUploading(null);
            setActiveCategoryForUpload(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this file from the database?')) return;

        try {
            const response = await fetch(`/api/files/${id}?academicYear=${academicYear}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                fetchFiles();
            }
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const openPreview = async (file) => {
        setPreviewFile(file);
        if (file.file_type === 'xlsx' || file.file_type === 'xls') {
            try {
                // Fetch binary from DB
                const response = await fetch(`/api/files/view/${file.id}?academicYear=${academicYear}`);
                const buffer = await response.arrayBuffer();
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                const worksheet = workbook.worksheets[0];
                const data = [];
                worksheet.eachRow((row) => {
                    data.push(row.values.slice(1));
                });
                setExcelData(data);
            } catch (err) {
                console.error('Excel parse error:', err);
                setExcelData([['Error loading excel data from database']]);
            }
        }
    };

    const closePreview = () => {
        setPreviewFile(null);
        setExcelData(null);
    };

    const getFileIcon = (type) => {
        switch (type) {
            case 'pdf': return <FileText size={24} color="#ef4444" />;
            case 'xlsx':
            case 'xls': return <ExcelIcon size={24} color="#22c55e" />;
            default: return <FileIcon size={24} color="#94a3b8" />;
        }
    };

    return (
        <div className="file-mgmt-container">
            <input
                type="file"
                ref={fileInputRef}
                className="upload-input-hidden"
                onChange={handleUpload}
                accept=".pdf,.xlsx,.xls"
            />

            <div className="flex flex-col gap-6">
                {categories.map(cat => (
                    <div key={cat.id} className="category-wrapper">
                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                            className={`glass-panel w-full flex items-center justify-between p-6 cursor-pointer transition-all ${expandedCategory === cat.id ? 'active-cat' : ''}`}
                            style={{
                                borderLeft: `6px solid ${cat.color}`,
                                background: expandedCategory === cat.id ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)'
                            }}
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-white shadow-sm" style={{ color: cat.color }}>
                                    {cat.icon}
                                </div>
                                <div className="text-left">
                                    <h3 className="text-lg font-bold text-slate-800">{cat.label}</h3>
                                    <p className="text-sm text-slate-500">{files.filter(f => f.category === cat.id).length} files available</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    className="btn-primary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCategoryForUpload(cat.id);
                                        fileInputRef.current.click();
                                    }}
                                    disabled={uploading === cat.id}
                                    style={{ background: cat.color }}
                                >
                                    {uploading === cat.id ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                                    Upload
                                </button>
                                {expandedCategory === cat.id ? <ChevronDown className="text-slate-400" /> : <ChevronRight className="text-slate-400" />}
                            </div>
                        </motion.button>

                        <AnimatePresence>
                            {expandedCategory === cat.id && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                                        {files.filter(f => f.category === cat.id).length === 0 ? (
                                            <div className="col-span-full p-12 text-center text-slate-400 glass-panel">
                                                <FileCode size={48} className="mx-auto mb-4 opacity-20" />
                                                <p>No files uploaded in this category yet.</p>
                                            </div>
                                        ) : (
                                            files.filter(f => f.category === cat.id).map(file => (
                                                <motion.div
                                                    key={file.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="file-card-v2 glass-panel p-4 flex items-center justify-between group"
                                                    onClick={() => openPreview(file)}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="file-type-icon">
                                                            {getFileIcon(file.file_type)}
                                                        </div>
                                                        <div className="overflow-hidden">
                                                            <div className="font-bold text-slate-700 truncate text-sm" title={file.original_name}>
                                                                {file.original_name}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 uppercase font-bold">
                                                                {new Date(file.upload_date).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <a
                                                            href={`/api/files/view/${file.id}?academicYear=${academicYear}&download=true`}
                                                            className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-500"
                                                            onClick={(e) => e.stopPropagation()}
                                                            download
                                                        >
                                                            <Download size={16} />
                                                        </a>
                                                        <button
                                                            className="p-2 hover:bg-red-50 rounded-lg text-red-400"
                                                            onClick={(e) => handleDelete(e, file.id)}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {previewFile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="preview-overlay"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="preview-content"
                            style={{ width: '95vw', height: '92vh', background: 'rgba(255, 255, 255, 0.98)' }}
                        >
                            <div className="preview-header glass-panel" style={{ borderRadius: '0', border: 'none', borderBottom: '1px solid #e2e8f0' }}>
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                                        {getFileIcon(previewFile.file_type)}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800 text-lg leading-tight">{previewFile.original_name}</span>
                                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Database Storage • {previewFile.file_type}</span>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <a
                                        href={`/api/files/view/${previewFile.id}?academicYear=${academicYear}&download=true`}
                                        className="btn-standard btn-primary"
                                        style={{ height: '44px', borderRadius: '12px' }}
                                        download
                                    >
                                        <Download size={20} />
                                        Download Securely
                                    </a>
                                    <button onClick={closePreview} className="btn-icon-only close-btn" style={{ width: '44px', height: '44px' }}>
                                        <X size={28} />
                                    </button>
                                </div>
                            </div>
                            <div className="preview-body">
                                {previewFile.file_type === 'pdf' ? (
                                    <iframe
                                        src={`/api/files/view/${previewFile.id}?academicYear=${academicYear}`}
                                        className="preview-frame"
                                        title="PDF Preview"
                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                    />
                                ) : excelData ? (
                                    <div className="w-full h-full p-6 overflow-auto bg-slate-100">
                                        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mx-auto max-w-[1400px]">
                                            <table className="excel-table w-full">
                                                <thead>
                                                    <tr className="bg-slate-50">
                                                        {excelData[0]?.map((cell, i) => (
                                                            <th key={i} className="px-4 py-3 text-left text-xs font-black text-slate-600 uppercase tracking-tighter border-b border-slate-200">{cell}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {excelData.slice(1).map((row, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                            {row.map((cell, j) => (
                                                                <td key={j} className="px-4 py-2 text-sm text-slate-700 border-b border-slate-100">{cell?.toString() || ''}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center w-full h-full gap-4">
                                        <Loader2 className="animate-spin text-indigo-500" size={48} />
                                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Fetching binary data from TiDB...</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-between items-center p-4 bg-white border-t">
                                <span className="text-xs text-slate-400">Secure Database Storage System v1.0</span>
                                <button
                                    onClick={closePreview}
                                    className="btn-standard"
                                    style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', height: '40px', borderRadius: '10px' }}
                                >
                                    <X size={18} />
                                    Exit Full Screen
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FileManagement;
