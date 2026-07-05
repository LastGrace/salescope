import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Edit, Trash, Download, Upload, FileText, Search, Package } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/Inventory.css';

const Inventory = () => {
    const { user, hasPermission, hasAnyPermission } = useAuth();

    // Permission flags
    const canCreate = hasPermission('inventory.product.create');
    const canEdit = hasPermission('inventory.product.update');
    const canDelete = hasPermission('inventory.product.delete');
    const canImport = hasPermission('inventory.import');
    const canExport = hasPermission('inventory.export');
    const canManageCategories = hasPermission('inventory.category.manage');
    const canSeeFinancials = hasAnyPermission(['inventory.product.update', 'inventory.product.create']);
    const canManageInventory = canEdit || canDelete || canCreate;

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [allSubcategories, setAllSubcategories] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Pagination & Search State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit, setLimit] = useState(50);
    const [totalProducts, setTotalProducts] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({
        barcode: '', name: '', category: '', subcategory_id: '', price: '', cost_price: '', stock_quantity: '', low_stock_threshold: '10'
    });

    // Confirmation Modal State
    const [confirmAction, setConfirmAction] = useState({ isOpen: false, type: 'single', productId: null });
    const [activeProductId, setActiveProductId] = useState(null);

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1); // Reset to page 1 on new search
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset page when category changes
    useEffect(() => {
        setPage(1);
    }, [selectedCategory]);

    useEffect(() => {
        fetchProducts();
    }, [page, limit, debouncedSearch, selectedCategory]);

    useEffect(() => {
        fetchCategories();
        fetchSubcategories();
    }, []);

    const fetchProducts = async () => {
        try {
            const params = {
                page,
                limit,
                search: debouncedSearch,
                category: selectedCategory
            };
            const res = await axios.get('/api/products', { params });
            setProducts(res.data.products);
            setTotalPages(res.data.totalPages);
            setTotalProducts(res.data.total);
        } catch (err) {
            console.error(err);
            toast.error('Error fetching products');
        }
    };

    const fetchCategories = async () => {
        try {
            const res = await axios.get('/api/categories');
            setCategories(res.data);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    const fetchSubcategories = async () => {
        try {
            const res = await axios.get('/api/subcategories');
            setAllSubcategories(res.data);
        } catch (err) {
            console.error('Error fetching subcategories:', err);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === products.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(products.map(p => p.id)));
        }
    };

    const toggleSelect = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const handleBulkDelete = () => {
        setConfirmAction({ isOpen: true, type: 'bulk' });
    };

    const confirmDeleteAction = async () => {
        try {
            if (confirmAction.type === 'bulk') {
                const ids = Array.from(selectedIds);
                await axios.post('/api/products/bulk-delete', { ids });
                toast.success(`${ids.length} products deleted`);
                setSelectedIds(new Set());
            } else {
                await axios.delete(`/api/products/${confirmAction.productId}`);
                toast.success('Product deleted');
            }
            fetchProducts();
            setConfirmAction({ isOpen: false, type: 'single', productId: null });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error occurred');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let savedBarcode = formData.barcode;
            let savedId = null;
            if (editingProduct) {
                await axios.put(`/api/products/${editingProduct.id}`, formData);
                toast.success('Product updated');
                savedId = editingProduct.id;
            } else {
                const res = await axios.post('/api/products', formData);
                toast.success('Product created');
                savedId = res.data.id;
                if (res.data.barcode) savedBarcode = res.data.barcode;
            }
            setShowForm(false);
            setEditingProduct(null);
            setFormData({ barcode: '', name: '', category: '', subcategory_id: '', price: '', cost_price: '', stock_quantity: '', low_stock_threshold: '10' });
            
            if (savedBarcode) {
                setSearchTerm(savedBarcode);
                if (savedId) {
                    setActiveProductId(savedId);
                    setTimeout(() => {
                        setActiveProductId(null);
                    }, 5000);
                }
            } else {
                fetchProducts();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving product');
        }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        try {
            await axios.post('/api/categories', { name: newCategoryName });
            await fetchCategories();
            setNewCategoryName('');
            setShowCategoryForm(false);
            toast.success('Category added');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error creating category');
        }
    };

    const handleDelete = async (id) => {
        setConfirmAction({ isOpen: true, type: 'single', productId: id });
    };

    const startEdit = (p) => {
        setEditingProduct(p);
        setFormData(p);
        setShowForm(true);
    };

    const handleExport = () => {
        const token = sessionStorage.getItem('token');
        window.open(`/api/export/products?token=${token}`, '_blank');
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                const formattedData = jsonData.map(row => {
                    const getVal = (keys) => {
                        for (const key of keys) {
                            if (row[key] !== undefined) return row[key];
                        }
                        return '';
                    };

                    return {
                        barcode: getVal(['Barcode', 'barcode']).toString().toUpperCase(),
                        name: getVal(['Product Name', 'Name', 'name']),
                        category: getVal(['Category', 'category']),
                        subcategory: getVal(['Subcategory', 'subcategory']),
                        price: getVal(['Selling Price', 'Price', 'price']),
                        cost_price: getVal(['Cost Price', 'Cost', 'cost_price']) || 0,
                        stock_quantity: getVal(['Stock', 'Quantity', 'stock_quantity']),
                        low_stock_threshold: getVal(['Min Stock', 'Low Stock Limit', 'low_stock_threshold']) || 10
                    };
                });

                await axios.post('/api/products/batch', formattedData);
                toast.success('Import successful');
                fetchProducts();
            } catch (err) {
                console.error(err);
                toast.error('Import failed: ' + (err.response?.data?.message || err.message));
            }
            e.target.value = null;
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="inventory-page">
            <header className="inventory-header">
                <div className="inventory-header-top">
                    <div className="inventory-title-group">
                        <div className="inventory-icon-box"><Package size={24} /></div>
                        <div className="inventory-title"><h1>Inventory Management</h1><p>Manage products, stock levels, and categories</p></div>
                    </div>
                    <div className="inventory-search-wrapper">
                        <Search className="inventory-search-icon" size={18} />
                        <input
                            className="inventory-search-input"
                            placeholder="Search products by name or barcode..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                {
                    (canExport || canImport || canCreate) && (
                        <div className="inventory-header-actions">
                            {canExport && (
                                <button className="btn btn-icon-text" onClick={handleExport}>
                                    <Download size={16} /> Export
                                </button>
                            )}
                            {canImport && (
                                <>
                                    <button className="btn btn-icon-text" onClick={() => window.open('/api/files/sample/inventory', '_blank')}>
                                        <FileText size={16} /> Sample
                                    </button>
                                    <button className="btn btn-icon-text" onClick={() => document.getElementById('file-upload').click()}>
                                        <Upload size={16} /> Import
                                    </button>
                                    <input type="file" id="file-upload" accept=".csv, .xlsx" style={{ display: 'none' }} onChange={handleImport} />
                                </>
                            )}
                            {canCreate && (
                                <button className="btn btn-primary" onClick={() => { setEditingProduct(null); setShowForm(true); }}>
                                    <Plus size={16} /> Add Product
                                </button>
                            )}
                        </div>
                    )
                }
            </header >

            {/* Category Modal */}
            {
                showCategoryForm && (
                    <div className="inventory-modal-overlay">
                        <div className="inventory-modal modal-category">
                            <h3>Add New Category</h3>
                            <form onSubmit={handleAddCategory} className="inventory-form-full">
                                <input className="input" placeholder="Category Name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} autoFocus />
                                <div className="form-actions">
                                    <button type="button" className="btn" onClick={() => setShowCategoryForm(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Add</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Product Modal */}
            {
                showForm && (
                    <div className="inventory-modal-overlay">
                        <div className="inventory-modal modal-product">
                            <h3>{editingProduct ? 'Edit Product' : 'New Product'}</h3>
                            <form onSubmit={handleSubmit} className="inventory-form">
                                <div><label>Barcode</label><input className="input" required value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value.toUpperCase() })} /></div>
                                <div><label>Name</label><input className="input" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                <div>
                                    <label>Category</label>
                                    <div className="category-input-group">
                                        <select className="input category-select" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value, subcategory_id: '' })}>
                                            <option value="">Select Category</option>
                                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        </select>
                                        {canManageCategories && <button type="button" className="btn" onClick={() => setShowCategoryForm(true)}><Plus size={16} /></button>}
                                    </div>
                                </div>
                                <div>
                                    <label>Subcategory</label>
                                    <select className="input" value={formData.subcategory_id || ''} onChange={e => setFormData({ ...formData, subcategory_id: e.target.value })} disabled={!formData.category}>
                                        <option value="">Select Subcategory (Optional)</option>
                                        {allSubcategories.filter(s => s.category_name === formData.category).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div><label>Price</label><input type="number" step="0.01" className="input" required value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} /></div>
                                <div><label>Cost Price</label><input type="number" step="0.01" className="input" required value={formData.cost_price} onChange={e => setFormData({ ...formData, cost_price: e.target.value })} /></div>
                                <div><label>Stock</label><input type="number" className="input" required value={formData.stock_quantity} onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })} /></div>
                                <div><label>Min Threshold</label><input type="number" className="input" value={formData.low_stock_threshold} onChange={e => setFormData({ ...formData, low_stock_threshold: e.target.value })} /></div>
                                <div className="form-actions">
                                    <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Save Product</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            <div className="inventory-table-container">
                <table className="inventory-table">
                    <thead>
                        <tr>
                            <th className="checkbox-cell">
                                <input type="checkbox" className="custom-checkbox" checked={selectedIds.size > 0 && selectedIds.size === products.length} onChange={toggleSelectAll} />
                            </th>
                            <th>Barcode</th>
                            <th>Name</th>
                            <th>Category</th>
                            {canSeeFinancials && <th>Cost</th>}
                            <th>Price</th>
                            {canSeeFinancials && <th>Margin</th>}
                            <th>Stock</th>
                            {canManageInventory && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(p => (
                            <tr key={p.id} className={`${selectedIds.has(p.id) ? 'row-selected' : ''} ${activeProductId === p.id ? 'active-highlight-row' : ''}`}>
                                <td className="checkbox-cell" data-label="Select">
                                    <input type="checkbox" className="custom-checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} />
                                </td>
                                <td data-label="Barcode"><span className="inventory-barcode">{p.barcode}</span></td>
                                <td data-label="Product Name">{p.name}</td>
                                <td data-label="Category">
                                    <div className="category-cell">
                                        <span className="category-name">{p.category}</span>
                                        {p.subcategory_name && <span className="subcategory-tag">{p.subcategory_name}</span>}
                                    </div>
                                </td>
                                {canSeeFinancials && <td className="cost-cell" data-label="Cost Price">₹{p.cost_price || 0}</td>}
                                <td className="price-cell" data-label="Selling Price">₹{p.price}</td>
                                {canSeeFinancials && (
                                    <td data-label="Margin">
                                        {(() => {
                                            const margin = parseFloat(p.price || 0) - parseFloat(p.cost_price || 0);
                                            const percent = p.price > 0 ? ((margin / p.price) * 100).toFixed(1) : 0;
                                            return <span className={margin >= 0 ? 'margin-positive' : 'margin-negative'}>₹{margin.toFixed(2)} ({percent}%)</span>;
                                        })()}
                                    </td>
                                )}
                                <td data-label="Stock"><span className={p.stock_quantity <= p.low_stock_threshold ? 'stock-low' : 'stock-ok'}>{p.stock_quantity}</span></td>
                                {canManageInventory && (
                                    <td data-label="Actions">
                                        <div className="flex gap-2">
                                            {canEdit && <button className="btn btn-edit" onClick={() => startEdit(p)}><Edit size={14} /></button>}
                                            {canDelete && <button className="btn btn-delete" onClick={() => handleDelete(p.id)}><Trash size={14} /></button>}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="pagination-container">
                <div className="pagination-info">
                    Showing {products.length} of {totalProducts} products
                </div>
                <div className="pagination-controls">
                    <select
                        className="input pagination-limit-select"
                        value={limit}
                        onChange={(e) => {
                            setLimit(Number(e.target.value));
                            setPage(1); // Reset to page 1 on limit change
                        }}
                    >
                        {[50, 100, 200, 500, 1000, 1500, 2000, 3000, 5000].map(val => (
                            <option key={val} value={val}>{val} per page</option>
                        ))}
                    </select>
                    <button
                        className="btn pagination-btn"
                        disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                        Previous
                    </button>
                    <span className="pagination-page-info">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className="btn pagination-btn"
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >
                        Next
                    </button>
                </div>
            </div>

            <div className={`bulk-actions-bar ${selectedIds.size > 0 ? 'visible' : ''}`}>
                <span className="selected-count">{selectedIds.size} Items Selected</span>
                <button className="bulk-btn-delete" onClick={handleBulkDelete}>
                    <Trash size={16} /> Delete Selected
                </button>
                <button className="bulk-btn-cancel" onClick={() => setSelectedIds(new Set())}>Cancel</button>
            </div>

            <ConfirmModal
                isOpen={confirmAction.isOpen}
                onClose={() => setConfirmAction({ isOpen: false, type: 'single', productId: null })}
                onConfirm={confirmDeleteAction}
                title={confirmAction.type === 'bulk' ? 'Delete Multiple Products' : 'Delete Product'}
                message={confirmAction.type === 'bulk' ? `Are you sure you want to delete ${selectedIds.size} products? This action cannot be undone.` : "Are you sure you want to delete this product?"}
                type="danger"
            />
        </div >
    );
};

export default Inventory;
