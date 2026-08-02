import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Printer, Scan, Search, Trash2, X, Eye, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BUILTIN_TEMPLATES } from './BarcodeStudio/components/PresetManagerModal';
import LivePrintPreviewModal from './BarcodeStudio/components/LivePrintPreviewModal';
import { useTheme } from '../context/ThemeContext';
import './BarcodeStudio/styles/BarcodeStudio.css';

const BarcodePrinter = () => {
    const { currentTheme } = useTheme();

    // Presets State
    const [presets, setPresets] = useState([]);
    const [selectedPresetId, setSelectedPresetId] = useState('');
    const [activePreset, setActivePreset] = useState(BUILTIN_TEMPLATES[0]);
    const [loadingPresets, setLoadingPresets] = useState(true);

    // Catalog & Queue State
    const [products, setProducts] = useState([]);
    const [barcodeScanInput, setBarcodeScanInput] = useState('');
    const [nameSearchInput, setNameSearchInput] = useState('');
    const [queue, setQueue] = useState([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);

    // Popup Preview Modal State
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

    // Refs
    const scanInputRef = useRef(null);
    const searchContainerRef = useRef(null);

    // 1. Fetch Presets
    useEffect(() => {
        const fetchPresets = async () => {
            try {
                const res = await axios.get('/api/barcode/presets');
                const data = Array.isArray(res.data) ? res.data : [];
                setPresets(data);
                if (data.length > 0) {
                    const defaultPreset = data.find(p => p.is_default) || data[0];
                    setSelectedPresetId(defaultPreset.id);
                    setActivePreset(defaultPreset);
                } else {
                    setSelectedPresetId(BUILTIN_TEMPLATES[0].id);
                    setActivePreset(BUILTIN_TEMPLATES[0]);
                }
            } catch (err) {
                console.error('Failed to load presets:', err);
                setSelectedPresetId(BUILTIN_TEMPLATES[0].id);
                setActivePreset(BUILTIN_TEMPLATES[0]);
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
                    const res = await axios.get('/api/barcode/batch-products?limit=1000');
                    data = Array.isArray(res.data) ? res.data : (res.data?.products || []);
                } catch {
                    const res = await axios.get('/api/products?limit=1000');
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
            const term = barcodeScanInput.trim().toLowerCase();
            if (!term) return;

            const matched = products.find(p =>
                (p.barcode && p.barcode.toLowerCase() === term) ||
                (p.sku && p.sku.toLowerCase() === term) ||
                (p.name && p.name.toLowerCase() === term)
            ) || products.find(p => p.name && p.name.toLowerCase().includes(term));

            if (matched) {
                addProductToQueue(matched);
                setBarcodeScanInput('');
            } else {
                toast.error(`No product found for barcode: "${barcodeScanInput}"`);
            }
        }
    };

    // Update Quantity in Queue
    const updateItemQty = (productId, newQty) => {
        const qty = Math.max(1, parseInt(newQty) || 1);
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

    // Renderer Constants
    const labelW = activePreset.label_width || 50;
    const labelH = activePreset.label_height || 25;
    const MM_TO_PX = 3.7795;
    const sampleItem = queue[0] || { name: 'Sample Product', barcode: '12345678', mrp: '999', selling_price: '799', sku: 'SKU-001', category: 'General' };

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
                <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main, #f8fafc)' }}>
                    Barcode Printer
                </h1>

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

                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                            if (queue.length === 0) {
                                toast.error('Add at least one product to preview');
                                return;
                            }
                            setIsPreviewModalOpen(true);
                        }}
                        style={{
                            padding: '0.5rem 1.25rem',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            background: queue.length === 0 ? 'var(--bg-card)' : 'var(--primary)',
                            border: queue.length === 0 ? '1px solid var(--border)' : '1px solid var(--primary)',
                            color: queue.length === 0 ? 'var(--text-muted)' : '#ffffff',
                            cursor: queue.length === 0 ? 'not-allowed' : 'pointer',
                            opacity: queue.length === 0 ? 0.6 : 1
                        }}
                    >
                        <Eye size={16} style={{ marginRight: 6 }} /> Preview ({totalLabelsCount})
                    </button>
                </div>
            </div>

            {/* ── MAIN BODY ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 360px',
                gap: '1.25rem',
                flex: 1,
                minHeight: 0
            }}>
                {/* LEFT SECTION: Inputs & Queue Table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
                    {/* Horizontal Inputs Row */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {/* 1. Barcode Scan */}
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

                        {/* 2. Product Name Search */}
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

                {/* RIGHT SIDE: Quick Sticker Visual Preview (Single Label Preview) */}
                <div style={{
                    background: 'var(--bg-card, #1e293b)',
                    border: '1px solid var(--border-color, #334155)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        padding: '0.85rem 1rem',
                        borderBottom: '1px solid var(--border-color, #334155)',
                        background: 'rgba(0, 0, 0, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main, #f8fafc)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Layers size={16} style={{ color: 'var(--primary, #3b82f6)' }} />
                            Single Label Visual
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', fontWeight: 600 }}>
                            {activePreset.name} ({labelW}×{labelH}mm)
                        </span>
                    </div>

                    <div style={{
                        flex: 1,
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 0.25)'
                    }}>
                        {/* Single Sticker Card Rendering */}
                        <div style={{
                            width: `${labelW * MM_TO_PX}px`,
                            height: `${labelH * MM_TO_PX}px`,
                            position: 'relative',
                            background: '#ffffff',
                            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            border: '1px solid #cbd5e1'
                        }}>
                            {(activePreset.canvas_data || []).map((el, idx) => {
                                const val = el.text
                                    ? el.text
                                        .replace(/\{\{product_name\}\}/g, sampleItem.name || '')
                                        .replace(/\{\{barcode\}\}/g, sampleItem.barcode || sampleItem.sku || '')
                                        .replace(/\{\{mrp\}\}/g, sampleItem.mrp || sampleItem.selling_price || sampleItem.price || '')
                                        .replace(/\{\{selling_price\}\}/g, sampleItem.selling_price || sampleItem.price || sampleItem.mrp || '')
                                        .replace(/\{\{sku\}\}/g, sampleItem.sku || '')
                                        .replace(/\{\{brand\}\}/g, sampleItem.brand || '')
                                        .replace(/\{\{category\}\}/g, sampleItem.category || '')
                                        .replace(/\{\{shop_name\}\}/g, 'SALESCOPE POS')
                                    : '';

                                return (
                                    <div
                                        key={idx}
                                        style={{
                                            position: 'absolute',
                                            left: `${(el.x || 0) * MM_TO_PX}px`,
                                            top: `${(el.y || 0) * MM_TO_PX}px`,
                                            width: `${(el.width || 10) * MM_TO_PX}px`,
                                            height: `${(el.height || 5) * MM_TO_PX}px`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: el.align === 'center' ? 'center' : (el.align === 'right' ? 'flex-end' : 'flex-start'),
                                            fontSize: `${el.fontSize || 9}pt`,
                                            fontWeight: el.fontWeight || 'bold',
                                            color: el.color || '#000000',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            boxSizing: 'border-box'
                                        }}
                                    >
                                        {el.type === 'barcode' ? (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{ background: '#000', width: '90%', height: '70%', borderRadius: '1px' }} />
                                                {el.showText !== false && (
                                                    <span style={{ fontSize: '7pt', color: '#000', marginTop: '1px' }}>{sampleItem.barcode || sampleItem.sku || '12345678'}</span>
                                                )}
                                            </div>
                                        ) : (
                                            val
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)', marginTop: '1rem', textAlign: 'center' }}>
                            Quick sticker layout preview.<br />Click <strong>Preview</strong> in header for full print layout & template selection.
                        </div>
                    </div>
                </div>
            </div>

            {/* ── POPUP LIVE PRINT PREVIEW MODAL ── */}
            <LivePrintPreviewModal
                isOpen={isPreviewModalOpen}
                onClose={() => setIsPreviewModalOpen(false)}
                preset={activePreset}
                presets={allPresetsList}
                onSelectPreset={(p) => handlePresetChange(p.id)}
                printerProfile={{ dpi: 203 }}
                queue={queue}
                storeInfo={{ shop_name: 'SALESCOPE POS' }}
            />
        </div>
    );
};

export default BarcodePrinter;
