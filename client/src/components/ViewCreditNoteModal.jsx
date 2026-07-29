import React from 'react';
import { X, Printer, Download, Smartphone, ReceiptText } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import Barcode from 'react-barcode';
import '../styles/ViewBillModal.css'; // Reuse premium receipt styles

const ViewCreditNoteModal = ({ creditNote, onClose, onViewSale }) => {
    const [storeSettings, setStoreSettings] = React.useState(null);
    const [confirmModal, setConfirmModal] = React.useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });
    const [usages, setUsages] = React.useState([]);

    React.useEffect(() => {
        const fetchSettingsAndUsages = async () => {
            try {
                const res = await axios.get('/api/settings/store');
                setStoreSettings(res.data);
            } catch (error) {
                console.error('Failed to load store settings', error);
                setStoreSettings({
                    store_name: 'Salescope',
                    address: 'Store Address',
                    phone_1: '9999999999',
                    phone_2: '',
                    instagram_link: '',
                    exchange_policy_text: 'Valid for 3 days',
                    whatsapp_caption: 'Thank you for shopping'
                });
            }

            try {
                const res = await axios.get(`/api/credit-notes/${creditNote.id}/usages`);
                setUsages(res.data);
            } catch (error) {
                console.error('Failed to load redemption history', error);
            }
        };
        fetchSettingsAndUsages();
    }, [creditNote.id]);

    if (!creditNote || !storeSettings) return null;

    // Compute running balances oldest-to-newest
    const sortedUsages = [...usages].sort((a, b) => new Date(a.used_at) - new Date(b.used_at));
    let runningBal = parseFloat(creditNote.amount);
    const usagesWithBalance = sortedUsages.map(usage => {
        const balAfter = runningBal - parseFloat(usage.amount_used);
        runningBal = balAfter;
        return {
            ...usage,
            balance_after: Math.max(0, balAfter),
            type: balAfter <= 0.01 ? 'Completely Redeemed' : 'Partially Redeemed'
        };
    }).reverse();

    const handleWhatsAppShare = async () => {
        const phone = creditNote.customer_phone;
        if (!phone) {
            toast.error('No phone number for this customer');
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'WhatsApp Share',
            message: `Send Credit Note PDF to ${phone} via WhatsApp?`,
            onConfirm: async () => {
                const input = document.getElementById('credit-note-modal-content');
                if (!input) return;

                const toastId = toast.loading('Sending...');

                try {
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const canvas = await html2canvas(input, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        allowTaint: true,
                        foreignObjectRendering: false,
                        removeContainer: true,
                        imageTimeout: 0,
                        ignoreElements: (element) => element.classList.contains('no-print') || element.tagName === 'BUTTON'
                    });
                    const imgData = canvas.toDataURL('image/jpeg', 0.7);
                    const pdfWidth = 80;
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                    const pdfCustom = new jsPDF('p', 'mm', [pdfWidth, pdfHeight + 10]);
                    pdfCustom.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

                    const pdfBlob = pdfCustom.output('blob');
                    const file = new File([pdfBlob], `credit_note_${creditNote.code}.pdf`, { type: 'application/pdf' });

                    const formData = new FormData();
                    formData.append('phone', phone);
                    formData.append('caption', `Here is your Credit Note: ${creditNote.code} for amount ₹${parseFloat(creditNote.balance).toFixed(2)}. Valid until ${new Date(creditNote.expiry_date).toLocaleDateString('en-GB')}.`);
                    formData.append('file', file);

                    const res = await axios.post('/api/whatsapp/sendMedia', formData);
                    if (res.data.delivered) {
                        toast.success('Sent and Delivered to phone', { id: toastId });
                    } else {
                        toast.success('Sent to WhatsApp server (Pending Delivery)', { id: toastId });
                    }
                } catch (err) {
                    console.error(err);
                    const errorMsg = err.response?.data?.error || err.message || 'Failed to send';
                    toast.error(errorMsg, { id: toastId });
                }
            }
        });
    };

    const downloadPDF = async () => {
        const input = document.getElementById('credit-note-modal-content');
        if (!input) return;

        try {
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                allowTaint: true,
                foreignObjectRendering: false,
                removeContainer: true,
                imageTimeout: 0,
                ignoreElements: (element) => element.classList.contains('no-print') || element.tagName === 'BUTTON'
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.7);
            const pdfWidth = 80;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            const pdfCustom = new jsPDF('p', 'mm', [pdfWidth, pdfHeight + 10]);
            pdfCustom.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdfCustom.save(`credit_note_${creditNote.code}.pdf`);
        } catch (err) {
            console.error('Failed to generate PDF', err);
        }
    };

    const handlePrint = async () => {
        const input = document.getElementById('credit-note-modal-content');
        if (!input) return;

        try {
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                allowTaint: true,
                foreignObjectRendering: false,
                removeContainer: true,
                imageTimeout: 0,
                ignoreElements: (element) => element.classList.contains('no-print') || element.tagName === 'BUTTON'
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.7);
            const pdfWidth = 80;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            const pdfCustom = new jsPDF('p', 'mm', [pdfWidth, pdfHeight + 10]);
            pdfCustom.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

            pdfCustom.autoPrint();
            const blob = pdfCustom.output('blob');
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (err) {
            console.error('Failed to print PDF', err);
        }
    };

    const isExpired = new Date(creditNote.expiry_date) <= new Date();
    const isRedeemed = parseFloat(creditNote.balance) === 0;

    return (
        <div className="bill-modal-overlay" onClick={onClose}>
            <div className="bill-modal-wrapper" onClick={(e) => e.stopPropagation()}>
                {/* Torn paper edge top */}
                <div className="bill-torn-edge-top"></div>

                {/* Main Receipt */}
                <div className="bill-receipt">
                    <div id="credit-note-modal-content" className="bill-content">
                        {/* Store Header */}
                        <div className="bill-store-header">
                            <img
                                src={storeSettings.bill_logo_url || '/Salescope.png'}
                                alt="Store Logo"
                                className="bill-logo-img"
                                style={{
                                    width: storeSettings.bill_logo_width || 'auto',
                                    height: storeSettings.bill_logo_height || '80px',
                                }}
                                onError={(e) => { e.target.onerror = null; e.target.src = '/Salescope.png'; }}
                            />
                            {(!storeSettings.bill_logo_url || storeSettings.bill_logo_url === '') && (
                                <h1 className="bill-store-name">{storeSettings.store_name}</h1>
                            )}
                            <div className="bill-store-address whitespace-pre-line">
                                {storeSettings.address}
                            </div>
                            <div className="bill-store-contact">
                                📞 {storeSettings.phone_1} {storeSettings.phone_2 && `| ${storeSettings.phone_2}`}
                            </div>
                        </div>

                        {/* Credit Note Title */}
                        <div style={{ 
                            textAlign: 'center', 
                            margin: '18px 0', 
                            padding: '12px 10px', 
                            borderTop: '1px dashed #d4a574', 
                            borderBottom: '1px dashed #d4a574',
                            background: 'rgba(212, 165, 116, 0.03)',
                            position: 'relative'
                        }}>
                            <h2 style={{ 
                                fontSize: '1.3rem', 
                                fontWeight: '900', 
                                letterSpacing: '4px', 
                                color: '#1a1a1a', 
                                margin: 0,
                                textTransform: 'uppercase',
                                fontFamily: "'Courier New', monospace"
                            }}>CREDIT NOTE</h2>
                            <div style={{ 
                                fontSize: '0.72rem', 
                                color: '#8b5a2b', 
                                fontWeight: '700',
                                letterSpacing: '2px',
                                textTransform: 'uppercase',
                                marginTop: '4px' 
                            }}>★ STORE VOUCHER ★</div>
                        </div>

                        {/* Invoice Meta Info */}
                        <div className="bill-meta-section" style={{ 
                            background: 'linear-gradient(135deg, rgba(212, 165, 116, 0.08), rgba(212, 165, 116, 0.03))',
                            border: '1px dashed #d4a574',
                            borderRadius: '8px',
                            padding: '14px 16px',
                            margin: '16px 0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderBottom: '1px dotted rgba(212, 165, 116, 0.2)', paddingBottom: '6px', alignItems: 'center' }}>
                                <span style={{ color: '#8B4513', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem' }}>Code</span>
                                <span style={{ fontWeight: '800', color: '#dc2626', fontFamily: 'monospace', fontSize: '0.9rem' }}>{creditNote.code}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderBottom: '1px dotted rgba(212, 165, 116, 0.2)', paddingBottom: '6px', alignItems: 'center' }}>
                                <span style={{ color: '#8B4513', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem' }}>Customer</span>
                                <span style={{ fontWeight: '700', color: '#1a1a1a', textTransform: 'uppercase' }}>{creditNote.customer_name || 'Walk-in'}</span>
                            </div>
                            {creditNote.customer_phone && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderBottom: '1px dotted rgba(212, 165, 116, 0.2)', paddingBottom: '6px', alignItems: 'center' }}>
                                    <span style={{ color: '#8B4513', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem' }}>Contact</span>
                                    <span style={{ fontWeight: '600', color: '#1a1a1a' }}>{creditNote.customer_phone}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', alignItems: 'center' }}>
                                <span style={{ color: '#8B4513', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.75rem' }}>Issued On</span>
                                <span style={{ fontWeight: '600', color: '#1a1a1a' }}>
                                    {new Date(creditNote.created_at).toLocaleDateString('en-GB')} | {new Date(creditNote.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>

                        {/* Credit Note Details */}
                        <div style={{ padding: '15px 0', borderBottom: '3px double #d4a574' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0', fontSize: '0.85rem' }}>
                                <span style={{ color: '#666', fontWeight: '500' }}>Original Value</span>
                                <span style={{ borderBottom: '1px dotted #ccc', flex: 1, margin: '0 8px' }}></span>
                                <span style={{ fontWeight: '700', color: '#1a1a1a', fontFamily: 'monospace' }}>₹{parseFloat(creditNote.amount).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0', fontSize: '0.85rem' }}>
                                <span style={{ color: '#666', fontWeight: '500' }}>Claimed Amount</span>
                                <span style={{ borderBottom: '1px dotted #ccc', flex: 1, margin: '0 8px' }}></span>
                                <span style={{ fontWeight: '700', color: '#b45309', fontFamily: 'monospace' }}>₹{parseFloat(creditNote.amount - creditNote.balance).toFixed(2)}</span>
                            </div>
                            <div className="bill-total-divider" style={{ borderBottom: '1px solid #ddd', margin: '10px 0' }}></div>
                            <div className="bill-grand-total" style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                background: isRedeemed 
                                    ? 'linear-gradient(90deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.02))' 
                                    : 'linear-gradient(90deg, rgba(37, 99, 235, 0.12), rgba(37, 99, 235, 0.02))',
                                borderLeft: isRedeemed ? '4px solid #16a34a' : '4px solid #2563eb',
                                padding: '12px 14px',
                                margin: '8px 0',
                                borderRadius: '4px'
                            }}>
                                <span style={{ 
                                    fontWeight: 900, 
                                    fontSize: '1rem', 
                                    color: '#1a1a1a', 
                                    letterSpacing: '1px',
                                    textTransform: 'uppercase'
                                }}>Balance</span>
                                <span className="bill-final-amount" style={{ 
                                    fontSize: '1.45rem',
                                    color: isRedeemed ? '#15803d' : '#1d4ed8' 
                                }}>₹{parseFloat(creditNote.balance).toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Status & Expiry Info */}
                        <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            gap: '8px',
                            margin: '15px 0 10px 0',
                            padding: '12px',
                            background: '#fafafa',
                            borderRadius: '8px',
                            border: '1px solid #f0f0f0'
                        }}>
                            <div style={{ 
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 14px', 
                                borderRadius: '30px', 
                                fontSize: '0.8rem',
                                fontWeight: '800', 
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                backgroundColor: isRedeemed ? '#dcfce7' : isExpired ? '#fee2e2' : '#e0f2fe',
                                color: isRedeemed ? '#166534' : isExpired ? '#991b1b' : '#0369a1'
                            }}>
                                <span style={{ 
                                    width: '6px', 
                                    height: '6px', 
                                    borderRadius: '50%', 
                                    backgroundColor: isRedeemed ? '#22c55e' : isExpired ? '#ef4444' : '#0ea5e9',
                                    display: 'inline-block'
                                }}></span>
                                {isRedeemed ? 'Fully Redeemed' : isExpired ? 'Expired' : 'Validity'}
                            </div>
                            <div style={{ 
                                fontSize: '0.82rem', 
                                color: '#666',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <span>Valid Until:</span> 
                                <strong style={{ color: isExpired && !isRedeemed ? '#b91c1c' : '#333', fontWeight: '700' }}>
                                    {new Date(creditNote.expiry_date).toLocaleDateString('en-GB')}
                                </strong>
                            </div>
                        </div>

                        {/* Redemption History */}
                        {usagesWithBalance.length > 0 && (
                            <div style={{ marginTop: '20px', borderTop: '2px dashed #d4a574', paddingTop: '15px' }}>
                                <h3 style={{ 
                                    fontSize: '0.9rem', 
                                    fontWeight: '800', 
                                    letterSpacing: '1px', 
                                    color: '#8B4513', 
                                    textAlign: 'center',
                                    textTransform: 'uppercase',
                                    marginBottom: '12px'
                                }}>Redemption History</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {usagesWithBalance.map((usage, idx) => (
                                        <div key={idx} style={{ 
                                            background: '#fcfaf6', 
                                            border: '1px solid #ebdcc5', 
                                            borderRadius: '6px', 
                                            padding: '10px 12px',
                                            fontSize: '0.8rem'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'center' }}>
                                                <span style={{ 
                                                    fontWeight: '700', 
                                                    color: usage.type === 'Completely Redeemed' ? '#166534' : '#b45309',
                                                    fontSize: '0.75rem',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {usage.type}
                                                </span>
                                                <span style={{ fontWeight: '800', color: '#1a1a1a' }}>
                                                    ₹{parseFloat(usage.amount_used).toFixed(2)}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>
                                                <span>Bill Number:</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {onViewSale ? (
                                                        <button 
                                                            onClick={() => onViewSale(usage.sale_id)}
                                                            title="View Bill Details"
                                                            style={{ 
                                                                background: 'none', 
                                                                border: 'none', 
                                                                padding: '0', 
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                color: '#2563eb',
                                                                fontWeight: '700',
                                                                transition: 'color 0.25s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.color = '#1d4ed8'}
                                                            onMouseLeave={(e) => e.currentTarget.style.color = '#2563eb'}
                                                        >
                                                            <ReceiptText size={14} style={{ color: '#d4a574' }} />
                                                            <span>SINV-{usage.sale_id}</span>
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontWeight: '600', color: '#1a1a1a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <ReceiptText size={14} style={{ color: '#888' }} />
                                                            SINV-{usage.sale_id}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '0.75rem', marginBottom: '4px' }}>
                                                <span>Redemption Date:</span>
                                                <span>{new Date(usage.used_at).toLocaleDateString('en-GB')} {new Date(usage.used_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '0.75rem', borderTop: '1px dotted #e6d3ba', paddingTop: '4px', marginTop: '4px' }}>
                                                <span>Remaining Later:</span>
                                                <span style={{ fontWeight: '700', color: usage.balance_after <= 0.01 ? '#16a34a' : '#2563eb' }}>
                                                    ₹{parseFloat(usage.balance_after).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="bill-footer" style={{ marginTop: '15px' }}>
                            {/* Barcode for Credit Note Code */}
                            <div className="bill-barcode-container">
                                <Barcode
                                    value={creditNote.code}
                                    width={1.5}
                                    height={40}
                                    fontSize={10}
                                    margin={0}
                                    displayValue={true}
                                    background="#ffffff"
                                />
                            </div>

                            <div className="bill-thank-you" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem', margin: '10px 0 5px 0' }}>
                                Thank You!
                            </div>
                            <div className="bill-sub-message" style={{ textAlign: 'center', fontSize: '0.75rem', color: '#666' }}>
                                Present this voucher at checkout to claim your credit.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Torn paper edge bottom */}
                <div className="bill-torn-edge-bottom"></div>

                {/* Action Buttons */}
                <div className="bill-actions-footer">
                    <button className="btn bill-btn-close" onClick={onClose}>
                        <X size={16} />
                    </button>
                    {creditNote.customer_phone && (
                        <button className="btn bill-btn-whatsapp" onClick={handleWhatsAppShare}>
                            <Smartphone size={16} /> WhatsApp
                        </button>
                    )}
                    <button className="btn bill-btn-print" onClick={handlePrint}>
                        <Printer size={16} />
                    </button>
                    <button className="btn bill-btn-print" onClick={downloadPDF}>
                        <Download size={16} />
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
            />
        </div>
    );
};

export default ViewCreditNoteModal;
