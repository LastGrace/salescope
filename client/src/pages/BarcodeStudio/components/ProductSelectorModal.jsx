import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, X, Plus, Package, CheckSquare, Square, Layers, Truck, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

const ProductSelectorModal = ({ isOpen, onClose, onAddProductsToQueue }) => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [search, setSearch] = useState('');
    const [scanCode, setScanCode] = useState('');

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [qtyMap, setQtyMap] = useState({});

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
            fetchProducts();
        }
    }, [isOpen, selectedCategory]);

    const fetchCategories = async () => {
        try {
            const res = await axios.get('/api/categories');
            setCategories(res.data || []);
        } catch (e) { }
    };

    const fetchProducts = async () => {
        try {
            const res = await axios.get('/api/barcode/batch-products', {
                params: { category: selectedCategory, search }
            });
            setProducts(res.data || []);
        } catch (e) {
            console.error('Fetch products error:', e);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchProducts();
    };

    const handleScan = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = scanCode.trim().toUpperCase();
            if (!code) return;

            const found = products.find(p => p.barcode?.toUpperCase() === code);
            if (found) {
                const nextIds = new Set(selectedIds);
                nextIds.add(found.id);
                setSelectedIds(nextIds);
                setQtyMap(prev => ({ ...prev, [found.id]: (prev[found.id] || 0) + 1 }));
                setScanCode('');
                toast.success(`Added ${found.name}`);
            } else {
                toast.error('Product barcode not found');
            }
        }
    };

    const toggleSelect = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
            if (!qtyMap[id]) setQtyMap(prev => ({ ...prev, [id]: 1 }));
        }
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === products.length) {
            setSelectedIds(new Set());
        } else {
            const allIds = new Set(products.map(p => p.id));
            const newQtyMap = { ...qtyMap };
            products.forEach(p => { if (!newQtyMap[p.id]) newQtyMap[p.id] = 1; });
            setSelectedIds(allIds);
            setQtyMap(newQtyMap);
        }
    };

    const handleAddSelected = () => {
        const selectedItems = products.filter(p => selectedIds.has(p.id)).map(p => ({
            ...p,
            printQty: qtyMap[p.id] || 1
        }));

        onAddProductsToQueue(selectedItems);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="studio-modal-overlay">
            <div className="studio-modal-card">
                <div className="studio-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={20} className="text-primary" />
                        <h3>Select Products for Barcode Printing</h3>
                    </div>
                    <button type="button" className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="studio-modal-body">
                    {/* Filters & Scan Bar */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                className="prop-input"
                                style={{ flex: 1 }}
                                placeholder="Search by product name or barcode..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <button type="submit" className="btn btn-secondary">
                                <Search size={16} />
                            </button>
                        </form>

                        <input
                            type="text"
                            className="prop-input"
                            style={{ width: '220px' }}
                            placeholder="Direct Barcode Scanner..."
                            value={scanCode}
                            onChange={(e) => setScanCode(e.target.value)}
                            onKeyDown={handleScan}
                        />

                        <select
                            className="prop-input"
                            style={{ width: '180px' }}
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            <option value="">All Categories</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Products Table */}
                    <div className="batch-table-container custom-scrollbar" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                        <table className="batch-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>
                                        <button type="button" className="btn-icon" onClick={toggleSelectAll}>
                                            {selectedIds.size > 0 && selectedIds.size === products.length ? <CheckSquare size={16} /> : <Square size={16} />}
                                        </button>
                                    </th>
                                    <th>Product Name</th>
                                    <th>Barcode</th>
                                    <th>Category</th>
                                    <th>MRP / Price</th>
                                    <th style={{ width: '100px' }}>Print Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                            No products found matching criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    products.map(p => {
                                        const isChecked = selectedIds.has(p.id);
                                        return (
                                            <tr key={p.id} onClick={() => toggleSelect(p.id)} style={{ cursor: 'pointer', background: isChecked ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                                                <td>
                                                    {isChecked ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} style={{ opacity: 0.4 }} />}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{p.name}</td>
                                                <td><code>{p.barcode}</code></td>
                                                <td>{p.category || '-'}</td>
                                                <td style={{ fontWeight: 'bold' }}>₹{p.price}</td>
                                                <td onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="number"
                                                        className="qty-input-field"
                                                        min="1"
                                                        value={qtyMap[p.id] || 1}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 1;
                                                            setQtyMap(prev => ({ ...prev, [p.id]: val }));
                                                            if (!selectedIds.has(p.id)) {
                                                                const next = new Set(selectedIds);
                                                                next.add(p.id);
                                                                setSelectedIds(next);
                                                            }
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {selectedIds.size} products selected
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleAddSelected}
                                disabled={selectedIds.size === 0}
                            >
                                Add {selectedIds.size} Products to Batch Queue
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductSelectorModal;
