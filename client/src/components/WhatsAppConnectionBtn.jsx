import React, { useState, useEffect } from 'react';
import { MessageSquare, Loader, CheckCircle, XCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import WhatsAppQRModal from './WhatsAppQRModal';

const WhatsAppConnectionBtn = ({ variant = 'default' }) => {
    const [status, setStatus] = useState('unknown');
    const [qrCode, setQrCode] = useState(null);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        // Fallback fetch in case SSE takes a moment
        axios.get('/api/whatsapp/status').then(res => setStatus(res.data?.status || 'unknown')).catch(() => {});
        
        // Setup Server-Sent Events (SSE) for instant updates
        const eventSource = new EventSource('/api/whatsapp/stream');
        
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setStatus(data.status);
                setQrCode(data.qr);

                // Auto-close modal if connected
                if (data.status === 'connected') {
                    // Slight delay to let user see "Connected" success state in the modal
                    setTimeout(() => setShowModal(false), 2000);
                }
            } catch (e) {
                console.error("SSE Parse Error:", e);
            }
        };

        eventSource.onerror = () => {
            console.error("SSE Connection Error. Retrying...");
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const handleClick = () => {
        if (status === 'connected') {
            toast.success('WhatsApp is already connected!');
        } else {
            setShowModal(true);
        }
    };

    // Use Dashboard's exact styling for the button to maintain UI consistency
    const isConnected = status === 'connected';
    const isConnecting = status === 'initializing' || status === 'waiting' || status === 'connecting';
    const isQrReady = status === 'qr_received';

    let statusClass = 'disconnected';
    if (isConnected) statusClass = 'connected';
    else if (isConnecting) statusClass = 'connecting';
    else if (isQrReady) statusClass = 'qr-ready';

    return (
        <>
            <div
                onClick={handleClick}
                className={`status-card status-card-custom ${statusClass}`}
                style={variant === 'full' ? { width: '100%', justifyContent: 'center', padding: '16px', fontSize: '16px' } : {}}
            >
                <div className="status-content">
                    {isConnecting ? (
                        <Loader size={variant === 'full' ? 20 : 14} className="animate-spin" />
                    ) : isConnected ? (
                        <CheckCircle size={variant === 'full' ? 20 : 14} />
                    ) : (
                        <div className="status-dot"></div>
                    )}
                    
                    {variant !== 'full' && <MessageSquare size={14} />}
                    <span>
                        {isConnected ? (variant === 'full' ? 'WhatsApp Connected' : 'WhatsApp') : isConnecting ? (status === 'connecting' ? 'Connecting...' : 'Initializing...') : isQrReady ? 'Click for QR Code' : 'WhatsApp'}
                    </span>
                </div>
            </div>

            {showModal && (
                <WhatsAppQRModal
                    status={status}
                    qrCode={qrCode}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
};

export default WhatsAppConnectionBtn;
