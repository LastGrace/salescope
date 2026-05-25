import React, { useState, useEffect } from 'react';
import { X, Plus, Trash, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import '../styles/ExpenseManager.css';

const AddExpenseModal = ({ onClose, onSuccess }) => {
    // Default to today or saved
    const [date, setDate] = useState(() => localStorage.getItem('expense_date') || new Date().toISOString().split('T')[0]);
    const [rows, setRows] = useState(() => {
        const saved = localStorage.getItem('expense_rows');
        return saved ? JSON.parse(saved) : [{ reason: '', amount: '', category: 'General' }];
    });

    useEffect(() => {
        localStorage.setItem('expense_date', date);
        localStorage.setItem('expense_rows', JSON.stringify(rows));
    }, [date, rows]);
    const [loading, setLoading] = useState(false);

    const addRow = () => {
        setRows([...rows, { reason: '', amount: '', category: 'General' }]);
    };

    const removeRow = (index) => {
        if (rows.length === 1) return;
        setRows(rows.filter((_, i) => i !== index));
    };

    const updateRow = (index, field, value) => {
        const newRows = [...rows];
        newRows[index][field] = value;
        setRows(newRows);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        const validRows = rows.filter(r => r.reason.trim() && r.amount);
        if (validRows.length === 0) {
            toast.error('Please add at least one valid expense');
            return;
        }

        const payload = validRows.map(r => ({
            date,
            reason: r.reason,
            amount: parseFloat(r.amount),
            category: r.category
        }));

        setLoading(true);
        try {
            await axios.post('/api/expenses/batch', payload);
            toast.success('Expenses added successfully');
            localStorage.removeItem('expense_date');
            localStorage.removeItem('expense_rows');
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error('Failed to add expenses');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="em-modal-overlay">
            <div className="em-modal-content" style={{ maxWidth: '850px' }}>
                {/* Header */}
                <div className="p-5 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-card)] shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-main)]">Add Expenses</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1">Enter multiple expenses for a single day</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={24} color="#6b7280" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto bg-[var(--bg-main)] flex-1">
                    <form onSubmit={handleSubmit}>

                        {/* Date Selection */}
                        <div className="date-input-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f9fafb', padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '20px', width: 'fit-content' }}>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: '#6b7280' }}>Date:</label>
                            <input
                                type="date"
                                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                            />
                        </div>

                        {/* Table Layout */}
                        <div className="w-full border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-card)] shadow-sm">
                            <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', width: '100%' }}>
                                <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                    <tr>
                                        <th style={{ padding: '12px', width: '50px', textAlign: 'center', color: '#6b7280', fontSize: '12px', borderRight: '1px solid #e5e7eb' }}>#</th>
                                        <th style={{ padding: '12px', width: '40%', color: '#6b7280', fontSize: '12px', borderRight: '1px solid #e5e7eb' }}>DESCRIPTION</th>
                                        <th style={{ padding: '12px', width: '25%', color: '#6b7280', fontSize: '12px', borderRight: '1px solid #e5e7eb' }}>CATEGORY</th>
                                        <th style={{ padding: '12px', textAlign: 'right', color: '#6b7280', fontSize: '12px' }}>AMOUNT</th>
                                        <th style={{ padding: '12px', width: '50px' }}></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {rows.map((row, index) => (
                                        <tr key={index} style={{ height: '54px', borderBottom: '1px solid #e5e7eb' }}>
                                            <td style={{ textAlign: 'center', padding: '8px', borderRight: '1px solid #e5e7eb', color: '#9ca3af', fontSize: '12px' }}>
                                                {index + 1}
                                            </td>
                                            <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>
                                                <input
                                                    className="em-input"
                                                    placeholder="e.g. Office Supplies"
                                                    value={row.reason}
                                                    onChange={e => updateRow(index, 'reason', e.target.value)}
                                                    required
                                                    autoFocus={index === rows.length - 1}
                                                />
                                            </td>
                                            <td style={{ padding: '8px', borderRight: '1px solid #e5e7eb' }}>
                                                <div className="em-select-wrapper">
                                                    <select
                                                        className="em-input"
                                                        value={row.category}
                                                        onChange={e => updateRow(index, 'category', e.target.value)}
                                                    >
                                                        <option value="General">General</option>
                                                        <option value="Utilities">Utilities</option>
                                                        <option value="Maintenance">Maintenance</option>
                                                        <option value="Salary">Salary</option>
                                                        <option value="Transport">Transport</option>
                                                        <option value="Marketing">Marketing</option>
                                                        <option value="Rent">Rent</option>
                                                    </select>
                                                    <ChevronDown size={14} className="select-icon" />
                                                </div>
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'right' }}>
                                                <div style={{ position: 'relative' }}>
                                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '14px' }}>₹</span>
                                                    <input
                                                        type="number"
                                                        className="em-input text-right"
                                                        style={{ paddingLeft: '20px' }}
                                                        placeholder="0.00"
                                                        value={row.amount}
                                                        onChange={e => updateRow(index, 'amount', e.target.value)}
                                                        required
                                                        min="0"
                                                        step="0.01"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && index === rows.length - 1) {
                                                                e.preventDefault();
                                                                addRow();
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '8px' }}>
                                                {rows.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeRow(index)}
                                                        style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}
                                                        title="Remove Row"
                                                    >
                                                        <Trash size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button
                            type="button"
                            onClick={addRow}
                            className="btn-add-line"
                            style={{
                                width: '100%',
                                padding: '12px',
                                backgroundColor: '#2563eb',
                                color: 'white',
                                fontWeight: 'bold',
                                borderRadius: '8px',
                                border: 'none',
                                marginTop: '16px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                textTransform: 'uppercase',
                                fontSize: '14px'
                            }}
                        >
                            <Plus size={18} /> Add Line Item
                        </button>


                        {/* Footer Actions */}
                        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                type="button"
                                className="btn-cancel"
                                onClick={onClose}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: '1px solid #d1d5db',
                                    backgroundColor: '#f3f4f6',
                                    color: '#374151',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-save"
                                style={{
                                    padding: '10px 30px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: '#16a34a',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                {loading ? 'Saving...' : 'Save Expenses'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddExpenseModal;
