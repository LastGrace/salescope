import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { File, Trash2, Upload, Download, RefreshCw, Image as ImageIcon, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/FileManager.css';

const FileManager = () => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const { token, hasPermission } = useAuth();

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/files', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setFiles(data);
            } else {
                toast.error('Failed to load files');
            }
        } catch (error) {
            console.error('Error fetching files:', error);
            toast.error('Error loading files');
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            const response = await fetch('/api/files', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (response.ok) {
                toast.success('File uploaded successfully');
                fetchFiles();
            } else {
                const error = await response.json();
                toast.error(error.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Upload failed');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (filename) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete File',
            message: `Are you sure you want to permanently delete "${filename}"? This action cannot be undone.`,
            onConfirm: async () => {
                try {
                    const response = await fetch(`/api/files/${filename}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        toast.success('File deleted');
                        setFiles(files.filter(f => f.name !== filename));
                    } else {
                        toast.error('Delete failed');
                    }
                } catch (error) {
                    console.error('Delete error:', error);
                    toast.error('Delete failed');
                }
            }
        });
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getIcon = (type) => {
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(type)) return <ImageIcon size={24} className="text-blue-500" />;
        if (['.pdf', '.txt', '.doc', '.docx'].includes(type)) return <FileText size={24} className="text-orange-500" />;
        return <File size={24} className="text-gray-500" />;
    };

    return (
        <div className="file-manager-container animate-fade-in">
            <div className="file-manager-header">
                <div className="file-manager-title">
                    <h1>File Manager</h1>
                </div>
                <div className="file-actions">
                    <button
                        onClick={fetchFiles}
                        className="btn-file-action btn-refresh"
                        disabled={loading}
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>

                    {hasPermission('files.upload') && (
                        <div className="relative">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleUpload}
                                className="hidden"
                                id="file-upload"
                            />
                            <label
                                htmlFor="file-upload"
                                className={`btn-file-action btn-upload ${uploading ? 'opacity-50' : ''}`}
                            >
                                <Upload size={18} /> {uploading ? 'Uploading...' : 'Upload File'}
                            </label>
                        </div>
                    )}
                </div>
            </div>

            <div className="file-grid-container custom-scrollbar">
                {loading ? (
                    <div className="empty-state">
                        <RefreshCw size={48} className="animate-spin mb-4" />
                        <p>Loading your files...</p>
                    </div>
                ) : files.length === 0 ? (
                    <div className="empty-state">
                        <File size={64} className="mb-4 opacity-20" />
                        <p>No files found</p>
                        <p className="text-sm">Upload a file to get started</p>
                    </div>
                ) : (
                    <div className="file-grid">
                        {files.map((file) => (
                            <div key={file.name} className="file-card group">
                                <div className="file-preview">
                                    <div className="file-card-actions">
                                        <a
                                            href={file.url}
                                            download={file.name}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-icon-action"
                                            title="Download"
                                        >
                                            <Download size={16} />
                                        </a>
                                        {hasPermission('files.delete') && (
                                            <button
                                                onClick={() => handleDelete(file.name)}
                                                className="btn-icon-action btn-icon-delete"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center">
                                        {['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(file.type) ? (
                                            <img
                                                src={file.url}
                                                alt={file.name}
                                                className="file-image"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="file-icon-placeholder">
                                                {getIcon(file.type)}
                                            </div>
                                        )}
                                    </a>
                                </div>

                                <div className="file-info">
                                    <div className="file-name" title={file.name}>{file.name}</div>
                                    <div className="file-meta">
                                        <span>{formatSize(file.size)}</span>
                                        <span>{new Date(file.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type="danger"
            />
        </div>
    );
};

export default FileManager;
