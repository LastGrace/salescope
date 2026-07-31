import React, { useState } from 'react';
import { Type, Barcode, QrCode, Square, Circle, Image, Layers, Tag, Plus, Lock, Unlock, Eye, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

const ElementsSidebar = ({
    elements,
    selectedId,
    setSelectedId,
    onAddElement,
    onAddPlaceholder,
    onMoveLayer,
    onToggleLock,
    onDeleteElement
}) => {
    const [activeTab, setActiveTab] = useState('elements');

    const placeholdersList = [
        { label: 'Product Name', key: '{{product_name}}' },
        { label: 'Barcode', key: '{{barcode}}' },
        { label: 'SKU / Code', key: '{{sku}}' },
        { label: 'Selling Price', key: '{{selling_price}}' },
        { label: 'MRP', key: '{{mrp}}' },
        { label: 'Cost Price', key: '{{cost_price}}' },
        { label: 'Brand Name', key: '{{brand}}' },
        { label: 'Category', key: '{{category}}' },
        { label: 'Weight (g/kg)', key: '{{weight}}' },
        { label: 'Batch No.', key: '{{batch}}' },
        { label: 'Expiry Date', key: '{{expiry}}' },
        { label: 'Company / Shop', key: '{{shop_name}}' },
        { label: 'Serial Number', key: '{{serial_number}}' },
        { label: 'Current Date', key: '{{date}}' }
    ];

    return (
        <aside className="designer-left-sidebar">
            <div className="sidebar-tab-header">
                <button
                    type="button"
                    className={`sidebar-tab-btn ${activeTab === 'elements' ? 'active' : ''}`}
                    onClick={() => setActiveTab('elements')}
                >
                    <Plus size={16} /> Elements
                </button>
                <button
                    type="button"
                    className={`sidebar-tab-btn ${activeTab === 'placeholders' ? 'active' : ''}`}
                    onClick={() => setActiveTab('placeholders')}
                >
                    <Tag size={16} /> Fields
                </button>
                <button
                    type="button"
                    className={`sidebar-tab-btn ${activeTab === 'layers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('layers')}
                >
                    <Layers size={16} /> Layers ({elements.length})
                </button>
            </div>

            <div className="sidebar-tab-content">
                {activeTab === 'elements' && (
                    <div className="element-add-grid">
                        <div className="element-add-card" onClick={() => onAddElement('text')}>
                            <Type size={22} className="text-primary" />
                            <span>Text</span>
                        </div>
                        <div className="element-add-card" onClick={() => onAddElement('barcode')}>
                            <Barcode size={22} className="text-primary" />
                            <span>1D Barcode</span>
                        </div>
                        <div className="element-add-card" onClick={() => onAddElement('qrcode')}>
                            <QrCode size={22} className="text-primary" />
                            <span>2D / QR Code</span>
                        </div>
                        <div className="element-add-card" onClick={() => onAddElement('rectangle')}>
                            <Square size={22} className="text-primary" />
                            <span>Rectangle</span>
                        </div>
                        <div className="element-add-card" onClick={() => onAddElement('circle')}>
                            <Circle size={22} className="text-primary" />
                            <span>Circle</span>
                        </div>
                        <div className="element-add-card" onClick={() => onAddElement('image')}>
                            <Image size={22} className="text-primary" />
                            <span>Image / Logo</span>
                        </div>
                    </div>
                )}

                {activeTab === 'placeholders' && (
                    <div className="placeholder-list">
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                            Click field to insert dynamic data placeholder:
                        </p>
                        {placeholdersList.map((p) => (
                            <div
                                key={p.key}
                                className="placeholder-chip"
                                onClick={() => onAddPlaceholder(p.key)}
                            >
                                <span>{p.label}</span>
                                <code style={{ fontSize: '0.7rem', opacity: 0.7 }}>{p.key}</code>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'layers' && (
                    <div>
                        {elements.length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
                                No elements added yet.
                            </p>
                        ) : (
                            elements.map((el, idx) => (
                                <div
                                    key={el.id}
                                    className={`layer-list-item ${selectedId === el.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedId(el.id)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                        <span style={{ fontWeight: 700, opacity: 0.6, fontSize: '0.75rem' }}>#{elements.length - idx}</span>
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {el.type === 'text' ? (el.text || 'Text') : el.type.toUpperCase()}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={(e) => { e.stopPropagation(); onToggleLock(el.id); }}
                                            title={el.locked ? 'Unlock' : 'Lock'}
                                        >
                                            {el.locked ? <Lock size={14} className="text-danger" /> : <Unlock size={14} style={{ opacity: 0.5 }} />}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={(e) => { e.stopPropagation(); onMoveLayer(el.id, 'up'); }}
                                            title="Move Up"
                                        >
                                            <ArrowUp size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={(e) => { e.stopPropagation(); onMoveLayer(el.id, 'down'); }}
                                            title="Move Down"
                                        >
                                            <ArrowDown size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={(e) => { e.stopPropagation(); onDeleteElement(el.id); }}
                                            title="Delete"
                                            style={{ color: '#ef4444' }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
};

export default ElementsSidebar;
