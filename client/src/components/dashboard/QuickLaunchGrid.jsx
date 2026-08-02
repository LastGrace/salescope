import React from 'react';
import { Link } from 'react-router-dom';
import { Rocket } from 'lucide-react';

const QuickLaunchGrid = ({ quickLaunchItems = [], hasPermission }) => {
    return (
        <>
            <h2 className="dashboard-section-title"><Rocket size={20} /> Quick Launch</h2>
            <div className="hub-grid hub-grid-quick">
                {quickLaunchItems.map((item, idx) => {
                    const Icon = item.icon;
                    if (item.permission && !hasPermission(item.permission)) return null;

                    return (
                        <Link key={idx} to={item.path} className="hub-card hub-card-quick">
                            <div className={`hub-icon ${item.color} hub-icon-circle`}>
                                <Icon size={22} />
                            </div>
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </>
    );
};

export default QuickLaunchGrid;
