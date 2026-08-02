import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import useGlobalShortcuts from '../hooks/useGlobalShortcuts';
import WhatsAppQRModal from './WhatsAppQRModal';
import {
    LayoutDashboard, ShoppingCart, Package, Users, Truck, LogOut,
    Menu, Moon, Sun, Plus, CreditCard, FileText, RotateCcw,
    Folder, Smartphone, Database, ChartNoAxesCombined, Orbit,
    MousePointer2, Hand, TrendingUp, Store, Palette, Settings as SettingsIcon, Barcode, Printer
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeSelector from './ThemeSelector';
import TitleBar from './TitleBar';
import toast from 'react-hot-toast';
import '../styles/Layout.css';

const Layout = () => {
    const { logout, user, hasPermission } = useAuth();
    const { currentTheme, isDarkMode, toggleMode } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [sidebarMode, setSidebarMode] = useState(() => localStorage.getItem('sidebarMode') || 'auto');
    const [showThemeSelector, setShowThemeSelector] = useState(false);

    // Sidebar Mode effect
    useEffect(() => {
        localStorage.setItem('sidebarMode', sidebarMode);
    }, [sidebarMode]);

    const toggleSidebarMode = () => {
        setSidebarMode(prev => prev === 'auto' ? 'logo' : 'auto');
    };

    // Auto-start WhatsApp engine AFTER UI loads, with connection notifications
    useEffect(() => {
        let isCurrentlyConnecting = false;

        const startWhatsApp = async () => {
            try {
                await fetch('/api/whatsapp/start', { method: 'POST' });
            } catch (err) {
                console.error('WhatsApp start error:', err);
            }
        };

        const eventSource = new EventSource('/api/whatsapp/stream');
        
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.status === 'initializing' || data.status === 'connecting') {
                    isCurrentlyConnecting = true;
                    toast.loading('Connecting WhatsApp...', { id: 'wa-status' });
                } else if (data.status === 'connected') {
                    if (isCurrentlyConnecting) {
                        toast.success('WhatsApp Connected Successfully', { id: 'wa-status' });
                        isCurrentlyConnecting = false;
                    }
                } else if (data.status === 'disconnected') {
                    if (isCurrentlyConnecting) {
                        toast.error('WhatsApp Connection Failed', { id: 'wa-status' });
                        isCurrentlyConnecting = false;
                    }
                }
            } catch (e) {}
        };

        // Start engine 1.5 seconds after UI mounts so boot feels instant
        const timer = setTimeout(startWhatsApp, 1500);

        return () => {
            clearTimeout(timer);
            eventSource.close();
        };
    }, []);

    // Global ESC to Back
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                navigate(-1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    const [showWhatsAppQR, setShowWhatsAppQR] = useState(false);
    useGlobalShortcuts({
        onOpenWhatsAppQR: () => setShowWhatsAppQR(true)
    });


    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isPOS = location.pathname === '/pos' || location.pathname === '/pos-new' || location.pathname === '/exchange';

    return (
        <div className="layout">
            {window.electronAPI && <TitleBar />}
            <aside
                className={`sidebar ${isOpen ? '' : 'closed'}`}
                onMouseEnter={() => sidebarMode === 'auto' && setIsOpen(true)}
                onMouseLeave={() => sidebarMode === 'auto' && setIsOpen(false)}
            >
                {/* Header with Toggle */}
                <div
                    className={`logo-area logo-area-wrapper ${sidebarMode === 'logo' ? 'cursor-pointer' : 'cursor-default'}`}
                    onClick={() => sidebarMode === 'logo' && setIsOpen(!isOpen)}
                    title={sidebarMode === 'logo' ? "Click to toggle sidebar" : ""}
                >
                    <div className="logo-container">
                        <div className="logo-icon-wrapper logo-icon-centered">
                            <img src="/Salescope.png" alt="SALESCOPE" className="logo-image" />
                        </div>
                        <span className="logo-text">
                            <span style={{ color: 'var(--primary)' }}>SALE</span>
                            <span style={{ color: '#ffffff' }}>SCOPE</span>
                        </span>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="nav-container">
                    <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Dashboard">
                        <LayoutDashboard size={20} /> <span className="nav-text">Dashboard</span>
                    </NavLink>
                    <NavLink to="/statistics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Statistics">
                        <TrendingUp size={20} /> <span className="nav-text">Statistics</span>
                    </NavLink>
                    <NavLink to="/pos-new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="POS">
                        <ShoppingCart size={20} /> <span className="nav-text">POS</span>
                    </NavLink>
                    <NavLink to="/sales-records" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Sales Records">
                        <ChartNoAxesCombined size={20} /> <span className="nav-text">Sales Records</span>
                    </NavLink>
                    <NavLink to="/inventory" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Inventory">
                        <Package size={20} /> <span className="nav-text">Inventory</span>
                    </NavLink>
                    <NavLink to="/barcodes" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Barcode Studio">
                        <Barcode size={20} /> <span className="nav-text">Barcode Studio</span>
                    </NavLink>
                    <NavLink to="/barcode-printer" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Barcode Printer">
                        <Printer size={20} /> <span className="nav-text">Barcode Printer</span>
                    </NavLink>
                    <NavLink to="/quick-add" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Quick Add">
                        <Plus size={20} /> <span className="nav-text">Quick Add</span>
                    </NavLink>
                    <NavLink to="/customers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Customers">
                        <Users size={20} /> <span className="nav-text">Customers</span>
                    </NavLink>
                    <NavLink to="/whatsapp-bulk" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="WhatsApp">
                        <Smartphone size={20} /> <span className="nav-text">WhatsApp</span>
                    </NavLink>

                    {user?.role === 'manager' && (
                        <NavLink to="/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Purchase Orders">
                            <Truck size={20} /> <span className="nav-text">Purchase Orders</span>
                        </NavLink>
                    )}
                </nav>
                <div className="sidebar-footer">
                    <button
                        type="button"
                        onClick={toggleSidebarMode}
                        className="btn nav-link sidebar-btn-mode sidebar-action-btn"
                        title={`Sidebar Mode: ${sidebarMode === 'auto' ? 'Auto (Hover)' : 'Manual (Logo)'}`}
                    >
                        {sidebarMode === 'auto' ? <MousePointer2 size={20} /> : <Hand size={20} />}
                        <span className="nav-text">Mode: {sidebarMode === 'auto' ? 'Auto' : 'Logo'}</span>
                    </button>
                    <button type="button" onClick={() => setShowThemeSelector(true)} className="btn nav-link sidebar-btn-theme sidebar-action-btn" title="Choose Theme">
                        <Palette size={20} />
                        <span className="nav-text">Theme</span>
                    </button>
                    <button type="button" onClick={handleLogout} className="btn nav-link sidebar-btn-logout sidebar-action-btn" title="Logout">
                        <LogOut size={20} /> <span className="nav-text role-text-capital">{user?.role}</span>
                    </button>
                </div>
            </aside>
            <main className={`main-content ${isPOS ? 'pos-mode' : ''}`}>
                {/* Global Header for Electron Navigation */}

                <React.Suspense fallback={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', color: 'var(--text-muted)' }}>
                        <span style={{ width: 30, height: 30, border: '3px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                    </div>
                }>
                    <Outlet />
                </React.Suspense>
            </main>

            <ThemeSelector
                isOpen={showThemeSelector}
                onClose={() => setShowThemeSelector(false)}
            />
            {showWhatsAppQR && (
                <WhatsAppQRModal
                    onClose={() => setShowWhatsAppQR(false)}
                    onConnected={() => {
                        setShowWhatsAppQR(false);
                        // Optional: Show success toast or notification
                    }}
                />
            )}
        </div>
    );
};

export default Layout;
