import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Plus, Download, Calendar, TrendingUp, TrendingDown, DollarSign, Archive, Filter, LayoutDashboard, FileText, Trash } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import * as XLSX from 'xlsx';
import AddExpenseModal from '../components/AddExpenseModal';
import ManageDailyExpensesModal from '../components/ManageDailyExpensesModal';
import '../styles/ExpenseManager.css';

const ExpenseManager = () => {
    // State
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState({ sales: 0, margin: 0, purchases: 0, expenses: 0, net_profit: 0 });
    const [reportData, setReportData] = useState([]);
    const [expenseList, setExpenseList] = useState([]); // List of individual expenses

    const [showAddModal, setShowAddModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);

    // Tab State: 'dashboard', 'report', 'expenses'
    const [activeTab, setActiveTab] = useState('dashboard');

    // Filters
    // Default to 'today' as per request.
    const [dateFilter, setDateFilter] = useState('today'); // today, this_month, custom
    const [customRange, setCustomRange] = useState({ start: '', end: '' });

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Initial Load & Refresh
    useEffect(() => {
        fetchData();
    }, [dateFilter, customRange, activeTab]);

    const getDateRange = () => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        if (dateFilter === 'today') {
            return { start: todayStr, end: todayStr };
        } else if (dateFilter === 'this_month') {
            const startOfMonth = `${yyyy}-${mm}-01`;
            return { start: startOfMonth, end: todayStr }; // Up to today
        } else if (dateFilter === 'custom') {
            return { start: customRange.start, end: customRange.end };
        }
        return { start: todayStr, end: todayStr };
    };

    const fetchData = async () => {
        const { start, end } = getDateRange();
        if (!start || !end) return;

        setLoading(true);
        try {
            // Always fetch Analytics for the top summary if we are on dashboard or report
            if (activeTab === 'dashboard' || activeTab === 'report') {
                const [analyticsRes, reportRes] = await Promise.all([
                    axios.get('/api/expenses/analytics', { params: { startDate: start, endDate: end } }),
                    axios.get('/api/expenses/daily-report', { params: { startDate: start, endDate: end } })
                ]);
                setAnalytics(analyticsRes.data);
                setReportData(reportRes.data);
            }

            // Fetch specific expense list only if on that tab
            if (activeTab === 'expenses') {
                const listRes = await axios.get('/api/expenses', { params: { startDate: start, endDate: end } });
                setExpenseList(listRes.data);
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteExpense = async (id) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Expense',
            message: 'Are you sure you want to permanently delete this expense record?',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/expenses/${id}`);
                    toast.success('Expense deleted');
                    fetchData();
                } catch (err) {
                    toast.error('Failed to delete expense');
                }
            }
        });
    };

    const openManageModal = (dateStr) => {
        setSelectedDate(dateStr);
        setShowManageModal(true);
    };

    const handleExport = () => {
        if (reportData.length === 0) {
            toast.error('No data to export');
            return;
        }

        // Prepare data for Excel
        const data = reportData.map(r => ({
            Date: r.date,
            'Total Sales (₹)': r.sales,
            'Total Margin (₹)': r.margin,
            'Total Expenses (₹)': r.expenses,
            'Net Status (₹)': r.margin - r.expenses
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Daily Report");

        // Add Summary Sheet
        const summaryData = [
            { Metric: 'Total Sales', Value: analytics.sales },
            { Metric: 'Total Margin', Value: analytics.margin },
            { Metric: 'Total Stock Purchases', Value: analytics.purchases },
            { Metric: 'Total Expenses', Value: analytics.expenses },
            { Metric: 'Net Profit', Value: analytics.net_profit }
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

        XLSX.writeFile(wb, `Financial_Report_${getDateRange().start}_to_${getDateRange().end}.xlsx`);
    };

    const StatCard = ({ title, value, icon: Icon, colorClass, subText }) => (
        <div className="stat-card">
            <div className="stat-info">
                <div className="stat-label">{title}</div>
                <div className={`stat-value ${colorClass}`}>{typeof value === 'number' ? '₹' + value.toLocaleString() : value}</div>
                {subText && <div className="stat-sub">{subText}</div>}
            </div>
            <div className={`p-3 rounded-full opacity-100 ${colorClass.replace('text-', 'bg-')}`}>
                <Icon size={24} className={colorClass} />
            </div>
        </div>
    );

    return (
        <div className="coupon-manager h-full flex flex-col bg-[var(--bg-main)]">
            {/* Header & Controls Bar */}
            <div className="expense-header">
                <div className="expense-header-top">
                    <div className="expense-title-group">
                        <div className="expense-icon-box">
                            <TrendingUp size={24} />
                        </div>
                        <div className="expense-title">
                            <h1>Financial Manager</h1>
                            <p>Track expenses, revenue, and profitability</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setShowAddModal(true)} className="btn btn-primary flex items-center gap-2 shadow-sm text-sm">
                            <Plus size={16} /> Add Expenses
                        </button>
                        {activeTab === 'report' && (
                            <button onClick={handleExport} className="btn bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 shadow-sm text-sm">
                                <Download size={16} /> Export Excel
                            </button>
                        )}
                    </div>
                </div>

                {/* Navigation & Filters Row */}
                <div className="expense-controls">
                    {/* Tabs */}
                    <div className="expense-tabs">
                        {[
                            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                            { id: 'report', label: 'Monthly Report', icon: FileText },
                            { id: 'expenses', label: 'Expense History', icon: DollarSign }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`expense-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            >
                                <tab.icon size={16} /> {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Date Filters */}
                    <div className="expense-filters">
                        <div className="filter-group">
                            <button onClick={() => setDateFilter('today')} className={`filter-btn ${dateFilter === 'today' ? 'active' : ''}`}>Today</button>
                            <button onClick={() => setDateFilter('this_month')} className={`filter-btn ${dateFilter === 'this_month' ? 'active' : ''}`}>This Month</button>
                            <button onClick={() => setDateFilter('custom')} className={`filter-btn ${dateFilter === 'custom' ? 'active' : ''}`}>Custom</button>
                        </div>
                        {dateFilter === 'custom' && (
                            <div className="filter-group" style={{ padding: '0.25rem 0.5rem', alignItems: 'center' }}>
                                <input type="date" className="text-xs bg-transparent border-none outline-none text-[var(--text-main)] font-mono" value={customRange.start} onChange={e => setCustomRange({ ...customRange, start: e.target.value })} />
                                <span className="text-[var(--text-muted)]">-</span>
                                <input type="date" className="text-xs bg-transparent border-none outline-none text-[var(--text-main)] font-mono" value={customRange.end} onChange={e => setCustomRange({ ...customRange, end: e.target.value })} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto p-4 content-area">

                {/* DASHBOARD TAB */}
                {activeTab === 'dashboard' && (
                    <div className="max-w-[1600px] mx-auto animate-fade-in space-y-6">
                        {/* KPI Grid */}
                        <div className="stats-grid">
                            <StatCard title="Total Sales" value={analytics.sales} icon={DollarSign} colorClass="text-blue" />
                            <StatCard title="Total Margin" value={analytics.margin} icon={TrendingUp} colorClass="text-green" subText="Gross Profit" />
                            <StatCard title="Stock Purchases" value={analytics.purchases} icon={Archive} colorClass="text-orange" subText="Via Purchase Orders" />
                            <StatCard title="Total Expenses" value={analytics.expenses} icon={TrendingDown} colorClass="text-red" />
                            <StatCard title="Net Profit" value={analytics.net_profit} icon={DollarSign} colorClass={analytics.net_profit >= 0 ? "text-emerald" : "text-red"} subText="Margin - Expenses" />
                        </div>
                    </div>
                )}

                {/* MONTHLY REPORT TAB */}
                {activeTab === 'report' && (
                    <div className="expense-table-container">
                        <div className="expense-table-wrapper">
                            <table className="expense-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th className="text-right">Total Sales</th>
                                        <th className="text-right">Total Margin</th>
                                        <th className="text-right">Total Expenses</th>
                                        <th className="text-right">Net Status</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="5" className="text-center" style={{ padding: '2rem' }}>Loading...</td></tr>
                                    ) : reportData.length === 0 ? (
                                        <tr><td colSpan="5" className="text-center p-8 text-[var(--text-muted)]">No records found for this period</td></tr>
                                    ) : (
                                        reportData.map((row, idx) => {
                                            const net = row.margin - row.expenses;
                                            return (
                                                <tr key={idx}>
                                                    <td className="font-mono">{row.date}</td>
                                                    <td className="text-right text-blue">₹{row.sales.toLocaleString()}</td>
                                                    <td className="text-right text-green">₹{row.margin.toLocaleString()}</td>
                                                    <td className="text-right text-red">₹{row.expenses.toLocaleString()}</td>
                                                    <td className={`text-right font-bold ${net >= 0 ? 'text-emerald' : 'text-red'}`}>
                                                        ₹{net.toLocaleString()}
                                                    </td>
                                                    <td className="text-center">
                                                        <button
                                                            onClick={() => openManageModal(row.date)}
                                                            className="btn-action-edit"
                                                        >
                                                            Edit Options
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                {!loading && reportData.length > 0 && (
                                    <tfoot>
                                        <tr className="font-bold">
                                            <td>TOTAL</td>
                                            <td className="text-right text-blue">₹{analytics.sales.toLocaleString()}</td>
                                            <td className="text-right text-green">₹{analytics.margin.toLocaleString()}</td>
                                            <td className="text-right text-red">₹{analytics.expenses.toLocaleString()}</td>
                                            <td className={`text-right ${analytics.net_profit >= 0 ? 'text-emerald' : 'text-red'}`}>
                                                ₹{analytics.net_profit.toLocaleString()}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                )}

                {/* EXPENSES LIST TAB */}
                {activeTab === 'expenses' && (
                    <div className="expense-table-container">
                        <div className="expense-table-wrapper">
                            <table className="expense-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Description / Reason</th>
                                        <th>Category</th>
                                        <th className="text-right">Amount</th>
                                        <th className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="5" className="text-center" style={{ padding: '2rem' }}>Loading...</td></tr>
                                    ) : expenseList.length === 0 ? (
                                        <tr><td colSpan="5" className="text-center p-8 text-[var(--text-muted)]">No expenses found for this period</td></tr>
                                    ) : (
                                        expenseList.map((exp) => (
                                            <tr key={exp.id}>
                                                <td className="font-mono">{new Date(exp.date).toLocaleDateString()}</td>
                                                <td>{exp.reason}</td>
                                                <td>
                                                    <span className="px-2 py-1 bg-[var(--bg-main)] rounded-full text-xs border border-[var(--border)]">{exp.category}</span>
                                                </td>
                                                <td className="text-right font-mono">₹{parseFloat(exp.amount).toLocaleString()}</td>
                                                <td className="text-center">
                                                    <button
                                                        onClick={() => handleDeleteExpense(exp.id)}
                                                        className="text-red hover:bg-red p-1 rounded transition-colors"
                                                        title="Delete Expense"
                                                    >
                                                        <Trash size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

            </div>

            {showAddModal && <AddExpenseModal onClose={() => setShowAddModal(false)} onSuccess={fetchData} />}
            {showManageModal && <ManageDailyExpensesModal date={selectedDate} onClose={() => setShowManageModal(false)} onSuccess={fetchData} />}

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

export default ExpenseManager;
