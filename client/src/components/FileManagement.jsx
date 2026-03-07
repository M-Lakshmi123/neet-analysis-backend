import React, { useState, useEffect, useRef } from 'react';
import {
    Upload,
    FileText,
    File as FileIcon,
    Download,
    X,
    Calendar,
    BarChart,
    Loader2,
    Trash2
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { motion, AnimatePresence } from 'framer-motion';

const FileManagement = ({ academicYear }) => {
    const [categories] = useState([
        { id: 'schedules', label: 'Schedule & Time Tables', icon: <Calendar size={20} />, emoji: '📅' },
        { id: 'average_files', label: 'Average Files from CO-HYD', icon: <BarChart size={20} />, emoji: '📊' }
    ]);

    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(null); // categoryId
    const [previewFile, setPreviewFile] = useState(null);
    const [excelData, setExcelData] = useState(null);
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
        if (!window.confirm('Are you sure you want to delete this file?')) return;

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
                const response = await fetch(`/uploads/${file.filename}`);
                const buffer = await response.arrayBuffer();
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                const worksheet = workbook.worksheets[0];
                const data = [];
                worksheet.eachRow((row, rowNumber) => {
                    data.push(row.values.slice(1)); // ExcelJS row values are 1-indexed
                });
                setExcelData(data);
            } catch (err) {
                console.error('Excel parse error:', err);
                setExcelData([['Error loading excel data']]);
            }
        }
    };

    const closePreview = () => {
        setPreviewFile(null);
        setExcelData(null);
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

            {categories.map(cat => (
                <section key={cat.id} className="file-category-section glass-panel">
                    <div className="category-header">
                        <h2 className="category-title">
                            {cat.icon}
                            {cat.label}
                        </h2>
                        <button
                            className="btn-primary"
                            onClick={() => {
                                setActiveCategoryForUpload(cat.id);
                                fileInputRef.current.click();
                            }}
                            disabled={uploading === cat.id}
                        >
                            {uploading === cat.id ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                            Upload File
                        </button>
                    </div>

                    <div className="file-grid">
                        {files.filter(f => f.category === cat.id).length === 0 ? (
                            <div className="p-8 text-center text-slate-400 w-full">No files uploaded yet.</div>
                        ) : (
                            files.filter(f => f.category === cat.id).map(file => (
                                <motion.div
                                    key={file.id}
                                    whileHover={{ y: -4 }}
                                    className="file-card"
                                    onClick={() => openPreview(file)}
                                >
                                    <div className="file-info">
                                        <div className="file-icon-wrapper">
                                            <span>{cat.emoji}</span>
                                        </div>
                                        <div style={{ overflow: 'hidden' }}>
                                            <div className="file-name" title={file.original_name}>
                                                {file.original_name}
                                            </div>
                                            <div className="file-meta">
                                                {new Date(file.upload_date).toLocaleDateString()} • {file.file_type.toUpperCase()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            className="btn-icon-only text-slate-400 hover:text-red-500"
                                            onClick={(e) => handleDelete(e, file.id)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </section>
            ))}

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
                            style={{ width: '95vw', height: '90vh', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}
                        >
                            <div className="preview-header glass-panel" style={{ borderRadius: '0', border: 'none', borderBottom: '1px solid #e2e8f0' }}>
                                <div className="flex items-center gap-4">
                                    <div className="file-icon-wrapper" style={{ width: 44, height: 44, fontSize: '1.25rem', background: '#fff' }}>
                                        {previewFile.file_type === 'pdf' ? '📄' : '📊'}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800 text-lg">{previewFile.original_name}</span>
                                        <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">{previewFile.file_type} Document</span>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <a
                                        href={`/uploads/${previewFile.filename}`}
                                        download={previewFile.original_name}
                                        className="btn-standard btn-primary"
                                        style={{ height: '44px' }}
                                    >
                                        <Download size={20} />
                                        Download File
                                    </a>
                                    <button onClick={closePreview} className="btn-icon-only close-btn" style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <X size={28} />
                                    </button>
                                </div>
                            </div>
                            <div className="preview-body">
                                {previewFile.file_type === 'pdf' ? (
                                    <iframe
                                        src={`/uploads/${previewFile.filename}`}
                                        className="preview-frame"
                                        title="PDF Preview"
                                        style={{ width: '100%', height: '100%', borderRadius: '8px', background: 'white' }}
                                    />
                                ) : excelData ? (
                                    <div className="w-full flex justify-center p-4">
                                        <div className="excel-preview-container w-full overflow-auto bg-white rounded-xl shadow-inner border border-slate-200">
                                            <table className="excel-table">
                                                <thead>
                                                    <tr>
                                                        {excelData[0]?.map((cell, i) => (
                                                            <th key={i}>{cell}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {excelData.slice(1).map((row, i) => (
                                                        <tr key={i}>
                                                            {row.map((cell, j) => (
                                                                <td key={j}>{cell?.toString() || ''}</td>
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
                                        <p className="text-slate-500 font-medium">Loading preview data...</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-center p-4 bg-slate-50 border-t items-center gap-4">
                                <p className="text-slate-400 text-sm italic">You are viewing {previewFile.original_name}</p>
                                <button
                                    onClick={closePreview}
                                    className="btn-standard"
                                    style={{ border: '1px solid #e2e8f0', background: 'white', color: '#64748b' }}
                                >
                                    <X size={18} />
                                    Close Preview
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
