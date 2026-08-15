import React from 'react';
import { Save, Copy, Undo, Redo, ZoomIn, ZoomOut, Grid, Eye, Printer, Download, Sparkles, SlidersHorizontal } from 'lucide-react';

const SearchableProductSelect = ({ products, sampleProduct, setSampleProduct }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const wrapperRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = (products || []).filter(p => 
        (p.name && String(p.name).toLowerCase().includes(search.toLowerCase())) || 
        (p.barcode && String(p.barcode).includes(search))
    );

    return (
        <div ref={wrapperRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Preview:</span>
            <div style={{ position: 'relative', width: '180px' }}>
                <div 
                    onClick={() => setIsOpen(!isOpen)}
                    className="prop-input"
                    style={{
                        padding: '0.3rem 0.5rem',
                        fontSize: '0.8rem',
                        borderRadius: '6px',
                        background: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}
                >
                    {sampleProduct?.id === 'default' ? 'Sample Product' : sampleProduct?.name || 'Select Product'}
                </div>
                {isOpen && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        zIndex: 50,
                        maxHeight: '220px',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search name or barcode..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: 'none',
                                borderBottom: '1px solid var(--border-color)',
                                background: 'transparent',
                                color: 'var(--text-main)',
                                outline: 'none',
                                fontSize: '0.8rem'
                            }}
                        />
                        <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                            <div 
                                onClick={() => {
                                    setSampleProduct({
                                        id: 'default',
                                        name: 'MEN COTTON T-SHIRT',
                                        barcode: '8901234567890',
                                        sku: 'TSH-BLK-M',
                                        price: '499.00',
                                        mrp: '999.00',
                                        cost_price: '250.00',
                                        brand: 'URBAN STYLE',
                                        category: 'Apparel',
                                        weight: '0.2',
                                        batch: 'B2026-07',
                                        expiry: '12/2028',
                                        hsn: '61091000'
                                    });
                                    setIsOpen(false);
                                    setSearch('');
                                }}
                                style={{
                                    padding: '0.4rem 0.6rem',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    color: sampleProduct?.id === 'default' ? 'var(--primary)' : 'var(--text-muted)',
                                    borderBottom: '1px solid var(--border-color)'
                                }}
                                onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.target.style.background = 'transparent'}
                            >
                                Sample Product
                            </div>
                            {filtered.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => {
                                        setSampleProduct(p);
                                        setIsOpen(false);
                                        setSearch('');
                                    }}
                                    style={{
                                        padding: '0.4rem 0.6rem',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        color: sampleProduct?.id === p.id ? 'var(--primary)' : 'var(--text-main)',
                                        borderBottom: '1px solid var(--border-color)'
                                    }}
                                    onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={e => e.target.style.background = 'transparent'}
                                >
                                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                                    {p.barcode && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.barcode}</div>}
                                </div>
                            ))}
                            {filtered.length === 0 && (
                                <div style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                                    No results
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const DesignerToolbar = ({
    preset,
    onSave,
    onDuplicate,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    zoom,
    setZoom,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    onOpenPreview,
    onOpenPrintBatch,
    onExportImage,
    onExportPDF,
    onOpenPresetsModal,
    onOpenPrinterProfilesModal,
    products,
    sampleProduct,
    setSampleProduct
}) => {
    return (
        <div className="studio-top-bar">
            {/* Left: Brand & Preset info */}
            <div className="studio-brand">
                <div className="studio-brand-icon">
                    <Sparkles size={20} />
                </div>
                <div className="studio-title-text">
                    <h1>Barcode Studio</h1>
                    <p>{preset?.name || 'Untitled Preset'} ({preset?.label_width || 50} × {preset?.label_height || 25} mm)</p>
                </div>
            </div>

            {/* Middle Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={onOpenPresetsModal} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', background: 'rgba(59, 130, 246, 0.15)', borderColor: 'var(--primary)' }}>
                    <Sparkles size={14} style={{ marginRight: '4px', color: '#60a5fa' }} />
                    Template Library
                </button>
                <button type="button" className="btn btn-secondary" onClick={onOpenPrinterProfilesModal} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                    <SlidersHorizontal size={14} style={{ marginRight: '4px' }} />
                    Printers
                </button>

                <div style={{ height: '24px', width: '1px', background: '#334155' }} />

                {/* Undo / Redo */}
                <button type="button" className="canvas-tool-btn" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
                    <Undo size={16} />
                </button>
                <button type="button" className="canvas-tool-btn" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
                    <Redo size={16} />
                </button>

                <div style={{ height: '24px', width: '1px', background: '#334155' }} />

                {/* Zoom Controls */}
                <button type="button" className="canvas-tool-btn" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} title="Zoom Out">
                    <ZoomOut size={16} />
                </button>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>
                    {Math.round(zoom * 100)}%
                </span>
                <button type="button" className="canvas-tool-btn" onClick={() => setZoom(z => Math.min(3, z + 0.25))} title="Zoom In">
                    <ZoomIn size={16} />
                </button>

                <div style={{ height: '24px', width: '1px', background: '#334155' }} />

                {/* Grid & Snap */}
                <button type="button" className={`canvas-tool-btn ${showGrid ? 'active' : ''}`} onClick={() => setShowGrid(!showGrid)} title="Toggle Grid Lines">
                    <Grid size={16} />
                </button>

                <div style={{ height: '24px', width: '1px', background: '#334155', marginLeft: '0.5rem', marginRight: '0.5rem' }} />

                <SearchableProductSelect 
                    products={products}
                    sampleProduct={sampleProduct}
                    setSampleProduct={setSampleProduct}
                />
            </div>

            {/* Right Actions */}
            <div className="studio-top-actions">
                <button type="button" className="btn btn-secondary" onClick={onSave} style={{ fontSize: '0.825rem' }}>
                    <Save size={16} style={{ marginRight: '6px' }} />
                    Save Preset
                </button>
                <button type="button" className="btn btn-secondary" onClick={onOpenPreview} style={{ fontSize: '0.825rem' }}>
                    <Eye size={16} style={{ marginRight: '6px' }} />
                    Preview
                </button>
                <button type="button" className="btn btn-primary" onClick={onOpenPrintBatch} style={{ fontSize: '0.825rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                    <Printer size={16} style={{ marginRight: '6px' }} />
                    Print Batch
                </button>
            </div>
        </div>
    );
};

export default DesignerToolbar;
