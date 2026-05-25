import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, AlertCircle, Plus, Trash } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/LoyaltySettings.css';

const LoyaltySettings = () => {
    const [settings, setSettings] = useState({
        is_active: 0,
        earn_rate_amount: 100,
        earn_rate_points: 1,
        redeem_rate_points: 10,
        redeem_rate_amount: 1,
        minimum_redeem_points: 0,
        max_redeem_percent: 100
    });
    const [loading, setLoading] = useState(false);

    // Category Rules State
    const [categoryRules, setCategoryRules] = useState([]);
    const [categories, setCategories] = useState([]);
    const [allSubcategories, setAllSubcategories] = useState([]);
    const [newRule, setNewRule] = useState({ category_id: '', subcategory_id: '', earn_type: 'fixed', earn_rate_amount: '', earn_rate_points: '', earn_rate_percent: '' });

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        fetchSettings();
        fetchRules();
        fetchCategories();
        fetchSubcategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await axios.get('/api/categories');
            if (Array.isArray(res.data)) {
                setCategories(res.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSubcategories = async () => {
        try {
            const res = await axios.get('/api/subcategories');
            setAllSubcategories(res.data);
        } catch (err) {
            console.error(err);
        }
    };



    const fetchRules = async () => {
        try {
            const res = await axios.get('/api/loyalty/rules');
            setCategoryRules(res.data);
        } catch (err) { console.error(err); }
    };

    const handleAddRule = async () => {
        if (!newRule.category_id) return;

        // Validation based on type
        const type = newRule.earn_type || 'fixed';
        if (type === 'fixed') {
            if (!newRule.earn_rate_amount || !newRule.earn_rate_points) return;
        } else {
            if (!newRule.earn_rate_percent) return;
        }

        try {
            await axios.post('/api/loyalty/rules', {
                ...newRule,
                subcategory_id: newRule.subcategory_id || null
            });
            setNewRule({ category_id: '', subcategory_id: '', earn_type: 'fixed', earn_rate_amount: '', earn_rate_points: '', earn_rate_percent: '' });
            fetchRules();
            toast.success('Rule Added');
        } catch (err) {
            toast.error('Failed to add rule');
        }
    };

    const handleDeleteRule = async (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Earning Rule',
            message: 'Are you sure you want to delete this earning rule? This will revert this category to global settings.',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/loyalty/rules/${id}`);
                    fetchRules();
                    toast.success('Rule deleted');
                } catch (err) {
                    toast.error('Failed to delete rule');
                }
            }
        });
    };

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/loyalty/settings');
            setSettings(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
        }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await axios.put('/api/loyalty/settings', settings);
            toast.success('Settings updated successfully');
        } catch (err) {
            toast.error('Failed to update: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in loyalty-settings-container">
            <h1 className="loyalty-page-title">Loyalty Program Settings</h1>

            <div className="settings-card">
                <div className="settings-header-row">
                    <label className="checkbox-container enable-checkbox-label">
                        <input
                            type="checkbox"
                            name="is_active"
                            checked={settings.is_active == 1}
                            onChange={handleChange}
                        />
                        <span className="enable-text">Enable Loyalty Program</span>
                    </label>
                    <button className="btn btn-primary save-btn-header" onClick={handleSave} disabled={loading}>
                        <Save size={16} /> {loading ? 'Saving...' : 'Save Config'}
                    </button>
                </div>

                <div className="settings-grid">
                    {/* LEFT COL: Earning */}
                    <div className="earning-section">
                        <h3 className="section-title">Earning Rules</h3>
                        <div className="radio-group">
                            <label className="radio-label">
                                <input type="radio" name="earn_type" value="fixed" checked={settings.earn_type === 'fixed'} onChange={handleChange} /> Fixed
                            </label>
                            <label className="radio-label">
                                <input type="radio" name="earn_type" value="percentage" checked={settings.earn_type === 'percentage'} onChange={handleChange} /> % Age
                            </label>
                        </div>

                        <div className="inputs-grid">
                            {settings.earn_type === 'percentage' ? (
                                <div>
                                    <label className="input-label">Earning %</label>
                                    <input type="number" className="setting-input" name="earn_rate_percent" value={settings.earn_rate_percent} onChange={handleChange} />
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <label className="input-label">Spend (₹)</label>
                                        <input type="number" className="setting-input" name="earn_rate_amount" value={settings.earn_rate_amount} onChange={handleChange} />
                                    </div>
                                    <div>
                                        <label className="input-label">Get Pts</label>
                                        <input type="number" className="setting-input" name="earn_rate_points" value={settings.earn_rate_points} onChange={handleChange} />
                                    </div>
                                </>
                            )}
                            <div className="setting-hint">
                                <AlertCircle size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                                {settings.earn_type === 'percentage'
                                    ? `Earn ${settings.earn_rate_percent}% of bill as points.`
                                    : `Earn ${settings.earn_rate_points} pt per ₹${settings.earn_rate_amount}.`
                                }
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COL: Redemption & Limits */}
                    <div>
                        <h3 className="section-title">Redemption & Limits</h3>
                        <div className="redemption-grid">
                            <div>
                                <label className="input-label">Redeem Pts</label>
                                <input type="number" className="setting-input" name="redeem_rate_points" value={settings.redeem_rate_points ?? ''} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="input-label">Get Value (₹)</label>
                                <input type="number" className="setting-input" name="redeem_rate_amount" value={settings.redeem_rate_amount ?? ''} onChange={handleChange} />
                            </div>
                            <div className="setting-hint">
                                {settings.redeem_rate_points} pts = ₹{settings.redeem_rate_amount}
                            </div>
                        </div>

                        <div className="limits-grid">
                            <div>
                                <label className="input-label">Min Pts to Redeem</label>
                                <input type="number" className="setting-input" name="minimum_redeem_points" value={settings.minimum_redeem_points ?? ''} onChange={handleChange} />
                            </div>
                            <div>
                                <label className="input-label">Max Redeem %</label>
                                <input type="number" className="setting-input" name="max_redeem_percent" value={settings.max_redeem_percent ?? ''} onChange={handleChange} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Rules Section */}
            <div className="card category-rules-card">
                <h3 className="section-title">Category Earning Rules</h3>
                <p className="cat-subtitle">
                    Override global earning rates for specific categories.
                </p>

                <div className="add-rule-form">
                    <div>
                        <select
                            className="setting-input"
                            value={newRule.category_id}
                            onChange={e => setNewRule({ ...newRule, category_id: e.target.value, subcategory_id: '' })}
                        >
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="input-label">Subcategory</label>
                        <select
                            className="setting-input"
                            value={newRule.subcategory_id}
                            onChange={e => setNewRule({ ...newRule, subcategory_id: e.target.value })}
                            disabled={!newRule.category_id}
                        >
                            <option value="">All Subcategories</option>
                            {allSubcategories
                                .filter(s => s.category_id == newRule.category_id)
                                .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                            }
                        </select>
                    </div>
                    <div>
                        <label className="input-label">Type</label>
                        <select
                            className="setting-input"
                            value={newRule.earn_type || 'fixed'}
                            onChange={e => setNewRule({ ...newRule, earn_type: e.target.value, earn_rate_amount: '', earn_rate_points: '', earn_rate_percent: '' })}
                        >
                            <option value="fixed">Fixed</option>
                            <option value="percentage">% Age</option>
                        </select>
                    </div>

                    {(newRule.earn_type === 'percentage') ? (
                        <div style={{ gridColumn: 'span 2' }}>
                            <label className="input-label">Percent (%)</label>
                            <input
                                type="number"
                                className="setting-input"
                                placeholder="5"
                                value={newRule.earn_rate_percent}
                                onChange={e => setNewRule({ ...newRule, earn_rate_percent: e.target.value })}
                            />
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="input-label">Spend (₹)</label>
                                <input
                                    type="number"
                                    className="setting-input"
                                    placeholder="100"
                                    value={newRule.earn_rate_amount}
                                    onChange={e => setNewRule({ ...newRule, earn_rate_amount: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="input-label">Pts</label>
                                <input
                                    type="number"
                                    className="setting-input"
                                    placeholder="1"
                                    value={newRule.earn_rate_points}
                                    onChange={e => setNewRule({ ...newRule, earn_rate_points: e.target.value })}
                                />
                            </div>
                        </>
                    )}

                    <button className="btn btn-primary add-btn" onClick={handleAddRule} disabled={!newRule.category_id}>
                        <Plus size={16} />
                    </button>
                </div>

                <table className="rules-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Subcategory</th>
                            <th>Rule</th>
                            <th className="action-cell"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {categoryRules.length === 0 ? (
                            <tr><td colSpan="3" className="empty-state">No rules active.</td></tr>
                        ) : (
                            categoryRules.map(rule => (
                                <tr key={rule.id}>
                                    <td>{rule.category_name}</td>
                                    <td>{rule.subcategory_name || <span className="text-muted">-</span>}</td>
                                    <td>
                                        {rule.earn_type === 'percentage'
                                            ? <span>Earn <strong>{rule.earn_rate_percent}%</strong> pts</span>
                                            : <span><strong>{rule.earn_rate_points}</strong> pts / <strong>₹{rule.earn_rate_amount}</strong></span>
                                        }
                                    </td>
                                    <td className="action-cell">
                                        <button className="delete-btn" onClick={() => handleDeleteRule(rule.id)}>
                                            <Trash size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type="danger"
            />
        </div>
    );
};

export default LoyaltySettings;
