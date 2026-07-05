import React from 'react';
import { X, Printer, Download, Smartphone } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import Barcode from 'react-barcode';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/ViewBillModal.css';

const ViewBillModal = ({ sale, onClose }) => {
    const [storeSettings, setStoreSettings] = React.useState(null);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = React.useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    React.useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axios.get('/api/settings/store');
                setStoreSettings(res.data);
            } catch (error) {
                console.error('Failed to load store settings', error);
                // Fallback to defaults if fetch fails
                setStoreSettings({
                    store_name: 'Trendy Flea',
                    address: 'Shop No.1, Main Market Road,\nWagholi, Pune, Maharashtra 412207',
                    phone_1: '9503755794',
                    phone_2: '9699655794',
                    instagram_link: 'https://www.instagram.com/trendyfleapune',
                    exchange_policy_text: 'Valid for 7 days',
                    whatsapp_caption: 'Thank you for shopping in Trendy Flea'
                });
            }
        };
        fetchSettings();
    }, []);

    if (!sale || !storeSettings) return null;

    const handleWhatsAppShare = async () => {
        if (!sale.customer_phone) {
            toast.error('No phone number for this customer');
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'WhatsApp Share',
            message: `Send bill PDF to ${sale.customer_phone} via WhatsApp?`,
            onConfirm: async () => {
                const input = document.getElementById('bill-modal-content');
                if (!input) return;

                const toastId = toast.loading('Sending...');

                try {
                    // Small delay to ensure SVGs are fully rendered
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // 1. Generate PDF
                    const canvas = await html2canvas(input, {
                        scale: 4, // Increased for better quality
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff', // Use pure white
                        allowTaint: true,
                        foreignObjectRendering: false,
                        removeContainer: true,
                        imageTimeout: 0,
                        ignoreElements: (element) => element.classList.contains('no-print') || element.tagName === 'BUTTON'
                    });
                    const imgData = canvas.toDataURL('image/png', 1.0);
                    const pdfWidth = 80;
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                    // Increased buffer from +5 to +10 to prevent cutting off footer/QR
                    const pdfCustom = new jsPDF('p', 'mm', [pdfWidth, pdfHeight + 10]);
                    pdfCustom.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

                    // 2. Convert to Blob
                    const pdfBlob = pdfCustom.output('blob');
                    const file = new File([pdfBlob], `bill_${sale.id}.pdf`, { type: 'application/pdf' });

                    // 3. Send via Open-WA
                    const formData = new FormData();
                    formData.append('phone', sale.customer_phone);
                    formData.append('caption', storeSettings.whatsapp_caption || 'Thank you for shopping.');
                    formData.append('file', file);

                    await axios.post('/api/whatsapp/sendMedia', formData);

                    toast.success('Sent successfully', { id: toastId });
                } catch (err) {
                    console.error(err);
                    toast.error('Terminated', { id: toastId });
                }
            }
        });
    };

    const downloadPDF = async () => {
        const input = document.getElementById('bill-modal-content');
        if (!input) return;

        try {
            // Small delay to ensure SVGs are fully rendered
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(input, {
                scale: 4, // Higher scale for better quality
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                allowTaint: true,
                foreignObjectRendering: false, // Better compatibility
                removeContainer: true,
                imageTimeout: 0,
                ignoreElements: (element) => element.classList.contains('no-print') || element.tagName === 'BUTTON'
            });
            const imgData = canvas.toDataURL('image/png', 1.0);
            const pdfWidth = 80;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            // Increased buffer from +5 to +10
            const pdfCustom = new jsPDF('p', 'mm', [pdfWidth, pdfHeight + 10]);
            pdfCustom.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdfCustom.save(`bill_${sale.id}.pdf`);
        } catch (err) {
            console.error('Failed to generate PDF', err);
        }
    };

    const handlePrint = async () => {
        const input = document.getElementById('bill-modal-content');
        if (!input) return;

        try {
            // Small delay to ensure SVGs are fully rendered
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(input, {
                scale: 4, // Higher scale for better quality
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                allowTaint: true,
                foreignObjectRendering: false, // Better compatibility
                removeContainer: true,
                imageTimeout: 0,
                ignoreElements: (element) => element.classList.contains('no-print') || element.tagName === 'BUTTON'
            });
            const imgData = canvas.toDataURL('image/png', 1.0);
            const pdfWidth = 80;
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            // Increased buffer from +5 to +10
            const pdfCustom = new jsPDF('p', 'mm', [pdfWidth, pdfHeight + 10]);
            pdfCustom.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            // Auto-print configuration
            pdfCustom.autoPrint();
            const blob = pdfCustom.output('blob');
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (err) {
            console.error('Failed to print PDF', err);
        }
    };

    const totalQty = sale.items.reduce((acc, item) => acc + Number(item.quantity), 0);

    // ===== Bill Summary Calculations =====
    // 1. Subtotal (total products price without any discounts)
    const subtotal = sale.items.reduce((acc, item) => {
        return acc + (Number(item.price_at_sale) * Number(item.quantity));
    }, 0);

    // 2. Per-item discounts total
    const itemDiscountsTotal = sale.items.reduce((acc, item) => {
        return acc + Number(item.discount || 0);
    }, 0);

    // 3. Global discount (discount_total contains ONLY the global discount from checkout)
    const globalDiscount = Number(sale.discount_total || 0);

    // 4. Total Discount (item discounts + global discount)
    const totalDiscount = itemDiscountsTotal + globalDiscount;

    // 5. Coupon code and amount (from sale object)
    const couponCode = sale.coupon_code || null;
    const couponAmount = Number(sale.coupon_amount || 0);

    // 6. Loyalty points redeemed amount (from sale object)
    const loyaltyAmount = Number(sale.loyalty_amount || 0);

    // 7. Gift Card / Credit Note used (from payments)
    const creditNotePayment = sale.payments?.find(p =>
        p.payment_method?.toLowerCase() === 'credit_note' ||
        p.payment_method?.toLowerCase() === 'gift_card' ||
        p.payment_method?.toLowerCase() === 'giftcard'
    );
    const creditNoteAmount = creditNotePayment ? Number(creditNotePayment.amount) : 0;

    // 8. Total Savings (all discounts + coupon + loyalty + credit note)
    const totalSavings = totalDiscount + couponAmount + loyaltyAmount + creditNoteAmount;

    // Generate bill number for barcode
    const billNumber = `SINV${sale.id}`;

    return (
        <div className="bill-modal-overlay" onClick={onClose}>
            <div className="bill-modal-wrapper" onClick={(e) => e.stopPropagation()}>
                {/* Torn paper edge top */}
                <div className="bill-torn-edge-top"></div>

                {/* Main Receipt */}
                <div className="bill-receipt">
                    <div id="bill-modal-content" className="bill-content">
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

                        {/* Invoice Meta Info */}
                        <div className="bill-meta-section">
                            <div className="bill-meta-item">
                                <span className="bill-meta-label">Inv No</span>
                                <span className="bill-meta-value" style={{ color: '#dc2626', fontFamily: 'monospace', fontSize: '0.9rem' }}>SINV-{sale.id}</span>
                            </div>
                            <div className="bill-meta-item">
                                <span className="bill-meta-label">Date</span>
                                <span className="bill-meta-value">{new Date(sale.created_at).toLocaleDateString('en-GB')}</span>
                            </div>
                            <div className="bill-meta-item">
                                <span className="bill-meta-label">Customer</span>
                                <span className="bill-meta-value" style={{ textTransform: 'uppercase' }}>{sale.customer_name || 'Customer'}</span>
                            </div>
                            <div className="bill-meta-item">
                                <span className="bill-meta-label">Time</span>
                                <span className="bill-meta-value">{new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            {sale.customer_phone && (
                                <div className="bill-meta-item">
                                    <span className="bill-meta-label">Contact</span>
                                    <span className="bill-meta-value">{sale.customer_phone}</span>
                                </div>
                            )}
                        </div>

                        {/* Items Table Header */}
                        <div className="bill-table-header">
                            <div>Item</div>
                            <div>Rate</div>
                            <div>Disc</div>
                            <div>Qty</div>
                            <div>Amt</div>
                        </div>

                        {/* Items */}
                        <div className="bill-items-container">
                            {sale.items.map((item, idx) => (
                                <div key={idx} className="bill-item-row">
                                    <div className="bill-item-name" title={item.product_name}>
                                        {item.product_name}
                                    </div>
                                    <div>₹{Number(item.price_at_sale).toFixed(0)}</div>
                                    <div>{Number(item.discount || 0) > 0 ? `₹${Number(item.discount).toFixed(0)}` : '-'}</div>
                                    <div>{item.quantity}</div>
                                    <div>₹{((item.price_at_sale * item.quantity) - (item.discount || 0)).toFixed(0)}</div>
                                </div>
                            ))}
                        </div>

                        {/* Bill Summary Section */}
                        <div className="bill-summary-container">
                            {/* Items Totals Row - aligned with table columns */}
                            <div className="bill-items-totals-row">
                                <div className="bill-totals-label">TOTAL</div>
                                <div>₹{subtotal.toFixed(0)}</div>
                                <div className="bill-discount-red">{itemDiscountsTotal > 0 ? `-₹${itemDiscountsTotal.toFixed(0)}` : '-'}</div>
                                <div className="bill-qty-total">{totalQty}</div>
                                <div>₹{(subtotal - itemDiscountsTotal).toFixed(0)}</div>
                            </div>

                            {/* Global Discount / Bill Discount (right aligned) */}
                            {globalDiscount > 0 && (
                                <div className="bill-summary-row-right">
                                    <span>Bill Discount: <strong className="bill-discount-red">-₹{globalDiscount.toFixed(0)}</strong></span>
                                </div>
                            )}

                            {/* Other Discount Breakdown: Coupon + Loyalty Points + Credit Note */}
                            {(couponAmount > 0 || loyaltyAmount > 0 || creditNoteAmount > 0) && (
                                <div className="bill-other-discount-breakdown">
                                    {couponCode && couponAmount > 0 && (
                                        <span>🎟️ Coupon ({couponCode}): <strong className="bill-discount-red">-₹{couponAmount.toFixed(0)}</strong></span>
                                    )}
                                    {loyaltyAmount > 0 && (
                                        <span>⭐ Loyalty Points: <strong className="bill-discount-red">-₹{loyaltyAmount.toFixed(0)}</strong></span>
                                    )}
                                    {creditNoteAmount > 0 && (
                                        <span>💳 Credit Note: <strong className="bill-discount-red">-₹{creditNoteAmount.toFixed(0)}</strong></span>
                                    )}
                                </div>
                            )}

                            {/* Divider before Total */}
                            <div className="bill-total-divider"></div>

                            {/* Row 7: TOTAL (Grand Total - final amount to pay) */}
                            <div className="bill-final-total">
                                <span>TOTAL</span>
                                <span className="bill-final-amount">₹{Number(sale.total_amount).toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Savings Box */}
                        {totalSavings > 0 && (
                            <div className="bill-savings-box">
                                <div className="bill-savings-label">🎉 YOU SAVED</div>
                                <div className="bill-savings-amount">₹{totalSavings.toFixed(0)}</div>
                            </div>
                        )}

                        {/* Payments */}
                        <div className="bill-payments-section">
                            <div className="bill-payment-header">
                                Payment Details
                            </div>
                            {sale.payments && sale.payments.length > 0 ? (
                                sale.payments.map((p, i) => (
                                    <div key={i} className="bill-payment-row">
                                        <span className="bill-payment-method">{p.payment_method}</span>
                                        <span className="bill-payment-amount">₹{Number(p.amount).toFixed(2)}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="bill-payment-row">
                                    <span className="bill-payment-method">{sale.payment_method || 'Cash'}</span>
                                    <span className="bill-payment-amount">₹{Number(sale.total_amount).toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bill-footer">
                            {/* Real Barcode for Bill Number */}
                            <div className="bill-barcode-container">
                                <Barcode
                                    value={billNumber}
                                    width={1.5}
                                    height={40}
                                    fontSize={10}
                                    margin={0}
                                    displayValue={true}
                                    background="#fffef8"
                                />
                            </div>

                            {/* QR Code for Instagram */}
                            {storeSettings.instagram_link && (
                                <div className="bill-qr-container">
                                    <div className="qr-code-wrapper">
                                        <QRCodeSVG
                                            value={storeSettings.instagram_link}
                                            size={60}
                                            level="M"
                                            bgColor="#fffef8"
                                            fgColor="#000000"
                                        />
                                    </div>
                                    <div className="bill-qr-label">Follow us on Instagram</div>
                                </div>
                            )}

                            <div className="bill-thank-you">
                                Thank You... Visit Again!
                            </div>
                            <div className="bill-sub-message">
                                No exchange without bill • {storeSettings.exchange_policy_text}
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
                    <button className="btn bill-btn-whatsapp" onClick={handleWhatsAppShare}>
                        <Smartphone size={16} /> WhatsApp
                    </button>
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
        </div >
    );
};

export default ViewBillModal;
