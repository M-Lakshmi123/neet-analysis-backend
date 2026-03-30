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
    AlertCircle,
    Eye,
    Maximize2,
    CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../utils/apiHelper';
import { logActivity } from '../utils/activityLogger';

const FileManagement = ({ academicYear, setAcademicYear, userData }) => {
    // Permission: Only the Main Admin (Yenjarappa) can Upload/Download/Delete
    const isMainAdmin = userData?.email === 'yenjarappa.s@varsitymgmt.com' || (userData?.role || '').toLowerCase() === 'admin';

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

    const [zoom, setZoom] = useState(100);
    const [isFullScreen, setIsFullScreen] = useState(false);
    
    // Stability States
    const scrollContainerRef = useRef(null);

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

    const sanitizeVault = async () => {
        if (!window.confirm('This will rename all files in the database to remove commas and apostrophes to fix preview errors. Continue?')) return;
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/files/sanitize-vault?academicYear=${academicYear}`, { method: 'POST' });
            if (response.ok) {
                showStatus('success', 'Vault Sanitized! All files clickable now.');
                fetchFiles();
            }
        } catch (err) {
            showStatus('error', 'Cleanup failed');
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
        setZoom(100);
        setIsFullScreen(false);
        logActivity(userData, `Open Preview: ${file.original_name}`);
    };

    const reloadPreview = () => {
        const current = previewFile;
        setPreviewFile(null);
        setTimeout(() => {
            setPreviewFile(current);
        }, 50);
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
                        <>
                            <button className="flat-btn-outline" onClick={sanitizeVault} title="Fix all comma/apostrophe errors in vault">
                                <FileCode size={16} /> FIX NAMES
                            </button>
                            <button className="upload-btn-compact" onClick={handleUpload} disabled={uploading}>
                                {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                                {uploading ? 'UPLOADING...' : 'UPLOAD FILES'}
                            </button>
                        </>
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
                                {isMainAdmin && <th className="w-48">UPLOAD DATE</th>}
                                <th className="w-32 text-right">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map(file => (
                                <tr key={file.id} onClick={() => openPreview(file)}>
                                    <td className="text-center">{getFileIcon(file.file_type)}</td>
                                    <td><span className="file-name-text">{file.original_name}</span></td>
                                    {isMainAdmin && <td className="date-text">{new Date(file.upload_date).toLocaleString()}</td>}
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
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        className={`modal-overlay ${isFullScreen ? 'immersive' : ''}`}
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.95, opacity: 0 }} 
                            className="modal-body"
                        >
                            <div className={`modal-head ${isFullScreen ? 'floating' : ''}`}>
                                <div className="flex items-center gap-3">
                                    {getFileIcon(previewFile.file_type)}
                                    <h2 className="modal-title">{previewFile.original_name}</h2>
                                    <span className="file-badge-mini">{previewFile.file_type.toUpperCase()}</span>
                                </div>
                                
                                <div className="preview-toolbar">
                                    <div className="toolbar-section">
                                        <button 
                                            onClick={() => setZoom(prev => Math.max(50, prev - 25))} 
                                            className="tool-btn" 
                                            title="Zoom Out"
                                        >
                                            <Search size={14} className="scale-x-[-1]" />-
                                        </button>
                                        <span className="zoom-value">{zoom}%</span>
                                        <button 
                                            onClick={() => setZoom(prev => Math.min(400, prev + 25))} 
                                            className="tool-btn" 
                                            title="Zoom In"
                                        >
                                            <Search size={14} />+
                                        </button>
                                    </div>

                                     {(previewFile.file_type === 'xlsx' || previewFile.file_type === 'xls') && (
                                         <>
                                             <div className="toolbar-divider"></div>
                                             <div className="flex items-center gap-1 bg-[#107c41] text-white px-3 py-1 rounded-md shadow-sm">
                                                  <ExcelIcon size={14} strokeWidth={2.5} />
                                                  <span className="text-[10px] font-black uppercase tracking-tighter">Office Pro View</span>
                                             </div>
                                             <div className="toolbar-divider"></div>
                                             <button onClick={reloadPreview} className="tool-btn" title="Reload if Stuck">
                                                  <Loader2 size={14} />
                                              </button>
                                         </>
                                     )}

                                    <div className="toolbar-divider"></div>

                                    <button 
                                        onClick={() => setIsFullScreen(!isFullScreen)} 
                                        className={`tool-btn ${isFullScreen ? 'active' : ''}`}
                                        title={isFullScreen ? "Exit Full View" : "Full View Mode"}
                                    >
                                        <Maximize2 size={16} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                     {isMainAdmin && (
                                          <a href={`${API_URL}/api/files/view/${previewFile.id}?academicYear=${academicYear}&download=true`} className="modal-action-btn" download title="Download"><Download size={18} /></a>
                                     )}
                                     <button 
                                         onClick={() => {
                                              const url = `https://drive.google.com/file/d/${previewFile.filename}/view?usp=sharing`;
                                             window.open(url, '_blank');
                                         }} 
                                         className="modal-action-btn" 
                                         title="Open in New Tab"
                                     >
                                         <Eye size={18} />
                                     </button>
                                     <button onClick={() => setPreviewFile(null)} className="modal-close-btn-top"><X size={20} /></button>
                                </div>
                            </div>
                            
                             <div 
                                className="modal-content"
                                ref={scrollContainerRef}
                                style={{
                                    overflow: 'auto',
                                    backgroundColor: previewFile.file_type === 'pdf' ? '#FFFFFF' : '#FFFFFF'
                                }}
                             >
                                  <div 
                                      className="preview-wrap"
                                      style={{
                                          width: `${zoom}%`,
                                          height: '100%',
                                          minHeight: '100%',
                                          margin: '0 auto',
                                          position: 'relative'
                                      }}
                                  >
                                       {previewFile.file_type === 'pdf' ? (
                                           <iframe 
                                               src={`${API_URL}/api/files/v/${previewFile.id}/${encodeURIComponent(previewFile.original_name)}?academicYear=${academicYear}#toolbar=1&navpanes=0`} 
                                               className="full-iframe" 
                                               title="PDF Preview"
                                               frameBorder="0"
                                           />
                                       ) : (previewFile.file_type === 'xlsx' || previewFile.file_type === 'xls') ? (
                                           <iframe 
                                               src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(`${API_URL}/api/files/v/${previewFile.id}/${previewFile.original_name}?academicYear=${academicYear}`)}`} 
                                               className="full-iframe" 
                                               title="Excel Preview"
                                               frameBorder="0"
                                           />
                                       ) : (
                                           <div className="loading-state">Preview not supported for this file type.</div>
                                       )}
                                  </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style jsx>{`
                .file-mgmt-clean { padding: 0; }
                .top-control-row { display: flex; justify-content: space-between; align-items: center; background: white; padding: 6px 16px; border-radius: 12px; margin-bottom: 12px; border: 1px solid #e2e8f0; min-height: fit-content; }
                .button-group-flat { display: flex; align-items: center; gap: 4px; background: #f8fafc; padding: 3px; border-radius: 8px; border: 1px solid #f1f5f9; height: fit-content; }
                .flat-btn { padding: 6px 12px; font-size: 10px; font-weight: 800; color: #64748b; border: none; background: transparent; border-radius: 6px; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
                .flat-btn.active { background: #172554; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .v-divider { width: 1px; height: 16px; background: #cbd5e1; margin: 0 4px; }
                .upload-btn-compact { background: #172554; color: white; padding: 6px 14px; border-radius: 8px; border: none; font-size: 10px; font-weight: 900; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; }
                .upload-btn-compact:hover { transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                
                .inline-feedback { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 6px 12px; border-radius: 6px; }
                .inline-feedback.success { color: #059669; border: 1px solid #d1fae5; background: #f0fdf4; }
                .inline-feedback.error { color: #dc2626; border: 1px solid #fee2e2; background: #fef2f2; }
                .inline-feedback.loading { color: #0f172a; border: 1px solid #e2e8f0; background: #f8fafc; }

                .compact-table-container { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); font-family: Arial, sans-serif; }
                .clean-table { width: 100%; border-collapse: collapse; font-family: Arial, Helvetica, sans-serif; }
                .clean-table th { text-align: left; padding: 10px 20px; background: #f8fafc; font-size: 9px; font-weight: 800; color: #94a3b8; border-bottom: 2px solid #f1f5f9; text-transform: uppercase; letter-spacing: 0.05em; font-family: Arial, sans-serif; }
                .clean-table td { padding: 10px 20px; border-bottom: 1px solid #f8fafc; cursor: pointer; font-family: Arial, sans-serif; }
                .clean-table tr:hover td { background: #f8fafc; }
                .file-name-text { font-weight: 700; color: #1e293b; font-size: 12px; }
                .date-text { font-size: 10px; color: #94a3b8; font-weight: 600; }
                
                .icon-link { color: #cbd5e1; transition: all 0.2s; border: none; background: transparent; cursor: pointer; padding: 6px; border-radius: 6px; }
                .icon-link:hover { background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                .icon-link.view:hover { color: #172554; }
                .icon-link.download:hover { color: #3b82f6; }
                .icon-link.delete:hover { color: #ef4444; }

                /* CRITICAL: Increased z-index to 9999 to cover global Logout/Header */
                .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; transition: all 0.3s; }
                .modal-overlay.immersive { background: rgba(0, 0, 0, 0.95); padding: 0; backdrop-filter: none; }
                
                .modal-body { width: 92vw; height: 92vh; background: white; display: flex; flex-direction: column; overflow: hidden; position: relative; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); transition: all 0.3s; }
                .modal-overlay.immersive .modal-body { width: 100vw; height: 100vh; border-radius: 0; }
                
                .modal-head { padding: 10px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #ffffff; }
                .modal-head.floating { position: absolute; top: 15px; left: 50%; transform: translateX(-50%); z-index: 100; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); padding: 5px 15px; border-radius: 50px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); border: 1px solid rgba(0,0,0,0.1); width: auto; max-width: 90%; }
                
                .modal-title { font-size: 11px; font-weight: 800; color: #0f172a; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .modal-content { flex: 1; background: #f8fafc; overflow: hidden; }
                .full-iframe { width: 100%; height: 100%; border: none; background: white; }
                .loading-state { height: 100%; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-weight: 800; font-size: 11px; text-transform: uppercase; }
                .modal-action-btn:hover { background: #f1f5f9; }

                .tool-btn-wide { display: flex; align-items: center; gap: 8px; padding: 0 12px; height: 32px; background: transparent; border: none; border-radius: 6px; cursor: pointer; color: #475569; transition: all 0.2s; border: 1px solid transparent; }
                .tool-btn-wide.active { background: #107c41; color: white; box-shadow: 0 4px 6px -1px rgba(16, 124, 65, 0.3); }
                .tool-btn-wide:hover:not(.active) { background: #e2e8f0; }
                
                .preview-toolbar {
                    display: flex;
                    align-items: center;
                    background: #f1f5f9;
                    border-radius: 8px;
                    padding: 2px 8px;
                    gap: 4px;
                }
                .toolbar-section { border: none; display: flex; align-items: center; gap: 4px; }
                .toolbar-divider { width: 1px; height: 16px; background: #cbd5e1; margin: 0 8px; }
                
                .tool-btn {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    background: transparent;
                    border-radius: 6px;
                    cursor: pointer;
                    color: #475569;
                    transition: all 0.2s;
                    font-weight: bold;
                }
                .tool-btn:hover { background: #e2e8f0; color: #1e293b; }
                .tool-btn.active { background: #172554; color: white; }
                
                .zoom-value { font-size: 10px; font-weight: 800; min-width: 40px; text-align: center; color: #1e293b; }
                .file-badge-mini { font-size: 8px; font-weight: 900; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: #64748b; }
                
                .flat-btn-outline { border: 1px solid #172554; color: #172554; padding: 6px 12px; border-radius: 8px; font-size: 10px; font-weight: 800; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; background: transparent; }
                .flat-btn-outline:hover { background: #f8fafc; }
            `}</style>
        </div>
    );
};

export default FileManagement;
