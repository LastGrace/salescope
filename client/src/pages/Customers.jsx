import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Download, Upload, RefreshCcw, CreditCard, X, Clock, FileText, User, Users, Star, Search, Save, Eye, Edit, Trash, Smartphone, PencilSparkles, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { normalizePhone } from '../utils/phoneUtils';
import ConfirmModal from '../components/ConfirmModal';
import ViewBillModal from '../components/ViewBillModal';
import CustomerDetailModal from '../components/CustomerDetailModal';
import '../styles/Customers.css';

const Customers = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Confirmation Modal State
    const [confirmAction, setConfirmAction] = useState({ isOpen: false, type: 'single', customerId: null, name: '' });

    const [showForm, setShowForm] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '', loyalty_points: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [messagingSettings, setMessagingSettings] = useState(null);

    useEffect(() => {
        fetchCustomers();
        fetchMessagingSettings();
    }, []);

    const fetchMessagingSettings = async () => {
        try {
            const res = await axios.get('/api/settings/messaging');
            setMessagingSettings(res.data);
        } catch (err) {
            console.error('Failed to fetch messaging settings:', err);
        }
    };

    const isWhatsHubInUse = messagingSettings
        ? (messagingSettings.whatshub_enabled === 1 || messagingSettings.whatshub_enabled === '1' || messagingSettings.whatshub_enabled === true)
        : false;

    const fetchCustomers = async () => {
        try {
            const res = await axios.get('/api/customers');
            setCustomers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredCustomers.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredCustomers.map(c => c.id)));
        }
    };

    const toggleSelect = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const handleBulkDelete = () => {
        setConfirmAction({
            isOpen: true,
            type: 'bulk',
            title: 'Delete Multiple Customers',
            message: `Are you sure you want to delete ${selectedIds.size} customers? Customers with sales history or active credit notes will be skipped automatically.`
        });
    };

    const confirmDeleteAction = async () => {
        try {
            if (confirmAction.type === 'bulk') {
                const ids = Array.from(selectedIds);
                const res = await axios.post('/api/customers/bulk-delete', { ids });

                const { deleted, skipped } = res.data;
                if (deleted > 0) toast.success(`${deleted} customers deleted`);
                if (skipped > 0) toast.error(`${skipped} skipped (Has history/credits)`);

                setSelectedIds(new Set());
            } else {
                await axios.delete(`/api/customers/${confirmAction.customerId}`);
                toast.success('Customer deleted');
            }
            fetchCustomers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error occurred');
        }
    };

    const handleIssueCard = async (customer) => {
        const cardNumber = window.prompt(`Issue Loyalty Card for ${customer.name}\nEnter Card Number/Scan Code:`);
        if (!cardNumber) return;
        try {
            await axios.post('/api/loyalty/cards/issue', { customer_id: customer.id, card_number: cardNumber });
            toast.success('Loyalty Card Issued Successfully');
        } catch (err) {
            toast.error('Failed to issue card: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleBulkSyncWhatsHub = async () => {
        const ids = Array.from(selectedIds);
        const toastId = toast.loading('Syncing to WhatsHub...');
        try {
            const res = await axios.post('/api/customers/sync-whatshub', { ids });
            toast.success(res.data.message, { id: toastId });
            setSelectedIds(new Set());
        } catch (err) {
            toast.error(err.response?.data?.message || 'Sync failed', { id: toastId });
        }
    };

    const handleSyncWhatsHub = async (id) => {
        const toastId = toast.loading('Syncing to WhatsHub...');
        try {
            const res = await axios.post('/api/customers/sync-whatshub', { ids: [id] });
            toast.success(res.data.message, { id: toastId });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Sync failed', { id: toastId });
        }
    };

    const handleRecalibrate = async () => {
        setConfirmAction({
            isOpen: true,
            type: 'sync',
            title: 'Recalibrate Credits',
            message: 'This will recalculate all customer credit balances based on transaction history. Continue?'
        });
    };

    const handleNormalizeContacts = async () => {
        setConfirmAction({
            isOpen: true,
            type: 'normalize',
            title: 'Normalize Contacts',
            message: 'This will update all contacts to ensure their phone numbers have the correct country code (+91) format for WhatsApp. Continue?'
        });
    };

    const confirmNormalizeContacts = async () => {
        const toastId = toast.loading('Normalizing contacts...');
        try {
            const res = await axios.post('/api/customers/normalize-all');
            toast.success(res.data.message, { id: toastId });
            fetchCustomers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Normalization failed', { id: toastId });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Unified phone validation
        const phoneResult = normalizePhone(formData.phone);
        if (phoneResult.error) return toast.error(phoneResult.error);

        try {
            const payload = { ...formData, phone: phoneResult.phone };
            if (editingCustomer) await axios.put(`/api/customers/${editingCustomer.id}`, payload);
            else await axios.post('/api/customers', payload);
            setShowForm(false);
            setEditingCustomer(null);
            setFormData({ name: '', phone: '', loyalty_points: '' });
            fetchCustomers();
            toast.success(editingCustomer ? 'Customer updated' : 'Customer added');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving customer');
        }
    };

    const [viewingCustomer, setViewingCustomer] = useState(null);

    const handleDeleteCustomer = (id, name) => {
        setConfirmAction({
            isOpen: true,
            type: 'single',
            customerId: id,
            title: 'Delete Customer',
            message: `Are you sure you want to permanently delete customer "${name}"?`
        });
    };

    const handleExport = () => {
        if (filteredCustomers.length === 0) return toast.error('No customers to export');

        const data = filteredCustomers.map(c => ({
            'Customer Name': c.name,
            'Phone Number': c.phone,
            'Email': c.email || '',
            'Loyalty Points': c.loyalty_points || 0,
            'Credit Balance': parseFloat(c.credit_balance || 0).toFixed(2),
            'Date Added': new Date(c.created_at).toLocaleDateString()
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Customers');
        XLSX.writeFile(wb, `customers_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('File exported successfully');
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                const validRows = [];
                const invalidRows = [];

                jsonData.forEach((row, idx) => {
                    const getVal = (keys) => {
                        for (const key of keys) if (row[key] !== undefined) return String(row[key]);
                        return '';
                    };
                    const name = getVal(['Customer Name', 'Name', 'name']);
                    const rawPhone = getVal(['Phone Number', 'Phone', 'phone']);
                    const email = getVal(['Email Address', 'Email', 'email']);
                    const address = getVal(['Shipping Address', 'Address', 'address']);
                    const loyalty_points = getVal(['Loyalty Points', 'Points', 'loyalty_points']) || 0;

                    if (!name) {
                        invalidRows.push({ row: idx + 2, name: name || '(blank)', phone: rawPhone, reason: 'Name is required' });
                        return;
                    }

                    const phoneResult = normalizePhone(rawPhone);
                    if (phoneResult.error) {
                        invalidRows.push({ row: idx + 2, name, phone: rawPhone, reason: phoneResult.error });
                        return;
                    }

                    validRows.push({ name, phone: phoneResult.phone, email, address, loyalty_points });
                });

                if (validRows.length > 0) {
                    const res = await axios.post('/api/customers/batch', validRows);
                    toast.success(res.data.message || `Imported ${validRows.length} customers`);
                    fetchCustomers();
                }

                if (invalidRows.length > 0) {
                    console.warn('[Import] Invalid rows skipped:', invalidRows);
                    toast.error(
                        `${invalidRows.length} row${invalidRows.length > 1 ? 's' : ''} skipped — invalid phone numbers. Check browser console for details.`,
                        { duration: 7000 }
                    );
                }

                if (validRows.length === 0 && invalidRows.length === 0) {
                    toast.error('No data found in the file.');
                }
            } catch (err) {
                toast.error('Import failed: ' + (err.response?.data?.message || err.message));
            }
            e.target.value = null;
        };
        reader.readAsArrayBuffer(file);
    };

    const filteredCustomers = customers.filter(c => {
        const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm);

        let matchDate = true;
        if (startDate || endDate) {
            const custDate = new Date(c.created_at);
            custDate.setHours(0, 0, 0, 0); // Normalize time

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                if (custDate < start) matchDate = false;
            }
            if (endDate && matchDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                if (custDate > end) matchDate = false;
            }
        }

        return matchSearch && matchDate;
    });

    return (
        <div className="customers-page-container customers-animate">
            <header className="customers-page-header">
                <div className="customers-header-top">
                    <div className="customers-title-group">
                        <div className="customers-icon-box"><Users size={24} /></div>
                        <div className="customers-title"><h1>Customer Management</h1><p>Track loyalty, credits, and purchase history</p></div>
                    </div>
                    <div className="customers-search-wrapper" style={{ display: 'flex', gap: '0.5rem', flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search className="customers-search-icon" size={18} style={{ position: 'absolute', left: '10px' }} />
                            <input className="customers-search-input" placeholder="Find by name or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '32px' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-card)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <input type="date" className="customers-search-input" style={{ width: 'auto', border: 'none' }} value={startDate} onChange={e => setStartDate(e.target.value)} title="Start Date" />
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                            <input type="date" className="customers-search-input" style={{ width: 'auto', border: 'none' }} value={endDate} onChange={e => setEndDate(e.target.value)} title="End Date" />
                            {(startDate || endDate) && (
                                <button className="btn-icon" onClick={() => { setStartDate(''); setEndDate(''); }} title="Clear Dates" style={{ padding: '4px' }}><X size={14} /></button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="customers-header-actions">
                    <button className="customers-btn-outline" onClick={handleExport}><Download size={14} /> Export</button>
                    <button className="customers-btn-outline" onClick={() => window.open('/api/files/sample/customer', '_blank')}><FileText size={14} /> Sample</button>
                    <button className="customers-btn-outline" onClick={() => document.getElementById('file-upload-c').click()}><Upload size={14} /> Import</button>
                    <button className="customers-btn-outline customers-btn-warning" onClick={handleRecalibrate}><RefreshCcw size={14} /> Sync Credits</button>
                    <button className="customers-btn-outline" onClick={handleNormalizeContacts} style={{ background: '#25D366', color: 'white', border: 'none' }}><PencilSparkles size={14} /> Fix</button>
                    <button 
                        className="customers-btn-outline" 
                        onClick={() => navigate('/invalid-numbers')} 
                        title="WhatsApp Audit (Invalid Numbers)" 
                        style={{ padding: '0.45rem', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <AlertTriangle size={14} style={{ color: '#ef4444' }} />
                    </button>
                    <input type="file" id="file-upload-c" accept=".csv, .xlsx" style={{ display: 'none' }} onChange={handleImport} />
                    <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => { setEditingCustomer(null); setFormData({ name: '', phone: '', loyalty_points: '' }); setShowForm(true); }}>
                        <Plus size={16} /> New Customer
                    </button>
                </div>
            </header>

            <div className="customers-kpi-grid">
                <div className="customers-kpi-card">
                    <div className="customers-kpi-info"><span className="customers-kpi-label">Total Base</span><span className="customers-kpi-value">{customers.length}</span></div>
                    <div className="customers-kpi-icon customers-kpi-icon-base"><Users size={24} /></div>
                </div>
                <div className="customers-kpi-card">
                    <div className="customers-kpi-info"><span className="customers-kpi-label">Active Debt</span><span className="customers-kpi-value customers-text-danger">₹{customers.reduce((sum, c) => sum + (parseFloat(c.credit_balance) || 0), 0).toLocaleString('en-IN')}</span></div>
                    <div className="customers-kpi-icon customers-kpi-icon-danger"><CreditCard size={24} /></div>
                </div>
                <div className="customers-kpi-card">
                    <div className="customers-kpi-info"><span className="customers-kpi-label">Loyalty Members</span><span className="customers-kpi-value customers-text-purple">{customers.filter(c => (c.loyalty_points || 0) > 0).length}</span></div>
                    <div className="customers-kpi-icon customers-kpi-icon-purple"><Star size={24} /></div>
                </div>
            </div>

            <main className="customers-page-content">
                <div className="customers-table-container">
                    <div className="customers-table-wrapper custom-scrollbar">
                        <table className="customers-data-table">
                            <thead>
                                <tr>
                                    <th className="checkbox-cell">
                                        <input type="checkbox" className="custom-checkbox" checked={selectedIds.size > 0 && selectedIds.size === filteredCustomers.length} onChange={toggleSelectAll} />
                                    </th>
                                    <th>Name</th>
                                    <th>Phone Number</th>
                                    <th>Loyalty Points</th>
                                    <th>Recent Credit Notes</th>
                                    <th>Pending Debt</th>
                                    <th className="val-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.map(c => (
                                    <tr key={c.id} className={selectedIds.has(c.id) ? 'row-selected' : ''}>
                                        <td className="checkbox-cell">
                                            <input type="checkbox" className="custom-checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
                                        </td>
                                        <td>
                                            <div className="customers-name">{c.name}</div>
                                        </td>
                                        <td>
                                            <div className="customers-phone">{c.phone}</div>
                                        </td>
                                        <td className="customers-loyalty-highlight">{c.loyalty_points || 0} pts</td>
                                        <td>₹{parseFloat(c.total_credit_note_balance || 0).toFixed(2)}</td>
                                        <td>
                                            {parseFloat(c.credit_balance) > 0 ? (
                                                <span className="customers-badge-credit">₹{parseFloat(c.credit_balance).toFixed(2)}</span>
                                            ) : (
                                                <span className="customers-badge-credit-empty">₹0.00</span>
                                            )}
                                        </td>
                                        <td className="val-center">
                                            <div className="customers-action-group customers-action-center">
                                                <button className="btn-icon" onClick={() => setViewingCustomer(c)} title="View"><Eye size={16} /></button>
                                                {isWhatsHubInUse && (
                                                    <button className="btn-icon" onClick={() => handleSyncWhatsHub(c.id)} title="Sync to WhatsHub"><Smartphone size={16} /></button>
                                                )}
                                                <button className="btn-icon" onClick={() => { setEditingCustomer(c); setFormData({ name: c.name, phone: c.phone, loyalty_points: c.loyalty_points || 0 }); setShowForm(true); }} title="Edit"><Edit size={16} /></button>
                                                <button className="btn-icon icon-purple" onClick={() => handleIssueCard(c)} title="Loyalty"><CreditCard size={16} /></button>
                                                <button className="btn-icon icon-danger" onClick={() => handleDeleteCustomer(c.id, c.name)} title="Delete"><Trash size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredCustomers.length === 0 && (
                                    <tr><td colSpan="7" className="val-center customers-empty-state">No customers found matching your search.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            <div className={`bulk-actions-bar ${selectedIds.size > 0 ? 'visible' : ''}`}>
                <span className="selected-count">{selectedIds.size} Selected</span>
                {isWhatsHubInUse && (
                    <button className="bulk-btn-sync" onClick={handleBulkSyncWhatsHub} style={{ background: '#25D366', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Smartphone size={16} /> Sync WhatsHub</button>
                )}
                <button className="bulk-btn-delete" onClick={handleBulkDelete}><Trash size={16} /> Delete Selected</button>
                <button className="bulk-btn-cancel" onClick={() => setSelectedIds(new Set())}>Cancel</button>
            </div>

            {showForm && (
                <div className="customers-modal-overlay">
                    <div className="customers-modal-content">
                        <div className="customers-modal-header">
                            <h3 className="customers-modal-title">{editingCustomer ? 'Modify Customer' : 'Add New Customer'}</h3>
                            <button className="btn-icon" onClick={() => setShowForm(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="customers-form-group"><label className="customers-label">Full Name *</label><input className="input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} autoFocus /></div>
                            <div className="customers-form-group"><label className="customers-label">WhatsApp / Phone *</label><input className="input" required value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="10-digit or +91..." /></div>
                            {editingCustomer && (
                                <div className="customers-form-group"><label className="customers-label">Loyalty Points</label><input className="input" type="number" min="0" value={formData.loyalty_points} onChange={e => setFormData({ ...formData, loyalty_points: e.target.value })} placeholder="0" /></div>
                            )}
                            <div className="customers-form-actions" style={{ marginTop: '2rem' }}>
                                <button type="button" className="btn customers-btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary customers-btn-submit">{editingCustomer ? 'Update Contact' : 'Create Record'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {viewingCustomer && <CustomerDetailModal customer={viewingCustomer} onClose={() => setViewingCustomer(null)} onUpdate={fetchCustomers} />}

            <ConfirmModal
                isOpen={confirmAction.isOpen}
                onClose={() => setConfirmAction({ ...confirmAction, isOpen: false })}
                onConfirm={
                    confirmAction.type === 'sync' ? async () => {
                        try {
                            await axios.post('/api/customers/recalibrate-credit');
                            toast.success('Credit balances synchronized');
                            fetchCustomers();
                        } catch (err) { toast.error('Sync failed'); }
                    } : confirmAction.type === 'normalize' ? confirmNormalizeContacts : confirmDeleteAction
                }
                title={confirmAction.title}
                message={confirmAction.message}
                type={(confirmAction.type === 'sync' || confirmAction.type === 'normalize') ? 'primary' : 'danger'}
            />
        </div>
    );
};

export default Customers;
