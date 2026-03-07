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
    FileCode,
    Search,
    FileSearch,
    Files
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { motion, AnimatePresence } from 'framer-motion';

const FileManagement = ({ academicYear, setAcademicYear }) => {
    // Exact requested categories as side-by-side tabs
    const [activeCategory, setActiveCategory] = useState('schedules');
    const categories = [
        { id: 'schedules', label: 'Schedules & Time Tables', icon: <Calendar size={18} />, color: '#6366f1' },
        { id: 'averages', label: 'Average Files from CO-HYD', icon: <BarChart size={18} />, color: '#10b981' }
    ];

    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);
    const [excelData, setExcelData] = useState(null);

    useEffect(() => {
        fetchFiles();
    }, [academicYear, activeCategory]);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            // Fetch for specific year AND category
            const response = await fetch(`/api/files?academicYear=${academicYear}&category=${activeCategory}`);
            const data = await response.json();
            setFiles(data);
        } catch (err) {
            console.error('Failed to fetch files:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true; // Support multiple files
        input.accept = '.pdf,.xlsx,.xls';
        input.onchange = async (e) => {
            const selectedFiles = Array.from(e.target.files);
            if (selectedFiles.length === 0) return;

            setUploading(true);
            const formData = new FormData();
            selectedFiles.forEach(file => {
                formData.append('files', file); // Use 'files' to match array upload in backend
            });
            formData.append('category', activeCategory);

            try {
                const response = await fetch(`/api/files/upload?academicYear=${academicYear}`, {
                    method: 'POST',
                    body: formData
                });
                if (response.ok) {
                    const result = await response.json();
                    alert(`Upload Complete: ${result.message}`);
                    fetchFiles();
                } else {
                    const errData = await response.json();
                    alert('Upload failed: ' + (errData.error || 'Check server logs'));
                }
            } catch (err) {
                console.error('Upload error:', err);
                alert('Connection error during upload');
            } finally {
                setUploading(false);
            }
        };
        input.click();
    };

    const handleDelete = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm('Delete this file permanently from ' + academicYear + ' database?')) return;

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
                const response = await fetch(`/api/files/view/${file.id}?academicYear=${academicYear}`);
                if (!response.ok) throw new Error('Binary stream failed');
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
                setExcelData([['ERROR: Data corrupt or unreachable in TiDB']]);
            }
        }
    };

    const getFileIcon = (type) => {
        switch (type) {
            case 'pdf': return <FileText size={20} className="text-red-500" />;
            case 'xlsx':
            case 'xls': return <ExcelIcon size={20} className="text-green-600" />;
            default: return <FileCode size={20} className="text-slate-400" />;
        }
    };

    return (
        <div className="file-mgmt-wrapper">
            {/* Main Selection Area */}
            <div className="glass-panel p-6 mb-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    {/* Left: Academic Year (Same logic as user requested) */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Cluster</span>
                        <div className="year-selector-nav" style={{ background: '#f1f5f9' }}>
                            <button
                                className={`year-nav-btn ${academicYear === '2025' ? 'active' : ''}`}
                                onClick={() => setAcademicYear('2025')}
                            >
                                ACADEMIC YEAR 2025
                            </button>
                            <button
                                className={`year-nav-btn ${academicYear === '2026' ? 'active' : ''}`}
                                onClick={() => setAcademicYear('2026')}
                            >
                                ACADEMIC YEAR 2026
                            </button>
                        </div>
                    </div>

                    {/* Right: Category Selector (Side-by-side buttons as requested) */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Document Category</span>
                        <div className="year-selector-nav" style={{ background: '#f1f5f9' }}>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    className={`year-nav-btn flex items-center gap-2 ${activeCategory === cat.id ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(cat.id)}
                                    style={{
                                        color: activeCategory === cat.id ? 'white' : '#64748b',
                                        backgroundColor: activeCategory === cat.id ? cat.color : 'transparent'
                                    }}
                                >
                                    {cat.icon}
                                    {cat.label.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Upload Integration */}
                    <div>
                        <button
                            className="upload-btn-main"
                            onClick={handleUpload}
                            disabled={uploading}
                            style={{ '--btn-bg': categories.find(c => c.id === activeCategory).color }}
                        >
                            {uploading ? <Loader2 className="animate-spin" size={20} /> : <Files size={20} />}
                            BULK UPLOAD TO {activeCategory.toUpperCase()}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content List Area - Full Table List */}
            <div className="content-area glass-panel">
                <div className="area-header flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl" style={{ color: categories.find(c => c.id === activeCategory).color }}>
                            {categories.find(c => c.id === activeCategory).icon}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">{categories.find(c => c.id === activeCategory).label}</h3>
                            <p className="text-xs font-bold text-slate-400">{files.length} Secure Records in Cluster {academicYear}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TiDB Secure Connection Active</span>
                    </div>
                </div>

                <div className="table-viewport">
                    {loading ? (
                        <div className="p-20 text-center">
                            <Loader2 className="animate-spin mx-auto mb-4 text-indigo-500" size={40} />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Fetching Binary Data...</p>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="p-24 text-center">
                            <FileSearch className="mx-auto mb-6 text-slate-100" size={80} />
                            <h3 className="text-xl font-bold text-slate-700 mb-2">No files found</h3>
                            <p className="text-slate-400">The document vault for "{categories.find(c => c.id === activeCategory).label}" ({academicYear}) is currently empty.</p>
                        </div>
                    ) : (
                        <table className="vault-table">
                            <thead>
                                <tr>
                                    <th className="w-16">TYPE</th>
                                    <th>DOCUMENT NAME & DATABASE ID</th>
                                    <th>UPLOAD TIMESTAMP</th>
                                    <th className="text-right">OPERATION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {files.map(file => (
                                    <motion.tr
                                        key={file.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={() => openPreview(file)}
                                        className="vault-row"
                                    >
                                        <td>
                                            <div className="type-badge">
                                                {getFileIcon(file.file_type)}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex flex-col">
                                                <span className="file-name-label">{file.original_name}</span>
                                                <span className="db-id-badge">ID: {file.id} • {file.file_type.toUpperCase()}</span>
                                            </div>
                                        </td>
                                        <td className="text-slate-500 font-bold text-xs uppercase tracking-tight">
                                            {new Date(file.upload_date).toLocaleString()}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                <a
                                                    href={`/api/files/view/${file.id}?academicYear=${academicYear}&download=true`}
                                                    className="op-btn download"
                                                    title="Stream Secure Binary"
                                                    download
                                                >
                                                    <Download size={18} />
                                                </a>
                                                <button
                                                    onClick={(e) => handleDelete(e, file.id)}
                                                    className="op-btn delete"
                                                    title="Purge from Cluster"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Full Screen High Impact Previewer Overlay */}
            <AnimatePresence>
                {previewFile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="preview-overlay"
                    >
                        <motion.div
                            initial={{ scale: 0.98, opacity: 0, y: 40 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.98, opacity: 0, y: 40 }}
                            className="preview-fullscreen-panel"
                        >
                            <div className="preview-top-nav">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm">
                                        {getFileIcon(previewFile.file_type)}
                                    </div>
                                    <div className="flex flex-col">
                                        <h2 className="preview-doc-title">{previewFile.original_name}</h2>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">TiDB LONGBLOB STREAM</span>
                                            <span className="w-1 h-1 rounded-full bg-white/30"></span>
                                            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{academicYear} CLUSTER</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <a
                                        href={`/api/files/view/${previewFile.id}?academicYear=${academicYear}&download=true`}
                                        className="preview-nav-btn download"
                                        download
                                    >
                                        <Download size={20} />
                                        SAVE AS DOWNLOAD
                                    </a>
                                    <button onClick={() => setPreviewFile(null)} className="preview-nav-btn close">
                                        <X size={28} />
                                    </button>
                                </div>
                            </div>

                            <div className="preview-viewport-area">
                                {previewFile.file_type === 'pdf' ? (
                                    <iframe
                                        src={`/api/files/view/${previewFile.id}?academicYear=${academicYear}#toolbar=0`}
                                        className="viewport-iframe"
                                        title="Secure PDF Viewer"
                                    />
                                ) : excelData ? (
                                    <div className="viewport-excel-scroll p-10">
                                        <div className="excel-modern-table-card">
                                            <table className="excel-core-table">
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
                                    <div className="flex flex-col items-center justify-center h-full gap-4 bg-slate-900">
                                        <Loader2 className="animate-spin text-white/20" size={60} />
                                        <p className="text-white/40 font-black uppercase tracking-widest text-sm">Streaming Secure Binary...</p>
                                    </div>
                                )}
                            </div>

                            <div className="preview-bottom-nav">
                                <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">Sri Chaitanya Educational Institutions • Digital Vault v2.5</div>
                                <button onClick={() => setPreviewFile(null)} className="exit-text-btn">
                                    <X size={14} /> EXIT SECURE VIEW
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx>{`
                .file-mgmt-wrapper {
                    padding: 0;
                }
                .upload-btn-main {
                    background: var(--btn-bg);
                    color: white;
                    padding: 0 2rem;
                    height: 46px;
                    border-radius: 12px;
                    border: none;
                    font-weight: 800;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 8px 16px -4px rgba(0,0,0,0.1);
                }
                .upload-btn-main:hover {
                    box-shadow: 0 12px 24px -6px rgba(0,0,0,0.2);
                    transform: translateY(-2px);
                    filter: brightness(1.1);
                }
                .upload-btn-main:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .vault-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .vault-table th {
                    text-align: left;
                    padding: 1.25rem 2rem;
                    background: #f8fafc;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    border-bottom: 2px solid #f1f5f9;
                }
                .vault-table td {
                    padding: 1.25rem 2rem;
                    border-bottom: 1px solid #f8fafc;
                }
                .vault-row {
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .vault-row:hover {
                    background: #f1f5f9;
                }
                .type-badge {
                    width: 44px;
                    height: 44px;
                    background: white;
                    border: 1px solid #f1f5f9;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }
                .file-name-label {
                    font-weight: 800;
                    color: #1e293b;
                    font-size: 1rem;
                }
                .db-id-badge {
                    font-size: 0.6rem;
                    font-weight: 800;
                    color: #94a3b8;
                    text-transform: uppercase;
                }
                .op-btn {
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .op-btn.download { background: #eff6ff; color: #3b82f6; }
                .op-btn.download:hover { background: #3b82f6; color: white; }
                .op-btn.delete { background: #fef2f2; color: #ef4444; }
                .op-btn.delete:hover { background: #ef4444; color: white; }

                .preview-fullscreen-panel {
                    width: 100vw;
                    height: 100vh;
                    background: #0f172a; /* Slate 900 */
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .preview-top-nav {
                    padding: 1.5rem 3rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(15, 23, 42, 0.8);
                    backdrop-filter: blur(20px);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .preview-doc-title {
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: white;
                    margin: 0;
                    letter-spacing: -0.02em;
                }
                .preview-nav-btn {
                    padding: 0 1.5rem;
                    height: 50px;
                    border-radius: 14px;
                    border: none;
                    cursor: pointer;
                    font-weight: 900;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    transition: all 0.2s;
                    text-transform: uppercase;
                }
                .preview-nav-btn.download {
                    background: #4f46e5;
                    color: white;
                    box-shadow: 0 10px 20px rgba(79, 70, 229, 0.4);
                }
                .preview-nav-btn.download:hover {
                    background: #4338ca;
                    transform: translateY(-2px);
                }
                .preview-nav-btn.close {
                    background: rgba(255, 255, 255, 0.05);
                    color: white;
                    padding: 0 1rem;
                }
                .preview-nav-btn.close:hover {
                    background: #ef4444;
                    transform: rotate(90deg);
                }
                .preview-viewport-area {
                    flex: 1;
                    background: #0f172a;
                    overflow: hidden;
                }
                .viewport-iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                }
                .viewport-excel-scroll {
                    height: 100%;
                    overflow: auto;
                }
                .excel-modern-table-card {
                    background: white;
                    border-radius: 24px;
                    box-shadow: 0 30px 60px rgba(0,0,0,0.5);
                    overflow: hidden;
                }
                .excel-core-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .excel-core-table th {
                    padding: 1.25rem;
                    background: #1e293b;
                    color: white;
                    text-align: left;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    position: sticky;
                    top: 0;
                    z-index: 20;
                }
                .excel-core-table td {
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 0.9rem;
                    color: #334155;
                }
                .preview-bottom-nav {
                    padding: 1.25rem 3rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(15, 23, 42, 0.9);
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                }
                .exit-text-btn {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    font-weight: 900;
                    font-size: 0.7rem;
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    transition: color 0.2s;
                }
                .exit-text-btn:hover {
                    color: #ef4444;
                }
            `}</style>
        </div>
    );
};

export default FileManagement;
