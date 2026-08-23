import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Printer, Scan, Search, Trash2, X, Layers, ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BUILTIN_TEMPLATES } from './BarcodeStudio/components/PresetManagerModal';
import { isElementVisible } from './BarcodeStudio/utils/barcodeRenderer';
import { getPrintPageStyle, getCalculatedRollWidth } from './BarcodeStudio/utils/printEngine';
import LabelElementRenderer from './BarcodeStudio/components/LabelElementRenderer';
import { useTheme } from '../context/ThemeContext';
import './BarcodeStudio/styles/BarcodeStudio.css';
import useSessionState from '../hooks/useSessionState';

const BarcodePrinter = () => {
    const { currentTheme } = useTheme();

    // Store Info State
    const [storeInfo, setStoreInfo] = useState({ store_name: '' });

    // Presets & Layout State
    const [presets, setPresets] = useState([]);
    const [selectedPresetId, setSelectedPresetId] = useSessionState('bp_selectedPresetId', '');
    const [activePreset, setActivePreset] = useSessionState('bp_activePreset', BUILTIN_TEMPLATES[0]);
    const [loadingPresets, setLoadingPresets] = useState(true);
    const [panelWidth, setPanelWidth] = useSessionState('bp_panelWidth', 480);

    // Catalog & Queue State
    const [products, setProducts] = useState([]);
    const [barcodeScanInput, setBarcodeScanInput] = useState('');
    const [nameSearchInput, setNameSearchInput] = useState('');
    const [queue, setQueue] = useSessionState('bp_queue', []);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);

    // Refs
    const scanInputRef = useRef(null);
    const searchContainerRef = useRef(null);
    const printContainerRef = useRef(null);

    // 1. Fetch Presets
    useEffect(() => {
        const fetchPresets = async () => {
            try {
                const res = await axios.get('/api/barcode/presets');
                const data = Array.isArray(res.data) ? res.data : [];
                setPresets(data);
                
                setActivePreset(prev => {
                    if (prev && prev.id && prev.id !== BUILTIN_TEMPLATES[0].id) return prev;
                    const defaultPreset = data.find(p => p.is_default) || data[0];
                    if (defaultPreset) setSelectedPresetId(defaultPreset.id);
                    return defaultPreset || BUILTIN_TEMPLATES[0];
                });
                
            } catch (err) {
                console.error('Failed to load presets:', err);
                // Fallback handled by session state
            } finally {
                setLoadingPresets(false);
            }
        };
        fetchPresets();
    }, []);

    // 2. Fetch Products Catalog
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                let data = [];
                try {
                    const res = await axios.get('/api/barcode/batch-products?limit=9999999');
                    data = Array.isArray(res.data) ? res.data : (res.data?.products || []);
                } catch {
                    const res = await axios.get('/api/products?limit=9999999');
                    data = Array.isArray(res.data) ? res.data : (res.data?.products || []);
                }
                setProducts(data);
            } catch (err) {
                console.error('Failed to load products:', err);
                toast.error('Could not load product catalog');
            }
        };
        fetchProducts();
    }, []);

    // 3. Fetch Store Info
    useEffect(() => {
        const fetchStoreInfo = async () => {
            try {
                const res = await axios.get('/api/settings/store');
                if (res.data) setStoreInfo(res.data);
            } catch (err) {
                console.error('Failed to load store info:', err);
            }
        };
        fetchStoreInfo();
    }, []);

    // Auto-focus barcode scanner input on mount
    useEffect(() => {
        if (scanInputRef.current) {
            scanInputRef.current.focus();
        }
    }, []);

    // Close search dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setShowSearchDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Combine all available presets for dropdown selection
    const allPresetsList = [
        ...presets.map(p => ({ ...p, isSaved: true })),
        ...BUILTIN_TEMPLATES.map(b => ({ ...b, isSaved: false }))
    ];

    // Preset Selection Change
    const handlePresetChange = (presetId) => {
        setSelectedPresetId(presetId);
        const found = allPresetsList.find(p => String(p.id) === String(presetId));
        if (found) {
            setActivePreset(found);
        }
    };

    // Add Product to Queue
    const addProductToQueue = (product) => {
        if (!product) return;
        setQueue(prevQueue => {
            const existingIdx = prevQueue.findIndex(item => item.id === product.id);
            if (existingIdx >= 0) {
                const updated = [...prevQueue];
                const currentQty = parseInt(updated[existingIdx].printQty) || 1;
                updated[existingIdx] = {
                    ...updated[existingIdx],
                    printQty: currentQty + 1
                };
                toast.success(`Updated quantity for "${product.name}" (${currentQty + 1})`);
                return updated;
            }
            toast.success(`Added "${product.name}" to queue`);
            return [
                ...prevQueue,
                {
                    ...product,
                    printQty: 1
                }
            ];
        });
    };

    // Handle Barcode Scan / Enter
    const handleBarcodeScan = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const inputValue = e.target.value || '';
            const term = inputValue.trim().toLowerCase();
            if (!term) return;

            const matched = products.find(p =>
                (p.barcode && p.barcode.trim().toLowerCase() === term) ||
                (p.sku && p.sku.trim().toLowerCase() === term) ||
                (p.name && p.name.trim().toLowerCase() === term)
            ) || products.find(p => p.name && p.name.toLowerCase().includes(term));

            if (matched) {
                addProductToQueue(matched);
                setBarcodeScanInput('');
            } else {
                toast.error(`No product found for barcode: "${inputValue}"`);
            }
        }
    };

    // Update Quantity in Queue (Allows clearing field while typing)
    const updateItemQty = (productId, newQty) => {
        if (newQty === '') {
            setQueue(prev => prev.map(item => item.id === productId ? { ...item, printQty: '' } : item));
            return;
        }
        const parsed = parseInt(newQty, 10);
        const qty = isNaN(parsed) ? '' : Math.max(1, parsed);
        setQueue(prev => prev.map(item => item.id === productId ? { ...item, printQty: qty } : item));
    };

    // Ensure Quantity is valid >= 1 when leaving input field
    const handleQtyBlur = (productId, currentVal) => {
        const qty = Math.max(1, parseInt(currentVal, 10) || 1);
        setQueue(prev => prev.map(item => item.id === productId ? { ...item, printQty: qty } : item));
    };

    // Remove Item from Queue
    const removeItem = (productId) => {
        setQueue(prev => prev.filter(item => item.id !== productId));
        toast('Item removed', { icon: '🗑️' });
    };

    // Clear Queue
    const handleClearQueue = () => {
        if (queue.length === 0) return;
        setQueue([]);
        toast.success('Queue cleared');
    };

    // Filter Search Products
    const filteredSearchProducts = products.filter(p => {
        if (!nameSearchInput.trim()) return false;
        const q = nameSearchInput.toLowerCase();
        return (
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.sku && p.sku.toLowerCase().includes(q)) ||
            (p.barcode && p.barcode.toLowerCase().includes(q)) ||
            (p.category && p.category.toLowerCase().includes(q))
        );
    }).slice(0, 10);

    const totalLabelsCount = queue.reduce((sum, item) => sum + (parseInt(item.printQty) || 0), 0);

    // Renderer & Layout Constants
    const isSheet = activePreset.paper_type === 'sheet';
    const labelW = activePreset.label_width || 50;
    const labelH = activePreset.label_height || 25;
    const layout = activePreset.page_layout || {};
    const cols = layout.cols || (isSheet ? 3 : 1);
    const rows = isSheet ? (layout.rows || 8) : 1;
    const labelsPerPage = cols * rows;
    const MM_TO_PX = 3.7795;
    const totalRollW = getCalculatedRollWidth(activePreset);

    const sampleItem = { name: 'Sample Product', barcode: '12345678', mrp: '999', selling_price: '799', sku: 'SKU-001', category: 'General' };

    // Items to render in real-time preview: queue items (expanded by printQty) or fallback sample item
    const itemsToRender = queue.length > 0
        ? queue.flatMap(item => Array(Math.max(1, parseInt(item.printQty) || 1)).fill(item))
        : [sampleItem];

    // Group items into pages / roll units
    const pages = [];
    for (let i = 0; i < itemsToRender.length; i += labelsPerPage) {
        pages.push(itemsToRender.slice(i, i + labelsPerPage));
    }

    // Direct Instant Print Execution
    const handlePrintNow = () => {
        if (queue.length === 0) {
            toast.error('Please add products to the print queue first');
            return;
        }
        if (!printContainerRef.current) return;

        // 1. Clean up existing mount if present
        let printMount = document.getElementById('barcode-print-mount');
        if (printMount) {
            printMount.remove();
        }

        // 2. Create isolated root print container
        printMount = document.createElement('div');
        printMount.id = 'barcode-print-mount';
        printMount.innerHTML = printContainerRef.current.innerHTML;
        document.body.appendChild(printMount);

        // 3. Inject print CSS
        const styleText = getPrintPageStyle(activePreset, { dpi: 203 });
        let styleEl = document.getElementById('barcode-print-style');
        if (styleEl) styleEl.remove();
        styleEl = document.createElement('style');
        styleEl.id = 'barcode-print-style';
        styleEl.type = 'text/css';
        styleEl.appendChild(document.createTextNode(styleText));
        document.head.appendChild(styleEl);

        // 4. Trigger browser print
        window.print();

        // 5. Clean up temporary mount and styles
        setTimeout(() => {
            if (printMount && printMount.parentNode) {
                printMount.parentNode.removeChild(printMount);
            }
            if (styleEl && styleEl.parentNode) {
                styleEl.parentNode.removeChild(styleEl);
            }
        }, 1000);
    };

    return (
        <div style={{
            background: 'var(--bg-main, #0f172a)',
            color: 'var(--text-main, #f8fafc)',
            minHeight: 'calc(100vh - 40px)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            boxSizing: 'border-box',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* ── HEADER ── */}
            <div style={{
                background: 'var(--bg-card, #1e293b)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '12px',
                padding: '0.85rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main, #f8fafc)' }}>
                        Barcode Printer
                    </h1>
                    {queue.length > 0 && (
                        <span style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            border: '1px solid rgba(59, 130, 246, 0.3)'
                        }}>
                            {queue.length} Products ({totalLabelsCount} Labels)
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                        type="button"
                        className="btn"
                        onClick={handleClearQueue}
                        disabled={queue.length === 0}
                        style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            background: queue.length === 0 ? 'var(--bg-card)' : 'rgba(239, 68, 68, 0.15)',
                            color: queue.length === 0 ? 'var(--text-muted)' : '#f87171',
                            border: queue.length === 0 ? '1px solid var(--border)' : '1px solid rgba(239, 68, 68, 0.3)',
                            cursor: queue.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: queue.length === 0 ? 0.6 : 1
                        }}
                    >
                        <Trash2 size={16} style={{ marginRight: 6 }} /> Clear Queue
                    </button>

                    {/* DIRECT PRINT BUTTON */}
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handlePrintNow}
                        disabled={queue.length === 0}
                        style={{
                            padding: '0.55rem 1.35rem',
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            background: queue.length === 0 ? 'var(--bg-card)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: queue.length === 0 ? '1px solid var(--border-color, #334155)' : '1px solid #10b981',
                            color: queue.length === 0 ? 'var(--text-muted)' : '#ffffff',
                            cursor: queue.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: queue.length === 0 ? 0.6 : 1,
                            boxShadow: queue.length === 0 ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.35)'
                        }}
                    >
                        <Printer size={18} style={{ marginRight: 6 }} /> Print Barcodes ({totalLabelsCount})
                    </button>
                </div>
            </div>

            {/* ── MAIN BODY ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: `1fr ${panelWidth}px`,
                gap: '1.25rem',
                flex: 1,
                minHeight: 0
            }}>
                {/* LEFT SECTION: Inputs & Queue Table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
                    {/* Horizontal Inputs Row */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {/* 1. Product Name Search */}
                        <div ref={searchContainerRef} style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.35rem', position: 'relative' }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Product Name Search
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #64748b)' }} />
                                <input
                                    type="text"
                                    className="prop-input"
                                    style={{
                                        width: '100%',
                                        paddingLeft: '2.5rem',
                                        paddingRight: '2rem',
                                        height: '42px',
                                        fontSize: '0.9rem',
                                        background: 'var(--bg-card, #1e293b)',
                                        border: '1px solid var(--border-color, #334155)',
                                        color: 'var(--text-main, #f8fafc)',
                                        borderRadius: '8px',
                                        boxSizing: 'border-box'
                                    }}
                                    placeholder="Type product name or SKU..."
                                    value={nameSearchInput}
                                    onChange={(e) => {
                                        setNameSearchInput(e.target.value);
                                        setShowSearchDropdown(true);
                                    }}
                                    onFocus={() => setShowSearchDropdown(true)}
                                />
                                {nameSearchInput && (
                                    <button
                                        type="button"
                                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer' }}
                                        onClick={() => {
                                            setNameSearchInput('');
                                            setShowSearchDropdown(false);
                                        }}
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Dropdown */}
                            {showSearchDropdown && nameSearchInput && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: '4px',
                                    background: 'var(--bg-card, #1e293b)',
                                    border: '1px solid var(--border-color, #334155)',
                                    borderRadius: '8px',
                                    maxHeight: '240px',
                                    overflowY: 'auto',
                                    zIndex: 50,
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                                }}>
                                    {filteredSearchProducts.length === 0 ? (
                                        <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', textAlign: 'center' }}>
                                            No products found
                                        </div>
                                    ) : (
                                        filteredSearchProducts.map(p => (
                                            <div
                                                key={p.id}
                                                style={{
                                                    padding: '0.6rem 0.85rem',
                                                    borderBottom: '1px solid var(--border-color, #334155)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}
                                                onClick={() => {
                                                    addProductToQueue(p);
                                                    setNameSearchInput('');
                                                    setShowSearchDropdown(false);
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(59, 130, 246, 0.15))'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main, #f8fafc)' }}>
                                                        {p.name}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
                                                        Barcode: {p.barcode || 'N/A'} · MRP: ₹{p.mrp || p.selling_price || p.price || 0}
                                                    </div>
                                                </div>
                                                <button type="button" className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: 600 }}>
                                                    + Add
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 2. Barcode Scan */}
                        <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Barcode Scan
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Scan size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary, #3b82f6)' }} />
                                <input
                                    ref={scanInputRef}
                                    type="text"
                                    className="prop-input"
                                    style={{
                                        width: '100%',
                                        paddingLeft: '2.5rem',
                                        height: '42px',
                                        fontSize: '0.9rem',
                                        background: 'var(--bg-card, #1e293b)',
                                        border: '1px solid var(--border-color, #334155)',
                                        color: 'var(--text-main, #f8fafc)',
                                        borderRadius: '8px',
                                        boxSizing: 'border-box'
                                    }}
                                    placeholder="Scan barcode or press Enter..."
                                    value={barcodeScanInput}
                                    onChange={(e) => setBarcodeScanInput(e.target.value)}
                                    onKeyDown={handleBarcodeScan}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Queue Table */}
                    <div style={{
                        background: 'var(--bg-card, #1e293b)',
                        border: '1px solid var(--border-color, #334155)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {queue.length === 0 ? (
                            <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted, #64748b)', margin: 'auto' }}>
                                <Scan size={44} style={{ marginBottom: '0.75rem', opacity: 0.35 }} />
                                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main, #f8fafc)' }}>Queue is empty</div>
                                <div style={{ fontSize: '0.82rem', marginTop: 4, color: 'var(--text-muted, #94a3b8)' }}>
                                    Scan product barcode or search product name above to add to queue
                                </div>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto', flex: 1 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid var(--border-color, #334155)' }}>
                                            <th style={{ width: '22%', padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Barcode</th>
                                            <th style={{ width: '38%', padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Product Name</th>
                                            <th style={{ width: '15%', padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', textAlign: 'right' }}>MRP</th>
                                            <th style={{ width: '15%', padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', textAlign: 'center' }}>Print Quantity</th>
                                            <th style={{ width: '10%', padding: '0.85rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase', textAlign: 'center' }}>Delete</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {queue.map((item) => (
                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color, rgba(51, 65, 85, 0.5))' }}>
                                                <td style={{ padding: '0.85rem 1rem', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main, #f8fafc)' }}>
                                                    {item.barcode || item.sku || 'N/A'}
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-main, #f8fafc)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {item.name}
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: '#34d399', fontSize: '0.88rem' }}>
                                                    ₹{item.mrp || item.selling_price || item.price || 0}
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                        <button
                                                            type="button"
                                                            style={{
                                                                width: 30,
                                                                height: 30,
                                                                background: 'var(--primary, #3b82f6)',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                color: '#ffffff',
                                                                fontWeight: 800,
                                                                fontSize: '1rem',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                lineHeight: 1
                                                            }}
                                                            onClick={() => updateItemQty(item.id, (parseInt(item.printQty) || 1) - 1)}
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            style={{
                                                                width: '50px',
                                                                height: '30px',
                                                                textAlign: 'center',
                                                                padding: '0 4px',
                                                                fontSize: '0.9rem',
                                                                fontWeight: 700,
                                                                borderRadius: '6px',
                                                                background: 'var(--bg-main, #0f172a)',
                                                                border: '1px solid var(--border-color, #334155)',
                                                                color: 'var(--text-main, #f8fafc)',
                                                                boxSizing: 'border-box'
                                                            }}
                                                            value={item.printQty}
                                                            min="1"
                                                            onChange={(e) => updateItemQty(item.id, e.target.value)}
                                                            onBlur={(e) => handleQtyBlur(item.id, e.target.value)}
                                                        />
                                                        <button
                                                            type="button"
                                                            style={{
                                                                width: 30,
                                                                height: 30,
                                                                background: 'var(--primary, #3b82f6)',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                color: '#ffffff',
                                                                fontWeight: 800,
                                                                fontSize: '1rem',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                lineHeight: 1
                                                            }}
                                                            onClick={() => updateItemQty(item.id, (parseInt(item.printQty) || 1) + 1)}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                                    <button
                                                        type="button"
                                                        className="btn-icon"
                                                        style={{ color: '#ef4444', padding: '6px' }}
                                                        onClick={() => removeItem(item.id)}
                                                        title="Delete row"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT SIDE: Realtime Template-Based Print Preview Panel */}
                <div style={{
                    background: 'var(--bg-card, #1e293b)',
                    border: '1px solid var(--border-color, #334155)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    minWidth: 0
                }}>
                    {/* Header Controls */}
                    <div style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid var(--border-color, #334155)',
                        background: 'rgba(0, 0, 0, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Layers size={18} style={{ color: 'var(--primary, #3b82f6)' }} />
                            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main, #f8fafc)' }}>
                                Realtime Preview
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            {/* Panel Width Slider Control */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                background: 'var(--bg-main, #0f172a)',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color, #334155)'
                            }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #94a3b8)' }}>
                                    Panel Width:
                                </span>
                                <input
                                    type="range"
                                    min="320"
                                    max="900"
                                    step="10"
                                    value={panelWidth}
                                    onChange={(e) => setPanelWidth(Number(e.target.value))}
                                    style={{
                                        width: '85px',
                                        height: '4px',
                                        accentColor: 'var(--primary, #3b82f6)',
                                        cursor: 'pointer'
                                    }}
                                    title={`Panel Width: ${panelWidth}px`}
                                />
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#60a5fa', minWidth: '40px', textAlign: 'right' }}>
                                    {panelWidth}px
                                </span>
                                <button
                                    type="button"
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', cursor: 'pointer', padding: 0, display: 'flex' }}
                                    onClick={() => setPanelWidth(480)}
                                    title="Reset Panel Width to 480px"
                                >
                                    <RotateCcw size={12} />
                                </button>
                            </div>

                            {/* Template Dropdown Selector */}
                            <select
                                className="prop-input"
                                style={{
                                    width: 'auto',
                                    maxWidth: '220px',
                                    padding: '0.35rem 0.65rem',
                                    fontSize: '0.8rem',
                                    background: 'var(--bg-main, #0f172a)',
                                    borderColor: 'var(--primary, #3b82f6)',
                                    color: '#60a5fa',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                                value={selectedPresetId}
                                onChange={(e) => handlePresetChange(e.target.value)}
                            >
                                {allPresetsList.map(p => (
                                    <option key={p.id} value={p.id}>
                                        📋 {p.name} ({p.label_width}×{p.label_height}mm)
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Canvas Scrollable Container */}
                    <div className="custom-scrollbar" style={{
                        flex: 1,
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        background: '#090d16',
                        overflowY: 'auto',
                        maxHeight: 'calc(100vh - 200px)'
                    }}>
                        <div ref={printContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', width: '100%' }}>
                            {pages.map((pageItems, pageIdx) => (
                                <div
                                    key={pageIdx}
                                    className="print-page-unit"
                                    style={{
                                        width: isSheet ? '210mm' : `${totalRollW}mm`,
                                        height: isSheet ? '297mm' : `${labelH}mm`,
                                        background: '#ffffff',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                        paddingTop: `${layout.marginTop || (isSheet ? 10 : 0)}mm`,
                                        paddingLeft: `${layout.marginLeft || (isSheet ? 10 : 0)}mm`,
                                        paddingRight: `${layout.marginRight || 0}mm`,
                                        paddingBottom: `${layout.marginBottom || 0}mm`,
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: `${layout.gapV || 0}mm ${layout.gapH || 0}mm`,
                                        position: 'relative',
                                        borderRadius: '2px',
                                        margin: '0 auto'
                                    }}
                                >
                                    {pageItems.map((item, labelIdx) => {
                                        const productData = { product: item, store: storeInfo };
                                        const colIndex = labelIdx % cols;
                                        let extraX = 0;
                                        let extraY = 0;

                                        if (colIndex === 1) {
                                            extraX = layout.col2OffsetX || 0;
                                            extraY = layout.col2OffsetY || 0;
                                        } else if (colIndex === 2) {
                                            extraX = layout.col3OffsetX || 0;
                                            extraY = layout.col3OffsetY || 0;
                                        }

                                        return (
                                            <div
                                                key={labelIdx}
                                                style={{
                                                    width: `${labelW}mm`,
                                                    height: `${labelH}mm`,
                                                    position: 'relative',
                                                    left: extraX ? `${extraX}mm` : '0mm',
                                                    top: extraY ? `${extraY}mm` : '0mm',
                                                    background: '#ffffff',
                                                    borderRadius: activePreset.corner_radius ? `${activePreset.corner_radius}mm` : 0,
                                                    overflow: 'hidden',
                                                    boxSizing: 'border-box'
                                                }}
                                            >
                                                {(activePreset.canvas_data || []).map((el) => {
                                                    if (!isElementVisible(el, productData)) return null;
                                                    return (
                                                        <LabelElementRenderer
                                                            key={el.id}
                                                            element={el}
                                                            productData={productData}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BarcodePrinter;
