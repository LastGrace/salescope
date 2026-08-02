import React from 'react';
import { Save, Copy, Undo, Redo, ZoomIn, ZoomOut, Grid, Eye, Printer, Download, Sparkles, SlidersHorizontal } from 'lucide-react';

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
    onOpenPrinterProfilesModal
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
