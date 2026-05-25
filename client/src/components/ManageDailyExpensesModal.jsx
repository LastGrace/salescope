import React, { useState, useEffect } from 'react';
import { X, Plus, Trash, Save, Edit2, ChevronDown } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import '../styles/ExpenseManager.css';

const ManageDailyExpensesModal = ({ date, onClose, onSuccess }) => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ reason: '', amount: '', category: '' });

    // New expense state
    const [isAdding, setIsAdding] = useState(false);
    const [newExpense, setNewExpense] = useState({ reason: '', amount: '', category: 'General' });

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        fetchExpenses();
    }, [date]);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/expenses', {
                params: { startDate: date, endDate: date }
            });
            setExpenses(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load expenses');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Daily Expense',
            message: 'Are you sure you want to delete this specific expense entry?',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/expenses/${id}`);
                    toast.success('Deleted');
                    fetchExpenses();
                    onSuccess();
                } catch (err) {
                    toast.error('Failed to delete');
                }
            }
        });
    };

    const startEdit = (exp) => {
        setEditingId(exp.id);
        setEditForm({ reason: exp.reason, amount: exp.amount, category: exp.category });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({ reason: '', amount: '', category: '' });
    };

    const saveEdit = async (id) => {
        try {
            await axios.put(`/api/expenses/${id}`, {
                date,
                ...editForm
            });
            toast.success('Updated');
            setEditingId(null);
            fetchExpenses();
            onSuccess();
        } catch (err) {
            toast.error('Failed to update');
        }
    };

    const saveNew = async () => {
        if (!newExpense.reason || !newExpense.amount) {
            toast.error('Fill required fields');
            return;
        }
        try {
            await axios.post('/api/expenses/batch', [{
                date,
                ...newExpense
            }]);
            toast.success('Added');
            setIsAdding(false);
            setNewExpense({ reason: '', amount: '', category: 'General' });
            fetchExpenses();
            onSuccess();
        } catch (err) {
            toast.error('Failed to add');
        }
    };

    return (
        <div className="em-modal-overlay">
            <div className="em-modal-content" style={{ maxWidth: '800px' }}>
                <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-card)] shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-[var(--text-main)]">Manage Expenses</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">{new Date(date).toDateString()}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="#6b7280" /></button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-[var(--bg-main)]">
                    {loading ? (
                        <div className="flex justify-center items-center h-32 text-[var(--text-muted)]">Loading...</div>
                    ) : (
                        <div className="w-full border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--bg-card)] shadow-sm">
                            <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', width: '100%' }}>
                                <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                    <tr>
                                        <th style={{ padding: '10px', width: '50%', fontSize: '12px', color: '#6b7280', borderRight: '1px solid #e5e7eb' }}>DESCRIPTION</th>
                                        <th style={{ padding: '10px', width: '25%', fontSize: '12px', color: '#6b7280', borderRight: '1px solid #e5e7eb' }}>CATEGORY</th>
                                        <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px', color: '#6b7280', borderRight: '1px solid #e5e7eb' }}>AMOUNT</th>
                                        <th style={{ padding: '10px', width: '80px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>ACTION</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                    {/* Empty State */}
                                    {expenses.length === 0 && !isAdding && (
                                        <tr>
                                            <td colSpan="4" className="text-center p-8 text-[var(--text-muted)]">
                                                No expenses recorded for this day.
                                            </td>
                                        </tr>
                                    )}

                                    {/* Existing Rows */}
                                    {expenses.map(exp => (
                                        <tr key={exp.id} className="group hover:bg-[var(--bg-main)] transition-colors" style={{ height: '54px', borderBottom: '1px solid #e5e7eb' }}>
                                            {editingId === exp.id ? (
                                                // Edit Row
                                                <>
                                                    <td className="p-2 border-r border-[var(--border)]">
                                                        <input className="em-input" value={editForm.reason} onChange={e => setEditForm({ ...editForm, reason: e.target.value })} autoFocus />
                                                    </td>
                                                    <td className="p-2 border-r border-[var(--border)]">
                                                        <div className="em-select-wrapper">
                                                            <select className="em-input" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                                                                <option>General</option>
                                                                <option>Utilities</option>
                                                                <option>Maintenance</option>
                                                                <option>Salary</option>
                                                                <option>Transport</option>
                                                                <option>Marketing</option>
                                                                <option>Rent</option>
                                                            </select>
                                                            <ChevronDown size={14} className="select-icon" />
                                                        </div>
                                                    </td>
                                                    <td className="p-2 border-r border-[var(--border)]">
                                                        <input type="number" className="em-input text-right" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
                                                    </td>
                                                    <td className="p-2 text-center flex justify-center gap-2">
                                                        <button onClick={() => saveEdit(exp.id)} className="btn-action-edit" style={{ color: 'green', borderColor: 'green' }}><Save size={16} /></button>
                                                        <button onClick={cancelEdit} className="btn-action-edit" style={{ color: 'red', borderColor: 'red' }}><X size={16} /></button>
                                                    </td>
                                                </>
                                            ) : (
                                                // View Row
                                                <>
                                                    <td className="py-3 px-4 border-r border-[var(--border)] text-sm text-[var(--text-main)] font-medium truncate">
                                                        {exp.reason}
                                                    </td>
                                                    <td className="py-3 px-4 border-r border-[var(--border)]">
                                                        <span className="text-xs text-[var(--text-muted)] px-2 py-1 bg-[var(--bg-main)] rounded border border-[var(--border)] uppercase">{exp.category}</span>
                                                    </td>
                                                    <td className="py-3 px-4 border-r border-[var(--border)] text-right font-mono text-sm text-[var(--text-main)]">
                                                        ₹{parseFloat(exp.amount).toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-2 text-center">
                                                        <div className="flex justify-center gap-2">
                                                            <button onClick={() => startEdit(exp)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }}><Edit2 size={16} /></button>
                                                            <button onClick={() => handleDelete(exp.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}><Trash size={16} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}

                                    {/* Add Row */}
                                    {isAdding && (
                                        <tr className="bg-blue-50" style={{ height: '54px', backgroundColor: '#eff6ff' }}>
                                            <td className="p-2 border-data-[var(--border)]">
                                                <input className="em-input bg-white" placeholder="New Item" value={newExpense.reason} onChange={e => setNewExpense({ ...newExpense, reason: e.target.value })} autoFocus />
                                            </td>
                                            <td className="p-2 border-data-[var(--border)]">
                                                <div className="em-select-wrapper">
                                                    <select className="em-input bg-white" value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}>
                                                        <option>General</option>
                                                        <option>Utilities</option>
                                                        <option>Maintenance</option>
                                                        <option>Salary</option>
                                                        <option>Transport</option>
                                                        <option>Marketing</option>
                                                        <option>Rent</option>
                                                    </select>
                                                    <ChevronDown size={14} className="select-icon" />
                                                </div>
                                            </td>
                                            <td className="p-2 border-data-[var(--border)]">
                                                <input type="number" className="em-input bg-white text-right" placeholder="0.00" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} />
                                            </td>
                                            <td className="p-2 text-center flex justify-center gap-2">
                                                <button onClick={saveNew} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><Save size={16} /></button>
                                                <button onClick={() => setIsAdding(false)} style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}><X size={16} /></button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {!isAdding && (
                                <button onClick={() => setIsAdding(true)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        backgroundColor: '#2563eb',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        fontSize: '14px',
                                        textTransform: 'uppercase',
                                        border: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        cursor: 'pointer'
                                    }}>
                                    <Plus size={16} /> Add New Entry
                                </button>
                            )}
                        </div>
                    )}
                </div>
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

export default ManageDailyExpensesModal;
