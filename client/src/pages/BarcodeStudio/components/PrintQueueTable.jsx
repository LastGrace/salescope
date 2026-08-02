import React from 'react';
import { Plus, Trash2, Printer, RefreshCw, Eye } from 'lucide-react';

const PrintQueueTable = ({
    queue,
    onUpdateQty,
    onUpdatePriceMode,
    onRemoveFromQueue,
    onClearQueue,
    onOpenProductSelector,
    onOpenPreview
}) => {
    const totalLabelsCount = queue.reduce((sum, item) => sum + (parseInt(item.printQty) || 0), 0);

    return (
        <div className="batch-queue-wrapper">
            {/* Header Control Card */}
            <div className="batch-controls-card">
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Batch Print Queue</h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Configure quantities and price modes before sending to printer
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button type="button" className="btn btn-secondary" onClick={onOpenProductSelector}>
                        <Plus size={16} style={{ marginRight: '6px' }} />
                        Add Products
                    </button>
                    {queue.length > 0 && (
                        <>
                            <button type="button" className="btn btn-secondary" onClick={onClearQueue} style={{ color: '#ef4444' }}>
                                Clear Queue
                            </button>
                            <button type="button" className="btn btn-primary" onClick={onOpenPreview} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                                <Printer size={16} style={{ marginRight: '6px' }} />
                                Preview & Print ({totalLabelsCount} Labels)
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Queue Table */}
            <div className="batch-table-container">
                <table className="batch-table">
                    <thead>
                        <tr>
                            <th>Product Name</th>
                            <th>Barcode</th>
                            <th>Price Mode</th>
                            <th>Label Price</th>
                            <th style={{ width: '130px', textAlign: 'center' }}>Copies</th>
                            <th style={{ width: '60px', textAlign: 'center' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {queue.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                                    <Printer size={40} style={{ opacity: 0.2, marginBottom: '0.5rem' }} /><br />
                                    Your print queue is currently empty.<br />
                                    Click <strong>Add Products</strong> to select items for label printing.
                                </td>
                            </tr>
                        ) : (
                            queue.map((item, idx) => {
                                const priceMode = item.priceMode || 'selling_price';
                                let displayPrice = item.price;
                                if (priceMode === 'mrp') displayPrice = item.mrp || item.price;
                                else if (priceMode === 'cost_price') displayPrice = item.cost_price || 0;

                                return (
                                    <tr key={item.uid || `${item.id}-${idx}`}>
                                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                                        <td><code>{item.barcode}</code></td>
                                        <td>
                                            <select
                                                className="prop-input"
                                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                                value={priceMode}
                                                onChange={(e) => onUpdatePriceMode(item.uid, e.target.value)}
                                            >
                                                <option value="selling_price">Selling Price (₹{item.price})</option>
                                                <option value="mrp">MRP (₹{item.mrp || item.price})</option>
                                                <option value="cost_price">Cost Price (₹{item.cost_price || 0})</option>
                                            </select>
                                        </td>
                                        <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                            ₹{Number(displayPrice || 0).toFixed(2)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <input
                                                type="number"
                                                className="qty-input-field"
                                                min="1"
                                                value={item.printQty || 1}
                                                onChange={(e) => onUpdateQty(item.uid, parseInt(e.target.value) || 1)}
                                            />
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button
                                                type="button"
                                                className="btn-icon"
                                                onClick={() => onRemoveFromQueue(item.uid)}
                                                style={{ color: '#ef4444' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PrintQueueTable;
