import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
    CreditCard, Package, Wallet, Ban, Ticket, Users,
    Star, RotateCcw, Folder, FileText,
    Database, Settings, ShoppingCart, TrendingUp, ChartNoAxesCombined, Plus, Smartphone, Truck, Rocket,
    Store, History, Info, Globe, Mail, X, ExternalLink, Shield, Clock, Sparkles
} from 'lucide-react';

import '../styles/Dashboard.css';
import '../styles/Modal.css';

import WhatsAppConnectionBtn from '../components/WhatsAppConnectionBtn';
import ShortcutModal from '../components/ShortcutModal';

const Dashboard = () => {
    const { token, hasPermission } = useAuth();
    const navigate = useNavigate();
    const [refreshing, setRefreshing] = useState(false);
    const [storeSettings, setStoreSettings] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Live Clock timer
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Core POS Launcher Items
    const corePosItems = useMemo(() => [
        { 
            label: 'New POS Terminal', 
            desc: 'Fast barcode checkout & split payments', 
            path: '/pos-new', 
            icon: ShoppingCart, 
            shortcut: 'F1', 
            permission: 'dashboard.view', 
            badge: 'RECOMMENDED',
            color: 'theme-primary' 
        },
        { 
            label: 'Sales Records', 
            desc: 'View, filter & export transaction history', 
            path: '/sales-records', 
            icon: ChartNoAxesCombined, 
            permission: 'dashboard.view', 
            color: 'theme-cyan' 
        },
        { 
            label: 'Analytics & Insights', 
            desc: 'Revenue trends, top items & profit margins', 
            path: '/statistics', 
            icon: TrendingUp, 
            permission: 'dashboard.view', 
            color: 'theme-indigo' 
        },
        { 
            label: 'Inventory Catalog', 
            desc: 'Stock levels, pricing & category filters', 
            path: '/inventory', 
            icon: Package, 
            permission: 'dashboard.view', 
            color: 'theme-green' 
        },
    ], []);

    // Operations Hub Items
    const operationsItems = useMemo(() => [
        { label: 'Quick Add Item', desc: 'Add new product in seconds', path: '/quick-add', icon: Plus, permission: 'dashboard.view', color: 'theme-purple' },
        { label: 'Return & Exchange', desc: 'Process customer product returns', path: '/exchange', icon: RotateCcw, permission: 'dashboard.view', color: 'theme-orange' },
        { label: 'Customer Directory', desc: 'Manage profiles, history & credit', path: '/customers', icon: Users, permission: 'dashboard.view', color: 'theme-blue' },
        { label: 'Purchase Orders', desc: 'Vendor orders & stock receipts', path: '/orders', icon: Truck, permission: 'manager.view', color: 'theme-cyan' },
        { label: 'Store Expenses', desc: 'Record daily expenses & overheads', path: '/expenses', icon: CreditCard, permission: 'dashboard.view', color: 'theme-red' },
        { label: 'Classic POS', desc: 'Legacy terminal interface', path: '/pos', icon: Store, permission: 'dashboard.view', color: 'theme-orange' },
    ], []);

    // Management & Systems Hub Items
    const managementItems = useMemo(() => [
        { label: 'WhatsApp Bulk', desc: 'Customer campaigns & invoices', path: '/whatsapp-bulk', icon: Smartphone, permission: 'dashboard.view', color: 'theme-green' },
        { label: 'WhatsApp Activity', desc: 'Message logs & dispatch history', path: '/whatsapp-activity', icon: History, permission: 'dashboard.view', color: 'theme-cyan' },
        { label: 'Barcode Generator', desc: 'Design & print custom labels', path: '/barcodes', icon: Package, permission: 'dashboard.view', color: 'theme-purple' },
        { label: 'Loyalty Rewards', desc: 'Customer points & redeem rates', path: '/loyalty-settings', icon: Star, permission: 'dashboard.view', color: 'theme-orange' },
        { label: 'Coupons & Promos', desc: 'Discount vouchers & promo codes', path: '/coupons', icon: Ticket, permission: 'dashboard.view', color: 'theme-purple' },
        { label: 'Categories', desc: 'Product departments & subcategories', path: '/categories', icon: Folder, permission: 'dashboard.view', color: 'theme-indigo' },
        { label: 'Credit Bills', desc: 'Customer outstanding dues', path: '/credit-bills', icon: Wallet, permission: 'dashboard.view', color: 'theme-blue' },
        { label: 'Credit Notes', desc: 'Return vouchers & ledger credit', path: '/credit-notes', icon: FileText, permission: 'dashboard.view', color: 'theme-indigo' },
        { label: 'Database & Backup', desc: 'Cloud sync & automatic backups', path: '/database', icon: Database, permission: 'dashboard.view', color: 'theme-cyan' },
        { label: 'Employees & Roles', desc: 'Staff access permissions', path: '/employees', icon: Users, permission: 'employees.view', color: 'theme-indigo' },
        { label: 'Store Settings', desc: 'Store details, logo & receipt format', path: '/settings/store', icon: Settings, permission: 'dashboard.view', color: 'theme-red' },
    ], []);

    const [licenseStatus, setLicenseStatus] = useState(null);
    const [driveStatus, setDriveStatus] = useState(false);

    const fetchStatusData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        const headers = { Authorization: `Bearer ${token}` };
        
        axios.get('/api/backup/drive/status', { headers })
            .then(res => setDriveStatus(res.data?.connected || false))
            .catch(() => {})
            .finally(() => { setRefreshing(false); });

        axios.get('/api/license/status', { headers })
            .then(res => setLicenseStatus(res.data || null))
            .catch(() => {});
    }, [token]);

    useEffect(() => {
        if (!hasPermission('dashboard.view')) return;

        // Initial load
        fetchStatusData();
        axios.get('/api/settings/store', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setStoreSettings(res.data))
            .catch(() => { });

        // Pre-fetch key page chunks in background for instantaneous 0ms page transitions
        import('./POSNew.jsx').catch(() => {});
        import('./Inventory.jsx').catch(() => {});
        import('./Customers.jsx').catch(() => {});

        // Real-time polling every 10 seconds
        const pollInterval = setInterval(() => fetchStatusData(), 10000);
        return () => clearInterval(pollInterval);
    }, [token, hasPermission, fetchStatusData]);

    if (!hasPermission('dashboard.view')) {
        return (
            <div className="state-empty access-restricted-container">
                <Ban size={48} className="text-muted icon-mb-1" />
                <h3>Access Restricted</h3>
                <p>You do not have permission to view the dashboard.</p>
            </div>
        );
    }

    const [showShortcutModal, setShowShortcutModal] = useState(false);
    const [showAboutModal, setShowAboutModal] = useState(false);
    const [aboutTab, setAboutTab] = useState('website');

    // Open links in default system browser (Electron support)
    const openExternal = (url) => {
        if (window.electron?.shell?.openExternal) {
            window.electron.shell.openExternal(url);
        } else if (window.require) {
            try {
                const { shell } = window.require('electron');
                shell.openExternal(url);
            } catch (e) {
                window.open(url, '_blank');
            }
        } else {
            window.open(url, '_blank');
        }
    };

    return (
        <div className="dashboard-container">
            {refreshing && <div className="loading-line"></div>}

            {/* Header & Controls */}
            <div className="dashboard-header">
                <div className="dashboard-header-brand">
                    <img 
                        src={storeSettings?.dashboard_logo_url || storeSettings?.logo_url || "/Salescope.png"} 
                        alt="Store Logo" 
                        className="dashboard-brand-logo"
                        onError={(e) => { e.target.onerror = null; e.target.src = "/Salescope.png"; }}
                    />
                    <div className="dashboard-title">
                        <p className="dashboard-greeting">{(() => {
                            const h = currentTime.getHours();
                            if (h < 12) return '☀️ Good Morning';
                            if (h < 17) return '🌤️ Good Afternoon';
                            return '🌙 Good Evening';
                        })()}</p>
                        <h1>{storeSettings?.store_name || 'SaleScope Retail Engine'}</h1>
                        <p className="dashboard-date">
                            <Clock size={14} className="dashboard-clock-icon" />
                            {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            <span className="dashboard-time-badge">{currentTime.toLocaleTimeString()}</span>
                        </p>
                    </div>
                </div>

                {/* Header Actions & Health Pills Stack */}
                <div className="dashboard-header-actions">
                    <div className="status-indicators-stack">
                        {/* WhatsApp Engine Button */}
                        <WhatsAppConnectionBtn />

                        {/* Google Drive Status */}
                        <div
                            className={`status-card status-card-custom ${driveStatus ? 'connected' : 'disconnected'}`}
                            onClick={() => {
                                if (driveStatus) {
                                    toast.success('Backup drive is connected');
                                } else {
                                    navigate('/database');
                                }
                            }}
                            title={driveStatus ? 'Google Drive Cloud Backup Active' : 'Click to connect Google Drive'}
                        >
                            <div className="status-content">
                                <div className="status-dot"></div>
                                <Database size={14} />
                                <span>{driveStatus ? 'Cloud Sync On' : 'Connect Cloud'}</span>
                            </div>
                        </div>

                        {/* License Status Pill */}
                        {licenseStatus && (
                            <div 
                                className={`status-card status-card-custom ${licenseStatus.status === 'licensed' ? 'connected' : 'disconnected'}`}
                                onClick={() => navigate('/activation')}
                                title="Click to manage license"
                            >
                                <div className="status-content">
                                    <Shield size={14} />
                                    <span>
                                        {licenseStatus.status === 'licensed'
                                            ? (licenseStatus.daysLeft !== null && licenseStatus.daysLeft !== undefined ? `${licenseStatus.daysLeft}d License` : 'Active License')
                                            : 'License Required'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Launch POS Hero Button */}
                    <Link to="/pos-new" className="btn-primary pos-launch-btn">
                        <ShoppingCart size={24} />
                        <div className="pos-launch-btn-content">
                            <span className="pos-launch-btn-text">OPEN POS</span>
                            <span className="pos-launch-btn-sub">Press F1 anytime</span>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Quick Access Hub Content */}
            <div className={`dashboard-content-wrapper ${refreshing ? 'refreshing' : ''}`}>

                {/* 1. Core POS & Sales Hero Section */}
                <div className="dashboard-section-header">
                    <h2><Sparkles size={20} className="section-icon text-indigo" /> POS Core & Checkout</h2>
                    <span className="dashboard-section-sub">Primary retail terminal & sales records</span>
                </div>
                <div className="hub-grid hub-grid-hero">
                    {corePosItems.map((item, idx) => {
                        const Icon = item.icon;
                        if (item.permission && !hasPermission(item.permission)) return null;

                        return (
                            <Link key={idx} to={item.path} className={`hub-card hub-card-hero ${item.color}`}>
                                {item.badge && <span className="hub-card-badge">{item.badge}</span>}
                                {item.shortcut && <span className="hub-card-shortcut">{item.shortcut}</span>}
                                <div className={`hub-icon ${item.color} hub-icon-circle`}>
                                    <Icon size={26} />
                                </div>
                                <div className="hub-card-details">
                                    <span className="hub-card-title">{item.label}</span>
                                    <span className="hub-card-desc">{item.desc}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* 2. Operations & Inventory Hub Section */}
                <div className="dashboard-section-header">
                    <h2><Rocket size={20} className="section-icon text-orange" /> Store Operations</h2>
                    <span className="dashboard-section-sub">Catalog, quick add, customer CRM & vendor orders</span>
                </div>
                <div className="hub-grid hub-grid-operations">
                    {operationsItems.map((item, idx) => {
                        const Icon = item.icon;
                        if (item.permission && !hasPermission(item.permission)) return null;

                        return (
                            <Link key={idx} to={item.path} className="hub-card hub-card-standard">
                                <div className={`hub-icon ${item.color} hub-icon-circle`}>
                                    <Icon size={20} />
                                </div>
                                <div className="hub-card-details">
                                    <span className="hub-card-title">{item.label}</span>
                                    <span className="hub-card-desc">{item.desc}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* 3. Management & Systems Section */}
                <div className="dashboard-section-header">
                    <h2><Settings size={20} className="section-icon text-cyan" /> Systems & Settings</h2>
                    <span className="dashboard-section-sub">WhatsApp campaigns, barcode printing, backups & roles</span>
                </div>
                <div className="hub-grid hub-grid-mgmt">
                    {managementItems.map((item, idx) => {
                        const Icon = item.icon;
                        if (item.permission && !hasPermission(item.permission)) return null;

                        return (
                            <Link key={idx} to={item.path} className="hub-card hub-card-compact">
                                <div className={`hub-icon ${item.color} hub-icon-circle`}>
                                    <Icon size={18} />
                                </div>
                                <div className="hub-card-details">
                                    <span className="hub-card-title">{item.label}</span>
                                    <span className="hub-card-desc">{item.desc}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="dashboard-bottom-bar">
                <button
                    className="dashboard-action-btn"
                    onClick={() => setShowShortcutModal(true)}
                    title="Keyboard Shortcuts"
                >
                    <div className="keyboard-key-icon">⌘</div>
                    <span>Keyboard Shortcuts</span>
                </button>
                <button
                    className="dashboard-action-btn about-btn"
                    onClick={() => setShowAboutModal(true)}
                    title="About SaleScope"
                >
                    <Info size={18} />
                    <span>About SaleScope</span>
                </button>
            </div>

            {showShortcutModal && (
                <ShortcutModal onClose={() => setShowShortcutModal(false)} />
            )}

            {showAboutModal && (
                <div className="modal-overlay" onClick={() => setShowAboutModal(false)}>
                    <div className="about-modal" onClick={e => e.stopPropagation()}>
                        <button className="about-close-btn" onClick={() => setShowAboutModal(false)}>
                            <X size={18} />
                        </button>
                        <div className="about-header">
                            <img
                                src="/Salescope.png"
                                alt="SaleScope"
                                className="about-logo"
                            />
                            <h2>SaleScope POS</h2>
                            <p className="about-version">Version 2.0.5 • Retail Management System</p>
                            
                            {/* License Status Badge */}
                            {licenseStatus && (
                                <div 
                                    className={`about-license-badge ${licenseStatus.status === 'licensed' ? 'active' : 'inactive'}`}
                                    onClick={() => navigate('/activation')}
                                    style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', background: licenseStatus.status === 'licensed' ? '#dcfce7' : '#fee2e2', color: licenseStatus.status === 'licensed' ? '#166534' : '#991b1b', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
                                    title="Click to manage license"
                                >
                                    <Shield size={14} />
                                    <span>
                                        {licenseStatus.status === 'licensed'
                                            ? `License: ${licenseStatus.daysLeft !== null && licenseStatus.daysLeft !== undefined ? `${licenseStatus.daysLeft} Days Left` : 'Active'}`
                                            : 'License Not Active'}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="about-tabs">
                            <button
                                className={`about-tab ${aboutTab === 'website' ? 'active' : ''}`}
                                onClick={() => setAboutTab('website')}
                            >
                                <Globe size={16} />
                                Website
                            </button>
                            <button
                                className={`about-tab ${aboutTab === 'email' ? 'active' : ''}`}
                                onClick={() => setAboutTab('email')}
                            >
                                <Mail size={16} />
                                Email
                            </button>
                        </div>

                        <div className="about-tab-content">
                            {aboutTab === 'website' ? (
                                <div className="about-content-card" onClick={() => openExternal('https://salescope.software')}>
                                    <div className="about-content-icon">
                                        <Globe size={32} />
                                    </div>
                                    <div className="about-content-details">
                                        <h3>Official Website</h3>
                                        <p>salescope.software</p>
                                    </div>
                                    <ExternalLink size={18} className="about-content-arrow" />
                                </div>
                            ) : (
                                <div className="about-content-card" onClick={() => openExternal('mailto:salescopepos@gmail.com')}>
                                    <div className="about-content-icon">
                                        <Mail size={32} />
                                    </div>
                                    <div className="about-content-details">
                                        <h3>Support Email</h3>
                                        <p>salescopepos@gmail.com</p>
                                    </div>
                                    <ExternalLink size={18} className="about-content-arrow" />
                                </div>
                            )}
                        </div>

                        <div className="about-footer">
                            <p>© {new Date().getFullYear()} SaleScope. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
