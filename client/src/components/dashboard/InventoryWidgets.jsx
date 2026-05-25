import React from 'react';
import { AlertTriangle, Package, TrendingUp } from 'lucide-react';

const InventoryWidgets = ({ lowStock = [], outOfStockCount = 0, fastMoving = [] }) => {
    return (
        <div className="grid-cols-2">
            {/* Low Stock Alert */}
            <div className="dashboard-card">
                <div className="flex-between mb-4">
                    <h3 className="card-title-lg" style={{ margin: 0 }}>Inventory Alerts</h3>
                    {outOfStockCount > 0 && (
                        <span className="badge-danger">
                            {outOfStockCount} Out of Stock
                        </span>
                    )}
                </div>

                <div className="inventory-list custom-scrollbar">
                    {lowStock.length === 0 ? (
                        <div className="state-empty">Inventory looks healthy!</div>
                    ) : (
                        lowStock.map((item, i) => (
                            <div key={i} className="inventory-item">
                                <div className="item-info">
                                    <div className="item-icon">
                                        <Package size={16} />
                                    </div>
                                    <div>
                                        <div className="item-name">{item.name}</div>
                                        {item.barcode && <div className="item-subtext" style={{ fontSize: '0.65rem', marginBottom: '0.1rem' }}>{item.barcode}</div>}
                                        <div className="item-subtext">Min: {item.min_stock_level}</div>
                                    </div>
                                </div>
                                <div className={item.stock_quantity === 0 ? 'text-red font-bold' : 'text-orange font-bold'}>
                                    {item.stock_quantity} left
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Fast Moving Items */}
            <div className="dashboard-card">
                <h3 className="card-title-lg mb-4">Fast Moving (30 Days)</h3>
                <div className="inventory-list">
                    {fastMoving.map((item, i) => (
                        <div key={i} style={{ marginBottom: '1rem', position: 'relative' }}>
                            <div className="flex-between" style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                <div>
                                    <span className="item-name" style={{ display: 'block' }}>{item.name}</span>
                                    {item.barcode && <span className="item-subtext" style={{ fontSize: '0.65rem' }}>{item.barcode}</span>}
                                </div>
                                <span className="item-subtext" style={{ whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>{item.sold} sold</span>
                            </div>
                            <div className="progress-bar-bg">
                                <div
                                    className="progress-bar-fill"
                                    style={{
                                        width: `${Math.min((item.sold / (fastMoving[0]?.sold || 1)) * 100, 100)}%`,
                                        backgroundColor: 'var(--color-primary)'
                                    }}
                                ></div>
                            </div>
                        </div>
                    ))}
                    {fastMoving.length === 0 && (
                        <div className="state-empty">No sales data yet</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InventoryWidgets;
