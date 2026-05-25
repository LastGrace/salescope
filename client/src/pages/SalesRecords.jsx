import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Eye, Download, Upload, Search, Calendar, Filter, CirclePlus, SquarePlus, SquareMinus, Trash, Edit, ShoppingCart } from 'lucide-react';
import * as XLSX from 'xlsx';
import ViewBillModal from '../components/ViewBillModal';
import '../styles/SalesRecords.css';

import toast from 'react-hot-toast'; // Added import
import { useAuth } from '../context/AuthContext';

const SalesRecords = () => {
    const [sales, setSales] = useState([]);
    const [selectedSale, setSelectedSale] = useState(null); // For modal
    const [visibleMargins, setVisibleMargins] = useState(new Set()); // Track which rows have margin revealed
    const [showStats, setShowStats] = useState(false); // Toggle Stats Grid visibility

    // Password Modal State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordAction, setPasswordAction] = useState({ type: '', id: null }); // type: 'delete' | 'edit'



    const navigate = useNavigate();
    const { user } = useAuth();

    // Helper for local date YYYY-MM-DD
    const getTodayStr = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Filters
    const [startDate, setStartDate] = useState(getTodayStr());
    const [endDate, setEndDate] = useState(getTodayStr());
    const [paymentMethod, setPaymentMethod] = useState('all');
    const [search, setSearch] = useState('');

    const [stats, setStats] = useState({ totalSale: 0, totalProfit: 0, marginPercentage: 0, byMethod: {} });
    const [selectedMethods, setSelectedMethods] = useState(null); // null = show all, Set = selected ones

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchSales();
        }, 500); // Debounce search
        return () => clearTimeout(timeoutId);
    }, [startDate, endDate, paymentMethod, search]);

    const fetchSales = async () => {
        try {
            const params = { startDate, endDate, paymentMethod, search };
            const [resSales, resStats] = await Promise.all([
                axios.get('/api/sales', { params }),
                axios.get('/api/sales/stats', { params })
            ]);
            setSales(resSales.data);
            setStats(resStats.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleViewBill = async (id) => {
        try {
            const res = await axios.get(`/api/sales/${id}`);
            setSelectedSale(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load bill details');
        }
    };

    const handleDeleteClick = (id) => {
        setPasswordAction({ type: 'delete', id });
        setShowPasswordModal(true);
    };

    const handleEditClick = (id) => {
        setPasswordAction({ type: 'edit', id });
        setShowPasswordModal(true);
    };

    const handlePasswordSubmit = async () => {
        if (!passwordInput) return;
        const { type, id } = passwordAction;

        try {
            // const user = JSON.parse(localStorage.getItem('user') || '{}');

            if (type === 'delete') {
                await axios.delete(`/api/sales/${id}`, { data: { password: passwordInput } });
                toast.success('Bill deleted successfully');
                fetchSales();
            } else if (type === 'edit') {
                // 1. Verify Password via API
                await axios.post('/api/auth/verify-password', {
                    password: passwordInput,
                    userId: user.id
                });

                // 2. Fetch details
                const res = await axios.get(`/api/sales/${id}`);
                const sale = res.data;

                // 3. Map items to cart format
                // ENSURE all values are numbers and discountType is set
                const cartItems = sale.items.map(item => ({
                    id: item.product_id,
                    name: item.product_name,
                    barcode: item.barcode,
                    price: parseFloat(item.price_at_sale) || 0,
                    count: parseFloat(item.quantity) || 1,
                    discountValue: parseFloat(item.discount) || 0,
                    discountType: 'rs', // Default to RS since DB stores absolute value
                    stock_quantity: 1000 // Placeholder to pass validation
                }));

                // 4. Navigate to POS with editing context
                navigate('/pos-new', {
                    state: {
                        cartItems,
                        customerId: sale.customer_id,
                        editingSale: {
                            id: sale.id,
                            discount_total: sale.discount_total
                        }
                    }
                });
            }
            setShowPasswordModal(false);
            setPasswordInput('');
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Authentication failed');
        }
    };

    const handleExport = () => {
        // Use server-side export for reliability
        const token = localStorage.getItem('token');
        const queryParams = new URLSearchParams({ startDate, endDate, paymentMethod, search, token }).toString();
        // Check if we are in dev mode (vite proxy handles /api, but window.open needs full url if not proxied correctly, 
        // usually /api/... works if proxy is set up in vite.config, assuming standard setup)
        // Actually, let's just use /api/export/sales...

        // We'll use a temporary link to force download without opening new tab if possible, or just window.open
        window.open(`/api/export/sales?${queryParams}`, '_blank');
    };

    return (
        <div className="sales-container">
            <div className="sales-header">
                <div>
                    <div className="sales-title-group">
                        <div className="sales-icon-box">
                            <ShoppingCart size={24} />
                        </div>
                        <div className="sales-title">
                            <h1>Sales Records</h1>
                            <p>Manage and view all your transaction history</p>
                        </div>
                    </div>
                </div>
                <div className="sales-actions">
                    <button
                        className={`btn ${showStats ? 'btn-primary' : 'sales-btn-outline'}`}
                        onClick={() => setShowStats(!showStats)}
                        title={showStats ? "Hide Stats" : "Show Stats"}
                    >
                        <Eye size={16} /> {showStats ? "Hide Stats" : "Show Stats"}
                    </button>
                    <button className="btn sales-btn-outline" onClick={handleExport}>
                        <Download size={16} /> Export Excel
                    </button>
                    {/* Placeholder for Import */}
                    <button className="btn sales-btn-outline btn-disabled" title="Import feature coming soon">
                        <Upload size={16} /> Import CSV
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            {showStats && (
                <div className="sales-stats-grid animate-fade-in">
                    <div className="sales-card sales-card-total">
                        <div className="sales-stat-label">Total Sales</div>
                        <div className="sales-stat-value">₹{stats.totalSale.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="sales-card sales-card-payments">
                        <div className="sales-stat-label">Payment Methods</div>
                        <div className="sales-payment-methods">
                            {Object.entries(stats.byMethod || {}).map(([method, data]) => {
                                const isSelected = !selectedMethods || selectedMethods.has(method);
                                return (
                                    <div
                                        key={method}
                                        className={`sales-payment-badge ${isSelected ? 'selected' : 'dimmed'}`}
                                        onClick={() => {
                                            setSelectedMethods(prev => {
                                                const allMethods = Object.keys(stats.byMethod);
                                                if (!prev) {
                                                    // First click: select only this method
                                                    return new Set([method]);
                                                }
                                                const next = new Set(prev);
                                                if (next.has(method)) {
                                                    next.delete(method);
                                                    // If none selected, show all
                                                    if (next.size === 0) return null;
                                                } else {
                                                    next.add(method);
                                                    // If all selected, reset to null (show all)
                                                    if (next.size === allMethods.length) return null;
                                                }
                                                return next;
                                            });
                                        }}
                                        style={{ cursor: 'pointer', opacity: isSelected ? 1 : 0.4 }}
                                        title={isSelected ? 'Click to exclude' : 'Click to include'}
                                    >
                                        <span className="text-bold">{method}</span>: ₹{data.amount.toLocaleString('en-IN')}
                                    </div>
                                );
                            })}
                        </div>
                        {selectedMethods && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Filtered Total: ₹{Object.entries(stats.byMethod || {})
                                    .filter(([m]) => selectedMethods.has(m))
                                    .reduce((sum, [, d]) => sum + d.amount, 0)
                                    .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                <button
                                    onClick={() => setSelectedMethods(null)}
                                    style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                                >Show All</button>
                            </div>
                        )}
                    </div>
                    <div className={`sales-card sales-card-profit ${stats.totalProfit < 0 ? 'negative' : ''}`}>
                        <div className="sales-stat-label">Total Profit (Margin)</div>
                        <div className="text-profit-large" style={{ color: stats.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            ₹{stats.totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            <span className="text-profit-sub">
                                ({stats.marginPercentage}%)
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters Bar */}
            <div className="sales-filters-bar">
                <div className="sales-filter-group">
                    <Calendar size={16} className="text-muted" />
                    <input
                        type="date"
                        className="input input-compact"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                    />
                    <span className="text-muted">to</span>
                    <input
                        type="date"
                        className="input input-compact"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                    />
                </div>

                <div className="sales-filter-group">
                    <Filter size={16} className="text-muted" />
                    <select
                        className="input input-select-compact"
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value)}
                    >
                        <option value="all">All Payments</option>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="upi">UPI</option>
                        <option value="exchange">Exchange</option>
                        <option value="refund">Refund</option>
                        <option value="pay_later">Pay Later</option>
                    </select>
                </div>

                <div className="pos-search-container sales-search-container">
                    <Search className="text-muted search-icon-abs" size={18} />
                    <input
                        type="text"
                        className="pos-search-input search-input-padding"
                        placeholder="Search Bill #, Name, Phone..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="sales-table-container">
                <table className="table">
                    <thead className="sales-table-header">
                        <tr>
                            <th>Bill No</th>
                            <th>Date & Time</th>
                            <th>Customer</th>
                            <th>Payment</th>
                            <th>Amount</th>
                            <th>Actions</th>
                            <th>
                                <button
                                    onClick={() => {
                                        if (visibleMargins.size === sales.length) {
                                            setVisibleMargins(new Set());
                                        } else {
                                            setVisibleMargins(new Set(sales.map(s => s.id)));
                                        }
                                    }}
                                    title="Toggle All Margins"
                                    className="btn-toggle-margin"
                                >
                                    <CirclePlus size={18} />
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sales.length > 0 ? (
                            sales.map(s => (
                                <tr key={s.id}>
                                    <td>#{s.id}</td>
                                    <td>{new Date(s.created_at).toLocaleString()}</td>
                                    <td>
                                        <div>{s.customer_name || 'Guest'}</div>
                                        {s.customer_phone && <div className="text-small-muted">{s.customer_phone}</div>}
                                    </td>
                                    <td>
                                        {s.payment_details ? (
                                            <div className="sales-payment-details">
                                                {s.payment_details.split(', ').map((p, i) => {
                                                    const parts = p.split(':');
                                                    const m = parts[0];
                                                    const a = parts[1] || '0';
                                                    return (
                                                        <span key={i} className="sales-payment-tag">
                                                            <span className="font-medium">{m}</span>
                                                            <span className="text-muted">₹{a}</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <span className="sales-simple-tag">
                                                {s.payment_method || 'Unknown'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="font-bold">₹{(s.display_amount != null ? s.display_amount : s.total_amount)}</td>
                                    <td>
                                        <div className="sales-row-actions">
                                            <button className="btn btn-primary sales-action-btn" onClick={() => handleViewBill(s.id)} title="View Details">
                                                <Eye size={16} />
                                            </button>
                                            <button className="btn sales-action-btn sales-btn-edit" onClick={() => handleEditClick(s.id)} title="Edit Bill (Void & Reload)">
                                                <Edit size={16} />
                                            </button>
                                            <button className="btn sales-action-btn sales-btn-delete" onClick={() => handleDeleteClick(s.id)} title="Delete Bill">
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </td>
                                    <td>
                                        {visibleMargins.has(s.id) && (
                                            <div className="sales-margin-display" style={{ color: s.total_profit >= 0 ? 'green' : 'red' }}>
                                                ₹{parseFloat(s.total_profit || 0).toLocaleString()}
                                                <div className="text-xs">
                                                    ({s.total_amount > 0 ? ((s.total_profit / s.total_amount) * 100).toFixed(1) : 0}%)
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="text-center-muted">
                                    No records found for the selected filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* View Bill Modal */}
            {selectedSale && <ViewBillModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="sales-password-overlay">
                    <div className="card sales-password-content">
                        <h3 className="mt-0">Confirm {passwordAction.type === 'delete' ? 'Delete' : 'Edit'}</h3>
                        <p className="text-sm-muted-mb">
                            Please enter your password to confirm.
                        </p>
                        <form onSubmit={(e) => { e.preventDefault(); handlePasswordSubmit(); }}>
                            <input
                                type="password"
                                className="input mb-4"
                                placeholder="Password"
                                value={passwordInput}
                                onChange={e => setPasswordInput(e.target.value)}
                                autoFocus
                            />
                            <div className="flex-end-gap">
                                <button type="button" className="btn" onClick={() => { setShowPasswordModal(false); setPasswordInput(''); }}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Confirm</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesRecords;
