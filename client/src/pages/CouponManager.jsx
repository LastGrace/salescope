import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash, Printer, AlertTriangle, Share2, X, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/CouponManager.css';

const CouponManager = () => {
    const [activeTab, setActiveTab] = useState('active'); // active, redeemed, expired, all
    const [showGenerator, setShowGenerator] = useState(false);
    const [coupons, setCoupons] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Confirmation Modal State
    const [confirmAction, setConfirmAction] = useState({ isOpen: false, type: 'single', id: null, title: '', message: '' });

    // Generator State
    const [genConfig, setGenConfig] = useState({
        mode: 'single', // single or batch
        count: 1,
        code: '', // Logic: if mode is single, user can type custom code
        description: '',
        discount_type: 'fixed',
        discount_value: '',
        min_order_amount: '',
        max_discount_amount: '',
        start_date: '',
        expiry_date: '',
        usage_limit: 1,
        target_type: 'all',
        target_value: '', // For single ID or custom string
        target_value_min: '', // For price range
        target_value_max: ''
    });

    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);

    useEffect(() => {
        fetchCoupons();
        fetchCategories();
        fetchSubcategories();
    }, []);

    // Reset selection when tab changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [activeTab]);

    const fetchCoupons = async () => {
        try {
            const res = await axios.get('/api/coupons');
            setCoupons(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await axios.get('/api/categories');
            setCategories(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchSubcategories = async () => {
        try {
            const res = await axios.get('/api/subcategories');
            setSubcategories(res.data);
        } catch (err) { console.error(err); }
    };

    // Selection Handlers
    const toggleSelect = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredCoupons.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredCoupons.map(c => c.id)));
    };

    const handleDelete = (id) => {
        setConfirmAction({
            isOpen: true,
            type: 'single',
            id,
            title: 'Delete Coupon',
            message: 'Are you sure you want to delete this coupon? This action cannot be undone.'
        });
    };

    const handleBulkDelete = () => {
        setConfirmAction({
            isOpen: true,
            type: 'bulk',
            title: 'Delete Multiple Coupons',
            message: `Are you sure you want to delete ${selectedIds.size} coupons? This action cannot be undone.`
        });
    };

    const confirmDeleteAction = async () => {
        try {
            if (confirmAction.type === 'bulk') {
                const ids = Array.from(selectedIds);
                await axios.post('/api/coupons/bulk-delete', { ids });
                toast.success(`${ids.length} coupons deleted`);
                setSelectedIds(new Set());
            } else {
                await axios.delete(`/api/coupons/${confirmAction.id}`);
                toast.success('Coupon deleted');
            }
            fetchCoupons();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error occurred');
        }
    };

    const handleGenerate = async (e) => {
        e.preventDefault();

        let payload = { ...genConfig };

        // Format target_value
        if (payload.target_type === 'price_range') {
            payload.target_value = { min: payload.target_value_min, max: payload.target_value_max };
        } else if (['category', 'subcategory'].includes(payload.target_type)) {
            // For batch gen, we might want to support multiple IDs, but let's stick to single ID or array
            // Here we just pass the ID as an array [id]
            payload.target_value = [parseInt(payload.target_value)];
        }

        try {
            if (payload.mode === 'single') {
                await axios.post('/api/coupons/create', payload);
                toast.success('Coupon created');
            } else {
                await axios.post('/api/coupons/generate', payload);
                toast.success(`Generated ${payload.count} coupons`);
            }
            setGenConfig({ ...genConfig, code: '', description: '' }); // Reset partial
            setShowGenerator(false);
            fetchCoupons();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error');
        }
    };

    const getTargetLabel = (c) => {
        if (c.target_type === 'all') return 'All Items';
        if (c.target_type === 'price_range') {
            const range = typeof c.target_value === 'string' ? JSON.parse(c.target_value) : c.target_value;
            return `Price ₹${range.min} - ₹${range.max}`;
        }
        if (c.target_type === 'category') return `Category ID: ${c.target_value}`; // Enhance to show name later
        if (c.target_type === 'subcategory') return `Subcategory ID: ${c.target_value}`;
        return c.target_type;
    };

    // Filter Logic
    const now = new Date();
    const filteredCoupons = coupons.filter(c => {
        if (activeTab === 'all') return true;

        const isExpired = c.expiry_date && new Date(c.expiry_date) < now;
        const isRedeemed = c.usage_limit && c.usage_count >= c.usage_limit;

        if (activeTab === 'active') return !isExpired && !isRedeemed;
        if (activeTab === 'redeemed') return isRedeemed;
        if (activeTab === 'expired') return isExpired && !isRedeemed;
        return true;
    });

    return (
        <div className="coupon-manager h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 px-4 pt-4">
                <h1 className="text-2xl font-bold">Coupon Manager</h1>
                <button
                    className="btn btn-primary flex items-center gap-2"
                    onClick={() => setShowGenerator(true)}
                >
                    <Plus size={18} /> Generate Coupon
                </button>
            </div>

            {/* Tabs */}
            <div className="tabs-container">
                {['active', 'redeemed', 'expired', 'all'].map(tab => (
                    <button
                        key={tab}
                        className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Main Content Area (Scrollable) */}
            <div className="table-wrapper">
                <div className="table-card">
                    <table className="coupon-table">
                        <thead>
                            <tr>
                                <th className="checkbox-cell">
                                    <input type="checkbox" className="custom-checkbox" checked={selectedIds.size > 0 && selectedIds.size === filteredCoupons.length} onChange={toggleSelectAll} />
                                </th>
                                <th>Code</th>
                                <th>Discount</th>
                                <th>Target</th>
                                <th>Usage</th>
                                <th>Expiry</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCoupons.map(c => (
                                <tr key={c.id} className={selectedIds.has(c.id) ? 'row-selected' : ''}>
                                    <td className="checkbox-cell">
                                        <input type="checkbox" className="custom-checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
                                    </td>
                                    <td className="code-cell">{c.code}</td>
                                    <td>{c.discount_type === 'percentage' ? `${c.discount_value}%` : `₹${c.discount_value}`}</td>
                                    <td className="target-cell">{getTargetLabel(c)}</td>
                                    <td>{c.usage_count} / {c.usage_limit || '∞'}</td>
                                    <td>{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'Never'}</td>
                                    <td className="actions-cell">
                                        <button className="action-btn delete" onClick={() => handleDelete(c.id)} title="Delete"><Trash size={16} /></button>
                                        <button className="action-btn print" onClick={() => alert('Print/Share Feature Coming Soon - ' + c.code)} title="Print"><Printer size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                            {filteredCoupons.length === 0 && <tr><td colSpan="7" className="empty-state">No coupons found</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Floating Bulk Action Bar */}
            <div className={`bulk-actions-bar ${selectedIds.size > 0 ? 'visible' : ''}`}>
                <span className="selected-count">{selectedIds.size} Selected</span>
                <button className="bulk-btn-delete" onClick={handleBulkDelete}>
                    <Trash size={16} /> Delete Selected
                </button>
                <button className="bulk-btn-cancel" onClick={() => setSelectedIds(new Set())}>Cancel</button>
            </div>

            {/* Generator Modal */}
            {showGenerator && (
                <div className="generator-modal-overlay animate-fade-in">
                    <div className="generator-modal">
                        <div className="modal-header">
                            <h3>Generate Coupons</h3>
                            <button onClick={() => setShowGenerator(false)} className="close-btn"><X size={20} /></button>
                        </div>

                        <div className="modal-body">
                            <form onSubmit={handleGenerate} className="generator-form">
                                <div className="form-group full-width">
                                    <label>Generation Mode</label>
                                    <div className="mode-switch">
                                        <button type="button" className={`mode-btn ${genConfig.mode === 'single' ? 'active' : ''}`} onClick={() => setGenConfig({ ...genConfig, mode: 'single' })}>Single Custom</button>
                                        <button type="button" className={`mode-btn ${genConfig.mode === 'batch' ? 'active' : ''}`} onClick={() => setGenConfig({ ...genConfig, mode: 'batch' })}>Batch Random</button>
                                    </div>
                                </div>

                                {genConfig.mode === 'single' ? (
                                    <div className="form-group full-width">
                                        <label>Coupon Code</label>
                                        <input className="input code-input" required value={genConfig.code} onChange={e => setGenConfig({ ...genConfig, code: e.target.value.toUpperCase() })} placeholder="e.g. SUMMER2025" />
                                    </div>
                                ) : (
                                    <div className="form-group full-width">
                                        <label>Quantity to Generate</label>
                                        <input type="number" className="input" required min="1" max="100" value={genConfig.count} onChange={e => setGenConfig({ ...genConfig, count: e.target.value })} />
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Discount Type</label>
                                    <select className="input" value={genConfig.discount_type} onChange={e => setGenConfig({ ...genConfig, discount_type: e.target.value })}>
                                        <option value="fixed">Fixed Amount (₹)</option>
                                        <option value="percentage">Percentage (%)</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Discount Value</label>
                                    <input type="number" className="input" required value={genConfig.discount_value} onChange={e => setGenConfig({ ...genConfig, discount_value: e.target.value })} placeholder="0" />
                                </div>

                                <div className="form-group full-width">
                                    <label>Apply To (Target)</label>
                                    <select className="input" value={genConfig.target_type} onChange={e => setGenConfig({ ...genConfig, target_type: e.target.value })}>
                                        <option value="all">All Items (Cart Total)</option>
                                        <option value="category">Specific Category</option>
                                        <option value="subcategory">Specific Subcategory</option>
                                        <option value="price_range">Price Range</option>
                                    </select>
                                </div>

                                {/* Dynamic Target Inputs */}
                                {genConfig.target_type === 'category' && (
                                    <div className="form-group full-width">
                                        <label>Select Category</label>
                                        <select className="input" required value={genConfig.target_value} onChange={e => setGenConfig({ ...genConfig, target_value: e.target.value })}>
                                            <option value="">Select Category...</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                {genConfig.target_type === 'subcategory' && (
                                    <div className="form-group full-width">
                                        <label>Select Subcategory</label>
                                        <select className="input" required value={genConfig.target_value} onChange={e => setGenConfig({ ...genConfig, target_value: e.target.value })}>
                                            <option value="">Select Subcategory...</option>
                                            {subcategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                {genConfig.target_type === 'price_range' && (
                                    <>
                                        <div className="form-group full-width" style={{ display: 'flex', gap: '10px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label>Min Price</label>
                                                <input type="number" className="input" value={genConfig.target_value_min} onChange={e => setGenConfig({ ...genConfig, target_value_min: e.target.value })} placeholder="0" />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label>Max Price</label>
                                                <input type="number" className="input" value={genConfig.target_value_max} onChange={e => setGenConfig({ ...genConfig, target_value_max: e.target.value })} placeholder="99999" />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="form-group full-width section-divider">
                                    <h4>Limits & Validity</h4>
                                    <div className="limits-grid">
                                        <div><label>Start Date</label><input type="date" className="input" value={genConfig.start_date} onChange={e => setGenConfig({ ...genConfig, start_date: e.target.value })} /></div>
                                        <div><label>Expiry Date</label><input type="date" className="input" value={genConfig.expiry_date} onChange={e => setGenConfig({ ...genConfig, expiry_date: e.target.value })} /></div>
                                        <div><label>Min Order (₹)</label><input type="number" className="input" value={genConfig.min_order_amount} onChange={e => setGenConfig({ ...genConfig, min_order_amount: e.target.value })} placeholder="0" /></div>
                                        <div><label>Usage Limit</label><input type="number" className="input" value={genConfig.usage_limit} onChange={e => setGenConfig({ ...genConfig, usage_limit: e.target.value })} placeholder="e.g. 1" /></div>
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button type="button" className="btn btn-cancel" onClick={() => setShowGenerator(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary btn-generate">Generate</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmAction.isOpen}
                onClose={() => setConfirmAction({ ...confirmAction, isOpen: false })}
                onConfirm={confirmDeleteAction}
                title={confirmAction.title}
                message={confirmAction.message}
                type="danger"
            />
        </div>
    );
};

export default CouponManager;
