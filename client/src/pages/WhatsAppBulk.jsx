import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Send, Upload, Smartphone, Terminal, CheckCircle, XCircle, Loader, FileText, AlertCircle, MessageSquare, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/WhatsAppBulk.css';

import '../styles/Dashboard.css';

// Lazy load the shared modal
import WhatsAppQRModal from '../components/WhatsAppQRModal';

const WhatsAppBulk = () => {
    const [status, setStatus] = useState('unknown');
    const [logs, setLogs] = useState([]);
    const [message, setMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);

    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);

    const [stats, setStats] = useState({ sent: 0, failed: 0, total: 0 });
    const logEndRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        checkStatus();
        fetchCustomers();
        const timer = setInterval(() => {
            checkStatus();
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
    };

    const checkStatus = async () => {
        try {
            const res = await axios.get('/api/whatsapp/status');
            const s = res.data.status;
            if (s === 'connected') {
                setStatus('connected');
                setShowQrModal(false);
            } else if (s === 'connecting') {
                setStatus('connecting');
                // Don't close modal here, it might be scanning
            } else {
                setStatus('disconnected');
            }
        } catch {
            setStatus('error');
        }
    };



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

    const initialize = async () => {
        try {
            addLog('Initializing Engine...', 'info');
            await axios.post('/api/whatsapp/init');
            setShowQrModal(true);
            toast.success('Engine launching... Please wait for QR Code.');
        } catch (e) {
            toast.error('Failed to launch');
            addLog('Launch failed: ' + e.message, 'error');
        }
    };

    const [mode, setMode] = useState('text');

    const handleSend = async () => {
        if (selectedCustomers.length === 0) return toast.error('Select customers');
        if (status !== 'connected') return toast.error('WhatsApp not connected');

        if (mode === 'text' && !message) return toast.error('Enter a message');
        if (mode === 'media' && !selectedFile) return toast.error('Select a file');

        setIsSending(true);
        setStats({ sent: 0, failed: 0, total: selectedCustomers.length });
        setLogs([]);
        addLog(`Starting batch (${mode.toUpperCase()}) for ${selectedCustomers.length} customers`, 'info');

        const targets = customers.filter(c => selectedCustomers.includes(c.id));

        for (const customer of targets) {
            try {
                addLog(`Sending to ${customer.name}...`, 'info');
                let endpoint = '/api/whatsapp/sendText';
                let payload;
                let headers = {};

                if (mode === 'media') {
                    endpoint = '/api/whatsapp/sendMedia';
                    const fd = new FormData();
                    fd.append('phone', customer.phone);
                    fd.append('caption', message || '');
                    fd.append('file', selectedFile);
                    payload = fd;
                    // axios automatically sets Content-Type for FormData
                } else {
                    payload = {
                        phone: customer.phone,
                        message: message
                    };
                    headers['Content-Type'] = 'application/json';
                }

                const res = await axios.post(endpoint, payload, { headers });

                if (res.data.success) {
                    addLog(`Success: ${customer.name}`, 'success');
                    setStats(s => ({ ...s, sent: s.sent + 1 }));
                } else {
                    addLog(`Failed: ${customer.name} - ${JSON.stringify(res.data.error)}`, 'error');
                    setStats(s => ({ ...s, failed: s.failed + 1 }));
                }

                await new Promise(r => setTimeout(r, 2000));

            } catch (err) {
                addLog(`Error: ${customer.name}`, 'error');
                setStats(s => ({ ...s, failed: s.failed + 1 }));
            }
        }

        setIsSending(false);
        addLog('Batch completed', 'success');
        toast.success('Batch completed');
    };

    const handleLogout = async () => {
        try {
            await axios.post('/api/whatsapp/logout');
            toast.success('Logged out. Restart server to get new QR.');
            setStatus('disconnected');
        } catch (e) {
            toast.error('Logout failed');
        }
    };

    const handleReset = async () => {
        try {
            addLog('Resetting session...', 'info');
            await axios.post('/api/whatsapp/logout');
            toast.success('Session cleared. Click Start Engine to get new QR.');
            setStatus('disconnected');
        } catch (e) {
            toast.error('Reset failed');
        }
    };

    return (
        <div className="whatsapp-container">
            {/* Header */}
            <div className="whatsapp-header">
                <div>
                    <h1>
                        <Smartphone size={28} /> WhatsApp Automator
                    </h1>
                    <p>WhatsApp Web Engine: Scan QR to connect.</p>
                </div>
                <div className={`whatsapp-status-badge ${status}`}>
                    {status === 'connected' ? <CheckCircle size={18} /> : status === 'connecting' ? <Loader className="animate-spin" size={18} /> : <XCircle size={18} />}
                    {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected'}
                </div>
            </div>

            <div className="whatsapp-grid">
                {/* Left Column */}
                <div className="whatsapp-left-col">
                    {/* Connection Card */}
                    <div className="whatsapp-card">
                        <h3>Connection</h3>

                        {status === 'connected' ? (
                            <div>
                                <div className="whatsapp-connection-success">
                                    <CheckCircle size={48} />
                                    <div>Ready to Send</div>
                                </div>
                                <button onClick={handleLogout} className="whatsapp-btn whatsapp-btn-danger">
                                    <XCircle size={16} /> Disconnect WhatsApp
                                </button>
                            </div>
                        ) : status === 'connecting' ? (
                            <div>
                                <div className="whatsapp-connection-waiting">
                                    <Loader size={48} className="animate-spin" />
                                    <div className="text-semibold">Connecting...</div>
                                    <div className="sub-text">Please wait, syncing with WhatsApp</div>
                                </div>
                                <button onClick={handleReset} className="whatsapp-btn whatsapp-btn-warning">
                                    <AlertCircle size={16} /> Reset & Get New QR
                                </button>
                                <button onClick={() => setShowQrModal(true)} className="whatsapp-btn btn-qr-popup">
                                    <QrCode size={16} /> Show QR Popup
                                </button>
                            </div>
                        ) : (
                            <>
                                <button onClick={initialize} className="whatsapp-btn whatsapp-btn-primary">
                                    <Terminal size={18} /> Start Engine / Get QR
                                </button>
                                <button onClick={() => setShowQrModal(true)} className="whatsapp-btn btn-qr-popup">
                                    <QrCode size={16} /> Show QR Popup
                                </button>
                            </>
                        )}
                    </div>

                    {/* Recipients Card */}
                    <div className="whatsapp-card whatsapp-recipients-card">
                        <div className="whatsapp-recipients-header">
                            <h3>Recipients ({selectedCustomers.length})</h3>
                            <button onClick={() => setSelectedCustomers(filteredCustomers.map(c => c.id))} className="whatsapp-select-all-btn">
                                Select All
                            </button>
                        </div>
                        <input
                            type="text"
                            className="input input-search-mb"
                            placeholder="Search..."
                            onChange={e => setFilteredCustomers(customers.filter(c => c.name.toLowerCase().includes(e.target.value.toLowerCase())))}
                        />
                        <div className="whatsapp-recipients-list">
                            {filteredCustomers.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => {
                                        if (selectedCustomers.includes(c.id)) setSelectedCustomers(p => p.filter(id => id !== c.id));
                                        else setSelectedCustomers(p => [...p, c.id]);
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
                            <h3>
                                <MessageSquare size={18} /> Compose
                            </h3>
                            <div className="whatsapp-mode-switch">
                                <button onClick={() => setMode('text')} className={`whatsapp-mode-btn ${mode === 'text' ? 'active' : ''}`}>
                                    Text Only
                                </button>
                                <button onClick={() => setMode('media')} className={`whatsapp-mode-btn ${mode === 'media' ? 'active' : ''}`}>
                                    Media
                                </button>
                            </div>
                        </div>

                        <textarea
                            className="whatsapp-textarea"
                            placeholder={mode === 'text' ? "Type your message..." : "Type caption for your media..."}
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
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setSelectedFile(e.target.files[0]);
                                        }
                                    }}
                                />
                                <button
                                    className={`whatsapp-file-upload ${selectedFile ? 'has-file' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {selectedFile ? <><FileText size={16} /> {selectedFile.name}</> : <><Upload size={16} /> Attach File (Required)</>}
                                </button>
                                {selectedFile && (
                                    <div className="whatsapp-remove-file" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                                        Remove
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={handleSend}
                            disabled={isSending || status !== 'connected'}
                            className="whatsapp-send-btn"
                        >
                            {isSending ? <Loader className="animate-spin" /> : <Send size={18} />}
                            {mode === 'text' ? 'Send Text Message' : 'Send Media + Caption'}
                        </button>
                    </div>

                    {/* Logs Card */}
                    <div className="whatsapp-card whatsapp-logs-card">
                        <div className="whatsapp-logs-header">
                            <span>Execution Logs</span>
                            <span>{stats.sent} Sent / {stats.failed} Failed</span>
                        </div>
                        <div className="whatsapp-logs-content">
                            {logs.map((l, i) => (
                                <div key={i} className={`whatsapp-log-item ${l.type}`}>
                                    <span className="whatsapp-log-time">[{l.time}]</span> {l.msg}
                                </div>
                            ))}
                            <div ref={logEndRef}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Shared WhatsApp QR Modal */}
            {showQrModal && status !== 'connected' && (
                <WhatsAppQRModal
                    onClose={() => setShowQrModal(false)}
                    onConnected={() => {
                        setStatus('connected');
                        setShowQrModal(false);
                    }}
                />
            )}
        </div>
    );
};

export default WhatsAppBulk;
