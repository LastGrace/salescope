import React, { useState } from 'react';
import { X, SlidersHorizontal, Plus, Check, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PrinterProfileModal = ({
    isOpen,
    onClose,
    profiles,
    activeProfileId,
    onSelectProfile,
    onSaveProfile,
    onDeleteProfile,
    onSetDefaultProfile
}) => {
    const [editingProfile, setEditingProfile] = useState(null);

    if (!isOpen) return null;

    const handleCreateNew = () => {
        setEditingProfile({
            name: 'New Thermal Profile',
            printer_type: 'thermal',
            dpi: 203,
            print_mode: 'gap',
            darkness: 10,
            speed: 3,
            offset_x: 0,
            offset_y: 0,
            feed_direction: 'normal',
            page_size: 'Custom',
            is_default: 0
        });
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!editingProfile.name) return toast.error('Name is required');
        onSaveProfile(editingProfile);
        setEditingProfile(null);
        toast.success('Printer profile saved');
    };

    return (
        <div className="studio-modal-overlay">
            <div className="studio-modal-card" style={{ maxWidth: '800px' }}>
                <div className="studio-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <SlidersHorizontal size={20} className="text-primary" />
                        <h3>Printer Configuration Profiles</h3>
                    </div>
                    <button type="button" className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="studio-modal-body">
                    {editingProfile ? (
                        <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="prop-group">
                                <label>Profile Name</label>
                                <input
                                    type="text"
                                    className="prop-input"
                                    value={editingProfile.name}
                                    onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                                />
                            </div>

                            <div className="prop-row">
                                <div className="prop-group">
                                    <label>Printer Type</label>
                                    <select
                                        className="prop-input"
                                        value={editingProfile.printer_type}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, printer_type: e.target.value })}
                                    >
                                        <option value="thermal">Thermal Roll Printer (TSC / Zebra / Generic)</option>
                                        <option value="office">Office Printer (A4 / Laser / InkJet)</option>
                                    </select>
                                </div>

                                <div className="prop-group">
                                    <label>DPI (Resolution)</label>
                                    <select
                                        className="prop-input"
                                        value={editingProfile.dpi}
                                        onChange={(e) => setEditingProfile({ ...editingProfile, dpi: parseInt(e.target.value) })}
                                    >
                                        <option value={203}>203 DPI (Standard)</option>
                                        <option value={300}>300 DPI (High Res)</option>
                                        <option value={600}>600 DPI (Ultra High)</option>
                                    </select>
                                </div>
                            </div>

                            {editingProfile.printer_type === 'thermal' && (
                                <>
                                    <div className="prop-row">
                                        <div className="prop-group">
                                            <label>Media Mode</label>
                                            <select
                                                className="prop-input"
                                                value={editingProfile.print_mode}
                                                onChange={(e) => setEditingProfile({ ...editingProfile, print_mode: e.target.value })}
                                            >
                                                <option value="gap">Gap Sensor</option>
                                                <option value="continuous">Continuous Roll</option>
                                                <option value="black_mark">Black Mark</option>
                                            </select>
                                        </div>

                                        <div className="prop-group">
                                            <label>Darkness (0 - 30)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="30"
                                                className="prop-input"
                                                value={editingProfile.darkness}
                                                onChange={(e) => setEditingProfile({ ...editingProfile, darkness: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>

                                        <div className="prop-group">
                                            <label>Speed (1 - 6)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="6"
                                                className="prop-input"
                                                value={editingProfile.speed}
                                                onChange={(e) => setEditingProfile({ ...editingProfile, speed: parseInt(e.target.value) || 1 })}
                                            />
                                        </div>
                                    </div>

                                    <div className="prop-row">
                                        <div className="prop-group">
                                            <label>Offset X (mm)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="prop-input"
                                                value={editingProfile.offset_x}
                                                onChange={(e) => setEditingProfile({ ...editingProfile, offset_x: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="prop-group">
                                            <label>Offset Y (mm)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                className="prop-input"
                                                value={editingProfile.offset_y}
                                                onChange={(e) => setEditingProfile({ ...editingProfile, offset_y: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingProfile(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Profile</button>
                            </div>
                        </form>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Select or edit a printer configuration profile</span>
                                <button type="button" className="btn btn-primary" onClick={handleCreateNew}>
                                    <Plus size={16} style={{ marginRight: '4px' }} /> Create New Profile
                                </button>
                            </div>

                            <div className="custom-scrollbar" style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {profiles.map(pr => {
                                    const isActive = pr.id === activeProfileId;
                                    return (
                                        <div
                                            key={pr.id}
                                            style={{
                                                background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.5)',
                                                border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border-color)'}`,
                                                borderRadius: '8px',
                                                padding: '0.85rem 1rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                                    {pr.name} {pr.is_default ? <span style={{ fontSize: '0.7rem', color: '#10b981', marginLeft: '6px' }}>(Default)</span> : ''}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    {pr.printer_type.toUpperCase()} • {pr.dpi} DPI • Mode: {pr.print_mode} • Darkness: {pr.darkness} • Offset: ({pr.offset_x}, {pr.offset_y})mm
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <button type="button" className="btn btn-secondary" onClick={() => setEditingProfile(pr)}>
                                                    Edit
                                                </button>
                                                {!pr.is_default && (
                                                    <button type="button" className="btn-icon" onClick={() => onSetDefaultProfile(pr.id)} title="Set Default">
                                                        <Check size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => onSelectProfile(pr)}
                                                >
                                                    {isActive ? 'Active' : 'Select'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrinterProfileModal;
