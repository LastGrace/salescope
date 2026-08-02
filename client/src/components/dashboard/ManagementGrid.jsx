import React from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';

const ManagementGrid = ({ hubItems = [], hasPermission }) => {
    return (
        <>
            <h2 className="dashboard-section-title"><Settings size={20} /> Systems & Management</h2>
            <div className="hub-grid hub-grid-mgmt">
                {hubItems.map((item, idx) => {
                    const Icon = item.icon;
                    if (!hasPermission(item.permission)) return null;

                    return (
                        <Link key={idx} to={item.path} className="hub-card">
                            <div className={`hub-icon ${item.color} hub-icon-circle`}>
                                <Icon size={20} />
                            </div>
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </>
    );
};

export default ManagementGrid;
