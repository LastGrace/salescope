import React, { useState, useEffect, useRef } from 'react';
import Barcode from 'react-barcode';
import axios from 'axios';
import { Search, Printer, Trash2, Plus, Settings, QrCode, Layout, Info } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import toast from 'react-hot-toast';
import '../styles/BarcodeGenerator.css';

const BarcodeGenerator = () => {
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');
    const [barcodeScan, setBarcodeScan] = useState('');
    const [queue, setQueue] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);

    // Label Settings
    const [labelWidth, setLabelWidth] = useState(38); // mm
    const [labelHeight, setLabelHeight] = useState(25); // mm

    // Paper Settings
    const PAPER_WIDTH_MM = 83; // Roll width

    const componentRef = useRef();

    useEffect(() => {
        loadProducts();
    }, []);

    useEffect(() => {
        if (!search) {
            setFilteredProducts([]);
            return;
        }
        const lower = search.toLowerCase();
        const filtered = products.filter(p =>
            p.name.toLowerCase().includes(lower) ||
            (p.barcode && p.barcode.toLowerCase().includes(lower))
        );
        setFilteredProducts(filtered.slice(0, 5));
    }, [search, products]);

    const loadProducts = async () => {
        try {
            const res = await axios.get('/api/products?limit=9999&lite=true');
            const data = res.data.products ? res.data.products : (Array.isArray(res.data) ? res.data : []);
            setProducts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('GET /products error:', err);
        }
    };

    const addToQueue = (product) => {
        setQueue([...queue, { ...product, printQty: 1, uid: Date.now() }]);
        setSearch('');
    };

    const removeFromQueue = (uid) => {
        setQueue(queue.filter(i => i.uid !== uid));
    };

    const updateQty = (uid, qty) => {
        setQueue(queue.map(i => i.uid === uid ? { ...i, printQty: parseInt(qty) || "" } : i));
    };

    const handleBarcodeScan = (e) => {
        if (e.key === 'Enter') {
            const code = barcodeScan.trim().toUpperCase();
            if (!code) return;

            const product = products.find(p => p.barcode?.toUpperCase() === code);
            if (product) {
                addToQueue(product);
                setBarcodeScan('');
            } else {
                toast.error('Barcode not found');
            }
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        pageStyle: `
            @page {
                size: ${PAPER_WIDTH_MM}mm ${labelHeight}mm;
                margin: 0mm;
            }
            @media print {
                html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    width: ${PAPER_WIDTH_MM}mm !important;
                    height: auto !important;
                    -webkit-print-color-adjust: exact;
                }
                .print-row {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    width: ${PAPER_WIDTH_MM}mm !important;
                    height: ${labelHeight}mm !important;
                    padding: 0 1.5mm !important;
                    box-sizing: border-box !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    page-break-after: always !important;
                    break-after: page !important;
                }
                .print-row:last-child {
                    page-break-after: auto !important;
                    break-after: auto !important;
                }
            }
        `
    });

    const LabelContent = ({ item }) => (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.5mm 1mm',
            background: 'white',
            color: 'black',
            fontFamily: 'Arial, sans-serif',
            boxSizing: 'border-box',
            textAlign: 'center'
        }}>
            <div style={{ fontWeight: '900', fontSize: '11pt', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1 }}>
                TRENDY FLEA
            </div>
            <div style={{ fontSize: '9.5pt', fontWeight: '700', textAlign: 'center', lineHeight: 1, letterSpacing: '0.5px', marginTop: '1px', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.name.toUpperCase()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '24px', overflow: 'hidden' }}>
                <Barcode
                    value={item.barcode || '0000'}
                    width={1.6}
                    height={24}
                    fontSize={0}
                    margin={0}
                    displayValue={false}
                    background="transparent"
                />
            </div>
            <div style={{ fontWeight: 'bold', fontSize: '8.5pt', letterSpacing: '1px', lineHeight: 1, whiteSpace: 'nowrap', marginTop: '-1px' }}>
                {item.barcode || '0000'}
            </div>
            <div style={{ fontWeight: '900', fontSize: '10.5pt', letterSpacing: '0.04em', lineHeight: 1, whiteSpace: 'nowrap' }}>
                MRP ₹ : {Number(item.price).toFixed(2)}
            </div>
        </div>
    );

    const allItems = queue.flatMap(item => Array(Number(item.printQty) || 0).fill(item));
    const rows = [];
    for (let i = 0; i < allItems.length; i += 2) {
        rows.push(allItems.slice(i, i + 2));
    }

    const totalLabels = queue.reduce((acc, i) => acc + (Number(i.printQty) || 0), 0);

    return (
        <div className="barcode-page-container barcode-animate">
            <header className="barcode-header">
                <div className="barcode-title-group">
                    <div className="barcode-icon-box">
                        <QrCode size={24} />
                    </div>
                    <div className="barcode-title">
                        <h1>Barcode Studio</h1>
                        <p>Generate & batch print product labels</p>
                    </div>
                </div>

                <div className="barcode-header-actions">
                    <button className="btn btn-primary barcode-print-btn" onClick={handlePrint} disabled={queue.length === 0}>
                        <Printer size={20} />
                        <span>Print Batch</span>
                        <span className="barcode-count-badge">{totalLabels}</span>
                    </button>
                </div>
            </header>

            <main className="barcode-main-layout">
                {/* Left Panel: Search & Queue */}
                <div className="barcode-left-panel">
                    <div className="barcode-search-container">
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                            <div className="barcode-search-bar" style={{ flex: 1, margin: 0 }}>
                                <Search size={20} style={{ color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="barcode-search-input"
                                    placeholder="Search by name or barcode..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="barcode-search-bar" style={{ flex: 1, margin: 0 }}>
                                <QrCode size={20} style={{ color: 'var(--text-muted)' }} />
                                <input
                                    autoFocus
                                    type="text"
                                    className="barcode-search-input"
                                    placeholder="Scan barcode directly..."
                                    value={barcodeScan}
                                    onChange={e => setBarcodeScan(e.target.value)}
                                    onKeyDown={handleBarcodeScan}
                                />
                            </div>
                        </div>
                        {filteredProducts.length > 0 && (
                            <div className="barcode-results-dropdown">
                                {filteredProducts.map(p => (
                                    <div key={p.id} className="barcode-result-item" onClick={() => addToQueue(p)}>
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{p.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.barcode} | ₹{p.price}</div>
                                        </div>
                                        <Plus size={18} className="text-primary" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="barcode-queue-card">
                        <div className="barcode-queue-header">
                            <span className="barcode-queue-title">Batch Queue</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{queue.length} distinct items</span>
                        </div>
                        <div className="barcode-queue-list custom-scrollbar">
                            {queue.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                                    <Layout size={40} style={{ opacity: 0.1, marginBottom: '1rem' }} /><br />
                                    Search for products to start building your print batch.
                                </div>
                            ) : (
                                queue.map((item) => (
                                    <div key={item.uid} className="barcode-queue-item">
                                        <div className="barcode-item-info">
                                            <div className="barcode-item-name">{item.name}</div>
                                            <div className="barcode-item-code">{item.barcode} | ₹{item.price}</div>
                                        </div>
                                        <div className="barcode-qty-control">
                                            <input
                                                type="number"
                                                className="barcode-qty-input"
                                                min="0"
                                                value={item.printQty}
                                                onChange={(e) => updateQty(item.uid, e.target.value)}
                                            />
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>copies</span>
                                        </div>
                                        <button onClick={() => removeFromQueue(item.uid)} className="btn-icon" style={{ color: '#ef4444' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Settings & Preview */}
                <div className="barcode-right-panel custom-scrollbar">
                    <div className="barcode-settings-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <Settings size={18} className="text-primary" />
                            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>Label Configuration</h3>
                        </div>

                        <div className="barcode-settings-grid">
                            <div className="barcode-setting-item">
                                <label>Width (mm)</label>
                                <input type="number" step="0.1" className="input" value={labelWidth} onChange={e => setLabelWidth(Number(e.target.value))} />
                            </div>
                            <div className="barcode-setting-item">
                                <label>Height (mm)</label>
                                <input type="number" step="0.1" className="input" value={labelHeight} onChange={e => setLabelHeight(Number(e.target.value))} />
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(225, 29, 72, 0.03)', border: '1px solid rgba(225, 29, 72, 0.1)', borderRadius: '0.75rem', display: 'flex', gap: '0.75rem' }}>
                            <Info size={16} className="text-primary" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                                Standard roll width is locked to <strong>{PAPER_WIDTH_MM}mm</strong>. For the TSC TE244, these settings ensure a 2-column layout.
                            </p>
                        </div>
                    </div>

                    <div className="barcode-preview-container">
                        <h3 style={{ position: 'absolute', top: '1.25rem', left: '1.5rem', margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Real-time Preview</h3>
                        {queue.length > 0 ? (
                            <div className="barcode-preview-label" style={{
                                width: `${labelWidth * 3}px`,
                                height: `${labelHeight * 3}px`,
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                overflow: 'hidden'
                            }}>
                                <LabelContent item={queue[0]} />
                            </div>
                        ) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Add labels to see preview</div>
                        )}
                        <span className="barcode-preview-hint">3:1 Scale Visualization</span>
                    </div>
                </div>
            </main>

            {/* Hidden Print Container - Positioned Off-Screen with Unconstrained Height */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
                <div ref={componentRef} style={{ width: `${PAPER_WIDTH_MM}mm` }}>
                    {rows.map((row, rowIdx) => (
                        <div key={rowIdx} className="print-row" style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: `${PAPER_WIDTH_MM}mm`,
                            height: `${labelHeight}mm`,
                            padding: '0 1.5mm',
                            boxSizing: 'border-box'
                        }}>
                            {row.map((item, colIdx) => (
                                <div key={colIdx} style={{
                                    width: `${labelWidth}mm`,
                                    height: `${labelHeight}mm`,
                                    background: 'white',
                                    overflow: 'hidden',
                                    boxSizing: 'border-box'
                                }}>
                                    <LabelContent item={item} />
                                </div>
                            ))}
                            {row.length === 1 && <div style={{ width: `${labelWidth}mm` }} />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BarcodeGenerator;
