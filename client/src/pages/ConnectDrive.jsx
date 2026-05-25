import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Cloud, Save, ArrowLeft, Key, ShieldCheck, Info } from 'lucide-react';
import '../styles/ConnectDrive.css';

const ConnectDrive = () => {
    const navigate = useNavigate();
    const [credentials, setCredentials] = useState({ clientId: '', clientSecret: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!credentials.clientId || !credentials.clientSecret) {
            toast.error("Please enter both Client ID and Client Secret");
            return;
        }

        setLoading(true);
        const toastId = toast.loading("Saving configuration...");

        try {
            await axios.post('http://localhost:3000/api/backup/drive/configure', credentials);
            toast.success("Saved! Redirecting to login...", { id: toastId });

            // Fetch auth URL and redirect
            const res = await axios.get('http://localhost:3000/api/backup/drive/connect');
            window.location.href = res.data.authUrl;
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to save configuration", { id: toastId });
            setLoading(false);
        }
    };

    return (
        <div className="connect-drive-container">
            <button onClick={() => navigate('/database')} className="connect-drive-back-btn">
                <ArrowLeft size={20} /> Back to Database Manager
            </button>

            <div className="connect-drive-card">
                <div className="connect-drive-header">
                    <div className="connect-drive-title-row">
                        <div className="connect-drive-icon-wrapper">
                            <Cloud size={32} color="white" />
                        </div>
                        <h1 className="connect-drive-title">Connect Google Drive</h1>
                    </div>
                    <p className="connect-drive-subtitle">
                        Configure your Google Cloud Project to enable automatic cloud backups.
                    </p>
                </div>

                <div className="connect-drive-content">
                    {/* Left: Instructions */}
                    <div className="connect-drive-instructions">
                        <div className="connect-drive-section-title">
                            <Info size={20} color="#2563eb" />
                            <h3>Setup Instructions</h3>
                        </div>

                        <div className="connect-drive-text">
                            <p>To connect your own Google Drive, you need to create a project in Google Cloud Console.</p>

                            <ol className="connect-drive-list">
                                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="connect-drive-link">Google Cloud Console</a>.</li>
                                <li>Create a <strong>New Project</strong> or select an existing one.</li>
                                <li>Search for <strong>"Google Drive API"</strong> and enable it.</li>
                                <li>Go to <strong>APIs & Services {'>'} Credentials</strong>.</li>
                                <li>Click <strong>Create Credentials {'>'} OAuth Client ID</strong>.</li>
                                <li>Select <strong>Web Application</strong>.</li>
                                <li>Add this <strong>Authorized Redirect URI</strong>:
                                    <div className="connect-drive-code-block">
                                        http://localhost:3000/api/backup/drive/callback
                                    </div>
                                </li>
                                <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> below.</li>
                            </ol>

                            <div className="connect-drive-note">
                                <p>
                                    <strong>Note:</strong> If your app is in "Testing" mode, don't forget to add your email to the <strong>Test Users</strong> list in the OAuth Consent Screen configuration.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Form */}
                    <div className="connect-drive-form-card">
                        <h3 className="connect-drive-section-title" style={{ borderBottom: 'none', marginBottom: '1rem' }}>
                            <Key size={20} color="#4f46e5" /> Enter Credentials
                        </h3>

                        <form onSubmit={handleSubmit} className="connect-drive-form">
                            <div>
                                <label className="connect-drive-label">
                                    Client ID
                                </label>
                                <div className="connect-drive-input-wrapper">
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g., 251911796253-..."
                                        className="connect-drive-input"
                                        value={credentials.clientId}
                                        onChange={e => setCredentials({ ...credentials, clientId: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="connect-drive-label">
                                    Client Secret
                                </label>
                                <div className="connect-drive-input-wrapper">
                                    <input
                                        type="password"
                                        required
                                        placeholder="e.g., GOCSPX-..."
                                        className="connect-drive-input"
                                        value={credentials.clientSecret}
                                        onChange={e => setCredentials({ ...credentials, clientSecret: e.target.value })}
                                    />
                                    <ShieldCheck className="connect-drive-input-icon" size={20} />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="connect-drive-btn"
                            >
                                {loading ? 'Key Exchange...' : (
                                    <>
                                        <Save size={18} /> Save & Connect
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConnectDrive;
