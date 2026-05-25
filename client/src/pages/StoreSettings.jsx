
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Save, Store, Info, Phone, MapPin, Globe, MessageSquare, Printer } from 'lucide-react';
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
        product_add_sound_url: ''
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
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/settings/store');
            const clean = Object.fromEntries(Object.entries(res.data).map(([k, val]) => [k, val === null ? '' : val]));
            setSettings(clean);
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
                        {/* Store Logo */}
                        <div className="form-section">
                            <div className="section-header">
                                <Store size={20} />
                                <h3>Store Logo</h3>
                            </div>
                            <div className="form-group">
                                <div className="logo-upload-container">
                                    {settings.logo_url && (
                                        <div className="current-logo">
                                            <img
                                                src={settings.logo_url}
                                                alt="Store Logo"
                                                className="logo-preview"
                                                onError={(e) => { e.target.onerror = null; e.target.src = '/Salescope.png'; }}
                                            />
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleFileChange} className="file-input" />
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
                            <div className="form-group">
                                <div className="logo-upload-container">
                                    {settings.bill_logo_url && (
                                        <div className="current-logo">
                                            <img
                                                src={settings.bill_logo_url}
                                                alt="Bill Logo"
                                                className="logo-preview"
                                                onError={(e) => { e.target.onerror = null; e.target.src = '/Salescope.png'; }}
                                            />
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleBillLogoChange} className="file-input" />
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
                            <div className="form-group">
                                <div className="logo-upload-container">
                                    {settings.login_logo_url && (
                                        <div className="current-logo">
                                            <img
                                                src={settings.login_logo_url}
                                                alt="Login Logo"
                                                className="logo-preview"
                                                onError={(e) => { e.target.onerror = null; e.target.src = '/Salescope.png'; }}
                                            />
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleLoginLogoChange} className="file-input" />
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
                                <h3>POS Background Logo</h3>
                            </div>
                            <div className="form-group">
                                <div className="logo-upload-container">
                                    {settings.pos_background_url && (
                                        <div className="current-logo">
                                            <img src={settings.pos_background_url} alt="POS Background" className="logo-preview" />
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handlePosBackgroundChange} className="file-input" />
                                    <small className="help-text">Visible in the background of POS and New POS screens.</small>
                                </div>
                            </div>
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
                            <div className="form-group" style={{ marginTop: '1rem' }}>
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
                                <div className="opacity-labels">
                                    <span>Solid</span>
                                </div>
                            </div>
                        </div>

                        {/* Product Add Sound */}
                        <div className="form-section">
                            <div className="section-header">
                                <span style={{ fontSize: '1.2rem' }}>🔊</span>
                                <h3>Product Add Sound</h3>
                            </div>
                            <div className="form-group">
                                <label>Upload MP3 Sound</label>
                                <div className="logo-upload-container">
                                    {settings.product_add_sound_url && (
                                        <div className="audio-preview" style={{ marginBottom: '10px' }}>
                                            <audio controls src={settings.product_add_sound_url}>
                                                Your browser does not support the audio element.
                                            </audio>
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="audio/mpeg, audio/wav, audio/mp3"
                                        onChange={handleProductAddSoundChange}
                                        className="file-input"
                                    />
                                    <small className="help-text">Plays when a product is added to the cart (POS/Scanner)</small>
                                </div>
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
