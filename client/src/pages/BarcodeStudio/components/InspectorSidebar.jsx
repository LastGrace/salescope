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

                                <div className="inspector-info-box">
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
            </div>

            {/* Text Inspector */}
            {selectedElement.type === 'text' && (
                <div className="inspector-section">
                    <div className="inspector-title">Typography</div>

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
                            <label>Color</label>
                            <input
                                type="color"
                                className="prop-input"
                                style={{ padding: '2px', height: '32px' }}
                                value={selectedElement.color || '#000000'}
                                onChange={(e) => onUpdateElement(selectedElement.id, { color: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="prop-row">
                        <div className="format-btn-group">
                            <button
                                type="button"
                                className={`format-btn ${selectedElement.fontWeight === 'bold' ? 'active' : ''}`}
                                onClick={() => onUpdateElement(selectedElement.id, { fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold' })}
                            >
                                <Bold size={16} />
                            </button>
                            <button
                                type="button"
                                className={`format-btn ${selectedElement.fontStyle === 'italic' ? 'active' : ''}`}
                                onClick={() => onUpdateElement(selectedElement.id, { fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic' })}
                            >
                                <Italic size={16} />
                            </button>
                            <button
                                type="button"
                                className={`format-btn ${selectedElement.textDecoration === 'underline' ? 'active' : ''}`}
                                onClick={() => onUpdateElement(selectedElement.id, { textDecoration: selectedElement.textDecoration === 'underline' ? 'none' : 'underline' })}
                            >
                                <Underline size={16} />
                            </button>
                        </div>

                        <div className="format-btn-group">
                            <button
                                type="button"
                                className={`format-btn ${selectedElement.align === 'left' ? 'active' : ''}`}
                                onClick={() => onUpdateElement(selectedElement.id, { align: 'left' })}
                            >
                                <AlignLeft size={16} />
                            </button>
                            <button
                                type="button"
                                className={`format-btn ${selectedElement.align === 'center' ? 'active' : ''}`}
                                onClick={() => onUpdateElement(selectedElement.id, { align: 'center' })}
                            >
                                <AlignCenter size={16} />
                            </button>
                            <button
                                type="button"
                                className={`format-btn ${selectedElement.align === 'right' ? 'active' : ''}`}
                                onClick={() => onUpdateElement(selectedElement.id, { align: 'right' })}
                            >
                                <AlignRight size={16} />
                            </button>
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

                            <div className="prop-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <label>Show Human Text</label>
                                <input
                                    type="checkbox"
                                    checked={selectedElement.showText !== false}
                                    onChange={(e) => onUpdateElement(selectedElement.id, { showText: e.target.checked })}
                                />
                            </div>
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
