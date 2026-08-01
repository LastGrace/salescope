import React, { useEffect, useState, Suspense } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
    IndianRupee, ShoppingCart, Percent, AlertTriangle,
    CreditCard, LayoutDashboard, TrendingUp, Package, Wallet,
    Ban, Ticket, Users, ArrowDownCircle, BarChart3, Activity
} from 'lucide-react';

import KPICard from '../components/statistics/KPICard';
import SalesChart from '../components/statistics/SalesChart';
import StatisticsSkeleton from '../components/statistics/StatisticsSkeleton';
import CustomRangePicker from '../components/statistics/CustomRangePicker';
import StrategicInsights from '../components/statistics/StrategicInsights';

import CustomerDetailModal from '../components/CustomerDetailModal';
import '../styles/Statistics.css';
import '../styles/Modal.css';

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
                <CustomRangePicker
                    customRange={customRange}
                    setCustomRange={setCustomRange}
                    onApply={() => setAppliedCustomRange(customRange)}
                />
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
                        <StrategicInsights
                            dateRange={dateRange}
                            setDateRange={setDateRange}
                            customerData={customerData}
                            salesData={salesData}
                            inventoryData={inventoryData}
                            setSelectedCustomer={setSelectedCustomer}
                        />
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
