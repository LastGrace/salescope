import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
    CreditCard, Package, Wallet, Ban, Ticket, Users,
    Star, RotateCcw, Folder, FileText,
    Database, Settings, ShoppingCart, TrendingUp, ChartNoAxesCombined, Plus, Smartphone, Truck,
    Store, History, Info
} from 'lucide-react';

import '../styles/Dashboard.css';
import '../styles/Modal.css';

import WhatsAppConnectionBtn from '../components/WhatsAppConnectionBtn';
import ShortcutModal from '../components/ShortcutModal';

import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';
import AboutModal from '../components/dashboard/AboutModal';
import QuickLaunchGrid from '../components/dashboard/QuickLaunchGrid';
import ManagementGrid from '../components/dashboard/ManagementGrid';

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
        { label: 'WhatsApp History', path: '/whatsapp-activity', icon: History, permission: 'dashboard.view', color: 'theme-cyan' },
        { label: 'Employees', path: '/employees', icon: Users, permission: 'employees.view', color: 'theme-indigo' },
        { label: 'Store Settings', path: '/settings/store', icon: Settings, permission: 'dashboard.view', color: 'theme-red' },
    ], []);

    const [licenseStatus, setLicenseStatus] = useState(null);
    const [driveStatus, setDriveStatus] = useState(false);

    const fetchStatusData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        const headers = { Authorization: `Bearer ${token}` };
        
        axios.get('/api/backup/drive/status', { headers })
            .then(res => setDriveStatus(res.data?.connected || false))
            .catch(() => {})
            .finally(() => { setRefreshing(false); setLoading(false); });

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
                {loading ? (
                    <DashboardSkeleton />
                ) : (
                    <>
                        <QuickLaunchGrid quickLaunchItems={quickLaunchItems} hasPermission={hasPermission} />
                        <ManagementGrid hubItems={hubItems} hasPermission={hasPermission} />
                    </>
                )}
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
                <AboutModal onClose={() => setShowAboutModal(false)} licenseStatus={licenseStatus} />
            )}
        </div>
    );
};

export default Dashboard;
