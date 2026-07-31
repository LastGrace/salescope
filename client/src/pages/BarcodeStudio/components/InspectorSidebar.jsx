import React from 'react';
import { Sliders, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline, Eye, Lock, Layers } from 'lucide-react';

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
                            <option value="Jewellery Label">Jewellery Label</option>
                            <option value="Price Tag">Price Tag</option>
                            <option value="Shelf Label">Shelf Label</option>
                            <option value="QR Label">QR Label</option>
                            <option value="Shipping Label">Shipping Label</option>
                            <option value="Fashion Tag">Fashion Tag</option>
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
