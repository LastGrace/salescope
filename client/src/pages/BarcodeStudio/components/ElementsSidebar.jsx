import React, { useState, useRef } from 'react';
import {
    Type, Barcode, QrCode, Square, Circle, Image, Layers, Tag, Plus,
    Lock, Unlock, Trash2, ArrowUp, ArrowDown, GripVertical, Eye, EyeOff,
    ChevronDown, ChevronRight, Copy
} from 'lucide-react';

const ELEMENT_TYPE_ICONS = {
    text: Type,
    barcode: Barcode,
    qrcode: QrCode,
    rectangle: Square,
    circle: Circle,
    image: Image,
};

const ELEMENT_TYPE_LABELS = {
    text: 'Text',
    barcode: '1D Barcode',
    qrcode: 'QR Code',
    rectangle: 'Rectangle',
    circle: 'Circle',
    image: 'Image/Logo',
};

const ELEMENT_TYPE_COLORS = {
    text: '#60a5fa',
    barcode: '#34d399',
    qrcode: '#a78bfa',
    rectangle: '#fb923c',
    circle: '#f472b6',
    image: '#facc15',
};

const placeholdersList = [
    { group: 'Product', items: [
        { label: 'Product Name', key: '{{product_name}}' },
        { label: 'SKU / Code', key: '{{sku}}' },
        { label: 'Brand Name', key: '{{brand}}' },
        { label: 'Category', key: '{{category}}' },
        { label: 'Weight', key: '{{weight}}' },
    ]},
    { group: 'Pricing', items: [
        { label: 'Selling Price', key: '{{selling_price}}' },
        { label: 'MRP', key: '{{mrp}}' },
        { label: 'Cost Price', key: '{{cost_price}}' },
    ]},
    { group: 'Barcode', items: [
        { label: 'Barcode Value', key: '{{barcode}}' },
        { label: 'Serial Number', key: '{{serial_number}}' },
    ]},
    { group: 'Expiry / Batch', items: [
        { label: 'Batch No.', key: '{{batch}}' },
        { label: 'Expiry Date', key: '{{expiry}}' },
        { label: 'HSN Code', key: '{{hsn}}' },
    ]},
    { group: 'Store', items: [
        { label: 'Shop Name', key: '{{shop_name}}' },
        { label: 'Current Date', key: '{{date}}' },
    ]},
];

const ElementsSidebar = ({
    elements,
    selectedId,
    setSelectedId,
    onAddElement,
    onAddPlaceholder,
    onMoveLayer,
    onToggleLock,
    onDeleteElement,
    onReorderElements,
}) => {
    const [activeTab, setActiveTab] = useState('elements');
    const [expandedGroups, setExpandedGroups] = useState({ Product: true, Pricing: true, Barcode: true });
    const [dragOverId, setDragOverId] = useState(null);
    const dragSrcId = useRef(null);

    const toggleGroup = (group) => setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));

    // Drag-and-drop for layer reordering
    const handleDragStart = (e, id) => {
        dragSrcId.current = id;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, id) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverId(id);
    };

    const handleDrop = (e, targetId) => {
        e.preventDefault();
        if (dragSrcId.current && targetId && dragSrcId.current !== targetId) {
            const list = [...elements];
            const fromIdx = list.findIndex(el => el.id === dragSrcId.current);
            const toIdx = list.findIndex(el => el.id === targetId);
            if (fromIdx !== -1 && toIdx !== -1) {
                const [moved] = list.splice(fromIdx, 1);
                list.splice(toIdx, 0, moved);
                if (onReorderElements) onReorderElements(list);
            }
        }
        dragSrcId.current = null;
        setDragOverId(null);
    };

    const handleDragEnd = () => {
        dragSrcId.current = null;
        setDragOverId(null);
    };

    return (
        <aside className="designer-left-sidebar">
            {/* Tab Headers */}
            <div className="sidebar-tab-header">
                <button
                    type="button"
                    className={`sidebar-tab-btn ${activeTab === 'elements' ? 'active' : ''}`}
                    onClick={() => setActiveTab('elements')}
                    title="Add Elements"
                >
                    <Plus size={14} /> Elements
                </button>
                <button
                    type="button"
                    className={`sidebar-tab-btn ${activeTab === 'placeholders' ? 'active' : ''}`}
                    onClick={() => setActiveTab('placeholders')}
                    title="Insert Data Fields"
                >
                    <Tag size={14} /> Fields
                </button>
                <button
                    type="button"
                    className={`sidebar-tab-btn ${activeTab === 'layers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('layers')}
                    title="Manage Layers"
                >
                    <Layers size={14} /> Layers
                    {elements.length > 0 && (
                        <span style={{ background: 'var(--primary, #3b82f6)', color: '#fff', borderRadius: '10px', padding: '0 5px', fontSize: '0.65rem', fontWeight: 700, marginLeft: 2 }}>
                            {elements.length}
                        </span>
                    )}
                </button>
            </div>

            <div className="sidebar-tab-content">
                {/* ── Elements Tab ────────────────────────────────── */}
                {activeTab === 'elements' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                Add Element
                            </div>
                            <div className="element-add-grid">
                                {Object.entries(ELEMENT_TYPE_LABELS).map(([type, label]) => {
                                    const Icon = ELEMENT_TYPE_ICONS[type];
                                    const color = ELEMENT_TYPE_COLORS[type];
                                    return (
                                        <div
                                            key={type}
                                            className="element-add-card"
                                            onClick={() => onAddElement(type)}
                                            title={`Add ${label}`}
                                        >
                                            <Icon size={20} style={{ color }} />
                                            <span style={{ color: '#cbd5e1' }}>{label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '0.65rem 0.75rem' }}>
                            <div style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: 700, marginBottom: '0.4rem' }}>💡 Quick Tips</div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.5 }}>
                                • Click element to select<br />
                                • Drag to move on canvas<br />
                                • Arrow keys for fine-tune<br />
                                • Switch to <strong style={{ color: '#f1f5f9' }}>Fields</strong> tab to insert dynamic data
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Placeholders Tab ─────────────────────────────── */}
                {activeTab === 'placeholders' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                            Click a field to insert it as a text element. Data is filled at print time.
                        </div>
                        {placeholdersList.map(({ group, items }) => (
                            <div key={group}>
                                <button
                                    type="button"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                                        fontSize: '0.7rem', fontWeight: 700, color: '#64748b',
                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                        padding: '0.4rem 0.25rem', marginTop: '0.35rem'
                                    }}
                                    onClick={() => toggleGroup(group)}
                                >
                                    {expandedGroups[group] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    {group}
                                </button>
                                {expandedGroups[group] && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.25rem' }}>
                                        {items.map(p => (
                                            <div
                                                key={p.key}
                                                className="placeholder-chip"
                                                onClick={() => onAddPlaceholder(p.key)}
                                                title={`Insert ${p.key}`}
                                            >
                                                <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{p.label}</span>
                                                <code style={{ fontSize: '0.65rem', color: '#60a5fa', fontFamily: 'monospace' }}>{p.key}</code>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Layers Tab ────────────────────────────────────── */}
                {activeTab === 'layers' && (
                    <div>
                        {elements.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#475569' }}>
                                <Layers size={28} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>No elements yet</div>
                                <div style={{ fontSize: '0.72rem', marginTop: 4, color: '#475569' }}>Switch to Elements tab to add items</div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                    Drag <GripVertical size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> handle to reorder layers. Top = front.
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    {[...elements].reverse().map((el, idx) => {
                                        const Icon = ELEMENT_TYPE_ICONS[el.type] || Type;
                                        const color = ELEMENT_TYPE_COLORS[el.type] || '#60a5fa';
                                        const isDragOver = dragOverId === el.id;
                                        const isSelected = selectedId === el.id;

                                        return (
                                            <div
                                                key={el.id}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, el.id)}
                                                onDragOver={(e) => handleDragOver(e, el.id)}
                                                onDrop={(e) => handleDrop(e, el.id)}
                                                onDragEnd={handleDragEnd}
                                                className={`layer-list-item ${isSelected ? 'selected' : ''}`}
                                                style={{
                                                    borderColor: isDragOver ? '#60a5fa' : undefined,
                                                    background: isDragOver ? 'rgba(96,165,250,0.15)' : undefined,
                                                    cursor: 'pointer',
                                                    borderLeft: isSelected ? `3px solid ${color}` : undefined,
                                                }}
                                                onClick={() => setSelectedId(el.id)}
                                            >
                                                {/* Drag handle */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                                                    <GripVertical
                                                        size={13}
                                                        style={{ color: '#475569', cursor: 'grab', flexShrink: 0 }}
                                                        onClick={e => e.stopPropagation()}
                                                    />
                                                    <Icon size={13} style={{ color, flexShrink: 0 }} />
                                                    <span style={{
                                                        fontSize: '0.78rem',
                                                        fontWeight: isSelected ? 700 : 500,
                                                        color: isSelected ? '#f1f5f9' : '#cbd5e1',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        minWidth: 0,
                                                    }}>
                                                        {el.type === 'text' ? (el.text?.replace(/\{\{|\}\}/g, '') || 'Text') : ELEMENT_TYPE_LABELS[el.type] || el.type}
                                                    </span>
                                                    {el.locked && <Lock size={11} style={{ color: '#ef4444', flexShrink: 0 }} />}
                                                </div>

                                                {/* Action Buttons */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0 }}>
                                                    <button
                                                        type="button"
                                                        className="btn-icon"
                                                        style={{ padding: '3px', opacity: 0.7 }}
                                                        onClick={(e) => { e.stopPropagation(); onMoveLayer(el.id, 'up'); }}
                                                        title="Bring Forward"
                                                    >
                                                        <ArrowUp size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-icon"
                                                        style={{ padding: '3px', opacity: 0.7 }}
                                                        onClick={(e) => { e.stopPropagation(); onMoveLayer(el.id, 'down'); }}
                                                        title="Send Backward"
                                                    >
                                                        <ArrowDown size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-icon"
                                                        style={{ padding: '3px', opacity: 0.7 }}
                                                        onClick={(e) => { e.stopPropagation(); onToggleLock(el.id); }}
                                                        title={el.locked ? 'Unlock' : 'Lock'}
                                                    >
                                                        {el.locked ? <Lock size={12} style={{ color: '#ef4444' }} /> : <Unlock size={12} />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-icon"
                                                        style={{ padding: '3px', color: '#ef4444', opacity: 0.8 }}
                                                        onClick={(e) => { e.stopPropagation(); onDeleteElement(el.id); }}
                                                        title="Delete Element"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
};

export default ElementsSidebar;
