import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Send, Upload, Smartphone, CheckCircle, XCircle, Loader, FileText, MessageSquare, StopCircle, RefreshCw } from 'lucide-react';
import '../styles/WhatsAppBulk.css';
import WhatsAppConnectionBtn from '../components/WhatsAppConnectionBtn';

const POLL_INTERVAL = 2000; // ms

const WhatsAppBulk = () => {
    const [message, setMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [mode, setMode] = useState('text');

    // Campaign state (mirrored from server)
    const [campaign, setCampaign] = useState(null);
    const [isStarting, setIsStarting] = useState(false);

    const fileInputRef = useRef(null);
    const logEndRef = useRef(null);
    const pollRef = useRef(null);

    // ── Fetch customers ──────────────────────────────────────────────────────
    useEffect(() => {
        fetchCustomers();
        fetchCampaignStatus(); // Restore any in-progress campaign on mount
    }, []);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [campaign?.logs]);

    const fetchCustomers = async () => {
        try {
            const res = await axios.get('/api/customers');
            const valid = res.data.filter(c => c.phone && c.phone.length >= 10);
            setCustomers(valid);
            setFilteredCustomers(valid);
        } catch (e) {
            toast.error('Could not load customers');
        }
    };

    // ── Polling ──────────────────────────────────────────────────────────────
    const fetchCampaignStatus = useCallback(async () => {
        try {
            const res = await axios.get('/api/whatsapp/campaign/status');
            setCampaign(res.data);
            return res.data;
        } catch (e) {
            // Silently fail status polls
        }
    }, []);

    const startPolling = useCallback(() => {
        if (pollRef.current) return; // Already polling
        pollRef.current = setInterval(async () => {
            const data = await fetchCampaignStatus();
            if (data && !data.running) {
                stopPolling();
            }
        }, POLL_INTERVAL);
    }, [fetchCampaignStatus]);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    // Start polling automatically if campaign is running when component mounts/updates
    useEffect(() => {
        if (campaign?.running) {
            startPolling();
        } else {
            stopPolling();
        }
        return () => stopPolling(); // Cleanup on unmount (polling continues on server!)
    }, [campaign?.running]);

    // ── Start Campaign ───────────────────────────────────────────────────────
    const handleSend = async () => {
        if (selectedCustomers.length === 0) return toast.error('Select at least one customer');
        if (mode === 'text' && !message.trim()) return toast.error('Enter a message');
        if (mode === 'media' && !selectedFile) return toast.error('Select a file');

        setIsStarting(true);

        try {
            const targets = customers
                .filter(c => selectedCustomers.includes(c.id))
                .map(c => ({ id: c.id, name: c.name, phone: c.phone }));

            const fd = new FormData();
            fd.append('mode', mode);
            fd.append('message', message);
            fd.append('customers', JSON.stringify(targets));
            if (mode === 'media' && selectedFile) {
                fd.append('file', selectedFile);
            }

            const res = await axios.post('/api/whatsapp/campaign/start', fd);

            if (res.data.success) {
                toast.success('Campaign started! It will run in the background.');
                await fetchCampaignStatus();
                startPolling();
            } else {
                toast.error(res.data.error || 'Failed to start campaign');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to start campaign');
        } finally {
            setIsStarting(false);
        }
    };

    // ── Cancel Campaign ──────────────────────────────────────────────────────
    const handleCancel = async () => {
        try {
            await axios.post('/api/whatsapp/campaign/cancel');
            toast.success('Campaign cancel requested');
            await fetchCampaignStatus();
        } catch (err) {
            toast.error('Failed to cancel campaign');
        }
    };

    // ── WhatsApp helpers ─────────────────────────────────────────────────────
    const handleRestart = async () => {
        try {
            const toastId = toast.loading('Restarting WhatsApp Engine...');
            await axios.post('/api/whatsapp/restart');
            toast.success('Engine Restarted', { id: toastId });
        } catch (err) {
            toast.error('Failed to restart engine');
        }
    };

    const handleDisconnect = async () => {
        if (window.confirm('Are you sure you want to log out from WhatsApp? You will need to scan the QR code again.')) {
            try {
                const toastId = toast.loading('Disconnecting...');
                await axios.post('/api/whatsapp/logout');
                toast.success('Disconnected Successfully', { id: toastId });
            } catch (err) {
                toast.error('Failed to disconnect');
            }
        }
    };

    // ── Derived state ─────────────────────────────────────────────────────────
    const isCampaignRunning = campaign?.running === true;
    const hasCampaign = campaign?.id != null;
    const progress = hasCampaign && campaign.total > 0
        ? Math.round(((campaign.sent + campaign.failed) / campaign.total) * 100)
        : 0;

    return (
        <div className="whatsapp-container">
            {/* Header */}
            <div className="whatsapp-header">
                <div>
                    <h1><Smartphone size={28} /> WhatsApp Automator</h1>
                    <p>WhatsApp Web Engine: Scan QR to connect.</p>
                </div>
            </div>

            {/* ── Campaign Status Banner ── */}
            {hasCampaign && (
                <div className={`wa-campaign-banner ${isCampaignRunning ? 'running' : campaign?.cancelled ? 'cancelled' : 'done'}`}>
                    <div className="wa-campaign-banner-top">
                        <div className="wa-campaign-banner-info">
                            {isCampaignRunning
                                ? <Loader size={16} className="animate-spin" />
                                : campaign?.cancelled
                                    ? <XCircle size={16} />
                                    : <CheckCircle size={16} />
                            }
                            <span>
                                {isCampaignRunning
                                    ? `Campaign running... ${campaign.sent + campaign.failed} / ${campaign.total}`
                                    : campaign?.cancelled
                                        ? `Campaign cancelled — Sent: ${campaign.sent}, Failed: ${campaign.failed}`
                                        : `Campaign complete — Sent: ${campaign.sent}, Failed: ${campaign.failed}`
                                }
                            </span>
                        </div>
                        <div className="wa-campaign-banner-actions">
                            {isCampaignRunning && (
                                <button className="wa-cancel-btn" onClick={handleCancel}>
                                    <StopCircle size={14} /> Cancel
                                </button>
                            )}
                            {!isCampaignRunning && (
                                <button className="wa-refresh-btn" onClick={fetchCampaignStatus}>
                                    <RefreshCw size={14} /> Refresh
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="wa-progress-bar-track">
                        <div
                            className="wa-progress-bar-fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    {/* Logs */}
                    <div className="wa-campaign-logs">
                        {(campaign.logs || []).map((l, i) => (
                            <div key={i} className={`whatsapp-log-item ${l.type}`}>
                                <span className="whatsapp-log-time">[{l.time}]</span> {l.msg}
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>
            )}

            <div className="whatsapp-grid">
                {/* Left Column */}
                <div className="whatsapp-left-col">
                    {/* Connection Card */}
                    <div className="whatsapp-card" style={{ padding: '24px' }}>
                        <h3>Connection</h3>
                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <WhatsAppConnectionBtn variant="full" />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={handleRestart}>
                                    Restart Engine
                                </button>
                                <button
                                    className="btn-danger"
                                    style={{ flex: 1, padding: '8px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    onClick={handleDisconnect}
                                >
                                    Disconnect
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Recipients Card */}
                    <div className="whatsapp-card whatsapp-recipients-card">
                        <div className="whatsapp-recipients-header">
                            <h3>Recipients ({selectedCustomers.length})</h3>
                            <button
                                onClick={() => setSelectedCustomers(filteredCustomers.map(c => c.id))}
                                className="whatsapp-select-all-btn"
                            >
                                Select All
                            </button>
                        </div>
                        <input
                            type="text"
                            className="input input-search-mb"
                            placeholder="Search..."
                            onChange={e => setFilteredCustomers(customers.filter(c =>
                                c.name.toLowerCase().includes(e.target.value.toLowerCase())
                            ))}
                        />
                        <div className="whatsapp-recipients-list">
                            {filteredCustomers.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => {
                                        if (selectedCustomers.includes(c.id))
                                            setSelectedCustomers(p => p.filter(id => id !== c.id));
                                        else
                                            setSelectedCustomers(p => [...p, c.id]);
                                    }}
                                    className={`whatsapp-recipient-item ${selectedCustomers.includes(c.id) ? 'selected' : ''}`}
                                >
                                    <input type="checkbox" checked={selectedCustomers.includes(c.id)} readOnly />
                                    <div>
                                        <div className="whatsapp-recipient-name">{c.name}</div>
                                        <div className="whatsapp-recipient-phone">{c.phone}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="whatsapp-right-col">
                    {/* Compose Card */}
                    <div className="whatsapp-card">
                        <div className="whatsapp-compose-header">
                            <h3><MessageSquare size={18} /> Compose</h3>
                            <div className="whatsapp-mode-switch">
                                <button
                                    onClick={() => setMode('text')}
                                    className={`whatsapp-mode-btn ${mode === 'text' ? 'active' : ''}`}
                                >
                                    Text Only
                                </button>
                                <button
                                    onClick={() => setMode('media')}
                                    className={`whatsapp-mode-btn ${mode === 'media' ? 'active' : ''}`}
                                >
                                    Media
                                </button>
                            </div>
                        </div>

                        <textarea
                            className="whatsapp-textarea"
                            placeholder={mode === 'text' ? 'Type your message...' : 'Type caption for your media...'}
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />

                        {mode === 'media' && (
                            <div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="d-none"
                                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                                    onChange={e => {
                                        if (e.target.files && e.target.files[0]) {
                                            setSelectedFile(e.target.files[0]);
                                        }
                                    }}
                                />
                                <button
                                    className={`whatsapp-file-upload ${selectedFile ? 'has-file' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {selectedFile
                                        ? <><FileText size={16} /> {selectedFile.name}</>
                                        : <><Upload size={16} /> Attach File (Required)</>
                                    }
                                </button>
                                {selectedFile && (
                                    <div
                                        className="whatsapp-remove-file"
                                        onClick={() => {
                                            setSelectedFile(null);
                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                        }}
                                    >
                                        Remove
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={handleSend}
                            disabled={isStarting || isCampaignRunning}
                            className="whatsapp-send-btn"
                            title={isCampaignRunning ? 'A campaign is already running' : ''}
                        >
                            {isStarting ? <Loader className="animate-spin" /> : <Send size={18} />}
                            {isCampaignRunning
                                ? 'Campaign Running...'
                                : mode === 'text' ? 'Send Text Message' : 'Send Media + Caption'
                            }
                        </button>

                        {isCampaignRunning && (
                            <p className="wa-bg-note">
                                ✅ Campaign is running in the background. You can safely navigate to other pages.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppBulk;
