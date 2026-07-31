import React, { useState } from 'react';
import { X, Star, Check, Copy, Trash2, Download, Upload, Plus, FileJson, Sparkles } from 'lucide-react';
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
    const [search, setSearch] = useState('');
    const [importJsonText, setImportJsonText] = useState('');
    const [showImportForm, setShowImportForm] = useState(false);

    if (!isOpen) return null;

    const filtered = presets.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.category && p.category.toLowerCase().includes(search.toLowerCase())));

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
            <div className="studio-modal-card" style={{ maxWidth: '850px' }}>
                <div className="studio-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sparkles size={20} className="text-primary" />
                        <h3>Barcode Label Presets Library</h3>
                    </div>
                    <button type="button" className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="studio-modal-body">
                    {/* Search & Actions */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', justifyContent: 'space-between' }}>
                        <input
                            type="text"
                            className="prop-input"
                            style={{ flex: 1, maxWidth: '400px' }}
                            placeholder="Search presets by name or category..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button type="button" className="btn btn-secondary" onClick={() => setShowImportForm(!showImportForm)}>
                            <Upload size={16} style={{ marginRight: '6px' }} />
                            Import Preset JSON
                        </button>
                    </div>

                    {showImportForm && (
                        <form onSubmit={handleImportSubmit} style={{ background: 'rgba(15,23,42,0.6)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #334155' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Paste Preset JSON Payload</h4>
                            <textarea
                                rows={4}
                                className="prop-input"
                                placeholder='{"name": "Custom Tag", "canvas_data": [...] }'
                                value={importJsonText}
                                onChange={(e) => setImportJsonText(e.target.value)}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowImportForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Import Now</button>
                            </div>
                        </form>
                    )}

                    {/* Presets Grid */}
                    <div className="custom-scrollbar" style={{ maxHeight: '420px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                        {filtered.map(p => {
                            const isActive = p.id === activePresetId;

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
                                        gap: '0.75rem'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.name}</span>
                                            <button type="button" className="btn-icon" onClick={() => onToggleFavorite(p.id)}>
                                                <Star size={16} fill={p.is_favorite ? '#f59e0b' : 'none'} color={p.is_favorite ? '#f59e0b' : '#94a3b8'} />
                                            </button>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            {p.category || 'General'} • {p.label_width} × {p.label_height} mm ({p.paper_type === 'sheet' ? 'A4 Sheet' : 'Thermal Roll'})
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: '0.5rem', borderTop: '1px solid rgba(51, 65, 85, 0.5)' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            {p.is_default ? (
                                                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px' }}>DEFAULT</span>
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
                                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                                            onClick={() => {
                                                onSelectPreset(p);
                                                onClose();
                                            }}
                                        >
                                            {isActive ? 'Active' : 'Load Preset'}
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
