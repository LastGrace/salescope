import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, RefreshCw, CheckCircle, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/WhatsAppQRModal.css';

const WhatsAppQRModal = ({ onClose, onConnected }) => {
    const { token } = useAuth();
    const [qrCode, setQrCode] = useState(null);
    const [status, setStatus] = useState('initializing'); // initializing, qr_ready, connected, error
    const [error, setError] = useState(null);

    const fetchQr = async () => {
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const response = await axios.get('/api/whatsapp/qr-data', { headers });

            const { status: wsStatus, qr } = response.data;

            if (wsStatus === 'connected') {
                setStatus('connected');
                if (onConnected) onConnected();
            } else if (wsStatus === 'qr' && qr) {
                setQrCode(qr);
                setStatus('qr_ready');
            } else {
                setStatus('waiting');
            }
            setError(null);
        } catch (err) {
            console.error("Error fetching QR:", err);
            setError("Failed to connect to WhatsApp service.");
        }
    };

    useEffect(() => {
        fetchQr();
        const intervalId = setInterval(fetchQr, 30000); // Poll every 30 seconds
        return () => clearInterval(intervalId);
    }, []);



    return (
        <div className="modal-overlay qr-modal-overlay">
            {/* Main Modal Container - Auto height, Scrollable if needed */}
            <div className="qr-modal-content">

                {/* Header - Fixed at top */}
                <div className="qr-modal-header">
                    <h2 className="qr-modal-title">
                        <ShieldCheck size={20} color="#10ad5c" />
                        Link Device
                    </h2>
                    <button
                        onClick={onClose}
                        className="btn-icon close-btn"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="qr-modal-body">

                    {status === 'initializing' || status === 'waiting' && (
                        <div className="loading-container">
                            <div className="spinner-wrapper">
                                <RefreshCw className="spin" size={36} style={{ color: '#10ad5c' }} />
                            </div>
                            <p className="loading-text">Initializing Connection...</p>
                        </div>
                    )}

                    {status === 'qr_ready' && qrCode && (
                        <div className="fade-in qr-display-container">
                            <div className="qr-code-box">
                                <QRCodeSVG value={qrCode} size={220} />
                            </div>

                            <div className="instructions-box">
                                <div className="instructions-title">Instructions:</div>
                                <ol className="instructions-list">
                                    <li>Open <strong>WhatsApp</strong> on your phone.</li>
                                    <li>Go to <strong>Settings</strong> {'>'} <strong>Linked Devices</strong>.</li>
                                    <li>Tap <strong>Link a Device</strong> & scan.</li>
                                </ol>
                            </div>
                        </div>
                    )}

                    {status === 'connected' && (
                        <div className="fade-in success-container">
                            <div className="success-icon-wrapper">
                                <CheckCircle size={36} />
                            </div>
                            <div className="success-text">
                                <h3 className="success-title">Connected!</h3>
                                <p className="success-subtitle">Ready to send messages.</p>
                            </div>
                            <button className="btn-primary continue-btn" onClick={onClose}>
                                Continue
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="error-banner-custom">
                            {error}
                        </div>
                    )}

                </div>



            </div>
        </div>
    );
};

export default WhatsAppQRModal;
