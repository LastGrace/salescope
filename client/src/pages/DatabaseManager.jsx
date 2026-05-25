import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Database, Download, RotateCcw, Save, AlertTriangle, Clock, Upload, Trash2, Edit, Cloud, CloudOff, ExternalLink, LogIn, LogOut, Skull } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { useSearchParams } from 'react-router-dom';
import '../styles/DatabaseManager.css';

const DatabaseManager = () => {
    const [backups, setBackups] = useState([]);
    const [schedule, setSchedule] = useState({ schedule: '0 0 * * *', autoUploadDrive: false });
    const [loading, setLoading] = useState(false);
    const [cronTime, setCronTime] = useState('00:00');
    const [driveStatus, setDriveStatus] = useState({ connected: false, configured: false });
    const [driveFiles, setDriveFiles] = useState([]);
    const fileInputRef = React.useRef(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [showDangerModal, setShowDangerModal] = useState(false);
    const [dangerPassword, setDangerPassword] = useState('');

    // Confirmation & Prompt Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'danger' });
    const [promptModal, setPromptModal] = useState({ isOpen: false, title: '', message: '', defaultValue: '', onConfirm: () => { } });

    useEffect(() => {
        fetchBackups();
        fetchSchedule();
        fetchDriveStatus();

        // Handle OAuth callback
        if (searchParams.get('drive_connected')) {
            toast.success('Google Drive connected!');
            setSearchParams({});
            fetchDriveStatus();
        }
        if (searchParams.get('drive_error')) {
            toast.error('Drive error: ' + searchParams.get('drive_error'));
            setSearchParams({});
        }
    }, []);

    const fetchBackups = async () => {
        try {
            const res = await axios.get('http://localhost:3000/api/backup/list');
            setBackups(res.data);
        } catch (error) {
            console.error('Error fetching backups:', error);
        }
    };

    const fetchSchedule = async () => {
        try {
            const res = await axios.get('http://localhost:3000/api/backup/config');
            setSchedule(res.data);
            const parts = res.data.schedule.split(' ');
            if (parts.length >= 2) {
                const minute = parts[0].padStart(2, '0');
                const hour = parts[1].padStart(2, '0');
                setCronTime(`${hour}:${minute}`);
            }
        } catch (error) {
            console.error('Error fetching schedule:', error);
        }
    };

    const fetchDriveStatus = async () => {
        try {
            const res = await axios.get('http://localhost:3000/api/backup/drive/status');
            setDriveStatus(res.data);
            if (res.data.connected) fetchDriveFiles();
        } catch (error) {
            console.error('Error fetching Drive status:', error);
        }
    };

    const fetchDriveFiles = async () => {
        try {
            const res = await axios.get('http://localhost:3000/api/backup/drive/list');
            setDriveFiles(res.data);
        } catch (error) {
            console.error('Error fetching Drive files:', error);
        }
    };

    const handleConnectDrive = async () => {
        try {
            const res = await axios.get('http://localhost:3000/api/backup/drive/connect');
            window.location.href = res.data.authUrl;
        } catch (error) {
            toast.error('Failed to connect: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDisconnectDrive = async () => {
        setConfirmModal({
            isOpen: true,
            title: 'Disconnect Google Drive',
            message: 'Are you sure you want to disconnect Google Drive? Automated cloud backups will be disabled.',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await axios.post('http://localhost:3000/api/backup/drive/disconnect');
                    toast.success('Disconnected from Google Drive');
                    setDriveStatus({ connected: false, configured: true });
                    setDriveFiles([]);
                } catch (error) {
                    toast.error('Failed to disconnect');
                }
            }
        });
    };

    const handleUploadToDrive = async (filename) => {
        const toastId = toast.loading('Uploading to Google Drive...');
        try {
            await axios.post(`http://localhost:3000/api/backup/drive/upload/${filename}`);
            toast.success('Uploaded to Google Drive!', { id: toastId });
            fetchDriveFiles();
        } catch (error) {
            toast.error('Upload failed: ' + (error.response?.data?.error || error.message), { id: toastId });
        }
    };

    const handleDeleteFromDrive = async (fileId, fileName) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete from Drive',
            message: `Are you sure you want to delete "${fileName}" from Google Drive? This action cannot be undone.`,
            type: 'danger',
            onConfirm: async () => {
                const toastId = toast.loading('Deleting from Drive...');
                try {
                    await axios.delete(`http://localhost:3000/api/backup/drive/delete/${fileId}`);
                    toast.success('Deleted from Drive', { id: toastId });
                    fetchDriveFiles();
                } catch (error) {
                    toast.error('Delete failed', { id: toastId });
                }
            }
        });
    };

    const handleRestoreFromDrive = async (fileId, fileName) => {
        setConfirmModal({
            isOpen: true,
            title: 'Restore from Drive',
            message: `Are you sure you want to restore the database from "${fileName}"? This will REPLACE all your current data.`,
            type: 'danger',
            onConfirm: async () => {
                setLoading(true);
                const toastId = toast.loading('Downloading and restoring from Drive...');
                try {
                    await axios.post(`http://localhost:3000/api/backup/drive/restore/${fileId}/${encodeURIComponent(fileName)}`);
                    toast.success('Restored from Google Drive!', { id: toastId });
                    fetchBackups(); // Refresh local backups list since file was downloaded
                } catch (error) {
                    toast.error('Restore failed: ' + (error.response?.data?.error || error.message), { id: toastId });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleBackupNow = async () => {
        setLoading(true);
        const toastId = toast.loading('Creating backup...');
        try {
            await axios.post('http://localhost:3000/api/backup/now');
            toast.success('Backup created!', { id: toastId });
            fetchBackups();
        } catch (error) {
            toast.error('Backup failed: ' + (error.response?.data?.error || error.message), { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (filename) => {
        setConfirmModal({
            isOpen: true,
            title: 'Restore Database',
            message: `WARNING: Are you sure you want to restore "${filename}"? This will overwrite the current database entirely.`,
            type: 'danger',
            onConfirm: async () => {
                setLoading(true);
                const toastId = toast.loading('Restoring...');
                try {
                    await axios.post('http://localhost:3000/api/backup/restore', { filename });
                    toast.success('Restored!', { id: toastId });
                } catch (error) {
                    toast.error('Restore failed', { id: toastId });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleDownload = async (filename) => {
        const toastId = toast.loading('Downloading backup...');
        try {
            const response = await axios({
                url: `http://localhost:3000/api/backup/download/${filename}`,
                method: 'GET',
                responseType: 'blob', // Important for downloading files
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success('Downloaded successfully!', { id: toastId });
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download file', { id: toastId });
        }
    };

    const handleSaveSchedule = async () => {
        const [hour, minute] = cronTime.split(':');
        const cronExpression = `${parseInt(minute)} ${parseInt(hour)} * * *`;
        const toastId = toast.loading('Saving...');
        try {
            await axios.post('http://localhost:3000/api/backup/config', {
                schedule: cronExpression,
                autoUploadDrive: schedule.autoUploadDrive
            });
            toast.success('Schedule saved!', { id: toastId });
            fetchSchedule();
        } catch (error) {
            toast.error('Failed to save', { id: toastId });
        }
    };

    const handleDelete = async (filename) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Backup',
            message: `Are you sure you want to delete "${filename}"?`,
            type: 'danger',
            onConfirm: async () => {
                const toastId = toast.loading('Deleting...');
                try {
                    await axios.delete(`http://localhost:3000/api/backup/delete/${filename}`);
                    toast.success('Deleted!', { id: toastId });
                    fetchBackups();
                } catch (error) {
                    toast.error('Delete failed', { id: toastId });
                }
            }
        });
    };

    const handleRename = (oldName) => {
        setPromptModal({
            isOpen: true,
            title: 'Rename Backup',
            message: `Enter a new name for "${oldName}" (without .sql):`,
            defaultValue: oldName.replace('.sql', ''),
            onConfirm: async (newName) => {
                if (!newName || newName.trim() + '.sql' === oldName) {
                    setPromptModal(prev => ({ ...prev, isOpen: false }));
                    return;
                }
                const toastId = toast.loading('Renaming...');
                try {
                    await axios.put('http://localhost:3000/api/backup/rename', { oldName, newName: newName.trim() });
                    toast.success('Renamed!', { id: toastId });
                    setPromptModal(prev => ({ ...prev, isOpen: false }));
                    fetchBackups();
                } catch (error) {
                    toast.error('Rename failed: ' + (error.response?.data?.error || error.message), { id: toastId });
                }
            }
        });
    };

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.name.endsWith('.sql')) {
            toast.error('Only .sql files allowed');
            return;
        }
        setLoading(true);
        const toastId = toast.loading('Uploading...');
        const formData = new FormData();
        formData.append('backupFile', file);
        try {
            await axios.post('http://localhost:3000/api/backup/upload', formData);
            toast.success('Uploaded!', { id: toastId });
            fetchBackups();
        } catch (error) {
            toast.error('Upload failed', { id: toastId });
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="database-manager">
            <h1 className="database-manager__header">
                <Database className="database-manager__header-icon" /> Database Manager
            </h1>

            <div className="database-manager__cards">
                {/* Manual Backup */}
                <div className="database-manager__card">
                    <h2 className="database-manager__card-title">
                        <Save className="database-manager__card-title-icon" /> Create Backup
                    </h2>
                    <p className="database-manager__card-description">Create a manual backup of the database.</p>
                    <button onClick={handleBackupNow} disabled={loading} className="database-manager__btn database-manager__btn--primary">
                        {loading ? 'Processing...' : 'Backup Now'}
                    </button>
                </div>

                {/* Schedule */}
                <div className="database-manager__card">
                    <h2 className="database-manager__card-title">
                        <Clock className="database-manager__card-title-icon" /> Schedule
                    </h2>
                    <p className="database-manager__card-description">Set daily automatic backup time.</p>
                    <div className="database-manager__schedule-row">
                        <input type="time" value={cronTime} onChange={(e) => setCronTime(e.target.value)} className="database-manager__time-input" />
                        <button onClick={handleSaveSchedule} className="database-manager__btn database-manager__btn--success">Save</button>
                    </div>
                    {driveStatus.connected ? (
                        <div className="database-manager__auto-upload">
                            <label className="database-manager__toggle-label">
                                <input
                                    type="checkbox"
                                    checked={schedule.autoUploadDrive}
                                    onChange={(e) => setSchedule({ ...schedule, autoUploadDrive: e.target.checked })}
                                    className="database-manager__toggle-checkbox"
                                />
                                <span className="database-manager__toggle-text">Automatic Drive Backup</span>
                            </label>
                        </div>
                    ) : (
                        <p className="database-manager__card-note">Connect Google Drive to enable automated cloud backups.</p>
                    )}
                </div>

                {/* Upload */}
                <div className="database-manager__card">
                    <h2 className="database-manager__card-title">
                        <Upload className="database-manager__card-title-icon" /> Upload Backup
                    </h2>
                    <p className="database-manager__card-description">Upload a .sql backup file.</p>
                    <input type="file" accept=".sql" ref={fileInputRef} onChange={handleUpload} style={{ display: 'none' }} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={loading} className="database-manager__btn database-manager__btn--warning">
                        <Upload className="database-manager__action-icon" /> Upload File
                    </button>
                </div>

                {/* Google Drive */}
                <div className="database-manager__card">
                    <h2 className="database-manager__card-title">
                        {driveStatus.connected ? <Cloud className="database-manager__card-title-icon" style={{ color: '#22c55e' }} /> : <CloudOff className="database-manager__card-title-icon" style={{ color: '#94a3b8' }} />}
                        Google Drive
                    </h2>
                    <p className="database-manager__card-description">
                        {driveStatus.connected ? `Connected as ${driveStatus.email}` : driveStatus.configured ? 'Click to connect your Google account' : driveStatus.reason}
                    </p>
                    {driveStatus.connected ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span className="database-manager__drive-badge database-manager__drive-badge--connected">● {driveStatus.fileCount || 0} files</span>
                            <button onClick={handleDisconnectDrive} className="database-manager__btn database-manager__btn--secondary">
                                <LogOut className="database-manager__action-icon" /> Disconnect
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {driveStatus.configured && (
                                <button onClick={handleConnectDrive} className="database-manager__btn database-manager__btn--primary">
                                    <LogIn className="database-manager__action-icon" /> Connect
                                </button>
                            )}
                            <button onClick={() => window.location.href = '/connect-drive'} className="database-manager__btn database-manager__btn--secondary">
                                {driveStatus.configured ? 'Reconfigure' : 'Configure Drive'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Local Backups Table */}
            <div className="database-manager__table-container">
                <div className="database-manager__table-header"><h2>Local Backups</h2></div>
                <div className="database-manager__table-wrapper">
                    <table className="database-manager__table">
                        <thead>
                            <tr>
                                <th>Filename</th>
                                <th>Created</th>
                                <th>Size</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {backups.length === 0 ? (
                                <tr><td colSpan="4" className="database-manager__table-empty">No backups found.</td></tr>
                            ) : backups.map((b) => (
                                <tr key={b.name}>
                                    <td className="database-manager__table-filename">{b.name}</td>
                                    <td className="database-manager__table-meta">{new Date(b.created).toLocaleString()}</td>
                                    <td className="database-manager__table-meta">{formatSize(b.size)}</td>
                                    <td className="database-manager__table-actions">
                                        <button onClick={() => handleDownload(b.name)} className="database-manager__action-link database-manager__action-link--download"><Download className="database-manager__action-icon" /> Download</button>
                                        <button onClick={() => handleRestore(b.name)} disabled={loading} className="database-manager__action-link database-manager__action-link--restore"><RotateCcw className="database-manager__action-icon" /> Restore</button>
                                        <button onClick={() => handleRename(b.name)} disabled={loading} className="database-manager__action-link database-manager__action-link--edit"><Edit className="database-manager__action-icon" /> Rename</button>
                                        <button onClick={() => handleDelete(b.name)} disabled={loading} className="database-manager__action-link database-manager__action-link--delete"><Trash2 className="database-manager__action-icon" /> Delete</button>
                                        {driveStatus.connected && (
                                            <button onClick={() => handleUploadToDrive(b.name)} className="database-manager__action-link database-manager__action-link--cloud"><Cloud className="database-manager__action-icon" /> Drive</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drive Files Table */}
            {driveStatus.connected && driveFiles.length > 0 && (
                <div className="database-manager__table-container">
                    <div className="database-manager__table-header"><h2>Google Drive Backups</h2></div>
                    <div className="database-manager__table-wrapper">
                        <table className="database-manager__table">
                            <thead>
                                <tr>
                                    <th>Filename</th>
                                    <th>Uploaded</th>
                                    <th>Size</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {driveFiles.map((f) => (
                                    <tr key={f.id}>
                                        <td className="database-manager__table-filename">{f.name}</td>
                                        <td className="database-manager__table-meta">{new Date(f.createdTime).toLocaleString()}</td>
                                        <td className="database-manager__table-meta">{formatSize(f.size)}</td>
                                        <td className="database-manager__table-actions">
                                            <a href={f.webViewLink} target="_blank" rel="noopener noreferrer" className="database-manager__action-link database-manager__action-link--download">
                                                <ExternalLink className="database-manager__action-icon" /> Open
                                            </a>
                                            <button onClick={() => handleRestoreFromDrive(f.id, f.name)} disabled={loading} className="database-manager__action-link database-manager__action-link--restore">
                                                <RotateCcw className="database-manager__action-icon" /> Restore
                                            </button>
                                            <button onClick={() => handleDeleteFromDrive(f.id, f.name)} className="database-manager__action-link database-manager__action-link--delete">
                                                <Trash2 className="database-manager__action-icon" /> Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="database-manager__warning">
                <AlertTriangle className="database-manager__warning-icon" />
                <div>
                    <h3 className="database-manager__warning-title">Important</h3>
                    <p className="database-manager__warning-text">Restoring a backup will <strong>replace</strong> your current database.</p>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="database-manager__danger-zone">
                <h2 className="database-manager__danger-title">
                    <Skull className="database-manager__danger-icon" /> Danger Zone
                </h2>
                <p className="database-manager__danger-description">
                    Permanently delete ALL data from the database. This action cannot be undone!
                </p>
                <button
                    onClick={() => setShowDangerModal(true)}
                    className="database-manager__btn database-manager__btn--danger"
                >
                    <Trash2 className="database-manager__action-icon" /> Delete All Database
                </button>
            </div>

            {/* Danger Zone Modal */}
            {showDangerModal && (
                <div className="database-manager__modal-overlay" onClick={() => setShowDangerModal(false)}>
                    <div className="database-manager__modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="database-manager__modal-title">
                            <Skull style={{ color: '#ef4444' }} /> Confirm Database Deletion
                        </h3>
                        <p className="database-manager__modal-text">
                            This will permanently delete <strong>ALL tables and data</strong> from the database.
                            This action <strong>CANNOT be undone</strong>.
                        </p>
                        <p className="database-manager__modal-text">
                            Enter the danger zone password to proceed:
                        </p>
                        <input
                            type="password"
                            value={dangerPassword}
                            onChange={(e) => setDangerPassword(e.target.value)}
                            placeholder="Enter password"
                            className="database-manager__modal-input"
                            autoFocus
                        />
                        <div className="database-manager__modal-actions">
                            <button
                                onClick={() => { setShowDangerModal(false); setDangerPassword(''); }}
                                className="database-manager__btn database-manager__btn--secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!dangerPassword) {
                                        toast.error('Please enter the password');
                                        return;
                                    }
                                    setLoading(true);
                                    const toastId = toast.loading('Deleting all data...');
                                    try {
                                        const res = await axios.post('http://localhost:3000/api/backup/danger/delete-all', { password: dangerPassword });
                                        toast.success(res.data.message, { id: toastId });
                                        setShowDangerModal(false);
                                        setDangerPassword('');
                                    } catch (error) {
                                        toast.error(error.response?.data?.error || 'Delete failed', { id: toastId });
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className="database-manager__btn database-manager__btn--danger"
                            >
                                {loading ? 'Deleting...' : 'Delete Everything'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prompt Modal */}
            {promptModal.isOpen && (
                <div className="database-manager__modal-overlay" onClick={() => setPromptModal({ ...promptModal, isOpen: false })}>
                    <div className="database-manager__modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="database-manager__modal-title">
                            <Edit style={{ color: '#3b82f6', marginRight: '8px' }} /> {promptModal.title}
                        </h3>
                        <p className="database-manager__modal-text">{promptModal.message}</p>
                        <input
                            type="text"
                            value={promptModal.defaultValue}
                            onChange={(e) => setPromptModal({ ...promptModal, defaultValue: e.target.value })}
                            placeholder="Enter new name"
                            className="database-manager__modal-input"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') promptModal.onConfirm(promptModal.defaultValue);
                            }}
                        />
                        <div className="database-manager__modal-actions">
                            <button
                                onClick={() => setPromptModal({ ...promptModal, isOpen: false })}
                                className="database-manager__btn database-manager__btn--secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => promptModal.onConfirm(promptModal.defaultValue)}
                                className="database-manager__btn database-manager__btn--primary"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
            />
        </div>
    );
};

export default DatabaseManager;
