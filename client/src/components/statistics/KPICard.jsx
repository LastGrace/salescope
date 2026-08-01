import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// Formatter for currency
const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

const KPICard = ({ title, value, subtext, icon: Icon, trend, color = 'blue', forceCurrency = false }) => {
    const isCurrency = forceCurrency || (
        typeof value === 'number' &&
        (title.toLowerCase().includes('sales') ||
            title.toLowerCase().includes('profit') ||
            title.toLowerCase().includes('credit') ||
            title.toLowerCase().includes('value') ||
            title.toLowerCase().includes('margin') ||
            title.toLowerCase().includes('liability') ||
            title.toLowerCase().includes('expenses')) &&
        !title.toLowerCase().includes('count') &&
        !title.toLowerCase().includes('avg') &&
        !title.toLowerCase().includes('bill')
    );

    return (
        <div className="stat-card">
            <div className="stat-info">
                <div className="stat-label">{title}</div>
                <div className="stat-value">
                    {isCurrency && typeof value === 'number'
                        ? formatCurrency(value)
                        : (typeof value === 'number' ? value.toLocaleString('en-IN') : value)}
                    {title.toLowerCase().includes('percent') || title.toLowerCase().includes('margin') ? '%' : ''}
                </div>
                {subtext && <div className="stat-sub">{subtext}</div>}

                {trend !== undefined && (
                    <div className="trend-indicator" style={{ marginTop: '0.5rem', color: trend > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        <span style={{ marginLeft: '0.25rem' }}>{Math.abs(trend)}%</span>
                    </div>
                )}
            </div>

            <div className={`kpi-icon-wrapper theme-${color}`}>
                {Icon && <Icon size={20} />}
            </div>
        </div>
    );
};

export default KPICard;
