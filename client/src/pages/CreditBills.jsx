import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, User, Eye, Edit, CreditCard, Clock, CheckCircle, ShieldAlert, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import ViewBillModal from '../components/ViewBillModal';
import '../styles/CreditBills.css';

const CreditBills = () => {
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'

    const navigate = useNavigate();
    const { user } = useAuth();

    // View/Edit State
    const [selectedSale, setSelectedSale] = useState(null);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordAction, setPasswordAction] = useState({ type: '', id: null });

    const fetchCreditBills = async () => {
        try {
            const res = await axios.get('/api/sales', { params: { paymentMethod: 'credit_history' } });
            setBills(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCreditBills();
    }, []);

    const getCreditAmount = (bill) => {
        if (!bill) return 0;
        if (bill.payment_method === 'pay_later') {
            return parseFloat(bill.total_amount) || 0;
        }
        if (typeof bill.payment_details === 'string') {
            const regex = /(?:pay[\s_]*later)\s*:\s*([\d.]+)/i;
            const match = bill.payment_details.match(regex);
            if (match && match[1]) {
                return parseFloat(match[1]);
            }
        }
        return 0;
    };

    const filteredBills = bills.filter(bill =>
        bill &&
        ((bill.customer_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
            (bill.id && bill.id.toString().includes(search)))
    );

    const pendingBills = filteredBills.filter(b => getCreditAmount(b) > 0);
    const paidBills = filteredBills.filter(b => b.was_pay_later && getCreditAmount(b) === 0);
    const totalCredit = pendingBills.reduce((sum, bill) => sum + getCreditAmount(bill), 0);

    const handleViewBill = async (id) => {
        try {
            const res = await axios.get(`/api/sales/${id}`);
            setSelectedSale(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load bill details');
        }
    };

    const handleEditClick = (id) => {
        setPasswordAction({ type: 'edit', id });
        setShowPasswordModal(true);
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!passwordInput) return;
        const { id } = passwordAction;

        try {
            // const user = JSON.parse(localStorage.getItem('user') || '{}');
            await axios.post('/api/auth/verify-password', {
                password: passwordInput,
                userId: user.id
            });

            const res = await axios.get(`/api/sales/${id}`);
            const sale = res.data;

            const cartItems = (sale.items || []).map(item => ({
                id: item.product_id,
                name: item.product_name,
                barcode: item.barcode,
                price: parseFloat(item.price_at_sale) || 0,
                quantity: parseFloat(item.quantity) || 1,
                discountValue: parseFloat(item.discount) || 0,
                discountType: 'rs',
                stock_quantity: 1000
            }));

            navigate('/pos-new', {
                state: {
                    cartItems,
                    customerId: sale.customer_id,
                    editingSale: {
                        id: sale.id,
                        discount_total: sale.discount_total,
                        paymentMethod: sale.payment_method
                    }
                }
            });

            setShowPasswordModal(false);
            setPasswordInput('');
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Authentication failed');
        }
    };

    return (
        <div className="credit-bills-container credit-animate">
            <header className="credit-header">
                <div className="credit-title-group">
                    <div className="credit-icon-box">
                        <CreditCard size={24} />
                    </div>
                    <div className="credit-title">
                        <h1>Credit Ledger</h1>
                        <p>Manage store credits and pay-later settlements</p>
                    </div>
                </div>
                <div className="credit-search-wrapper">
                    <Search className="credit-search-icon" size={20} />
                    <input
                        className="input credit-search-input"
                        placeholder={`Filter ${activeTab}...`}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </header>

            <div className="credit-kpi-grid">
                <div className="credit-kpi-card credit-outstanding">
                    <div className="credit-kpi-info">
                        <span className="credit-kpi-label">Total Outstanding</span>
                        <span className="credit-kpi-value text-danger">₹{totalCredit.toFixed(2)}</span>
                    </div>
                    <div className="credit-kpi-icon">
                        <Clock size={20} />
                    </div>
                </div>
                <div className="credit-kpi-card credit-pending">
                    <div className="credit-kpi-info">
                        <span className="credit-kpi-label">Active Credits</span>
                        <span className="credit-kpi-value">{pendingBills.length}</span>
                    </div>
                    <div className="credit-kpi-icon">
                        <ShieldAlert size={20} />
                    </div>
                </div>
                <div className="credit-kpi-card credit-settled">
                    <div className="credit-kpi-info">
                        <span className="credit-kpi-label">Settled Bills</span>
                        <span className="credit-kpi-value">{paidBills.length}</span>
                    </div>
                    <div className="credit-kpi-icon">
                        <CheckCircle size={20} />
                    </div>
                </div>
            </div>

            <div className="credit-toolbar">
                <div className="credit-tabs-container">
                    <button
                        className={`credit-tab ${activeTab === 'pending' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pending')}
                    >
                        <ShieldAlert size={16} />
                        Pending Settlements
                    </button>
                    <button
                        className={`credit-tab ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <CheckCircle size={16} />
                        Settlement History
                    </button>
                </div>
            </div>

            <main className="credit-content custom-scrollbar">
                {/* Active Ledger */}
                {activeTab === 'pending' && (
                    <section className="credit-section-card">
                        <div className="credit-section-header pending-header">
                            <div className="section-title">
                                <h3>Active Credit Items</h3>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#be123c' }}>{pendingBills.length} RECORDS</span>
                        </div>
                        <table className="credit-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Date</th>
                                    <th>Customer</th>
                                    <th className="val-right">Credit Amount</th>
                                    <th className="val-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="5" className="val-center" style={{ padding: '3rem' }}>Loading active ledger...</td></tr>
                                ) : pendingBills.length === 0 ? (
                                    <tr><td colSpan="5" className="val-center" style={{ padding: '3rem', opacity: 0.5 }}>No active credit settlements found</td></tr>
                                ) : (
                                    pendingBills.map(bill => (
                                        <tr key={bill.id} className="pending-row">
                                            <td className="mono">#{bill.id}</td>
                                            <td>{new Date(bill.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <div className="credit-user-info">
                                                    <div className="user-avatar pending-avatar"><User size={14} /></div>
                                                    <span className="customer-name">{bill.customer_name || 'Walking Customer'}</span>
                                                </div>
                                            </td>
                                            <td className="val-right text-danger">₹{getCreditAmount(bill).toFixed(2)}</td>
                                            <td className="val-center">
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                    <button className="btn-icon" onClick={() => handleViewBill(bill.id)} title="Details"><Eye size={18} /></button>
                                                    <button className="btn-icon" onClick={() => handleEditClick(bill.id)} title="Settle/Edit"><Edit size={18} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </section>
                )}

                {/* History Ledger */}
                {activeTab === 'history' && (
                    <section className="credit-section-card">
                        <div className="credit-section-header paid-header">
                            <div className="section-title">
                                <h3>Settled Ledger history</h3>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>{paidBills.length} COMPLETED</span>
                        </div>
                        <table className="credit-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Date</th>
                                    <th>Customer</th>
                                    <th className="val-right">Total Settled</th>
                                    <th className="val-center">Reciept</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="5" className="val-center" style={{ padding: '3rem' }}>Loading history...</td></tr>
                                ) : paidBills.length === 0 ? (
                                    <tr><td colSpan="5" className="val-center" style={{ padding: '3rem', opacity: 0.5 }}>No historical settlements found</td></tr>
                                ) : (
                                    paidBills.map(bill => (
                                        <tr key={bill.id} className="paid-row">
                                            <td className="mono">#{bill.id}</td>
                                            <td>{new Date(bill.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <div className="credit-user-info">
                                                    <div className="user-avatar paid-avatar"><User size={14} /></div>
                                                    <span className="customer-name">{bill.customer_name || 'Walking Customer'}</span>
                                                </div>
                                            </td>
                                            <td className="val-right text-success">₹{parseFloat(bill.total_amount).toFixed(2)}</td>
                                            <td className="val-center">
                                                <button className="btn-icon" onClick={() => handleViewBill(bill.id)} title="Details"><Eye size={18} /></button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </section>
                )}
            </main>

            {/* Modals */}
            {selectedSale && (
                <ViewBillModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
            )}

            {showPasswordModal && (
                <div className="credit-auth-overlay">
                    <div className="credit-auth-modal">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>Verify Security</h3>
                            <button className="btn-icon" onClick={() => setShowPasswordModal(false)}><X size={20} /></button>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            Authentication is required to edit or settle existing credit records.
                        </p>
                        <form onSubmit={handlePasswordSubmit}>
                            <input
                                type="password"
                                className="input"
                                autoFocus
                                required
                                value={passwordInput}
                                onChange={e => setPasswordInput(e.target.value)}
                                placeholder="Enter system password"
                            />
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" className="btn" onClick={() => setShowPasswordModal(false)} style={{ flex: 1 }}>Abort</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Unlock Record</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreditBills;
