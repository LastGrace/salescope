import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, CheckCircle, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

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
        } catch (err) {
            toast.error('Failed to create PO');
        }
    };

    const receivePO = async (id) => {
        try {
            await axios.post(`/api/purchase-orders/${id}/receive`);
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
                // Expected Import headers: 'Vendor', 'Barcode', 'Quantity', 'Cost'
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
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h1>Purchase Orders</h1>
                    <input
                        type="text"
                        className="input"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '250px', margin: 0 }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn" style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={handleExport}>
                        <Download size={16} /> Export Excel
                    </button>
                    <button className="btn" style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => document.getElementById('file-upload-po').click()}>
                        <Upload size={16} /> Import
                    </button>
                    <input
                        type="file"
                        id="file-upload-po"
                        accept=".csv, .xlsx"
                        style={{ display: 'none' }}
                        onChange={handleImport}
                    />
                    <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                        <Plus size={16} /> New Order
                    </button>
                </div>
            </div>



            {showForm && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3>Create Purchase Order</h3>
                    <div style={{ marginBottom: '1rem' }}>
                        <label>Vendor Name</label>
                        <input className="input" value={vendorName} onChange={e => setVendorName(e.target.value)} />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label>Add Item</label>
                        <select className="input" onChange={e => addToCart(e.target.value)} value="">
                            <option value="">Select Product...</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    <table className="table" style={{ marginBottom: '1rem' }}>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Quantity</th>
                                <th>Cost Price</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cart.map((item, i) => (
                                <tr key={i}>
                                    <td>{item.name}</td>
                                    <td><input type="number" style={{ width: '80px' }} value={item.quantity} onChange={e => updateCartItem(i, 'quantity', Number(e.target.value))} /></td>
                                    <td><input type="number" style={{ width: '80px' }} value={item.cost_price} onChange={e => updateCartItem(i, 'cost_price', Number(e.target.value))} /></td>
                                    <td><button className="btn" style={{ color: 'red' }} onClick={() => removeCartItem(i)}>X</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn btn-primary" onClick={createPO} disabled={cart.length === 0}>Create PO</button>
                        <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                </div>
            )}

            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Vendor</th>
                            <th>Status</th>
                            <th>Total Cost</th>
                            <th>Date</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.map(po => (
                            <tr key={po.id}>
                                <td>#{po.id}</td>
                                <td>{po.vendor_name}</td>
                                <td>
                                    <span style={{
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '0.25rem',
                                        backgroundColor: po.status === 'RECEIVED' ? '#dcfce7' : '#fef9c3',
                                        color: po.status === 'RECEIVED' ? '#166534' : '#854d0e',
                                        fontSize: '0.875rem'
                                    }}>
                                        {po.status}
                                    </span>
                                </td>
                                <td>${po.total_cost}</td>
                                <td>{new Date(po.created_at).toLocaleDateString()}</td>
                                <td>
                                    {po.status === 'PENDING' && (
                                        <button className="btn btn-primary" onClick={() => receivePO(po.id)}>
                                            Mark Received
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PurchaseOrders;
