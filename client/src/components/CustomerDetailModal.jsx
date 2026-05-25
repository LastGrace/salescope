import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Clock, FileText, User, Save, Eye, Edit, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ViewBillModal from './ViewBillModal';
import '../styles/Customers.css';

const CustomerDetailModal = ({ customer, onClose, onUpdate }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [viewingCustomer, setViewingCustomer] = useState(customer);
    const [activeTab, setActiveTab] = useState('credit');
    const [customerCreditBills, setCustomerCreditBills] = useState([]);
    const [customerHistory, setCustomerHistory] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Editable fields
    const [editName, setEditName] = useState(customer.name);
    const [editPhone, setEditPhone] = useState(customer.phone);

    // View & Edit Bill logic
    const [selectedSale, setSelectedSale] = useState(null);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [editSaleId, setEditSaleId] = useState(null);

    useEffect(() => {
        if (viewingCustomer?.id) {
            fetchCustomerDetails(viewingCustomer.id);
        }
    }, [viewingCustomer?.id]);

    const fetchCustomerDetails = async (id) => {
        setLoadingDetails(true);
        try {
            const [billsRes, historyRes] = await Promise.all([
                axios.get(`/api/customers/${id}/credit-bills`),
                axios.get(`/api/customers/${id}/history`)
            ]);
            setCustomerCreditBills(billsRes.data);
            setCustomerHistory(historyRes.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load customer details');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleUpdateCustomer = async (e) => {
        e.preventDefault();
        const cleanPhone = editPhone.replace(/\D/g, '');
        let formattedPhone = editPhone;

        if (cleanPhone.length === 10) formattedPhone = '+91' + cleanPhone;
        else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) formattedPhone = '+' + cleanPhone;
        else return toast.error('Please enter a valid 10-digit phone number.');

        try {
            await axios.put(`/api/customers/${viewingCustomer.id}`, { name: editName, phone: formattedPhone });
            toast.success('Customer updated');
            setViewingCustomer({ ...viewingCustomer, name: editName, phone: formattedPhone });
            if (onUpdate) onUpdate();
        } catch (err) {
            toast.error('Update failed');
        }
    };

    const handleViewBill = async (id) => {
        try {
            const res = await axios.get(`/api/sales/${id}`);
            setSelectedSale(res.data);
        } catch (err) {
            toast.error('Failed to load bill');
        }
    };

    const handleEditClick = (id) => {
        setEditSaleId(id);
        setShowPasswordModal(true);
    };

    const handlePasswordSubmit = async () => {
        try {
            // const user = JSON.parse(localStorage.getItem('user') || '{}');
            await axios.post('/api/auth/verify-password', { password: passwordInput, userId: user.id });
            const res = await axios.get(`/api/sales/${editSaleId}`);
            const sale = res.data;
            const cartItems = sale.items.map(item => ({
                id: item.product_id,
                name: item.product_name,
                barcode: item.barcode,
                price: parseFloat(item.price_at_sale) || 0,
                count: parseFloat(item.quantity) || 1,
                discountValue: parseFloat(item.discount) || 0,
                discountType: 'rs',
                stock_quantity: 1000
            }));
            navigate('/pos-new', {
                state: {
                    cartItems,
                    customerId: sale.customer_id,
                    editingSale: { id: sale.id, discount_total: sale.discount_total }
                }
            });
            setShowPasswordModal(false);
            setPasswordInput('');
            onClose(); // Close the detail modal as we are navigating away
        } catch (err) {
            toast.error(err.response?.data?.message || 'Authentication failed');
        }
    };

    const getBillStatus = (bill) => {
        const splitAmount = parseFloat(bill.split_credit_amount || 0);
        if (bill.payment_method === 'pay_later') return 'pending';
        if (splitAmount > 0) return 'partial';
        if (bill.was_pay_later) return 'paid';
        return 'pending';
    };

    return (
        <div className="customers-modal-overlay" style={{ zIndex: 1300 }}>
            <div className="card" style={{ width: '95%', maxWidth: '1200px', height: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', background: 'var(--bg-card)' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
                            {viewingCustomer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{viewingCustomer.name}</h2>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Customer ID: #{viewingCustomer.id}</span>
                        </div>
                    </div>
                    <button className="btn-icon" onClick={onClose}><X size={24} /></button>
                </div>

                <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    <div className="card" style={{ padding: '0.75rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'sm', marginBottom: 0 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={14} /> Credit Info</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>₹{parseFloat(viewingCustomer.total_credit_note_balance || 0).toFixed(2)}</div>
                    </div>
                    <div className="card" style={{ padding: '0.75rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'sm', marginBottom: 0 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={14} /> Loyalty Points</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#8b5cf6' }}>{viewingCustomer.loyalty_points || 0}</div>
                    </div>
                    <div className="card" style={{ padding: '0.75rem 1rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'sm', marginBottom: 0 }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CreditCard size={14} /> Debt</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444' }}>₹{parseFloat(viewingCustomer.credit_balance || 0).toFixed(2)}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <div className="custom-scrollbar" style={{ width: '300px', padding: '1.5rem', borderRight: '1px solid var(--border-color)', overflowY: 'auto', background: 'var(--bg-main)', minHeight: 0 }}>
                        <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><User size={16} /> Contact Info</h4>
                        <form onSubmit={handleUpdateCustomer}>
                            <div className="customers-form-group"><label style={{ fontSize: '0.85rem' }}>Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} required /></div>
                            <div className="customers-form-group"><label style={{ fontSize: '0.85rem' }}>Phone</label><input className="input" value={editPhone} onChange={e => setEditPhone(e.target.value)} /></div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}><Save size={14} style={{ marginRight: '0.5rem' }} /> Save Changes</button>
                        </form>
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
                            <button style={{ padding: '1rem 2rem', background: activeTab === 'credit' ? 'var(--bg-card)' : 'var(--bg-main)', border: 'none', borderBottom: activeTab === 'credit' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'credit' ? 'bold' : 'normal', cursor: 'pointer', color: 'var(--text-main)' }} onClick={() => setActiveTab('credit')}>Credit Bills</button>
                            <button style={{ padding: '1rem 2rem', background: activeTab === 'history' ? 'var(--bg-card)' : 'var(--bg-main)', border: 'none', borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : 'none', fontWeight: activeTab === 'history' ? 'bold' : 'normal', cursor: 'pointer', color: 'var(--text-main)' }} onClick={() => setActiveTab('history')}>Bill History</button>
                        </div>
                        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: 'var(--bg-card)', minHeight: 0 }}>
                            {loadingDetails ? <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div> : (
                                activeTab === 'credit' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                        <div>
                                            <h4 style={{ color: '#be123c', borderBottom: '1px solid #fecdd3', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Pending / Partial Bills</h4>
                                            <table className="table" style={{ fontSize: '0.9rem' }}>
                                                <thead><tr style={{ background: 'var(--bg-main)' }}><th>ID</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                                                <tbody>
                                                    {customerCreditBills.filter(b => getBillStatus(b) === 'pending' || getBillStatus(b) === 'partial').length === 0 ? (
                                                        <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No pending bills</td></tr>
                                                    ) : (
                                                        customerCreditBills.filter(b => getBillStatus(b) === 'pending' || getBillStatus(b) === 'partial').map(b => (
                                                            <tr key={b.id}>
                                                                <td>#{b.id}</td>
                                                                <td>{new Date(b.created_at).toLocaleDateString()}</td>
                                                                <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#ef4444' }}>₹{parseFloat(b.pending_amount || b.credit_amount).toFixed(2)}</td>
                                                                <td><span className="badge">{getBillStatus(b).toUpperCase()}</span></td>
                                                                <td><div style={{ display: 'flex', gap: '0.5rem' }}><button className="btn-icon" onClick={() => handleViewBill(b.id)}><Eye size={16} /></button><button className="btn-icon" onClick={() => handleEditClick(b.id)}><Edit size={16} /></button></div></td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div>
                                            <h4 style={{ color: '#15803d', borderBottom: '1px solid #bbf7d0', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Paid Credit History</h4>
                                            <table className="table" style={{ fontSize: '0.9rem' }}>
                                                <thead><tr style={{ background: 'var(--bg-main)' }}><th>ID</th><th>Date</th><th style={{ textAlign: 'right' }}>Total</th><th>Status</th><th>Actions</th></tr></thead>
                                                <tbody>
                                                    {customerCreditBills.filter(b => getBillStatus(b) === 'paid').length === 0 ? (
                                                        <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No history</td></tr>
                                                    ) : (
                                                        customerCreditBills.filter(b => getBillStatus(b) === 'paid').map(b => (
                                                            <tr key={b.id}>
                                                                <td>#{b.id}</td>
                                                                <td>{new Date(b.created_at).toLocaleDateString()}</td>
                                                                <td style={{ textAlign: 'right', opacity: 0.7 }}>₹{parseFloat(b.total_amount).toFixed(2)}</td>
                                                                <td><span className="badge">PAID</span></td>
                                                                <td><div style={{ display: 'flex', gap: '0.5rem' }}><button className="btn-icon" onClick={() => handleViewBill(b.id)}><Eye size={16} /></button><button className="btn-icon" onClick={() => handleEditClick(b.id)}><Edit size={16} /></button></div></td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <table className="table" style={{ fontSize: '0.9rem' }}>
                                        <thead><tr><th>Bill ID</th><th>Date</th><th style={{ textAlign: 'right' }}>Total</th><th>Method</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {customerHistory.map(b => (
                                                <tr key={b.id}>
                                                    <td>#{b.id}</td>
                                                    <td>{new Date(b.created_at).toLocaleDateString()}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{parseFloat(b.total_amount).toFixed(2)}</td>
                                                    <td>{b.payment_method}</td>
                                                    <td><div style={{ display: 'flex', gap: '0.5rem' }}><button className="btn-icon" onClick={() => handleViewBill(b.id)}><Eye size={16} /></button><button className="btn-icon" onClick={() => handleEditClick(b.id)}><Edit size={16} /></button></div></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {selectedSale && <ViewBillModal sale={selectedSale} onClose={() => setSelectedSale(null)} />}
            {showPasswordModal && (
                <div className="customers-modal-overlay" style={{ zIndex: 1400 }}>
                    <div className="card" style={{ width: '300px', padding: '1.5rem' }}>
                        <h3>Confirm Edit</h3>
                        <form onSubmit={(e) => { e.preventDefault(); handlePasswordSubmit(); }}>
                            <input type="password" className="input" placeholder="Password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} autoFocus style={{ marginBottom: '1rem' }} />
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Confirm</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerDetailModal;
