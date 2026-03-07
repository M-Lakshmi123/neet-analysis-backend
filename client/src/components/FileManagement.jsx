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
    Files,
    CheckCircle,
    AlertCircle
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { motion, AnimatePresence } from 'framer-motion';

const FileManagement = ({ academicYear, setAcademicYear }) => {
    const [activeCategory, setActiveCategory] = useState('schedules');
    const categories = [
        { id: 'schedules', label: 'Schedules & Time Tables', icon: <Calendar size={16} />, color: '#172554' },
        { id: 'averages', label: 'Average Files from CO-HYD', icon: <BarChart size={16} />, color: '#172554' }
    ];

    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [statusAction, setStatusAction] = useState(null); // { type: 'success'|'error', msg: '' }
    const [previewFile, setPreviewFile] = useState(null);
    const [excelData, setExcelData] = useState(null);

    useEffect(() => {
        fetchFiles();
    }, [academicYear, activeCategory]);

    const showStatus = (type, msg) => {
        setStatusAction({ type, msg });
        setTimeout(() => setStatusAction(null), 4000);
    };

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/files?academicYear=${academicYear}&category=${activeCategory}`);
            const data = await response.json();
            setFiles(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.pdf,.xlsx,.xls';
        input.onchange = async (e) => {
            const selectedFiles = Array.from(e.target.files);
            if (selectedFiles.length === 0) return;

            setUploading(true);
            const formData = new FormData();
            selectedFiles.forEach(file => {
                formData.append('files', file);
            });
            formData.append('category', activeCategory);

            try {
                const response = await fetch(`/api/files/upload?academicYear=${academicYear}`, {
                    method: 'POST',
                    body: formData
                });
                if (response.ok) {
                    const res = await response.json();
                    showStatus('success', `Uploaded ${selectedFiles.length} files`);
                    fetchFiles();
                } else {
                    showStatus('error', 'Upload failed. Check file sizes.');
                }
            } catch (err) {
                console.error('Upload error:', err);
                showStatus('error', 'Network error during upload');
            } finally {
                setUploading(false);
            }
        };
        input.click();
    };

    const handleDelete = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm('Delete this file?')) return;

        try {
            const response = await fetch(`/api/files/${id}?academicYear=${academicYear}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showStatus('success', 'File deleted');
                fetchFiles();
            } else {
                showStatus('error', 'Delete failed');
            }
        } catch (err) {
            console.error('Delete error:', err);
            showStatus('error', 'Error purged file');
        }
    };

    const openPreview = async (file) => {
        setPreviewFile(file);
        if (file.file_type === 'xlsx' || file.file_type === 'xls') {
            try {
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
                setExcelData([['Error loading data']]);
            }
        }
    };

    const getFileIcon = (type) => {
        switch (type) {
            case 'pdf': return <FileText size={18} className="text-red-500" />;
            case 'xlsx':
            case 'xls': return <ExcelIcon size={18} className="text-green-600" />;
            default: return <FileCode size={18} className="text-slate-400" />;
        }
    };

    return (
        <div className="file-mgmt-clean">
            {/* COMPACT TOP BAR */}
            <div className="top-control-row">
                <div className="button-group-flat">
                    <button className={`flat-btn ${academicYear === '2025' ? 'active' : ''}`} onClick={() => setAcademicYear('2025')}>2025</button>
                    <button className={`flat-btn ${academicYear === '2026' ? 'active' : ''}`} onClick={() => setAcademicYear('2026')}>2026</button>
                    <div className="v-divider"></div>
                    {categories.map(cat => (
                        <button key={cat.id} className={`flat-btn ${activeCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveCategory(cat.id)}>
                            {cat.label.toUpperCase()}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <AnimatePresence>
                        {statusAction && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className={`inline-feedback ${statusAction.type}`}
                            >
                                {statusAction.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                {statusAction.msg}
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <button className="upload-btn-compact" onClick={handleUpload} disabled={uploading}>
                        {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                        {uploading ? 'UPLOADING...' : 'UPLOAD FILES'}
                    </button>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="compact-table-container">
                {loading ? (
                    <div className="p-12 text-center text-slate-400">
                        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                        <p className="text-[10px] uppercase tracking-widest font-bold">Loading Vault...</p>
                    </div>
                ) : files.length === 0 ? (
                    <div className="p-20 text-center">
                        <Search size={40} className="mx-auto mb-4 text-slate-200" />
                        <h3 className="text-lg font-bold text-slate-400">No Files Found</h3>
                    </div>
                ) : (
                    <table className="clean-table">
                        <thead>
                            <tr>
                                <th className="w-12 text-center">FORMAT</th>
                                <th>FILE NAME</th>
                                <th className="w-48">UPLOAD DATE</th>
                                <th className="w-32 text-right">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map(file => (
                                <tr key={file.id} onClick={() => openPreview(file)}>
                                    <td className="text-center">{getFileIcon(file.file_type)}</td>
                                    <td><span className="file-name-text">{file.original_name}</span></td>
                                    <td className="date-text">{new Date(file.upload_date).toLocaleString()}</td>
                                    <td className="text-right">
                                        <div className="flex items-center justify-end gap-3" onClick={e => e.stopPropagation()}>
                                            <a href={`/api/files/view/${file.id}?academicYear=${academicYear}&download=true`} className="icon-link download" download><Download size={16} /></a>
                                            <button onClick={(e) => handleDelete(e, file.id)} className="icon-link delete"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* PREVIEW MODAL */}
            <AnimatePresence>
                {previewFile && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-body">
                            <div className="modal-head">
                                <div className="flex items-center gap-3">
                                    {getFileIcon(previewFile.file_type)}
                                    <h2 className="modal-title">{previewFile.original_name}</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a href={`/api/files/view/${previewFile.id}?academicYear=${academicYear}&download=true`} className="modal-action-btn" download><Download size={18} /></a>
                                    <button onClick={() => setPreviewFile(null)} className="modal-close-btn"><X size={20} /></button>
                                </div>
                            </div>
                            <div className="modal-content">
                                {previewFile.file_type === 'pdf' ? <iframe src={`/api/files/view/${previewFile.id}?academicYear=${academicYear}#toolbar=0`} className="full-iframe" /> :
                                    excelData ? <div className="excel-view"><table className="excel-table"><thead><tr>{excelData[0]?.map((c, i) => <th key={i}>{c}</th>)}</tr></thead><tbody>{excelData.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c?.toString() || ''}</td>)}</tr>)}</tbody></table></div> :
                                        <div className="loading-state">Loading...</div>}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx>{`
                .file-mgmt-clean { padding: 0; }
                .top-control-row { display: flex; justify-content: space-between; align-items: center; background: white; padding: 12px 24px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
                .button-group-flat { display: flex; align-items: center; gap: 8px; background: #f8fafc; padding: 4px; border-radius: 8px; border: 1px solid #f1f5f9; }
                .flat-btn { padding: 8px 16px; font-size: 11px; font-weight: 800; color: #64748b; border: none; background: transparent; border-radius: 6px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
                .flat-btn.active { background: #172554; color: white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
                .v-divider { width: 1px; height: 16px; background: #cbd5e1; margin: 0 4px; }
                .upload-btn-compact { background: #172554; color: white; padding: 10px 20px; border-radius: 8px; border: none; font-size: 11px; font-weight: 800; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s; }
                .upload-btn-compact:hover { transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                
                .inline-feedback { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 6px 12px; border-radius: 6px; }
                .inline-feedback.success { color: #059669; border: 1px solid #d1fae5; background: #f0fdf4; }
                .inline-feedback.error { color: #dc2626; border: 1px solid #fee2e2; background: #fef2f2; }

                .compact-table-container { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
                .clean-table { width: 100%; border-collapse: collapse; }
                .clean-table th { text-align: left; padding: 12px 20px; background: #f8fafc; font-size: 10px; font-weight: 800; color: #94a3b8; border-bottom: 2px solid #f1f5f9; text-transform: uppercase; letter-spacing: 0.05em; }
                .clean-table td { padding: 14px 20px; border-bottom: 1px solid #f8fafc; cursor: pointer; }
                .clean-table tr:last-child td { border-bottom: none; }
                .clean-table tr:hover td { background: #f8fafc; }
                .file-name-text { font-weight: 700; color: #1e293b; font-size: 12.5px; }
                .date-text { font-size: 11px; color: #94a3b8; font-weight: 600; }
                
                .icon-link { color: #cbd5e1; transition: all 0.2s; border: none; background: transparent; cursor: pointer; padding: 6px; border-radius: 6px; }
                .icon-link:hover { background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .icon-link.download:hover { color: #3b82f6; }
                .icon-link.delete:hover { color: #ef4444; }

                .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 24px; }
                .modal-body { width: 100%; max-width: 1400px; height: 92vh; background: white; border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3); }
                .modal-head { padding: 16px 32px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
                .modal-title { font-size: 16px; font-weight: 900; color: #1e293b; letter-spacing: -0.02em; }
                .modal-content { flex: 1; background: #f1f5f9; overflow: hidden; }
                .full-iframe { width: 100%; height: 100%; border: none; }
                .excel-view { height: 100%; overflow: auto; padding: 32px; }
                .excel-table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                .excel-table th { padding: 12px; background: #1e293b; color: white; font-size: 11px; text-align: left; position: sticky; top: 0; }
                .excel-table td { padding: 10px; border: 1px solid #f1f5f9; font-size: 12px; color: #334155; }
                .loading-state { height: 100%; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-weight: 800; font-size: 12px; text-transform: uppercase; }
                .modal-action-btn { background: #f8fafc; color: #1e293b; padding: 10px; border-radius: 10px; transition: all 0.2s; }
                .modal-action-btn:hover { background: #172554; color: white; }
                .modal-close-btn { color: #94a3b8; transition: all 0.2s; }
                .modal-close-btn:hover { color: #ef4444; transform: rotate(90deg); }
                .flex { display: flex; }
                .items-center { align-items: center; }
                .gap-3 { gap: 12px; }
                .gap-4 { gap: 16px; }
            `}</style>
        </div>
    );
};

export default FileManagement;
