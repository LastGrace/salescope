import React, { useState } from 'react';
import { X, Star, Check, Copy, Trash2, Download, Upload, Sparkles, Printer, Layers } from 'lucide-react';
import toast from 'react-hot-toast';

const PresetManagerModal = ({
    isOpen,
    onClose,
    presets,
    activePresetId,
    onSelectPreset,
    onDuplicatePreset,
    onSetDefaultPreset,
    onToggleFavorite,
    onDeletePreset,
    onImportPreset
}) => {
    const [selectedCategoryTab, setSelectedCategoryTab] = useState('ALL');
    const [search, setSearch] = useState('');
    const [importJsonText, setImportJsonText] = useState('');
    const [showImportForm, setShowImportForm] = useState(false);

    if (!isOpen) return null;

    const categories = [
        { id: 'ALL', label: 'All Templates' },
        { id: 'Thermal 2-Up (TSC)', label: 'TSC 83mm Dual (2-Up)' },
        { id: 'Thermal 1-Up', label: 'Thermal Single (1-Up)' },
        { id: 'Jewellery', label: 'Jewellery Tags' },
        { id: 'A4 Sheets', label: 'A4 Sticker Sheets' }
    ];

    const filtered = presets.filter(p => {
        const matchesCat = selectedCategoryTab === 'ALL' || (p.category && p.category === selectedCategoryTab);
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.category && p.category.toLowerCase().includes(search.toLowerCase()));
        return matchesCat && matchesSearch;
    });

    const handleExport = (preset) => {
        const jsonStr = JSON.stringify(preset, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${preset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_preset.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${preset.name}`);
    };

    const handleImportSubmit = (e) => {
        e.preventDefault();
        try {
            const parsed = JSON.parse(importJsonText);
            if (!parsed.name || !parsed.canvas_data) {
                toast.error('Invalid preset JSON data');
                return;
            }
            onImportPreset(parsed);
            setShowImportForm(false);
            setImportJsonText('');
            toast.success('Preset imported!');
        } catch (err) {
            toast.error('JSON parsing error');
        }
    };

    return (
        <div className="studio-modal-overlay">
            <div className="studio-modal-card" style={{ maxWidth: '920px' }}>
                <div className="studio-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sparkles size={22} className="text-primary" />
                        <div>
                            <h3 style={{ margin: 0 }}>Barcode Label Template Library</h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Prebuilt templates for TSC, Zebra, TVS thermal roll printers & A4 sticker sheets
                            </span>
                        </div>
                    </div>
                    <button type="button" className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="studio-modal-body">
                    {/* Category Tabs & Search Bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                            <div className="studio-nav-tabs">
                                {categories.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        className={`studio-tab-btn ${selectedCategoryTab === c.id ? 'active' : ''}`}
                                        onClick={() => setSelectedCategoryTab(c.id)}
                                    >
                                        {c.label}
                                    </button>
                                ))}
                            </div>

                            <button type="button" className="btn btn-secondary" onClick={() => setShowImportForm(!showImportForm)} style={{ fontSize: '0.8rem' }}>
                                <Upload size={14} style={{ marginRight: '6px' }} />
                                Import JSON
                            </button>
                        </div>

                        <input
                            type="text"
                            className="prop-input"
                            style={{ width: '100%' }}
                            placeholder="Search prebuilt templates by printer name or label format..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {showImportForm && (
                        <form onSubmit={handleImportSubmit} style={{ background: 'rgba(15,23,42,0.6)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #334155' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Paste Custom Preset JSON</h4>
                            <textarea
                                rows={4}
                                className="prop-input"
                                placeholder='{"name": "Custom Tag", "canvas_data": [...] }'
                                value={importJsonText}
                                onChange={(e) => setImportJsonText(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowImportForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Import Template</button>
                            </div>
                        </form>
                    )}

                    {/* Presets Grid */}
                    <div className="custom-scrollbar" style={{ maxHeight: '440px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
                        {filtered.map(p => {
                            const isActive = p.id === activePresetId;
                            const isDualRow = p.category === 'Thermal 2-Up (TSC)';

                            return (
                                <div
                                    key={p.id}
                                    style={{
                                        background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.5)',
                                        border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-color)'}`,
                                        borderRadius: '10px',
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        gap: '0.75rem',
                                        position: 'relative'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3 }}>{p.name}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '6px' }}>
                                                    <span style={{ fontSize: '0.7rem', background: isDualRow ? 'rgba(59, 130, 246, 0.2)' : 'rgba(148, 163, 184, 0.1)', color: isDualRow ? '#60a5fa' : '#cbd5e1', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                                        {p.category || 'General'}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        {p.label_width} × {p.label_height} mm
                                                    </span>
                                                </div>
                                            </div>

                                            <button type="button" className="btn-icon" onClick={() => onToggleFavorite(p.id)}>
                                                <Star size={16} fill={p.is_favorite ? '#f59e0b' : 'none'} color={p.is_favorite ? '#f59e0b' : '#94a3b8'} />
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(51, 65, 85, 0.5)' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                            {p.is_default ? (
                                                <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px' }}>DEFAULT</span>
                                            ) : (
                                                <button type="button" className="btn-icon" onClick={() => onSetDefaultPreset(p.id)} title="Set Default">
                                                    <Check size={14} />
                                                </button>
                                            )}
                                            <button type="button" className="btn-icon" onClick={() => onDuplicatePreset(p.id)} title="Duplicate">
                                                <Copy size={14} />
                                            </button>
                                            <button type="button" className="btn-icon" onClick={() => handleExport(p)} title="Export JSON">
                                                <Download size={14} />
                                            </button>
                                            {!p.is_default && (
                                                <button type="button" className="btn-icon" onClick={() => onDeletePreset(p.id)} style={{ color: '#ef4444' }} title="Delete">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                                            onClick={() => {
                                                onSelectPreset(p);
                                                onClose();
                                                toast.success(`Loaded template: ${p.name}`);
                                            }}
                                        >
                                            {isActive ? 'Active Template' : 'Load Template'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PresetManagerModal;
