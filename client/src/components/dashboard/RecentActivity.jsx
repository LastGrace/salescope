import React from 'react';
import { User, Activity, ShoppingCart, Box } from 'lucide-react';

const RecentActivity = ({ activities = [] }) => {

    const getIcon = (action) => {
        if (action.includes('sale')) return <ShoppingCart size={16} className="text-green" />;
        if (action.includes('inventory') || action.includes('product')) return <Box size={16} className="text-blue" />;
        if (action.includes('employee') || action.includes('permission')) return <User size={16} className="text-purple" />;
        return <Activity size={16} className="text-secondary" style={{ color: 'var(--text-secondary)' }} />;
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = (now - date) / 1000; // seconds

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="dashboard-card">
            <h3 className="card-title-lg mb-4">Recent Activity</h3>
            <div className="activity-feed custom-scrollbar">
                {activities.map((log, i) => (
                    <div key={i} className="activity-item">
                        <div className="activity-icon-wrapper">
                            {getIcon(log.action)}
                        </div>
                        <div className="activity-content">
                            <div className="activity-text">
                                <span className="activity-user">{log.user}</span>
                                {log.action.replace(/[._]/g, ' ')}
                            </div>
                            {log.details && (
                                <div className="activity-details">
                                    {log.details.replace(/[{"}]/g, ' ').slice(0, 50)}
                                </div>
                            )}
                            <div className="activity-time">
                                {formatTime(log.created_at)}
                            </div>
                        </div>
                    </div>
                ))}

                {activities.length === 0 && (
                    <div className="state-empty">No recent activity</div>
                )}
            </div>
        </div>
    );
};

export default RecentActivity;
