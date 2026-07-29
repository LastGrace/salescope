import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, CheckCircle, Download, Upload, Trash2, Search, Package, ClipboardList } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import '../styles/PurchaseOrders.css';

const PurchaseOrders = () => {
    const [orders, setOrders] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [products, setProducts] = useState([]);

    // New PO Form State
    const [vendorName, setVendorName] = useState(() => localStorage.getItem('po_vendor') || '');
    const [cart, setCart] = useState(() => {
        const saved = localStorage.getItem('po_cart');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('po_vendor', vendorName);
        localStorage.setItem('po_cart', JSON.stringify(cart));
    }, [vendorName, cart]);

    useEffect(() => {
        fetchOrders();
        fetchProducts();
    }, []);

    const fetchOrders = async () => {
        try {
            const res = await axios.get('/api/purchase-orders');
            setOrders(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await axios.get('/api/products');
            setProducts(Array.isArray(res.data) ? res.data : res.data.products || []);
        } catch (err) { console.error(err); }
    };

    const addToCart = (productId) => {
        if (!productId) return;
        const product = products.find(p => p.id === parseInt(productId));
        if (!product) return;
        setCart([...cart, { product_id: product.id, name: product.name, quantity: 1, cost_price: 0 }]);
    };

    const updateCartItem = (index, field, value) => {
        const newCart = [...cart];
        newCart[index][field] = value;
        setCart(newCart);
    };

    const removeCartItem = (index) => {
        const newCart = cart.filter((_, i) => i !== index);
        setCart(newCart);
    };

    const createPO = async () => {
        try {
            await axios.post('/api/purchase-orders', { vendor_name: vendorName, items: cart });
            setShowForm(false);
            setVendorName('');
            setCart([]);
            localStorage.removeItem('po_vendor');
            localStorage.removeItem('po_cart');
            fetchOrders();
            toast.success('Purchase order created successfully!');
        } catch (err) {
            toast.error('Failed to create PO');
        }
    };

    const receivePO = async (id) => {
        try {
            await axios.post(`/api/purchase-orders/${id}/receive`);
            toast.success('Order marked as received!');
            fetchOrders();
        } catch (err) {
            toast.error('Failed to receive PO');
        }
    };

    const handleExport = () => {
        const token = localStorage.getItem('token');
        window.open(`/api/export/purchase-orders?token=${token}`, '_blank');
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

                // Map Excel headers to API keys
                const formattedData = jsonData.map(row => ({
                    vendor: row['Vendor'] || row['vendor'],
                    barcode: row['Barcode'] || row['barcode'],
                    quantity: row['Quantity'] || row['quantity'],
                    cost: row['Cost'] || row['cost']
                })).filter(item => item.barcode && item.quantity); // Ensure valid items

                if (formattedData.length === 0) {
                    toast.error('No valid items found. Ensure columns are: Vendor, Barcode, Quantity, Cost');
                    return;
                }

                await axios.post('/api/purchase-orders/batch', formattedData);
                toast.success('Import successful');
                fetchOrders();
            } catch (err) {
                console.error(err);
                toast.error('Import failed: ' + (err.response?.data?.message || err.message));
            }
            e.target.value = null;
        };
        reader.readAsArrayBuffer(file);
    };

    const [searchTerm, setSearchTerm] = useState('');

    const filteredOrders = orders.filter(po => {
        const term = searchTerm.toLowerCase();
        return (
            po.vendor_name.toLowerCase().includes(term) ||
            po.id.toString().includes(term) ||
            po.status.toLowerCase().includes(term) ||
            new Date(po.created_at).toLocaleDateString().includes(term)
        );
    });

    return (
        <div className="po-page">
            {/* Header Section */}
            <div className="po-header">
                <div className="po-header-left">
                    <h1>Purchase Orders</h1>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            className="po-search-input"
                            placeholder="Search orders, vendors..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '2.5rem' }}
                        />
                    </div>
                </div>
                <div className="po-header-actions">
                    <button className="po-btn po-btn-outline" onClick={handleExport}>
                        <Download size={16} /> Export
                    </button>
                    <button className="po-btn po-btn-outline" onClick={() => document.getElementById('file-upload-po').click()}>
                        <Upload size={16} /> Import
                    </button>
                    <input
                        type="file"
                        id="file-upload-po"
                        accept=".csv, .xlsx"
                        style={{ display: 'none' }}
                        onChange={handleImport}
                    />
                    <button className="po-btn po-btn-primary" onClick={() => setShowForm(!showForm)}>
                        {showForm ? 'Cancel Creation' : <><Plus size={16} /> New Order</>}
                    </button>
                </div>
            </div>

            {/* Create PO Form */}
            {showForm && (
                <div className="po-create-section">
                    <h3>Create Purchase Order</h3>
                    
                    <div className="po-form-grid">
                        <div className="po-form-group">
                            <label>Vendor Name</label>
                            <input 
                                className="po-form-input" 
                                placeholder="Enter vendor name"
                                value={vendorName} 
                                onChange={e => setVendorName(e.target.value)} 
                            />
                        </div>
                        <div className="po-form-group">
                            <label>Add Item</label>
                            <select className="po-form-select" onChange={e => addToCart(e.target.value)} value="">
                                <option value="">Select Product...</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {cart.length > 0 ? (
                        <table className="po-cart-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Quantity</th>
                                    <th>Cost Price</th>
                                    <th style={{ width: '80px', textAlign: 'center' }}>Remove</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cart.map((item, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                                        <td>
                                            <input 
                                                type="number" 
                                                min="1"
                                                className="po-cart-input" 
                                                value={item.quantity} 
                                                onChange={e => updateCartItem(i, 'quantity', Number(e.target.value))} 
                                            />
                                        </td>
                                        <td>
                                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>$</span>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    step="0.01"
                                                    className="po-cart-input" 
                                                    style={{ paddingLeft: '1.5rem' }}
                                                    value={item.cost_price} 
                                                    onChange={e => updateCartItem(i, 'cost_price', Number(e.target.value))} 
                                                />
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="po-btn-danger-icon" onClick={() => removeCartItem(i)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', marginBottom: '2rem', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                            <Package size={32} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                            <p style={{ margin: 0 }}>No items added yet. Select a product to begin.</p>
                        </div>
                    )}

                    <div className="po-form-actions">
                        <button className="po-btn po-btn-primary" onClick={createPO} disabled={cart.length === 0 || !vendorName}>
                            Create Purchase Order
                        </button>
                        <button className="po-btn po-btn-outline" onClick={() => setShowForm(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Main Orders Table */}
            <div className="po-table-card">
                {filteredOrders.length > 0 ? (
                    <table className="po-main-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Vendor</th>
                                <th>Status</th>
                                <th>Total Cost</th>
                                <th>Date</th>
                                <th style={{ textAlign: 'right' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map(po => (
                                <tr key={po.id}>
                                    <td className="po-id">#{po.id}</td>
                                    <td className="po-vendor">{po.vendor_name}</td>
                                    <td>
                                        <span className={`po-status po-status-${po.status.toLowerCase()}`}>
                                            {po.status}
                                        </span>
                                    </td>
                                    <td className="po-cost">${parseFloat(po.total_cost).toFixed(2)}</td>
                                    <td>{new Date(po.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        {po.status === 'PENDING' && (
                                            <button className="po-action-receive" onClick={() => receivePO(po.id)}>
                                                <CheckCircle size={14} /> Mark Received
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="po-empty-state">
                        <ClipboardList size={48} style={{ opacity: 0.3 }} />
                        <h3 style={{ margin: 0, color: '#334155' }}>No Purchase Orders Found</h3>
                        <p style={{ margin: 0, maxWidth: '300px' }}>
                            {searchTerm ? 'Try adjusting your search terms.' : 'Create your first purchase order to track inventory costs.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PurchaseOrders;
