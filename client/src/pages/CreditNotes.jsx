import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, RotateCcw, Printer, FileText, CheckCircle, Clock, Ban, Wallet, ArrowRightCircle, AlertCircle, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import ViewBillModal from '../components/ViewBillModal';
import '../styles/CreditNotes.css';

const CreditNotes = () => {
    const [creditNotes, setCreditNotes] = useState([]);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('active'); // active, redeemed, expired, all
    const [loading, setLoading] = useState(true);
    const [selectedSale, setSelectedSale] = useState(null);

    useEffect(() => {
        fetchCreditNotes();
    }, []);

    const fetchCreditNotes = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/credit-notes');
            setCreditNotes(res.data);
        } catch (err) {
            console.error(err);
            setCreditNotes([]);
        } finally {
            setLoading(false);
        }
    };

    const handleViewSale = async (billId) => {
        if (!billId) return;
        try {
            const res = await axios.get(`/api/sales/${billId}`);
            setSelectedSale(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const totalLiability = creditNotes
        .filter(n => new Date(n.expiry_date) > new Date() && parseFloat(n.balance) > 0)
        .reduce((sum, n) => sum + parseFloat(n.balance), 0);

    const activeCount = creditNotes.filter(n => new Date(n.expiry_date) > new Date() && parseFloat(n.balance) > 0).length;

    const expiringSoon = creditNotes.filter(n => {
        const daysToExpiry = (new Date(n.expiry_date) - new Date()) / (1000 * 60 * 60 * 24);
        return daysToExpiry > 0 && daysToExpiry <= 7 && parseFloat(n.balance) > 0;
    }).length;

    const filteredNotes = creditNotes.filter(note => {
        const matchesSearch =
            note.code.toLowerCase().includes(search.toLowerCase()) ||
            (note.customer_name && note.customer_name.toLowerCase().includes(search.toLowerCase()));

        if (filter === 'all') return matchesSearch;
        const isExpired = new Date(note.expiry_date) <= new Date();
        const isRedeemed = parseFloat(note.balance) === 0;

        if (filter === 'active') return matchesSearch && !isRedeemed && !isExpired;
        if (filter === 'redeemed') return matchesSearch && isRedeemed;
        if (filter === 'expired') return matchesSearch && isExpired;
        return matchesSearch;
    });

    return (
        <div className="cn-container cn-animate">
            {/* Header */}
            <header className="cn-header">
                <div className="cn-header-top">
                    <div className="cn-title-group">
                        <div className="cn-icon-box">
                            <Wallet size={24} />
                        </div>
                        <div className="cn-title">
                            <h1>Credit Note Ledger</h1>
                            <p>Manage store liabilities and customer refunds</p>
                        </div>
                    </div>

                    <div className="cn-search-wrapper">
                        <Search className="cn-search-icon" size={18} />
                        <input
                            type="text"
                            className="cn-search-input"
                            placeholder="Find code or customer..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="cn-tabs">
                    {['active', 'redeemed', 'expired', 'all'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={clsx('cn-tab-btn', { 'active': filter === f })}
                        >
                            {f}
                        </button>
                    ))}
                    <button className="cn-tab-btn" onClick={fetchCreditNotes} style={{ marginLeft: 'auto', opacity: 0.6 }}>
                        <RotateCcw size={14} />
                    </button>
                </div>
            </header>

            {/* KPI Section */}
            <div className="cn-kpi-grid">
                <div className="cn-kpi-card">
                    <div className="cn-kpi-info">
                        <span className="cn-kpi-label">Total Payable</span>
                        <span className="cn-kpi-value text-primary">₹{totalLiability.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="cn-kpi-icon" style={{ background: 'rgba(225, 29, 72, 0.1)', color: 'var(--primary)' }}>
                        <FileText size={24} />
                    </div>
                </div>

                <div className="cn-kpi-card">
                    <div className="cn-kpi-info">
                        <span className="cn-kpi-label">Active Notes</span>
                        <span className="cn-kpi-value">{activeCount}</span>
                    </div>
                    <div className="cn-kpi-icon" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>
                        <CheckCircle size={24} />
                    </div>
                </div>

                <div className="cn-kpi-card">
                    <div className="cn-kpi-info">
                        <span className="cn-kpi-label">Expiring Soon</span>
                        <span className="cn-kpi-value" style={{ color: '#ea580c' }}>{expiringSoon}</span>
                    </div>
                    <div className="cn-kpi-icon" style={{ background: 'rgba(234, 88, 12, 0.1)', color: '#ea580c' }}>
                        <Clock size={24} />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="cn-content">
                <div className="cn-table-card">
                    <div className="cn-table-wrapper custom-scrollbar">
                        <table className="cn-table">
                            <thead>
                                <tr>
                                    <th>CN Code</th>
                                    <th>Customer Details</th>
                                    <th>Issued On</th>
                                    <th>Valid Until</th>
                                    <th className="val-right">Original</th>
                                    <th className="val-right">Balance</th>
                                    <th className="val-center">Status</th>
                                    <th className="val-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="8" className="val-center" style={{ padding: '4rem' }}>Loading credit ledger...</td></tr>
                                ) : filteredNotes.map(note => {
                                    const isExpired = new Date(note.expiry_date) <= new Date();
                                    const isRedeemed = parseFloat(note.balance) === 0;

                                    return (
                                        <tr key={note.code}>
                                            <td className="font-mono text-primary">{note.code}</td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{note.customer_name || 'Walk-in'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{note.customer_phone || 'No phone'}</div>
                                            </td>
                                            <td>{new Date(note.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                            <td style={{ color: isExpired && !isRedeemed ? '#dc2626' : 'inherit' }}>
                                                {new Date(note.expiry_date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="val-right">₹{parseFloat(note.amount).toFixed(2)}</td>
                                            <td className="val-right" style={{ fontWeight: 800 }}>₹{parseFloat(note.balance).toFixed(2)}</td>
                                            <td className="val-center">
                                                <span className={clsx('cn-badge', {
                                                    'cn-badge-active': !isRedeemed && !isExpired,
                                                    'cn-badge-redeemed': isRedeemed,
                                                    'cn-badge-expired': isExpired && !isRedeemed
                                                })}>
                                                    {isRedeemed ? 'Redeemed' : isExpired ? 'Expired' : 'Active'}
                                                </span>
                                            </td>
                                            <td className="val-center">
                                                <div className="cn-action-group">
                                                    <button className="btn-icon" title="View Sale" onClick={() => handleViewSale(note.sale_id)}>
                                                        <Eye size={16} />
                                                    </button>
                                                    <button className="btn-icon" title="Print" onClick={() => window.print()}>
                                                        <Printer size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!loading && filteredNotes.length === 0 && (
                                    <tr>
                                        <td colSpan="8" className="val-center" style={{ padding: '4rem', color: 'var(--text-muted)' }}>
                                            <AlertCircle size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} /><br />
                                            No credit records matching your criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {selectedSale && (
                <ViewBillModal
                    sale={selectedSale}
                    onClose={() => setSelectedSale(null)}
                />
            )}
        </div>
    );
};

export default CreditNotes;

