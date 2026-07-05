import React from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import { X, RefreshCw, CheckCircle, ShieldCheck } from 'lucide-react';
import '../styles/WhatsAppQRModal.css';

const WhatsAppQRModal = ({ onClose, status, qrCode }) => {
    const modalContent = (
        <div className="modal-overlay qr-modal-overlay">
            <div className="qr-modal-content">
                <div className="qr-modal-header">
                    <h2 className="qr-modal-title">
                        <ShieldCheck size={20} color="#10ad5c" />
                        Link Device
                    </h2>
                    <button onClick={onClose} className="btn-icon close-btn" title="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className="qr-modal-body">
                    {(status === 'initializing' || status === 'unknown' || status === 'waiting' || status === 'connecting' || (status === 'qr_received' && !qrCode)) && (
                        <div className="loading-container">
                            <div className="spinner-wrapper">
                                <RefreshCw className="spin" size={36} style={{ color: '#10ad5c' }} />
                            </div>
                            <p className="loading-text">{status === 'connecting' ? 'Connecting to WhatsApp...' : 'Initializing Connection...'}</p>
                        </div>
                    )}

                    {status === 'qr_received' && qrCode && (
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
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default WhatsAppQRModal;
