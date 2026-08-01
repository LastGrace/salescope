import React from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';

const SalesChart = ({ data, type = 'area' }) => {
    if (!data || data.length === 0) {
        return <div className="state-empty" style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No data available</div>;
    }

    const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumSignificantDigits: 3 }).format(val);

    return (
        <div className="dashboard-card" style={{ minWidth: 0 }}>
            <h3 className="card-title-lg mb-4">Sales Trend</h3>
            <div style={{ width: '100%', height: '300px', minHeight: 0, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                    {type === 'area' ? (
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                tickFormatter={(str) => new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                tickFormatter={(val) => `₹${val / 1000}k`}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                formatter={(val) => [formatCurrency(val), 'Sales']}
                                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                            />
                            <Area
                                type="monotone"
                                dataKey="total"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorTotal)"
                            />
                        </AreaChart>
                    ) : (
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                tickFormatter={(str) => new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#9ca3af', fontSize: 12 }}
                                tickFormatter={(val) => `₹${val / 1000}k`}
                            />
                            <Tooltip
                                cursor={{ fill: '#f3f4f6' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                formatter={(val) => [formatCurrency(val), 'Sales']}
                            />
                            <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default SalesChart;
