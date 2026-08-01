import React from 'react';
import { Sliders, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Eye, Layers, Info } from 'lucide-react';

const InspectorSidebar = ({
    preset,
    onUpdatePreset,
    selectedElement,
    onUpdateElement
}) => {
    if (!selectedElement) {
        // Label & Page Settings Inspector
        const layout = preset.page_layout || {};

        return (
            <aside className="designer-right-sidebar">
                <div className="inspector-section">
                    <div className="inspector-title">
                        <Sliders size={16} className="text-primary" />
                        <span>Label & Paper Settings</span>
                    </div>

                    <div className="prop-group">
                        <label>Preset Name</label>
                        <input
                            type="text"
                            className="prop-input"
                            value={preset.name || ''}
                            onChange={(e) => onUpdatePreset({ name: e.target.value })}
                        />
                    </div>

                    <div className="prop-group">
                        <label>Category</label>
                        <select
                            className="prop-input"
                            value={preset.category || 'Product Barcode'}
                            onChange={(e) => onUpdatePreset({ category: e.target.value })}
                        >
                            <option value="Product Barcode">Product Barcode</option>
                            <option value="Jewellery">Jewellery Tag</option>
                            <option value="Price Tag">Price Tag</option>
                            <option value="Shelf Label">Shelf Label</option>
                            <option value="QR Labels">QR Label</option>
                            <option value="Shipping Label">Shipping Label</option>
                            <option value="Fashion & Apparel">Fashion Tag</option>
                            <option value="Pharmacy">Pharmacy</option>
                            <option value="Electronics">Electronics</option>
                            <option value="A4 Sheets">A4 Sheet Label</option>
                            <option value="Thermal 1-Up">Thermal Single (1-Up)</option>
                            <option value="Thermal 2-Up (TSC)">Thermal 2-Up (TSC 83mm)</option>
                        </select>
                    </div>

                    <div className="prop-group">
                        <label>Paper Type</label>
                        <select
                            className="prop-input"
                            value={preset.paper_type || 'thermal'}
                            onChange={(e) => onUpdatePreset({ paper_type: e.target.value })}
                        >
                            <option value="thermal">Thermal Roll</option>
                            <option value="sheet">A4 Sticker Sheet</option>
                        </select>
                    </div>

                    <div className="prop-row">
                        <div className="prop-group">
                            <label>Width (mm)</label>
                            <input
                                type="number"
                                step="0.5"
                                className="prop-input"
                                value={preset.label_width || 50}
                                onChange={(e) => onUpdatePreset({ label_width: parseFloat(e.target.value) || 10 })}
                            />
                        </div>
                        <div className="prop-group">
                            <label>Height (mm)</label>
                            <input
                                type="number"
                                step="0.5"
                                className="prop-input"
                                value={preset.label_height || 25}
                                onChange={(e) => onUpdatePreset({ label_height: parseFloat(e.target.value) || 10 })}
                            />
                        </div>
                    </div>
                </div>

                {/* Thermal Roll Multi-Up Settings */}
                {preset.paper_type === 'thermal' && (
                    <div className="inspector-section">
                        <div className="inspector-title">
                            <Layers size={14} className="text-primary" />
                            <span>Stickers Per Row (Roll Layout)</span>
                        </div>

                        <div className="prop-group">
                            <label>Roll Format / Multi-Up</label>
                            <select
                                className="prop-input"
                                value={layout.mode || (layout.cols === 2 ? '2up' : layout.cols === 3 ? '3up' : '1up')}
                                onChange={(e) => {
                                    const mode = e.target.value;
                                    let cols = 1;
                                    let gapH = layout.gapH || 0;
                                    let marginLeft = layout.marginLeft || 0;
                                    let marginRight = layout.marginRight || 0;

                                    if (mode === '2up') {
                                        cols = 2;
                                        if (!gapH) gapH = 3;
                                        if (!marginLeft) marginLeft = 2.5;
                                        if (!marginRight) marginRight = 2.5;
                                    } else if (mode === '3up') {
                                        cols = 3;
                                        if (!gapH) gapH = 2.5;
                                        if (!marginLeft) marginLeft = 2;
                                        if (!marginRight) marginRight = 2;
                                    } else if (mode === '4up') {
                                        cols = 4;
                                        if (!gapH) gapH = 2;
                                        if (!marginLeft) marginLeft = 1.5;
                                        if (!marginRight) marginRight = 1.5;
                                    }

                                    onUpdatePreset({
                                        page_layout: { ...layout, mode, cols, gapH, marginLeft, marginRight }
                                    });
                                }}
                            >
                                <option value="1up">1-Up — Single sticker per row</option>
                                <option value="2up">2-Up — 2 stickers per row (TSC 83mm)</option>
                                <option value="3up">3-Up — 3 stickers per row (105mm)</option>
                                <option value="4up">4-Up — 4 stickers per row (120mm)</option>
                            </select>
                        </div>

                        {(layout.cols > 1 || layout.mode === '2up' || layout.mode === '3up' || layout.mode === '4up') && (
                            <>
                                <div className="prop-row">
                                    <div className="prop-group">
                                        <label>Gap Between (mm)</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            className="prop-input"
                                            value={layout.gapH ?? 3}
                                            onChange={(e) => onUpdatePreset({ page_layout: { ...layout, gapH: parseFloat(e.target.value) || 0 } })}
                                        />
                                    </div>
                                    <div className="prop-group">
                                        <label>Side Margin (mm)</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            className="prop-input"
                                            value={layout.marginLeft ?? 2.5}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                onUpdatePreset({ page_layout: { ...layout, marginLeft: val, marginRight: val } });
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* 2nd Sticker Fine Alignment Section */}
                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        🎯 2nd Sticker Fine Alignment
                                    </div>

                                    <div className="prop-group" style={{ marginBottom: '0.5rem' }}>
                                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>2nd Sticker X Offset</span>
                                            <span style={{ color: (layout.col2OffsetX || 0) < 0 ? '#f87171' : (layout.col2OffsetX || 0) > 0 ? '#4ade80' : '#94a3b8', fontWeight: 700 }}>
                                                {(layout.col2OffsetX || 0) > 0 ? `+${layout.col2OffsetX}` : (layout.col2OffsetX || 0)} mm
                                            </span>
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <input
                                                type="range"
                                                min="-10"
                                                max="10"
                                                step="0.2"
                                                style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                                                value={layout.col2OffsetX || 0}
                                                onChange={(e) => onUpdatePreset({ page_layout: { ...layout, col2OffsetX: parseFloat(e.target.value) || 0 } })}
                                            />
                                            <input
                                                type="number"
                                                step="0.2"
                                                className="prop-input"
                                                style={{ width: '65px', textAlign: 'center' }}
                                                value={layout.col2OffsetX || 0}
                                                onChange={(e) => onUpdatePreset({ page_layout: { ...layout, col2OffsetX: parseFloat(e.target.value) || 0 } })}
                                            />
                                        </div>
                                    </div>

                                    <div className="prop-group">
                                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>2nd Sticker Y Offset</span>
                                            <span style={{ color: (layout.col2OffsetY || 0) < 0 ? '#f87171' : (layout.col2OffsetY || 0) > 0 ? '#4ade80' : '#94a3b8', fontWeight: 700 }}>
                                                {(layout.col2OffsetY || 0) > 0 ? `+${layout.col2OffsetY}` : (layout.col2OffsetY || 0)} mm
                                            </span>
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <input
                                                type="range"
                                                min="-10"
                                                max="10"
                                                step="0.2"
                                                style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                                                value={layout.col2OffsetY || 0}
                                                onChange={(e) => onUpdatePreset({ page_layout: { ...layout, col2OffsetY: parseFloat(e.target.value) || 0 } })}
                                            />
                                            <input
                                                type="number"
                                                step="0.2"
                                                className="prop-input"
                                                style={{ width: '65px', textAlign: 'center' }}
                                                value={layout.col2OffsetY || 0}
                                                onChange={(e) => onUpdatePreset({ page_layout: { ...layout, col2OffsetY: parseFloat(e.target.value) || 0 } })}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.3 }}>
                                        Adjusts 2nd sticker position independently without affecting 1st sticker.
                                    </div>
                                </div>

                                <div className="inspector-info-box" style={{ marginTop: '0.75rem' }}>
                                    <div className="info-title">📏 Calculated Roll Width</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f1f5f9', margin: '3px 0' }}>
                                        {((layout.cols || 2) * (preset.label_width || 38)) + (((layout.cols || 2) - 1) * (layout.gapH || 3)) + (layout.marginLeft || 2.5) + (layout.marginRight || 2.5)} mm
                                    </div>
                                    <div style={{ color: '#7dd3fc' }}>Set this as your printer driver paper width.</div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Sheet Layout Settings if Sheet */}
                {preset.paper_type === 'sheet' && (
                    <div className="inspector-section">
                        <div className="inspector-title">
                            <Layers size={16} className="text-primary" />
                            <span>A4 Grid Layout</span>
                        </div>

                        <div className="prop-row">
                            <div className="prop-group">
                                <label>Columns</label>
                                <input
                                    type="number"
                                    className="prop-input"
                                    value={layout.cols || 3}
                                    onChange={(e) => onUpdatePreset({ page_layout: { ...layout, cols: parseInt(e.target.value) || 1 } })}
                                />
                            </div>
                            <div className="prop-group">
                                <label>Rows</label>
                                <input
                                    type="number"
                                    className="prop-input"
                                    value={layout.rows || 8}
                                    onChange={(e) => onUpdatePreset({ page_layout: { ...layout, rows: parseInt(e.target.value) || 1 } })}
                                />
                            </div>
                        </div>

                        <div className="prop-row">
                            <div className="prop-group">
                                <label>Top Margin (mm)</label>
                                <input
                                    type="number"
                                    className="prop-input"
                                    value={layout.marginTop || 10}
                                    onChange={(e) => onUpdatePreset({ page_layout: { ...layout, marginTop: parseFloat(e.target.value) || 0 } })}
                                />
                            </div>
                            <div className="prop-group">
                                <label>Left Margin (mm)</label>
                                <input
                                    type="number"
                                    className="prop-input"
                                    value={layout.marginLeft || 10}
                                    onChange={(e) => onUpdatePreset({ page_layout: { ...layout, marginLeft: parseFloat(e.target.value) || 0 } })}
                                />
                            </div>
                        </div>

                        <div className="prop-row">
                            <div className="prop-group">
                                <label>Gap Horiz (mm)</label>
                                <input
                                    type="number"
                                    className="prop-input"
                                    value={layout.gapH || 2}
                                    onChange={(e) => onUpdatePreset({ page_layout: { ...layout, gapH: parseFloat(e.target.value) || 0 } })}
                                />
                            </div>
                            <div className="prop-group">
                                <label>Gap Vert (mm)</label>
                                <input
                                    type="number"
                                    className="prop-input"
                                    value={layout.gapV || 0}
                                    onChange={(e) => onUpdatePreset({ page_layout: { ...layout, gapV: parseFloat(e.target.value) || 0 } })}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </aside>
        );
    }

    // Selected Element Inspector
    return (
        <aside className="designer-right-sidebar">
            {/* Position & Size */}
            <div className="inspector-section">
                <div className="inspector-title">
                    <Sliders size={16} className="text-primary" />
                    <span>Position & Size (mm)</span>
                </div>

                <div className="prop-row">
                    <div className="prop-group">
                        <label>X (mm)</label>
                        <input
                            type="number"
                            step="0.5"
                            className="prop-input"
                            value={selectedElement.x || 0}
                            onChange={(e) => onUpdateElement(selectedElement.id, { x: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                    <div className="prop-group">
                        <label>Y (mm)</label>
                        <input
                            type="number"
                            step="0.5"
                            className="prop-input"
                            value={selectedElement.y || 0}
                            onChange={(e) => onUpdateElement(selectedElement.id, { y: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                </div>

                <div className="prop-row">
                    <div className="prop-group">
                        <label>Width (mm)</label>
                        <input
                            type="number"
                            step="0.5"
                            className="prop-input"
                            value={selectedElement.width || 10}
                            onChange={(e) => onUpdateElement(selectedElement.id, { width: parseFloat(e.target.value) || 1 })}
                        />
                    </div>
                    <div className="prop-group">
                        <label>Height (mm)</label>
                        <input
                            type="number"
                            step="0.5"
                            className="prop-input"
                            value={selectedElement.height || 10}
                            onChange={(e) => onUpdateElement(selectedElement.id, { height: parseFloat(e.target.value) || 1 })}
                        />
                    </div>
                </div>

                <div className="prop-group">
                    <label>Rotation (degrees)</label>
                    <input
                        type="number"
                        className="prop-input"
                        value={selectedElement.rotation || 0}
                        onChange={(e) => onUpdateElement(selectedElement.id, { rotation: parseInt(e.target.value) || 0 })}
                    />
                </div>

                <div className="prop-group" style={{ marginTop: '0.75rem' }}>
                    <label>Quick Alignment / Center Layer</label>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ flex: 1, fontSize: '0.725rem', padding: '0.35rem 0.2rem' }}
                            onClick={() => {
                                const labelW = preset.label_width || 50;
                                const elW = selectedElement.width || 10;
                                const newX = Math.max(0, Math.round(((labelW - elW) / 2) * 10) / 10);
                                onUpdateElement(selectedElement.id, { x: newX });
                            }}
                            title="Center Horizontally on Label"
                        >
                            ↔ Center X
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ flex: 1, fontSize: '0.725rem', padding: '0.35rem 0.2rem' }}
                            onClick={() => {
                                const labelH = preset.label_height || 25;
                                const elH = selectedElement.height || 10;
                                const newY = Math.max(0, Math.round(((labelH - elH) / 2) * 10) / 10);
                                onUpdateElement(selectedElement.id, { y: newY });
                            }}
                            title="Center Vertically on Label"
                        >
                            ↕ Center Y
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ flex: 1, fontSize: '0.725rem', padding: '0.35rem 0.2rem', background: 'rgba(59, 130, 246, 0.2)', borderColor: 'var(--primary)', color: '#60a5fa' }}
                            onClick={() => {
                                const labelW = preset.label_width || 50;
                                const labelH = preset.label_height || 25;
                                const elW = selectedElement.width || 10;
                                const elH = selectedElement.height || 10;
                                const newX = Math.max(0, Math.round(((labelW - elW) / 2) * 10) / 10);
                                const newY = Math.max(0, Math.round(((labelH - elH) / 2) * 10) / 10);
                                onUpdateElement(selectedElement.id, { x: newX, y: newY });
                            }}
                            title="Center Layer Completely on Label"
                        >
                            🎯 Center Both
                        </button>
                    </div>
                </div>
            </div>

            {/* Text Inspector */}
            {selectedElement.type === 'text' && (
                <div className="inspector-section">
                    <div className="inspector-title">Typography & Thermal Density</div>

                    <div className="prop-group">
                        <label>Content / Placeholders</label>
                        <textarea
                            rows={2}
                            className="prop-input"
                            value={selectedElement.text || ''}
                            onChange={(e) => onUpdateElement(selectedElement.id, { text: e.target.value })}
                        />
                    </div>

                    <div className="prop-row">
                        <div className="prop-group">
                            <label>Font Size (pt)</label>
                            <input
                                type="number"
                                className="prop-input"
                                value={selectedElement.fontSize || 9}
                                onChange={(e) => onUpdateElement(selectedElement.id, { fontSize: parseInt(e.target.value) || 6 })}
                            />
                        </div>
                        <div className="prop-group">
                            <label>Font Weight / Thickness</label>
                            <select
                                className="prop-input"
                                value={selectedElement.fontWeight || 'bold'}
                                onChange={(e) => onUpdateElement(selectedElement.id, { fontWeight: e.target.value })}
                            >
                                <option value="normal">Normal (400)</option>
                                <option value="500">Medium (500)</option>
                                <option value="600">SemiBold (600)</option>
                                <option value="bold">Bold (700 - Recommended for Thermal)</option>
                                <option value="800">Extra Bold (800)</option>
                                <option value="900">Black / Heavy (900 - Darkest)</option>
                            </select>
                        </div>
                    </div>

                    <div className="prop-row">
                        <div className="prop-group">
                            <label>Text Color</label>
                            <input
                                type="color"
                                className="prop-input"
                                style={{ padding: '2px', height: '32px' }}
                                value={selectedElement.color || '#000000'}
                                onChange={(e) => onUpdateElement(selectedElement.id, { color: e.target.value })}
                            />
                        </div>

                        <div className="format-btn-group" style={{ alignSelf: 'flex-end', marginBottom: '2px' }}>
                            <button
                                type="button"
                                className={`format-btn ${selectedElement.fontWeight === 'bold' || selectedElement.fontWeight === '700' || selectedElement.fontWeight === '800' || selectedElement.fontWeight === '900' ? 'active' : ''}`}
                                onClick={() => onUpdateElement(selectedElement.id, { fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                title="Toggle Bold"
                            >
                                <Bold size={16} />
                            </button>
                            <button
                                type="button"
                                className={`format-btn ${selectedElement.fontStyle === 'italic' ? 'active' : ''}`}
                                onClick={() => onUpdateElement(selectedElement.id, { fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                title="Toggle Italic"
                            >
                                <Italic size={16} />
                            </button>
                            <button
                                type="button"
                                className={`format-btn ${selectedElement.textDecoration === 'underline' ? 'active' : ''}`}
                                onClick={() => onUpdateElement(selectedElement.id, { textDecoration: selectedElement.textDecoration === 'underline' ? 'none' : 'underline' })}
                                title="Toggle Underline"
                            >
                                <Underline size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="prop-group">
                        <label>Text Alignment</label>
                        <div className="format-btn-group" style={{ width: '100%' }}>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                className={`format-btn ${selectedElement.align === 'left' ? 'active' : ''}`}
                                onClick={() => onUpdateElement(selectedElement.id, { align: 'left' })}
                            >
                                <AlignLeft size={16} /> Left
                            </button>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                className={`format-btn ${selectedElement.align === 'center' ? 'active' : ''}`}
                                onClick={() => onUpdateElement(selectedElement.id, { align: 'center' })}
                            >
                                <AlignCenter size={16} /> Center
                            </button>
                            <button
                                type="button"
                                style={{ flex: 1 }}
                                className={`format-btn ${selectedElement.align === 'right' ? 'active' : ''}`}
                                onClick={() => onUpdateElement(selectedElement.id, { align: 'right' })}
                            >
                                <AlignRight size={16} /> Right
                            </button>
                        </div>
                    </div>

                    {/* Border & Dynamic Auto-Fit Section */}
                    <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="inspector-title" style={{ fontSize: '0.85rem' }}>Dynamic Text Box & Border</div>

                        <div className="prop-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: '0.5rem 0' }}>
                            <label style={{ margin: 0, cursor: 'pointer' }}>Auto-Fit Width to Text</label>
                            <input
                                type="checkbox"
                                checked={selectedElement.autoWidth === true}
                                onChange={(e) => onUpdateElement(selectedElement.id, { autoWidth: e.target.checked })}
                            />
                        </div>

                        <div className="prop-row">
                            <div className="prop-group">
                                <label>Border Width (px)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="10"
                                    className="prop-input"
                                    value={selectedElement.borderWidth || 0}
                                    onChange={(e) => onUpdateElement(selectedElement.id, { borderWidth: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="prop-group">
                                <label>Border Color</label>
                                <input
                                    type="color"
                                    className="prop-input"
                                    style={{ padding: '2px', height: '32px' }}
                                    value={selectedElement.borderColor || '#000000'}
                                    onChange={(e) => onUpdateElement(selectedElement.id, { borderColor: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="prop-row">
                            <div className="prop-group">
                                <label>Box Padding (mm)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    className="prop-input"
                                    value={selectedElement.padding || 0}
                                    onChange={(e) => onUpdateElement(selectedElement.id, { padding: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="prop-group">
                                <label>Corner Radius (px)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="prop-input"
                                    value={selectedElement.borderRadius || 0}
                                    onChange={(e) => onUpdateElement(selectedElement.id, { borderRadius: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Barcode Inspector */}
            {(selectedElement.type === 'barcode' || selectedElement.type === 'qrcode') && (
                <div className="inspector-section">
                    <div className="inspector-title">Barcode Properties</div>

                    <div className="prop-group">
                        <label>Value / Placeholder</label>
                        <input
                            type="text"
                            className="prop-input"
                            value={selectedElement.text || ''}
                            onChange={(e) => onUpdateElement(selectedElement.id, { text: e.target.value })}
                        />
                    </div>

                    {selectedElement.type === 'barcode' && (
                        <>
                            <div className="prop-group">
                                <label>Barcode Format</label>
                                <select
                                    className="prop-input"
                                    value={selectedElement.format || 'CODE128'}
                                    onChange={(e) => onUpdateElement(selectedElement.id, { format: e.target.value })}
                                >
                                    <option value="CODE128">Code 128</option>
                                    <option value="CODE39">Code 39</option>
                                    <option value="EAN13">EAN-13</option>
                                    <option value="EAN8">EAN-8</option>
                                    <option value="UPCA">UPC-A</option>
                                    <option value="UPCE">UPC-E</option>
                                    <option value="ITF">ITF</option>
                                    <option value="CODABAR">Codabar</option>
                                    <option value="MSI">MSI</option>
                                </select>
                            </div>

                            <div className="prop-group" style={{ marginTop: '0.5rem' }}>
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>Barcode Bar Height</span>
                                    <span style={{ color: '#60a5fa', fontWeight: 700 }}>{selectedElement.barHeight || 12} mm</span>
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    <input
                                        type="range"
                                        min="4"
                                        max="50"
                                        step="1"
                                        style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                                        value={selectedElement.barHeight || 12}
                                        onChange={(e) => onUpdateElement(selectedElement.id, { barHeight: parseInt(e.target.value) || 12 })}
                                    />
                                    <input
                                        type="number"
                                        min="4"
                                        max="50"
                                        className="prop-input"
                                        style={{ width: '60px', textAlign: 'center' }}
                                        value={selectedElement.barHeight || 12}
                                        onChange={(e) => onUpdateElement(selectedElement.id, { barHeight: parseInt(e.target.value) || 12 })}
                                    />
                                </div>
                            </div>

                            <div className="prop-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: '0.75rem 0 0.5rem 0' }}>
                                <label style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }}>Show Human Text</label>
                                <input
                                    type="checkbox"
                                    checked={selectedElement.showText !== false}
                                    onChange={(e) => onUpdateElement(selectedElement.id, { showText: e.target.checked })}
                                />
                            </div>

                            {selectedElement.showText !== false && (
                                <>
                                    <div className="prop-group" style={{ marginTop: '0.5rem' }}>
                                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>Human Text Size</span>
                                            <span style={{ color: '#60a5fa', fontWeight: 700 }}>{selectedElement.textSize || 10} pt</span>
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <input
                                                type="range"
                                                min="4"
                                                max="30"
                                                step="1"
                                                style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                                                value={selectedElement.textSize || 10}
                                                onChange={(e) => onUpdateElement(selectedElement.id, { textSize: parseInt(e.target.value) || 10 })}
                                            />
                                            <input
                                                type="number"
                                                min="4"
                                                max="30"
                                                className="prop-input"
                                                style={{ width: '60px', textAlign: 'center' }}
                                                value={selectedElement.textSize || 10}
                                                onChange={(e) => onUpdateElement(selectedElement.id, { textSize: parseInt(e.target.value) || 10 })}
                                            />
                                        </div>
                                    </div>

                                    <div className="prop-row" style={{ marginTop: '0.5rem' }}>
                                        <div className="prop-group">
                                            <label>Human Text Font</label>
                                            <select
                                                className="prop-input"
                                                value={selectedElement.textFont || 'OCR-B'}
                                                onChange={(e) => onUpdateElement(selectedElement.id, { textFont: e.target.value })}
                                            >
                                                <option value="OCR-B">OCR-B (Standard Crisp Barcode Font)</option>
                                                <option value="Helvetica">Helvetica (Clean Bold Sans)</option>
                                                <option value="Courier">Courier (Monospace Crisp)</option>
                                                <option value="Inconsolata">Inconsolata (Mono)</option>
                                                <option value="Arial">Arial (Sans-serif)</option>
                                            </select>
                                        </div>
                                        <div className="prop-group">
                                            <label>Text Color</label>
                                            <input
                                                type="color"
                                                className="prop-input"
                                                style={{ padding: '2px', height: '32px' }}
                                                value={selectedElement.color || '#000000'}
                                                onChange={(e) => onUpdateElement(selectedElement.id, { color: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="prop-group" style={{ marginTop: '0.5rem' }}>
                                        <label>Human Text Weight / Density</label>
                                        <select
                                            className="prop-input"
                                            value={selectedElement.textWeight || 'bold'}
                                            onChange={(e) => onUpdateElement(selectedElement.id, { textWeight: e.target.value })}
                                        >
                                            <option value="normal">Normal (400)</option>
                                            <option value="medium">Medium (500)</option>
                                            <option value="semibold">SemiBold (600)</option>
                                            <option value="bold">Bold (700 — Crisp Thermal Recommended)</option>
                                            <option value="extrabold">Extra Bold (800 — Heavy Dark)</option>
                                            <option value="black">Black / Ultra Dark (900)</option>
                                        </select>
                                    </div>

                                    <div className="prop-group" style={{ marginTop: '0.5rem' }}>
                                        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>Gap Between Barcode & Text</span>
                                            <span style={{ color: '#60a5fa', fontWeight: 700 }}>{selectedElement.textMargin ?? 2} pt</span>
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <input
                                                type="range"
                                                min="0"
                                                max="30"
                                                step="1"
                                                style={{ flex: 1, accentColor: 'var(--primary)', cursor: 'pointer' }}
                                                value={selectedElement.textMargin ?? 2}
                                                onChange={(e) => onUpdateElement(selectedElement.id, { textMargin: parseInt(e.target.value) || 0 })}
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                max="30"
                                                className="prop-input"
                                                style={{ width: '60px', textAlign: 'center' }}
                                                value={selectedElement.textMargin ?? 2}
                                                onChange={(e) => onUpdateElement(selectedElement.id, { textMargin: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Conditional Visibility */}
            <div className="inspector-section">
                <div className="inspector-title">
                    <Eye size={16} className="text-primary" />
                    <span>Visibility Rule</span>
                </div>

                <div className="prop-group">
                    <select
                        className="prop-input"
                        value={selectedElement.visibility || 'always'}
                        onChange={(e) => onUpdateElement(selectedElement.id, { visibility: e.target.value })}
                    >
                        <option value="always">Always Visible</option>
                        <option value="hide_if_empty">Hide if Empty / Blank</option>
                        <option value="hide_if_zero">Hide if Zero (0 / 0.00)</option>
                    </select>
                </div>
            </div>
        </aside>
    );
};

export default InspectorSidebar;
