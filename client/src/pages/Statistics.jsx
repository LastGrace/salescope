import React, { useEffect, useState, Suspense } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
    IndianRupee, ShoppingCart, Percent, AlertTriangle,
    CreditCard, LayoutDashboard, TrendingUp, Package, Wallet,
    Ban, Ticket, Users, ArrowDownCircle, BarChart3,
    MessageSquare, Star, Eye, Activity
} from 'lucide-react';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

import KPICard from '../components/dashboard/KPICard';
import '../styles/Statistics.css';
import '../styles/Modal.css';

import CustomerDetailModal from '../components/CustomerDetailModal';
import SalesChart from '../components/dashboard/SalesChart';
import InventoryWidgets from '../components/dashboard/InventoryWidgets';

// Skeleton Loader Component
const StatisticsSkeleton = () => (
    <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl"></div>
            <div className="h-96 bg-gray-200 rounded-xl"></div>
        </div>
    </div>
);

const Statistics = () => {
    const { token, hasPermission } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const lastFetchQuery = React.useRef(null);

    const [summary, setSummary] = useState({});
    const [salesData, setSalesData] = useState({});
    const [inventoryData, setInventoryData] = useState({});
    const [staffData, setStaffData] = useState({});
    const [customerData, setCustomerData] = useState({});
    const [todayData, setTodayData] = useState(null);

    const [dateRange, setDateRange] = useState('today'); // today, this_month, 7days, 30days, etc.
    const [activeTab, setActiveTab] = useState('today'); // tabs: 'today', 'month', 'range', 'insights'
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [appliedCustomRange, setAppliedCustomRange] = useState({ start: '', end: '' });

    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const fetchAllData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);

        try {
            const headers = { Authorization: `Bearer ${token}` };

            let dateQuery = `range=${dateRange}`;
            if (activeTab === 'range' && appliedCustomRange.start && appliedCustomRange.end) {
                dateQuery = `range=exact&start=${appliedCustomRange.start}&end=${appliedCustomRange.end}`;
            }

            // Prevent redundant fetching if query and tab haven't changed
            const currentFetchKey = `${dateQuery}-${activeTab}`;
            if (!isRefresh && Object.keys(summary).length > 0 && lastFetchQuery.current === currentFetchKey) {
                setLoading(false);
                setRefreshing(false);
                return;
            }
            lastFetchQuery.current = currentFetchKey;

            // Parallel fetching of all stats sections
            const [statRes, salesRes, invRes, staffRes, custRes, todayRes] = await Promise.all([
                axios.get(`/api/dashboard/summary?${dateQuery}`, { headers }),
                axios.get(`/api/dashboard/sales-analytics?${dateQuery}`, { headers }),
                axios.get(`/api/dashboard/inventory-analytics?${dateQuery}`, { headers }),
                axios.get(`/api/dashboard/staff-performance?${dateQuery}`, { headers }),
                axios.get(`/api/dashboard/customer-analytics?${dateQuery}`, { headers }),
                (activeTab === 'today') ? axios.get('/api/dashboard/today-activity', { headers }) : Promise.resolve({ data: null })
            ]);

            setSummary(statRes.data);
            setSalesData(salesRes.data);
            setInventoryData(invRes.data);
            setStaffData(staffRes.data);
            setCustomerData(custRes.data);
            if (activeTab === 'today') setTodayData(todayRes.data);

        } catch (err) {
            console.error('Statistics Data Fetch Error:', err);
            toast.error('Failed to load statistics data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (hasPermission('dashboard.view')) {
            fetchAllData(Object.keys(summary).length > 0);
        }
    }, [dateRange, appliedCustomRange.start, appliedCustomRange.end, activeTab, token, hasPermission]);

    if (!hasPermission('dashboard.view')) {
        return (
            <div className="state-empty" style={{ height: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Ban size={48} className="text-muted" style={{ marginBottom: '1rem' }} />
                <h3>Access Restricted</h3>
                <p>You do not have permission to view statistics.</p>
            </div>
        );
    }

    return (
        <div className="dashboard-container statistics-page">
            {refreshing && <div className="loading-line"></div>}

            <div className="dashboard-header">
                <div className="dashboard-title">
                    <h1>Statistics</h1>
                    <p>Detailed breakdown of store performance</p>
                </div>
            </div>

            <div className="stats-tabs-container">
                <button className={`stats-tab ${activeTab === 'today' ? 'active' : ''}`} onClick={() => { setActiveTab('today'); setDateRange('today'); }}>
                    Today's Activity
                </button>
                <button className={`stats-tab ${activeTab === 'month' ? 'active' : ''}`} onClick={() => { setActiveTab('month'); setDateRange('this_month'); }}>
                    This Month
                </button>
                <button className={`stats-tab ${activeTab === 'range' ? 'active' : ''}`} onClick={() => { setActiveTab('range'); }}>
                    Custom Range
                </button>
                <button className={`stats-tab ${activeTab === 'insights' ? 'active' : ''}`} onClick={() => { setActiveTab('insights'); setDateRange('this_month'); }}>
                    Strategic Insights
                </button>
            </div>

            {activeTab === 'range' && (
                <div className="custom-range-card">
                    <div className="custom-range-header">
                        <span className="custom-range-label">Filter Analytics</span>
                        <h3 className="card-title-lg m-0">Custom Date Range</h3>
                    </div>

                    <div className="custom-range-controls">
                        <div className="date-input-group">
                            <label>Start Date</label>
                            <input
                                type="date"
                                className="input"
                                value={customRange.start || ''}
                                onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                            />
                        </div>
                        <span className="text-muted font-bold">→</span>
                        <div className="date-input-group">
                            <label>End Date</label>
                            <input
                                type="date"
                                className="input"
                                value={customRange.end || ''}
                                onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                            />
                        </div>
                        <button
                            className="btn btn-primary"
                            style={{ padding: '0.7rem 1.5rem', borderRadius: '8px', fontWeight: '600' }}
                            onClick={() => setAppliedCustomRange(customRange)}
                            disabled={!customRange.start || !customRange.end}
                        >
                            Apply Filter
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'insights' && (
                <div className="custom-range-card" style={{ padding: '1rem 1.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="custom-range-label" style={{ margin: 0 }}>Insight Timeframe</span>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            className={`btn ${dateRange === '7days' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                            onClick={() => setDateRange('7days')}>1 Week
                        </button>
                        <button
                            className={`btn ${dateRange === 'this_month' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                            onClick={() => setDateRange('this_month')}>1 Month
                        </button>
                        <button
                            className={`btn ${dateRange === '3months' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                            onClick={() => setDateRange('3months')}>3 Months
                        </button>
                        <button
                            className={`btn ${dateRange === '6months' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                            onClick={() => setDateRange('6months')}>6 Months
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <StatisticsSkeleton />
            ) : (
                <Suspense fallback={<StatisticsSkeleton />}>

                    {/* ONLY SHOW PERFORMANCE & STATS IF NOT ON INSIGHTS TAB */}
                    {activeTab !== 'insights' && (
                        <>
                            {/* Revenue Timeline (For Month & Range) */}
                            {(activeTab === 'month' || activeTab === 'range') && (
                                <div className="dashboard-card" style={{ marginBottom: '1.5rem', marginTop: '1.5rem' }}>
                                    <h3 className="card-title-lg mb-4">Revenue Timeline</h3>
                                    <div style={{ minWidth: 0 }}>
                                        <SalesChart data={salesData.trend} type="area" />
                                    </div>
                                </div>
                            )}

                            {/* 1. Core Performance */}
                            <h2 className="dashboard-section-title" style={{ marginTop: (activeTab === 'month' || activeTab === 'range') ? 0 : '1rem' }}>
                                <Wallet size={20} /> Performance Overview ({activeTab === 'today' ? 'Today' : (activeTab === 'month' ? 'This Month' : 'Custom Range')})
                            </h2>
                            <div className="stats-grid">
                                <KPICard
                                    title="Gross Sales"
                                    value={summary.sales}
                                    icon={IndianRupee}
                                    color="blue"
                                />
                                <KPICard
                                    title="Net Profit"
                                    value={summary.profit}
                                    icon={TrendingUp}
                                    color="green"
                                />
                                <KPICard
                                    title="Store Expenses"
                                    value={summary.expenses}
                                    icon={ArrowDownCircle}
                                    color="red"
                                />
                                <KPICard
                                    title="Total Bills"
                                    value={summary.bills}
                                    icon={LayoutDashboard}
                                    color="purple"
                                />
                                <KPICard
                                    title="Total Returns"
                                    value={summary.returns}
                                    icon={LayoutDashboard}
                                    color="red"
                                />
                            </div>

                            {/* 2. Averages & Margins Section */}
                            <h2 className="dashboard-section-title"><Activity size={20} /> Averages & Margins</h2>
                            <div className="stats-grid">
                                <KPICard
                                    title="Net Margin"
                                    value={summary.net_margin}
                                    icon={BarChart3}
                                    color="cyan"
                                />
                                <KPICard
                                    title="Avg Bill Value"
                                    value={summary.avg_bill_value}
                                    icon={Percent}
                                    color="orange"
                                />
                                <KPICard
                                    title="Avg Items / Bill"
                                    value={summary.avg_items_per_bill}
                                    icon={Package}
                                    color="blue"
                                />
                                <KPICard
                                    title="Outstanding Credit"
                                    value={summary.outstanding_credit}
                                    icon={CreditCard}
                                    color="orange"
                                    subtext="Unpaid Dues"
                                />
                            </div>

                            {/* 3. Inventory & Risks Section */}
                            <h2 className="dashboard-section-title"><AlertTriangle size={20} /> Inventory & Stock Risks</h2>
                            <div className="stats-grid">
                                <KPICard
                                    title="Low Stock"
                                    value={summary.low_stock_count}
                                    icon={AlertTriangle}
                                    color={summary.low_stock_count > 0 ? "red" : "green"}
                                />
                                <KPICard
                                    title="Dead Stock Value"
                                    value={summary.dead_stock_value}
                                    icon={Ban}
                                    color="red"
                                    subtext="No sales in 30 days"
                                />
                                <KPICard
                                    title="Pending POs"
                                    value={summary.pending_pos}
                                    icon={ShoppingCart}
                                    color="orange"
                                />
                            </div>

                            {/* 4. Marketing & Loyalty Section */}
                            <h2 className="dashboard-section-title"><Ticket size={20} /> Marketing & Loyalty</h2>
                            <div className="stats-grid">
                                <KPICard
                                    title="Active Coupons"
                                    value={summary.active_coupons}
                                    icon={Ticket}
                                    color="blue"
                                />
                                <KPICard
                                    title="Loyalty Liability"
                                    value={summary.loyalty_liability}
                                    icon={Users}
                                    color="purple"
                                    subtext="Unredeemed Points"
                                />
                            </div>

                        </>
                    )}

                    {/* INSIGHTS TAB ONLY */}
                    {activeTab === 'insights' && (
                        <Suspense fallback={<div className="h-96 bg-gray-200 rounded-xl animate-pulse mt-4"></div>}>

                            {/* Existing Customer Analytics Row */}
                            <div className="widgets-grid" style={{ marginTop: '1.5rem' }}>
                                {/* Repeat Customers Table */}
                                <div className="dashboard-card" style={{ maxHeight: '450px' }}>
                                    <h3 className="card-title-lg mb-4">Repeat Customers ({dateRange})</h3>
                                    <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                                        <table className="products-table">
                                            <thead>
                                                <tr>
                                                    <th>Customer</th>
                                                    <th className="val-right">Bills</th>
                                                    <th className="val-right">Total Spent</th>
                                                    <th className="val-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {customerData.repeat_customers?.slice(0, 50).map((c, i) => (
                                                    <tr key={i}>
                                                        <td className="text-primary">
                                                            <div className="font-bold">{c.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.phone}</div>
                                                        </td>
                                                        <td className="val-right font-bold">{c.order_count}</td>
                                                        <td className="val-right text-primary font-bold">₹{Number(c.total_spent || 0).toLocaleString('en-IN')}</td>
                                                        <td className="val-right">
                                                            <button className="btn-icon" onClick={() => setSelectedCustomer(c)}>
                                                                <Eye size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {(!customerData.repeat_customers || customerData.repeat_customers.length === 0) && (
                                            <div className="state-empty">No repeat customers found</div>
                                        )}
                                    </div>
                                </div>

                                {/* Top Spenders Table */}
                                <div className="dashboard-card" style={{ maxHeight: '450px' }}>
                                    <h3 className="card-title-lg mb-4">Top Spenders ({dateRange})</h3>
                                    <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                                        <table className="products-table">
                                            <thead>
                                                <tr>
                                                    <th>Customer</th>
                                                    <th className="val-right">Bills</th>
                                                    <th className="val-right">Total Spent</th>
                                                    <th className="val-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {customerData.top_spenders?.slice(0, 50).map((c, i) => (
                                                    <tr key={i}>
                                                        <td className="text-primary">
                                                            <div className="font-bold">{c.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.phone}</div>
                                                        </td>
                                                        <td className="val-right">{c.order_count}</td>
                                                        <td className="val-right font-bold text-primary">₹{Number(c.total_spent || 0).toLocaleString('en-IN')}</td>
                                                        <td className="val-right">
                                                            <button className="btn-icon" onClick={() => setSelectedCustomer(c)}>
                                                                <Eye size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {(!customerData.top_spenders || customerData.top_spenders.length === 0) && (
                                            <div className="state-empty">No spending data found</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Inventory Alerts & Top Products */}
                            <div className="charts-grid" style={{ marginTop: '1.5rem' }}>
                                <InventoryWidgets
                                    lowStock={inventoryData.low_stock_items}
                                    outOfStockCount={inventoryData.out_of_stock_count}
                                    fastMoving={inventoryData.fast_moving}
                                />
                                <div className="dashboard-card" style={{ maxHeight: '450px' }}>
                                    <h3 className="card-title-lg mb-4">Top Performing Products</h3>
                                    <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                                        <table className="products-table">
                                            <thead>
                                                <tr>
                                                    <th>Product</th>
                                                    <th className="val-right">Sold</th>
                                                    <th className="val-right">Revenue</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {salesData.top_products?.slice(0, 50).map((p, i) => (
                                                    <tr key={i}>
                                                        <td>
                                                            <div className="text-primary font-bold">{p.name}</div>
                                                            {p.barcode && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.barcode}</div>}
                                                        </td>
                                                        <td className="val-right">{p.qty}</td>
                                                        <td className="val-right text-primary font-bold">₹{Number(p.revenue || 0).toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {(!salesData.top_products || salesData.top_products.length === 0) && (
                                            <div className="state-empty">No sales data found</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 5. Advanced Insights: Strategic Growth */}
                            <h2 className="dashboard-section-title"><Star size={20} /> Strategic Insights</h2>
                            <div className="widgets-grid">
                                {/* At-Risk Customers */}
                                <div className="dashboard-card" style={{ maxHeight: '450px' }}>
                                    <div className="flex-between mb-4">
                                        <h3 className="card-title-lg m-0">Re-engage At-Risk Loyalists</h3>
                                        <span className="badge-danger">30+ Days Dormant</span>
                                    </div>
                                    <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                                        <table className="products-table">
                                            <thead>
                                                <tr>
                                                    <th>Customer</th>
                                                    <th className="val-right">Last Visit</th>
                                                    <th className="val-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {salesData.at_risk_customers?.slice(0, 50).map((c, i) => (
                                                    <tr key={i}>
                                                        <td>
                                                            <div className="text-primary font-bold">{c.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.total_bills} bills · ₹{Number(c.lifetime_spend || 0).toLocaleString('en-IN')} total</div>
                                                        </td>
                                                        <td className="val-right">
                                                            <div className="text-red font-bold">{c.days_since} days ago</div>
                                                            <div style={{ fontSize: '0.7rem' }}>{new Date(c.last_visit).toLocaleDateString()}</div>
                                                        </td>
                                                        <td className="val-right">
                                                            <button
                                                                className="btn-icon theme-green"
                                                                title="Send WhatsApp"
                                                                onClick={() => {
                                                                    const msg = `Hi ${c.name}, we haven't seen you at the store in a while! We miss you. Use code MISSYOU10 for 10% off on your next visit!`;
                                                                    window.open(`https://wa.me/${c.phone}?text=${encodeURIComponent(msg)}`, '_blank');
                                                                }}
                                                            >
                                                                <MessageSquare size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {(!salesData.at_risk_customers || salesData.at_risk_customers.length === 0) && (
                                            <div className="state-empty">Your loyal customers are active!</div>
                                        )}
                                    </div>
                                </div>

                                {/* Profitability Leaderboard */}
                                <div className="dashboard-card" style={{ maxHeight: '450px' }}>
                                    <h3 className="card-title-lg mb-4">Profitability Leaderboard (Margin %)</h3>
                                    <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
                                        <table className="products-table">
                                            <thead>
                                                <tr>
                                                    <th>Product</th>
                                                    <th className="val-right">Margin %</th>
                                                    <th className="val-right">Profit Contribution</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {salesData.profitable_items?.slice(0, 50).map((p, i) => (
                                                    <tr key={i}>
                                                        <td>
                                                            <div className="text-primary font-bold">{p.name}</div>
                                                            {p.barcode && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.barcode}</div>}
                                                        </td>
                                                        <td className="val-right">
                                                            <div className="text-green font-bold">{Number(p.avg_margin_percent || 0).toFixed(1)}%</div>
                                                            <div style={{ fontSize: '0.7rem' }}>Sold: {p.total_qty} units</div>
                                                        </td>
                                                        <td className="val-right text-primary font-bold">₹{Number(p.total_profit_contribution || 0).toLocaleString('en-IN')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {(!salesData.profitable_items || salesData.profitable_items.length === 0) && (
                                            <div className="state-empty">Not enough sales data for margin analysis</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Suspense>
                    )}

                </Suspense>
            )}

            {selectedCustomer && (
                <Suspense fallback={null}>
                    <CustomerDetailModal
                        customer={selectedCustomer}
                        onClose={() => setSelectedCustomer(null)}
                        onUpdate={fetchAllData}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default Statistics;
