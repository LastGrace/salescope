import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
    CreditCard, LayoutDashboard, Package, Wallet, Ban, Ticket, Users,
    MessageSquare, Star, RotateCcw, Folder, FileText,
    Database, Settings, ShoppingCart, TrendingUp, ChartNoAxesCombined, Plus, Smartphone, Truck, Rocket,
    Info, Globe, Instagram, Facebook, Youtube, Twitter, Mail, X, ExternalLink, Store, Shield
} from 'lucide-react';

import '../styles/Dashboard.css';
import '../styles/Modal.css';

import WhatsAppConnectionBtn from '../components/WhatsAppConnectionBtn';
import ShortcutModal from '../components/ShortcutModal';

// Skeleton Loader Component
const DashboardSkeleton = () => (
    <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
        </div>
    </div>
);

const Dashboard = () => {
    const { token, hasPermission } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [storeSettings, setStoreSettings] = useState(null);

    const quickLaunchItems = useMemo(() => [
        { label: 'Statistics', path: '/statistics', icon: TrendingUp, permission: 'dashboard.view', color: 'theme-indigo' },
        { label: 'Sales Records', path: '/sales-records', icon: ChartNoAxesCombined, permission: 'dashboard.view', color: 'theme-cyan' },
        { label: 'Classic POS', path: '/pos', icon: Store, permission: 'dashboard.view', color: 'theme-orange' },
        { label: 'Inventory', path: '/inventory', icon: Package, permission: 'dashboard.view', color: 'theme-green' },
        { label: 'Quick Add', path: '/quick-add', icon: Plus, permission: 'dashboard.view', color: 'theme-purple' },
        { label: 'Customers', path: '/customers', icon: Users, permission: 'dashboard.view', color: 'theme-blue' },
        { label: 'WhatsApp', path: '/whatsapp-bulk', icon: Smartphone, permission: 'dashboard.view', color: 'theme-green' },
    ], []);

    const hubItems = useMemo(() => [
        { label: 'Exchange', path: '/exchange', icon: RotateCcw, permission: 'dashboard.view', color: 'theme-orange' },
        { label: 'Purchase Orders', path: '/orders', icon: Truck, permission: 'manager.view', color: 'theme-cyan' },
        { label: 'Expenses', path: '/expenses', icon: CreditCard, permission: 'dashboard.view', color: 'theme-red' },
        { label: 'Categories', path: '/categories', icon: Folder, permission: 'dashboard.view', color: 'theme-purple' },
        { label: 'Credit Bills', path: '/credit-bills', icon: Wallet, permission: 'dashboard.view', color: 'theme-indigo' },
        { label: 'Credit Notes', path: '/credit-notes', icon: FileText, permission: 'dashboard.view', color: 'theme-blue' },
        { label: 'Loyalty', path: '/loyalty-settings', icon: Star, permission: 'dashboard.view', color: 'theme-orange' },
        { label: 'Barcodes', path: '/barcodes', icon: Package, permission: 'dashboard.view', color: 'theme-green' },
        { label: 'Coupons', path: '/coupons', icon: Ticket, permission: 'dashboard.view', color: 'theme-purple' },
        { label: 'Database', path: '/database', icon: Database, permission: 'dashboard.view', color: 'theme-cyan' },
        { label: 'Employees', path: '/employees', icon: Users, permission: 'employees.view', color: 'theme-indigo' },
        { label: 'Store Settings', path: '/settings/store', icon: Settings, permission: 'dashboard.view', color: 'theme-red' },
    ], []);

    const [licenseStatus, setLicenseStatus] = useState(null);
    const [driveStatus, setDriveStatus] = useState(false);

    const fetchStatusData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const headers = { Authorization: `Bearer ${token}` };
            const [driveRes, licenseRes] = await Promise.all([
                axios.get('/api/backup/drive/status', { headers }),
                axios.get('/api/license/status', { headers })
            ]);
            setDriveStatus(driveRes.data?.connected || false);
            setLicenseStatus(licenseRes.data || null);
        } catch (err) {
            // Silently fail - don't log on polling errors to avoid console spam
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        if (!hasPermission('dashboard.view')) return;

        // Initial load
        fetchStatusData();
        axios.get('/api/settings/store', { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setStoreSettings(res.data))
            .catch(() => { });

        // Real-time polling every 8 seconds
        const pollInterval = setInterval(() => fetchStatusData(), 8000);
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
    const [aboutTab, setAboutTab] = useState('website'); // 'website' or 'email'

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
                <div className="dashboard-title">
                    <p className="dashboard-greeting">{(() => {
                        const h = new Date().getHours();
                        if (h < 12) return '☀️ Good Morning';
                        if (h < 17) return '🌤️ Good Afternoon';
                        return '🌙 Good Evening';
                    })()}</p>
                    <h1>{storeSettings?.store_name || 'Dashboard'}</h1>
                    <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>



                {/* Header Actions */}
                <div className="dashboard-header-actions">
                    {/* Status Indicators Stack */}
                    <div className="status-indicators-stack">
                        {/* WhatsApp Status */}
                        <WhatsAppConnectionBtn />

                        {/* Google Drive Status */}
                        <div
                            className={`status-card status-card-custom ${driveStatus ? 'connected' : 'disconnected'}`}
                            onClick={() => {
                                if (driveStatus) {
                                    toast.success('Backup drive is already connected!');
                                } else {
                                    navigate('/database');
                                }
                            }}
                        >
                            <div className="status-content">
                                <div className="status-dot"></div>
                                <Database size={14} />
                                <span>Backup</span>
                            </div>
                        </div>

                    </div>

                    {/* POS Button */}
                    <Link to="/pos-new" className="btn-primary pos-launch-btn">
                        <ShoppingCart size={28} />
                        <span className="pos-launch-btn-text">POS</span>
                    </Link>
                </div>
            </div>

            {/* Quick Access Hub */}
            <div className={`dashboard-content-wrapper ${refreshing ? 'refreshing' : ''}`}>


                {/* Quick Launch Section */}
                <h2 className="dashboard-section-title"><Rocket size={20} /> Quick Launch</h2>
                <div className="hub-grid hub-grid-quick">
                    {quickLaunchItems.map((item, idx) => {
                        const Icon = item.icon;
                        if (item.permission && !hasPermission(item.permission)) return null;

                        return (
                            <Link key={idx} to={item.path} className="hub-card hub-card-quick">
                                <div className={`hub-icon ${item.color} hub-icon-circle`}>
                                    <Icon size={22} />
                                </div>
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </div>

                <h2 className="dashboard-section-title"><Settings size={20} /> Systems & Management</h2>
                <div className="hub-grid hub-grid-mgmt">
                    {hubItems.map((item, idx) => {
                        const Icon = item.icon;
                        if (!hasPermission(item.permission)) return null;

                        return (
                            <Link key={idx} to={item.path} className="hub-card">
                                <div className={`hub-icon ${item.color} hub-icon-circle`}>
                                    <Icon size={20} />
                                </div>
                                <span>{item.label}</span>
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
                    <span>Shortcuts</span>
                </button>
                <button
                    className="dashboard-action-btn about-btn"
                    onClick={() => setShowAboutModal(true)}
                    title="About Salescope"
                >
                    <Info size={18} />
                    <span>About</span>
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
                                alt="Salescope"
                                className="about-logo"
                            />
                            <h2>Salescope</h2>
                            <p className="about-version">Retail Management System</p>
                            
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
                            <p>© {new Date().getFullYear()} Salescope. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
};

export default Dashboard;
