import React, { Suspense } from 'react';
import { Star, Eye, MessageSquare } from 'lucide-react';
import InventoryWidgets from './InventoryWidgets';

const StrategicInsights = ({
    dateRange,
    setDateRange,
    customerData = {},
    salesData = {},
    inventoryData = {},
    setSelectedCustomer
}) => {
    return (
        <>
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
        </>
    );
};

export default StrategicInsights;
