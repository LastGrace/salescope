
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Save, Store, Info, Phone, MapPin, Globe, MessageSquare, Printer, Trash, X, Smartphone, Orbit } from 'lucide-react';
import '../styles/StoreSettings.css';

const StoreSettings = () => {
    const [settings, setSettings] = useState({
        store_name: '',
        address: '',
        phone_1: '',
        phone_2: '',
        instagram_link: '',
        exchange_policy_text: '',
        whatsapp_caption: '',
        logo_url: '',
        logo_width: '',
        logo_height: '',
        bill_logo_url: '',
        bill_logo_width: '',
        bill_logo_height: '',
        login_logo_url: '',
        login_logo_width: '',
        login_logo_height: '',
        pos_background_url: '',
        pos_background_width: '',
        pos_background_height: '',
        pos_background_opacity: 0.1,
        product_add_sound_url: '',
        baileys_enabled: true,
        whatshub_enabled: false,
        default_provider: 'baileys',
        whatshub_api_key: '',
        override_invoices: '',
        override_bills: '',
        override_bulk: '',
        override_marketing: '',
        override_sync: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('store_info');

    const [logoFile, setLogoFile] = useState(null);
    const [billLogoFile, setBillLogoFile] = useState(null);
    const [loginLogoFile, setLoginLogoFile] = useState(null);
    const [posBackgroundFile, setPosBackgroundFile] = useState(null);
    const [productAddSoundFile, setProductAddSoundFile] = useState(null);

    useEffect(() => {
        fetchSettings();
        fetchMessagingSettings();
    }, []);

    const fetchMessagingSettings = async () => {
        try {
            const res = await axios.get('/api/settings/messaging');
            const clean = Object.fromEntries(Object.entries(res.data).map(([k, val]) => [k, val === null ? '' : val]));
            setSettings(prev => ({ ...prev, ...clean }));
        } catch (err) {
            console.error('Failed to load messaging settings', err);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/settings/store');
            const clean = Object.fromEntries(Object.entries(res.data).map(([k, val]) => [k, val === null ? '' : val]));
            setSettings(prev => ({ ...prev, ...clean }));
        } catch (err) {
            console.error(err);
            toast.error('Failed to load store settings');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Parse numbers for dimensions and opacity
        const numericFields = ['logo_width', 'logo_height', 'bill_logo_width', 'bill_logo_height', 'login_logo_width', 'login_logo_height', 'pos_background_width', 'pos_background_height', 'pos_background_opacity'];
        let finalValue = value;

        if (numericFields.includes(name) && value !== '') {
            // Only parse if it looks like a number
            if (!isNaN(value)) {
                finalValue = parseFloat(value);
            }
        }

        setSettings(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) setLogoFile(e.target.files[0]);
    };

    const handleBillLogoChange = (e) => {
        if (e.target.files[0]) setBillLogoFile(e.target.files[0]);
    };

    const handleLoginLogoChange = (e) => {
        if (e.target.files[0]) setLoginLogoFile(e.target.files[0]);
    };

    const handlePosBackgroundChange = (e) => {
        if (e.target.files[0]) setPosBackgroundFile(e.target.files[0]);
    };

    const handleProductAddSoundChange = (e) => {
        if (e.target.files[0]) setProductAddSoundFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        const formData = new FormData();
        Object.keys(settings).forEach(key => {
            if (!['logo', 'bill_logo', 'login_logo', 'pos_background', 'product_add_sound'].includes(key) && settings[key] !== null) {
                formData.append(key, settings[key]);
            }
        });

        if (logoFile) formData.append('logo', logoFile);
        if (billLogoFile) formData.append('bill_logo', billLogoFile);
        if (loginLogoFile) formData.append('login_logo', loginLogoFile);
        if (posBackgroundFile) formData.append('pos_background', posBackgroundFile);
        if (productAddSoundFile) formData.append('product_add_sound', productAddSoundFile);

        try {
            const res = await axios.post('/api/settings/store', formData);
            
            await axios.post('/api/settings/messaging', {
                baileys_enabled: settings.baileys_enabled,
                whatshub_enabled: settings.whatshub_enabled,
                default_provider: settings.default_provider,
                whatshub_api_key: settings.whatshub_api_key,
                override_invoices: settings.override_invoices,
                override_bills: settings.override_bills,
                override_bulk: settings.override_bulk,
                override_marketing: settings.override_marketing,
                override_sync: settings.override_sync
            });

            setSettings(prev => ({
                ...prev,
                logo_url: res.data.logo_url,
                bill_logo_url: res.data.bill_logo_url,
                login_logo_url: res.data.login_logo_url,
                pos_background_url: res.data.pos_background_url,
                product_add_sound_url: res.data.product_add_sound_url
            }));
            // Clear file inputs so stale files aren't re-uploaded on next save
            setLogoFile(null);
            setBillLogoFile(null);
            setLoginLogoFile(null);
            setPosBackgroundFile(null);
            setProductAddSoundFile(null);
            // Re-fetch to ensure all fields are in sync with DB
            fetchSettings();
            fetchMessagingSettings();
            toast.success('Store settings updated successfully');
        } catch (err) {
            console.error(err);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleFixDb = async () => {
        try {
            const res = await axios.post('/api/debug/fix-db');
            toast.success(res.data.message);
            fetchSettings();
        } catch (err) {
            toast.error('Repair failed: ' + (err.response?.data?.message || err.message));
        }
    };

    if (loading) return <div className="loading-text-container">Loading settings...</div>;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'store_info':
                return (
                    <div className="settings-tab-content">
                        {/* General Section */}
                        <div className="form-section">
                            <div className="section-header">
                                <Info size={20} />
                                <h3>General Information</h3>
                            </div>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label>Store Name</label>
                                    <input
                                        type="text"
                                        name="store_name"
                                        value={settings.store_name}
                                        onChange={handleChange}
                                        required
                                        placeholder="e.g. Trendy Flea"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Instagram Link (QR Generation)</label>
                                    <input
                                        type="text"
                                        name="instagram_link"
                                        value={settings.instagram_link}
                                        onChange={handleChange}
                                        placeholder="https://instagram.com/..."
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Address <MapPin size={14} className="address-icon" /></label>
                                <textarea
                                    name="address"
                                    value={settings.address}
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="Full store address..."
                                />
                            </div>
                        </div>

                        {/* Contact Section */}
                        <div className="form-section">
                            <div className="section-header">
                                <Phone size={20} />
                                <h3>Contact Details</h3>
                            </div>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label>Phone Number 1</label>
                                    <input
                                        type="text"
                                        name="phone_1"
                                        value={settings.phone_1}
                                        onChange={handleChange}
                                        placeholder="Primary contact"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Phone Number 2</label>
                                    <input
                                        type="text"
                                        name="phone_2"
                                        value={settings.phone_2}
                                        onChange={handleChange}
                                        placeholder="Secondary contact"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'bill_config':
                return (
                    <div className="settings-tab-content">
                        <div className="form-section">
                            <div className="section-header">
                                <Printer size={20} />
                                <h3>Billing & WhatsApp</h3>
                            </div>
                            <div className="form-group">
                                <label>Exchange Policy (Bill Footer)</label>
                                <input
                                    type="text"
                                    name="exchange_policy_text"
                                    value={settings.exchange_policy_text}
                                    onChange={handleChange}
                                    placeholder="e.g. Valid for 7 days"
                                />
                            </div>
                            <div className="form-group">
                                <label>WhatsApp Bill Caption</label>
                                <textarea
                                    name="whatsapp_caption"
                                    value={settings.whatsapp_caption}
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="Message sent with the PDF bill..."
                                />
                                <small className="help-text">This text will be attached when sending the bill PDF via WhatsApp.</small>
                            </div>
                        </div>
                    </div>
                );
            case 'images_config':
                return (
                    <div className="settings-tab-content">
                        <div className="images-settings-grid">
                            {/* Store Logo */}
                            <div className="form-section">
                                <div className="section-header">
                                    <Store size={20} />
                                    <h3>Store Logo</h3>
                                </div>
                                <div className="logo-upload-container">
                                    {settings.logo_url ? (
                                        <div className="current-logo-container">
                                            <div className="current-logo">
                                                <img
                                                    src={settings.logo_url}
                                                    alt="Store Logo"
                                                    className="logo-preview"
                                                    onError={(e) => { e.target.onerror = null; e.target.src = '/Salescope.png'; }}
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                className="media-action-btn media-delete-btn" 
                                                onClick={() => {
                                                    setSettings(prev => ({ ...prev, logo_url: '' }));
                                                    setLogoFile(null);
                                                }}
                                                title="Delete Current Logo"
                                            >
                                                <Trash size={14} /> Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="no-media-placeholder">No store logo configured</div>
                                    )}
                                    
                                    <div className="file-input-wrapper">
                                        <input 
                                            type="file" 
                                            id="store-logo-file"
                                            accept="image/*" 
                                            onChange={handleFileChange} 
                                            className="file-input-hidden" 
                                        />
                                        <label htmlFor="store-logo-file" className="file-input-label">
                                            Choose Image
                                        </label>
                                        {logoFile && (
                                            <div className="selected-file-badge">
                                                <span className="file-name">{logoFile.name}</span>
                                                <button 
                                                    type="button" 
                                                    className="file-cancel-btn" 
                                                    onClick={() => setLogoFile(null)}
                                                    title="Cancel Selection"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group"><label>Width</label><input type="text" name="logo_width" value={settings.logo_width || ''} onChange={handleChange} placeholder="e.g. 150px" /></div>
                                    <div className="form-group"><label>Height</label><input type="text" name="logo_height" value={settings.logo_height || ''} onChange={handleChange} placeholder="auto" /></div>
                                </div>
                            </div>

                            {/* Bill Logo */}
                            <div className="form-section">
                                <div className="section-header">
                                    <Printer size={20} />
                                    <h3>Bill Logo</h3>
                                </div>
                                <div className="logo-upload-container">
                                    {settings.bill_logo_url ? (
                                        <div className="current-logo-container">
                                            <div className="current-logo">
                                                <img
                                                    src={settings.bill_logo_url}
                                                    alt="Bill Logo"
                                                    className="logo-preview"
                                                    onError={(e) => { e.target.onerror = null; e.target.src = '/Salescope.png'; }}
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                className="media-action-btn media-delete-btn" 
                                                onClick={() => {
                                                    setSettings(prev => ({ ...prev, bill_logo_url: '' }));
                                                    setBillLogoFile(null);
                                                }}
                                                title="Delete Current Bill Logo"
                                            >
                                                <Trash size={14} /> Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="no-media-placeholder">No bill logo configured</div>
                                    )}
                                    
                                    <div className="file-input-wrapper">
                                        <input 
                                            type="file" 
                                            id="bill-logo-file"
                                            accept="image/*" 
                                            onChange={handleBillLogoChange} 
                                            className="file-input-hidden" 
                                        />
                                        <label htmlFor="bill-logo-file" className="file-input-label">
                                            Choose Image
                                        </label>
                                        {billLogoFile && (
                                            <div className="selected-file-badge">
                                                <span className="file-name">{billLogoFile.name}</span>
                                                <button 
                                                    type="button" 
                                                    className="file-cancel-btn" 
                                                    onClick={() => setBillLogoFile(null)}
                                                    title="Cancel Selection"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group"><label>Width</label><input type="text" name="bill_logo_width" value={settings.bill_logo_width || ''} onChange={handleChange} placeholder="e.g. 200px" /></div>
                                    <div className="form-group"><label>Height</label><input type="text" name="bill_logo_height" value={settings.bill_logo_height || ''} onChange={handleChange} placeholder="auto" /></div>
                                </div>
                            </div>

                            {/* Login Logo */}
                            <div className="form-section">
                                <div className="section-header">
                                    <Info size={20} />
                                    <h3>Login Logo</h3>
                                </div>
                                <div className="logo-upload-container">
                                    {settings.login_logo_url ? (
                                        <div className="current-logo-container">
                                            <div className="current-logo">
                                                <img
                                                    src={settings.login_logo_url}
                                                    alt="Login Logo"
                                                    className="logo-preview"
                                                    onError={(e) => { e.target.onerror = null; e.target.src = '/Salescope.png'; }}
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                className="media-action-btn media-delete-btn" 
                                                onClick={() => {
                                                    setSettings(prev => ({ ...prev, login_logo_url: '' }));
                                                    setLoginLogoFile(null);
                                                }}
                                                title="Delete Current Login Logo"
                                            >
                                                <Trash size={14} /> Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="no-media-placeholder">No login logo configured</div>
                                    )}
                                    
                                    <div className="file-input-wrapper">
                                        <input 
                                            type="file" 
                                            id="login-logo-file"
                                            accept="image/*" 
                                            onChange={handleLoginLogoChange} 
                                            className="file-input-hidden" 
                                        />
                                        <label htmlFor="login-logo-file" className="file-input-label">
                                            Choose Image
                                        </label>
                                        {loginLogoFile && (
                                            <div className="selected-file-badge">
                                                <span className="file-name">{loginLogoFile.name}</span>
                                                <button 
                                                    type="button" 
                                                    className="file-cancel-btn" 
                                                    onClick={() => setLoginLogoFile(null)}
                                                    title="Cancel Selection"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group"><label>Width</label><input type="text" name="login_logo_width" value={settings.login_logo_width || ''} onChange={handleChange} placeholder="e.g. 250px" /></div>
                                    <div className="form-group"><label>Height</label><input type="text" name="login_logo_height" value={settings.login_logo_height || ''} onChange={handleChange} placeholder="auto" /></div>
                                </div>
                            </div>

                            {/* POS Background */}
                            <div className="form-section">
                                <div className="section-header">
                                    <Globe size={20} />
                                    <h3>POS Background</h3>
                                </div>
                                <div className="logo-upload-container">
                                    {settings.pos_background_url ? (
                                        <div className="current-logo-container">
                                            <div className="current-logo">
                                                <img 
                                                    src={settings.pos_background_url} 
                                                    alt="POS Background" 
                                                    className="logo-preview" 
                                                    onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                className="media-action-btn media-delete-btn" 
                                                onClick={() => {
                                                    setSettings(prev => ({ ...prev, pos_background_url: '' }));
                                                    setPosBackgroundFile(null);
                                                }}
                                                title="Delete Current Background"
                                            >
                                                <Trash size={14} /> Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="no-media-placeholder">No POS background configured</div>
                                    )}
                                    
                                    <div className="file-input-wrapper">
                                        <input 
                                            type="file" 
                                            id="pos-bg-file"
                                            accept="image/*" 
                                            onChange={handlePosBackgroundChange} 
                                            className="file-input-hidden" 
                                        />
                                        <label htmlFor="pos-bg-file" className="file-input-label">
                                            Choose Image
                                        </label>
                                        {posBackgroundFile && (
                                            <div className="selected-file-badge">
                                                <span className="file-name">{posBackgroundFile.name}</span>
                                                <button 
                                                    type="button" 
                                                    className="file-cancel-btn" 
                                                    onClick={() => setPosBackgroundFile(null)}
                                                    title="Cancel Selection"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="grid-2">
                                        <div className="form-group">
                                            <label>Width</label>
                                            <input type="text" name="pos_background_width" value={settings.pos_background_width || ''} onChange={handleChange} placeholder="e.g. 400px" />
                                        </div>
                                        <div className="form-group">
                                            <label>Height</label>
                                            <input type="text" name="pos_background_height" value={settings.pos_background_height || ''} onChange={handleChange} placeholder="auto" />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginTop: '0.5rem' }}>
                                        <label>Background Opacity ({settings.pos_background_opacity})</label>
                                        <input
                                            type="range"
                                            name="pos_background_opacity"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={(settings.pos_background_opacity !== undefined && settings.pos_background_opacity !== null) ? settings.pos_background_opacity : 0.1}
                                            onChange={handleChange}
                                            className="opacity-slider"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Product Add Sound */}
                            <div className="form-section">
                                <div className="section-header">
                                    <span style={{ fontSize: '1.2rem' }}>🔊</span>
                                    <h3>Product Add Sound</h3>
                                </div>
                                <div className="logo-upload-container">
                                    {settings.product_add_sound_url ? (
                                        <div className="audio-preview-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <audio controls src={settings.product_add_sound_url} style={{ width: '100%', height: '32px' }}>
                                                Your browser does not support the audio element.
                                            </audio>
                                            <button 
                                                type="button" 
                                                className="media-action-btn media-delete-btn" 
                                                onClick={() => {
                                                    setSettings(prev => ({ ...prev, product_add_sound_url: '' }));
                                                    setProductAddSoundFile(null);
                                                }}
                                                style={{ width: 'fit-content' }}
                                                title="Delete Current Sound"
                                            >
                                                <Trash size={14} /> Remove Sound
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="no-media-placeholder">No product add sound configured</div>
                                    )}
                                    
                                    <div className="file-input-wrapper" style={{ marginTop: '0.5rem' }}>
                                        <input
                                            type="file"
                                            id="product-sound-file"
                                            accept="audio/mpeg, audio/wav, audio/mp3"
                                            onChange={handleProductAddSoundChange}
                                            className="file-input-hidden"
                                        />
                                        <label htmlFor="product-sound-file" className="file-input-label">
                                            Choose Sound
                                        </label>
                                        {productAddSoundFile && (
                                            <div className="selected-file-badge">
                                                <span className="file-name">{productAddSoundFile.name}</span>
                                                <button 
                                                    type="button" 
                                                    className="file-cancel-btn" 
                                                    onClick={() => setProductAddSoundFile(null)}
                                                    title="Cancel Selection"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'messaging_settings':
                return (
                    <div className="settings-tab-content">
                        {/* Provider Cards */}
                        <div className="images-settings-grid" style={{ marginBottom: '2rem' }}>
                            {/* Baileys Card */}
                            <div className={`form-section provider-card ${settings.baileys_enabled ? 'enabled' : ''}`}>
                                <div>
                                    <div className="section-header" style={{ border: 'none', marginBottom: '0.5rem', paddingBottom: 0 }}>
                                        <Smartphone size={22} style={{ color: settings.baileys_enabled ? '#25d366' : 'var(--text-muted)' }} />
                                        <h3 style={{ fontSize: '1.15rem' }}>Built-in WhatsApp</h3>
                                    </div>
                                    <p className="provider-desc">
                                        Uses a local automated browser session to link your phone. Completely free and runs directly on your machine.
                                    </p>
                                </div>
                                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                                    <div className="toggle-switch-container" style={{ margin: 0 }}>
                                        <span className="toggle-switch-label" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                            {settings.baileys_enabled ? 'Active (Recommended)' : 'Disabled'}
                                        </span>
                                        <label className="toggle-switch">
                                            <input 
                                                type="checkbox" 
                                                checked={settings.baileys_enabled} 
                                                onChange={(e) => setSettings(prev => ({ ...prev, baileys_enabled: e.target.checked }))} 
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* WhatsHub Card */}
                            <div className={`form-section provider-card ${settings.whatshub_enabled ? 'enabled' : ''}`}>
                                <div>
                                    <div className="section-header" style={{ border: 'none', marginBottom: '0.5rem', paddingBottom: 0 }}>
                                        <Globe size={22} style={{ color: settings.whatshub_enabled ? 'var(--primary)' : 'var(--text-muted)' }} />
                                        <h3 style={{ fontSize: '1.15rem' }}>WhatsHub Cloud Gateway</h3>
                                    </div>
                                    <p className="provider-desc">
                                        Uses a cloud-based API gateway. Highly recommended for heavy marketing or remote, unattended server campaigns.
                                    </p>
                                </div>
                                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                                    <div className="toggle-switch-container" style={{ marginBottom: settings.whatshub_enabled ? '1rem' : 0 }}>
                                        <span className="toggle-switch-label" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                            {settings.whatshub_enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                        <label className="toggle-switch">
                                            <input 
                                                type="checkbox" 
                                                checked={settings.whatshub_enabled} 
                                                onChange={(e) => setSettings(prev => ({ ...prev, whatshub_enabled: e.target.checked }))} 
                                            />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                    {settings.whatshub_enabled && (
                                        <div className="form-group" style={{ margin: 0, animation: 'fade-in 0.2s ease-out' }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>WhatsHub API Key</label>
                                            <input
                                                type="password"
                                                name="whatshub_api_key"
                                                value={settings.whatshub_api_key || ''}
                                                onChange={handleChange}
                                                placeholder="wh_..."
                                                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* General Settings */}
                        <div className="form-section" style={{ marginBottom: '2rem' }}>
                            <div className="section-header">
                                <MessageSquare size={20} />
                                <h3>Global Routing Settings</h3>
                            </div>
                            <div className="form-group" style={{ maxWidth: '400px' }}>
                                <label style={{ fontWeight: 700 }}>Default Message Provider</label>
                                <select 
                                    name="default_provider" 
                                    value={settings.default_provider || 'baileys'} 
                                    onChange={handleChange}
                                    className="premium-select"
                                >
                                    <option value="baileys">Built-in WhatsApp (Baileys)</option>
                                    <option value="whatshub">WhatsHub Cloud API</option>
                                </select>
                                <span className="help-text">Fallback provider for all outgoing text receipts, invoices, and alerts.</span>
                            </div>
                        </div>

                        {/* Advanced Feature Overrides */}
                        <div className="form-section">
                            <div className="section-header">
                                <Orbit size={20} />
                                <h3>Advanced Feature Routing</h3>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                                Override the default messaging provider for specific system functions. Leave as "Use Default Provider" to inherit the setting above.
                            </p>
                            <div className="grid-2">
                                {[
                                    { key: 'invoices', label: 'Customer Invoices', desc: 'Sent when completing digital checkout sales.' },
                                    { key: 'bills', label: 'POS Bills / Receipts', desc: 'Auto-sent when printing bills at register POS.' },
                                    { key: 'bulk', label: 'Bulk Campaigns', desc: 'Broadcast notifications to customer groups.' },
                                    { key: 'marketing', label: 'Marketing Auto-alerts', desc: 'Loyalty point checkins or store promo alerts.' },
                                    { key: 'sync', label: 'Database Synchronization', desc: 'Session check alerts and store log dumps.' }
                                ].map(feature => (
                                    <div className="form-group routing-group-card" key={feature.key}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <label style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>{feature.label}</label>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{feature.desc}</span>
                                        </div>
                                        <select 
                                            name={`override_${feature.key}`} 
                                            value={settings[`override_${feature.key}`] || ''} 
                                            onChange={handleChange}
                                            className="premium-select"
                                            style={{ marginTop: '0.75rem' }}
                                        >
                                            <option value="">Use Default Provider</option>
                                            <option value="baileys">Built-in WhatsApp (Baileys)</option>
                                            <option value="whatshub">WhatsHub Cloud API</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="store-settings-container">
            <header className="page-header">
                <div className="header-title">
                    <Store className="w-8 h-8 text-primary" />
                    <div>
                        <h1>Store Settings</h1>
                        <p>Configure your shop identity, billing rules, and branding</p>
                    </div>
                </div>
            </header>

            <nav className="settings-tabs">
                <button
                    className={`tab-btn ${activeTab === 'store_info' ? 'active' : ''}`}
                    onClick={() => setActiveTab('store_info')}
                >
                    Store Info
                </button>
                <button
                    className={`tab-btn ${activeTab === 'bill_config' ? 'active' : ''}`}
                    onClick={() => setActiveTab('bill_config')}
                >
                    Bill Config
                </button>
                <button
                    className={`tab-btn ${activeTab === 'images_config' ? 'active' : ''}`}
                    onClick={() => setActiveTab('images_config')}
                >
                    Images Config
                </button>
                <button
                    className={`tab-btn ${activeTab === 'messaging_settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('messaging_settings')}
                >
                    Messaging
                </button>
            </nav>

            <main className="settings-content">
                <form onSubmit={handleSubmit} className="settings-form">
                    {renderTabContent()}
                    <div className="form-actions-sticky">
                        <button type="button" onClick={handleFixDb} className="save-btn" style={{ background: '#f59e0b', marginRight: '10px' }}>
                            Repair Database
                        </button>
                        <button type="submit" className="save-btn" disabled={saving}>
                            <Save size={18} />
                            {saving ? 'Saving...' : 'Save All Changes'}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
};

export default StoreSettings;
