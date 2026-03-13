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
    AlertCircle,
    Eye
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../utils/apiHelper';

const FileManagement = ({ academicYear, setAcademicYear, userData }) => {
    // Permission: Only the Main Admin (Yenjarappa) can Upload/Download/Delete
    const isMainAdmin = userData?.email === 'yenjarappa.s@varsitymgmt.com';

    const [activeCategory, setActiveCategory] = useState('schedules');
    const categories = [
        { id: 'schedules', label: 'Schedules & Time Tables', icon: <Calendar size={16} />, color: '#172554' },
        { id: 'averages', label: 'Average Files from CO-HYD', icon: <BarChart size={16} />, color: '#172554' }
    ];

    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [statusAction, setStatusAction] = useState(null);
    const [previewFile, setPreviewFile] = useState(null);
    const [previewMode, setPreviewMode] = useState('data'); // 'data' or 'original'
    const [excelData, setExcelData] = useState(null);
    const [availableSheets, setAvailableSheets] = useState([]);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);
    const [loadingData, setLoadingData] = useState(false);

    useEffect(() => {
        fetchFiles();
    }, [academicYear, activeCategory]);

    const showStatus = (type, msg) => {
        setStatusAction({ type, msg });
        setTimeout(() => setStatusAction(null), 5000);
    };

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/files?academicYear=${academicYear}&category=${activeCategory}&_t=${Date.now()}`);
            if (!response.ok) throw new Error('Server unreachable');
            const data = await response.json();
            setFiles(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Fetch error:', err);
            setFiles([]);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async () => {
        if (!isMainAdmin) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.pdf,.xlsx,.xls';
        input.onchange = async (e) => {
            const selectedFiles = Array.from(e.target.files);
            if (selectedFiles.length === 0) return;

            setUploading(true);
            let successCount = 0;
            let failCount = 0;
            let serverErrorMessage = null;

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const fileSizeMB = file.size / (1024 * 1024);

                // UX: Update status with progress
                showStatus('loading', `Uploading ${i + 1}/${selectedFiles.length}: ${file.name}`);

                if (fileSizeMB > 250) {
                    failCount++;
                    serverErrorMessage = `File too large (${fileSizeMB.toFixed(1)}MB). Max 250MB.`;
                    continue;
                }

                const formData = new FormData();
                formData.append('files', file);
                formData.append('category', activeCategory);

                try {
                    const response = await fetch(`${API_URL}/api/files/upload?academicYear=${academicYear}`, {
                        method: 'POST',
                        body: formData
                    });

                    let result;
                    try {
                        result = await response.json();
                    } catch (e) {
                        throw new Error('Server returned invalid response');
                    }

                    if (response.ok && result.success > 0) {
                        successCount++;
                    } else {
                        failCount++;
                        if (result.errors?.[0]?.error) {
                            serverErrorMessage = result.errors[0].error;
                        } else if (result.error) {
                            serverErrorMessage = result.error;
                        }
                    }
                } catch (err) {
                    console.error('Upload Error:', err);
                    failCount++;
                    // Map network errors to clearer messages
                    if (err.message.includes('fetch')) {
                        serverErrorMessage = `Network error (possible file size timeout).`;
                    } else {
                        serverErrorMessage = err.message;
                    }
                }
            }

            if (successCount > 0) {
                showStatus('success', `Saved ${successCount} files`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                fetchFiles();
            }
            if (failCount > 0) {
                const finalMsg = serverErrorMessage || (failCount === 1 ? 'File rejected by server' : `${failCount} files failed`);
                showStatus('error', finalMsg);
            }

            setUploading(false);
        };
        input.click();
    };

    const handleDelete = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isMainAdmin) return;
        if (!window.confirm('Delete this file?')) return;

        try {
            const response = await fetch(`${API_URL}/api/files/${id}?academicYear=${academicYear}`, { method: 'DELETE' });
            if (response.ok) {
                showStatus('success', 'File deleted');
                fetchFiles();
            } else {
                showStatus('error', 'Delete failed');
            }
        } catch (err) {
            showStatus('error', 'Network failure');
        }
    };

    const openPreview = async (file) => {
        setPreviewFile(file);
        setExcelData(null);
        setAvailableSheets([]);
        setActiveSheetIndex(0);

        if (file.file_type === 'xlsx' || file.file_type === 'xls') {
            setPreviewMode('data'); // Auto-switch to fast data view
            setLoadingData(true);
            try {
                const response = await fetch(`${API_URL}/api/files/excel-preview-data/${file.id}?academicYear=${academicYear}`);
                const result = await response.json();
                if (result.rows) {
                    setExcelData(result.rows);
                    setAvailableSheets(result.sheetNames || [result.sheetName]);
                }
            } catch (err) {
                console.error('Data Load Error:', err);
                setExcelData([['Failed to load preview data']]);
            } finally {
                setLoadingData(false);
            }
        } else {
            setPreviewMode('original'); // Use native viewer for PDF
        }
    };

    const loadSheetData = (workbook, index) => {
        try {
            const worksheet = workbook.worksheets[index];
            const data = [];
            let rCount = 0;
            worksheet.eachRow((row) => {
                if (rCount < 1000) {
                    const rowValues = row.values.slice(1).map(v => {
                        if (v === null || v === undefined) return '';
                        if (typeof v === 'object') {
                            if (v.text) return String(v.text);
                            if (v.richText) return v.richText.map(rt => rt.text).join('');
                            if (v.result !== undefined) return String(v.result);
                            return '';
                        }
                        return String(v);
                    });
                    data.push(rowValues);
                }
                rCount++;
            });
            setExcelData(data);
            setActiveSheetIndex(index);
        } catch (e) {
            setExcelData([['Error rendering sheet']]);
        }
    };

    const handleSheetChange = async (idx, name) => {
        // For simplicity, we just notify it's limited to 1st sheet for speed
        // but if they really need it we could add another endpoint param
        setActiveSheetIndex(idx);
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
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className={`inline-feedback ${statusAction.type}`}>
                                {statusAction.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                {statusAction.msg}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {isMainAdmin && (
                        <button className="upload-btn-compact" onClick={handleUpload} disabled={uploading}>
                            {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                            {uploading ? 'UPLOADING...' : 'UPLOAD FILES'}
                        </button>
                    )}
                </div>
            </div>

            <div className="compact-table-container">
                {loading ? (
                    <div className="p-12 text-center text-slate-400">
                        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                        <p className="text-[10px] uppercase font-bold tracking-widest">Syncing Vault...</p>
                    </div>
                ) : files.length === 0 ? (
                    <div className="p-20 text-center">
                        <Search size={40} className="mx-auto mb-4 text-slate-200" />
                        <h3 className="text-lg font-bold text-slate-300">No Records Found</h3>
                    </div>
                ) : (
                    <table className="clean-table">
                        <thead>
                            <tr>
                                <th className="w-12 text-center">MODE</th>
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
                                            <button onClick={() => openPreview(file)} className="icon-link view" title="View Preview"><Eye size={16} /></button>
                                            {isMainAdmin && (
                                                <>
                                                    <a href={`${API_URL}/api/files/view/${file.id}?academicYear=${academicYear}&download=true`} className="icon-link download" download><Download size={16} /></a>
                                                    <button onClick={(e) => handleDelete(e, file.id)} className="icon-link delete"><Trash2 size={16} /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

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
                                     {(previewFile.file_type === 'xlsx' || previewFile.file_type === 'xls') && (
                                         <div className="mode-switcher">
                                             <button className={`mode-btn ${previewMode === 'original' ? 'active' : ''}`} onClick={() => setPreviewMode('original')}>Original View</button>
                                             <button className={`mode-btn ${previewMode === 'data' ? 'active' : ''}`} onClick={() => setPreviewMode('data')}>Data View</button>
                                         </div>
                                     )}
                                     {isMainAdmin && (
                                         <a href={`${API_URL}/api/files/view/${previewFile.id}?academicYear=${academicYear}&download=true`} className="modal-action-btn" download title="Download"><Download size={18} /></a>
                                     )}
                                     <a href={`https://drive.google.com/file/d/${previewFile.filename}/view?usp=sharing`} target="_blank" rel="noopener noreferrer" className="modal-action-btn" title="Open Original in New Tab">
                                         <Eye size={18} />
                                     </a>
                                     <button onClick={() => setPreviewFile(null)} className="modal-close-btn-top"><X size={20} /></button>
                                 </div>
                            </div>
                            <div className="modal-content">
                                 {(previewFile.file_type === 'xlsx' || previewFile.file_type === 'xls' || previewFile.file_type === 'pdf') ? (
                                     previewMode === 'original' ? (
                                        <iframe 
                                            src={`https://drive.google.com/file/d/${previewFile.filename}/preview?rm=minimal`} 
                                            className="full-iframe" 
                                            style={{ background: 'white' }}
                                        />
                                     ) : (
                                         <div className="excel-view-container">
                                             {loadingData ? (
                                                 <div className="loading-state">
                                                     <div className="spinner"></div>
                                                     <p>Scanning Large File...</p>
                                                 </div>
                                             ) : excelData ? (
                                                 <div className="excel-data-layout">
                                                     {availableSheets.length > 1 && (
                                                         <div className="sheet-tabs-bottom">
                                                             {availableSheets.map((s, i) => (
                                                                 <button key={i} className={`sheet-tab ${activeSheetIndex === i ? 'active' : ''}`} title="Fast preview limited to primary sheet">
                                                                     {typeof s === 'string' ? s : s.name}
                                                                 </button>
                                                             ))}
                                                         </div>
                                                     )}
                                                     <div className="grid-scroll">
                                                         <table className="excel-grid">
                                                             <thead>
                                                                 <tr>
                                                                     <th className="corner"></th>
                                                                     {excelData[0]?.map((_, i) => <th key={i}>{String.fromCharCode(65 + i)}</th>)}
                                                                 </tr>
                                                             </thead>
                                                             <tbody>
                                                                 {excelData.map((row, i) => (
                                                                     <tr key={i}>
                                                                         <td className="row-num">{i + 1}</td>
                                                                         {row.map((cell, j) => <td key={j}>{cell}</td>)}
                                                                     </tr>
                                                                 ))}
                                                             </tbody>
                                                         </table>
                                                     </div>
                                                 </div>
                                             ) : (
                                                 <div className="loading-state">Click 'Original View' if this fails</div>
                                             )
                                         </div>
                                     )
                                 ) : (
                                     <div className="loading-state">Unsupported file type</div>
                                 )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx>{`
                .file-mgmt-clean { padding: 0; }
                .top-control-row { display: flex; justify-content: space-between; align-items: center; background: white; padding: 10px 20px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0; }
                .button-group-flat { display: flex; align-items: center; gap: 6px; background: #f8fafc; padding: 3px; border-radius: 8px; border: 1px solid #f1f5f9; }
                .flat-btn { padding: 8px 14px; font-size: 10px; font-weight: 800; color: #64748b; border: none; background: transparent; border-radius: 6px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
                .flat-btn.active { background: #172554; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .v-divider { width: 1px; height: 16px; background: #cbd5e1; margin: 0 4px; }
                .upload-btn-compact { background: #172554; color: white; padding: 8px 18px; border-radius: 8px; border: none; font-size: 10px; font-weight: 900; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s; }
                .upload-btn-compact:hover { transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                
                .inline-feedback { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 6px 12px; border-radius: 6px; }
                .inline-feedback.success { color: #059669; border: 1px solid #d1fae5; background: #f0fdf4; }
                .inline-feedback.error { color: #dc2626; border: 1px solid #fee2e2; background: #fef2f2; }
                .inline-feedback.loading { color: #0f172a; border: 1px solid #e2e8f0; background: #f8fafc; }

                .compact-table-container { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
                .clean-table { width: 100%; border-collapse: collapse; }
                .clean-table th { text-align: left; padding: 12px 20px; background: #f8fafc; font-size: 9px; font-weight: 800; color: #94a3b8; border-bottom: 2px solid #f1f5f9; text-transform: uppercase; letter-spacing: 0.05em; }
                .clean-table td { padding: 12px 20px; border-bottom: 1px solid #f8fafc; cursor: pointer; }
                .clean-table tr:hover td { background: #f8fafc; }
                .file-name-text { font-weight: 700; color: #1e293b; font-size: 12px; }
                .date-text { font-size: 10px; color: #94a3b8; font-weight: 600; }
                
                .icon-link { color: #cbd5e1; transition: all 0.2s; border: none; background: transparent; cursor: pointer; padding: 6px; border-radius: 6px; }
                .icon-link:hover { background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                .icon-link.view:hover { color: #172554; }
                .icon-link.download:hover { color: #3b82f6; }
                .icon-link.delete:hover { color: #ef4444; }

                /* CRITICAL: Increased z-index to 9999 to cover global Logout/Header */
                .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 0px; }
                .modal-body { width: 100%; height: 100%; background: white; display: flex; flex-direction: column; overflow: hidden; }
                .modal-head { padding: 10px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
                .modal-title { font-size: 13px; font-weight: 900; color: #1e293b; }
                .modal-content { flex: 1; background: #f1f5f9; overflow: hidden; }
                .full-iframe { width: 100%; height: 100%; border: none; }
                .excel-view { height: 100%; overflow: auto; padding: 24px; }
                .excel-table { width: 100%; border-collapse: collapse; background: white; border-radius: 4px; overflow: hidden; }
                .excel-table th { padding: 10px; background: #1e293b; color: white; font-size: 11px; text-align: left; }
                .excel-table td { padding: 8px 10px; border: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
                .loading-state { height: 100%; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-weight: 800; font-size: 11px; text-transform: uppercase; }
                .modal-action-btn:hover { background: #f1f5f9; }
                .mode-switcher { display: flex; background: #e2e8f0; padding: 3px; border-radius: 6px; margin-right: 10px; }
                .mode-btn { border: none; background: transparent; padding: 4px 10px; font-size: 9px; font-weight: 800; border-radius: 4px; cursor: pointer; color: #64748b; transition: all 0.2s; }
                .mode-btn.active { background: white; color: #172554; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }

                /* Premium Excel Grid Style */
                .excel-view-container { height: 100%; display: flex; flex-direction: column; background: #f1f5f9; }
                .excel-data-layout { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
                .grid-scroll { flex: 1; overflow: auto; padding: 0; background: white; }
                .excel-grid { border-collapse: separate; border-spacing: 0; table-layout: fixed; }
                .excel-grid th, .excel-grid td { border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 6px 10px; font-size: 11px; white-space: nowrap; font-family: 'Inter', sans-serif; }
                .excel-grid th { background: #f8fafc; color: #94a3b8; font-weight: 500; text-align: center; }
                .excel-grid td { color: #334155; }
                .excel-grid .row-num { background: #f8fafc; color: #94a3b8; text-align: center; width: 40px; position: sticky; left: 0; font-weight: 500; border-right: 2px solid #e2e8f0; }
                .excel-grid thead th { position: sticky; top: 0; z-index: 20; border-bottom: 2px solid #e2e8f0; }
                .excel-grid thead th.corner { position: sticky; left: 0; z-index: 30; }
                
                .sheet-tabs-bottom { display: flex; background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 4px 10px; }
                .sheet-tab { border: none; background: transparent; padding: 4px 12px; font-size: 10px; font-weight: 700; color: #64748b; cursor: pointer; border-radius: 4px; }
                .sheet-tab.active { background: white; color: #172554; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

                .spinner { width: 24px; height: 24px; border: 3px solid #e2e8f0; border-top-color: #172554; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 10px; }
                @keyframes spin { to { transform: rotate(360deg); } }

                .flex { display: flex; }
                .items-center { align-items: center; }
                .gap-3 { gap: 12px; }
                .gap-4 { gap: 16px; }
            `}</style>
        </div>
    );
};

export default FileManagement;
