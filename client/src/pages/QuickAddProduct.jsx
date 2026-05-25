import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Trash2, Printer, Save, AlertCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import Barcode from 'react-barcode';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

const QuickAddProduct = () => {
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [allSubcategories, setAllSubcategories] = useState([]);

    // Helper to create N empty rows
    const createEmptyRows = (count = 1) => Array(count).fill(null).map(() => createEmptyRow());

    const [rows, setRows] = useState(() => {
        const saved = localStorage.getItem('quick_add_rows');
        return saved ? JSON.parse(saved) : createEmptyRows(5);
    });

    useEffect(() => {
        localStorage.setItem('quick_add_rows', JSON.stringify(rows));
    }, [rows]);
    const [autoReset, setAutoReset] = useState(true);

    // Print State
    const [printQueue, setPrintQueue] = useState([]); // Array of rows to print
    const componentRef = useRef();

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Print Settings (Matched with BarcodeGenerator)
    const PAPER_WIDTH_MM = 83;
    const labelWidth = 38;
    const labelHeight = 25;
    const PIXELS_PER_MM = 3.78;
    const DESIGN_WIDTH_PX = 300;
    const DESIGN_HEIGHT_PX = 150;

    useEffect(() => {
        fetchCategories();
        fetchSubcategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await axios.get('/api/categories');
            setCategories(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSubcategories = async () => {
        try {
            const res = await axios.get('/api/subcategories');
            setAllSubcategories(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    function createEmptyRow() {
        return {
            id: Date.now() + Math.random(),
            barcode: '',
            name: '',
            category: '',
            subcategory_id: '',
            price: '',
            cost_price: '',
            stock_quantity: '',
            low_stock_threshold: '10',
            printQty: 1,
            isExisting: false, // Flag for existing products
            original: null // Store original data to detect changes
        };
    }

    const addRow = () => {
        setRows(prev => [...prev, createEmptyRow()]);
    };

    const resetTable = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Clear Table',
            message: 'Are you sure you want to clear all rows? This will reset the table to empty rows.',
            onConfirm: () => setRows(createEmptyRows(5))
        });
    };

    const removeRow = (id) => {
        if (rows.length === 1) {
            toast.error("Cannot remove the last row");
            return;
        }
        setRows(rows.filter(r => r.id !== id));
    };

    const updateRow = async (id, field, value) => {
        // Handle Barcode Check
        if (field === 'barcode') {
            const barcode = value.toUpperCase();

            // Optimistic update
            setRows(prev => prev.map(r => r.id === id ? { ...r, barcode, isExisting: false } : r));

            if (barcode.length > 2) {
                try {
                    const res = await axios.get(`/api/products/barcode/${barcode}`);
                    const product = res.data;
                    setRows(prev => prev.map(r => r.id === id ? {
                        ...r,
                        barcode: product.barcode, // Ensure match
                        name: product.name,
                        category: product.category,
                        subcategory_id: product.subcategory_id,
                        price: product.price,
                        cost_price: product.cost_price,
                        // DO NOT auto-fill stock_quantity (user enters how much to ADD)
                        stock_quantity: '',
                        low_stock_threshold: product.low_stock_threshold,
                        isExisting: true,
                        original: product // Save original state
                    } : r));
                } catch (err) {
                    // Not found, treat as new
                    setRows(prev => prev.map(r => r.id === id ? { ...r, isExisting: false, original: null } : r));
                }
            }
        } else {
            setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
        }
    };

    const handleUpdateDetails = async (row) => {
        try {
            await axios.put(`/api/products/barcode/${row.barcode}/details`, {
                name: row.name,
                category: row.category,
                subcategory_id: row.subcategory_id,
                price: row.price,
                cost_price: row.cost_price,
                low_stock_threshold: row.low_stock_threshold

            });
            toast.success(`Updated details for ${row.name}`);
            // Update original to match current state (hides button)
            setRows(prev => prev.map(r => r.id === row.id ? { ...r, original: { ...r, original: undefined } } : r));
        } catch (err) {
            toast.error('Failed to update details: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleAddStock = async (row) => {
        if (!row.stock_quantity || parseInt(row.stock_quantity) <= 0) {
            toast.error("Please enter a valid quantity to add.");
            return;
        }

        try {
            await axios.put(`/api/products/barcode/${row.barcode}/add-stock`, { quantity: row.stock_quantity });
            toast.success(`Added ${row.stock_quantity} to stock for ${row.name}`);
            // Clear row or Reset? Maybe just clear stock field to prevent double submission
            setRows(prev => prev.map(r => r.id === row.id ? { ...r, stock_quantity: '' } : r));
        } catch (err) {
            toast.error('Failed to add stock: ' + (err.response?.data?.message || err.message));
        }
    };

    // --- PRINTING LOGIC ---
    const handlePrintRequest = (row) => {
        if (!row.barcode || !row.name || !row.price) {
            toast.error("Please fill Barcode, Name, and Price to print.");
            return;
        }
        setPrintQueue([row]);
        setTimeout(() => triggerPrint(), 100);
    };

    const handlePrintAll = () => {
        const validRows = rows.filter(r => r.barcode && r.name && r.price);
        if (validRows.length === 0) {
            toast.error("No valid rows to print.");
            return;
        }
        setPrintQueue(validRows);
        setTimeout(() => triggerPrint(), 100);
    };

    const triggerPrint = useReactToPrint({
        contentRef: componentRef,
        pageStyle: `
            @page {
                size: ${PAPER_WIDTH_MM}mm auto;
                margin: 0mm;
            }
            @media print {
                body {
                    -webkit-print-color-adjust: exact;
                }
                .print-row {
                    page-break-inside: avoid;
                }
            }
        `,
        onAfterPrint: () => setPrintQueue([])
    });

    const LabelContent = ({ item }) => (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5%',
            background: 'white',
            color: 'black',
            fontFamily: 'Arial, sans-serif',
            boxSizing: 'border-box'
        }}>
            <div style={{ fontWeight: '900', fontSize: '187%', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                TRENDY FLEA
            </div>
            <div style={{ fontSize: '145%', fontWeight: '700', textAlign: 'center', marginBottom: '4px', lineHeight: 1, letterSpacing: '2px', marginTop: '2px', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.name.toUpperCase()}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', overflow: 'hidden', height: '22%' }}>
                <div style={{ width: '100%', height: '22px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px' }}>
                    <Barcode
                        value={item.barcode || '0000'}
                        width={2.5}
                        height={50}
                        fontSize={0}
                        margin={0}
                        displayValue={false}
                        background="transparent"
                    />
                </div>
            </div>
            <div style={{ fontWeight: 'bold', marginTop: '3px', fontSize: '110%', letterSpacing: '2px', lineHeight: 1, whiteSpace: 'nowrap', marginBottom: '-6px' }}>
                {item.barcode || '0000'}
            </div>
            <div style={{ fontWeight: '900', fontSize: '155%', letterSpacing: '0.05em', marginTop: '5px', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                MRP ₹ : {Number(item.price).toFixed(2)}
            </div>
        </div>
    );

    // Prepare print content
    const renderPrintContent = () => {
        if (printQueue.length === 0) return null;

        // Flatten queue based on printQty
        const allItems = printQueue.flatMap(row => Array(parseInt(row.printQty) || 1).fill(row));

        const chunkedRows = [];
        for (let i = 0; i < allItems.length; i += 2) {
            chunkedRows.push(allItems.slice(i, i + 2));
        }

        return (
            <div style={{ width: `${PAPER_WIDTH_MM}mm` }}>
                {chunkedRows.map((rowItems, idx) => (
                    <div key={idx} className="print-row" style={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        width: '100%',
                        height: `${labelHeight}mm`
                    }}>
                        {rowItems.map((item, colIdx) => (
                            <div key={colIdx} style={{
                                width: `${labelWidth}mm`,
                                height: `${labelHeight}mm`,
                                position: 'relative',
                                background: 'white',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${DESIGN_WIDTH_PX}px`,
                                    height: `${DESIGN_HEIGHT_PX}px`,
                                    transform: `scale(${(labelWidth * PIXELS_PER_MM) / DESIGN_WIDTH_PX}, ${(labelHeight * PIXELS_PER_MM) / DESIGN_HEIGHT_PX})`,
                                    transformOrigin: 'top left',
                                }}>
                                    <LabelContent item={item} />
                                </div>
                            </div>
                        ))}
                        {rowItems.length === 1 && <div style={{ width: `${labelWidth}mm` }} />}
                    </div>
                ))}
            </div>
        );
    };

    // --- SAVE LOGIC ---
    const handleSaveAll = async () => {
        // Validate
        const validRows = rows.filter(r => r.barcode && r.name && r.price);
        if (validRows.length === 0) {
            toast.error("No valid rows to save. Please enter Barcode, Name, and Price.");
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'Save to Inventory',
            message: `Are you sure you want to save ${validRows.length} products to inventory? This will process both new items and stock updates.`,
            onConfirm: async () => {
                try {
                    // Ensure numeric fields are numbers
                    const payload = validRows.map(r => ({
                        ...r,
                        price: parseFloat(r.price),
                        cost_price: parseFloat(r.cost_price) || 0,
                        subcategory_id: r.subcategory_id || null,
                        stock_quantity: parseInt(r.stock_quantity) || 0,
                        low_stock_threshold: parseInt(r.low_stock_threshold) || 10
                    }));

                    await axios.post('/api/products/batch', payload);
                    toast.success('Products added successfully!');

                    if (autoReset) {
                        setRows(createEmptyRows(5));
                    }
                } catch (err) {
                    toast.error('Failed to save products: ' + (err.response?.data?.message || err.message));
                }
            }
        });
    };

    return (
        <div className="animate-fade-in" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1>Quick Add Products</h1>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {/* Controls Group */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--bg-card)', padding: '0.3rem 0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                            <input
                                type="checkbox"
                                checked={autoReset}
                                onChange={e => setAutoReset(e.target.checked)}
                            />
                            Auto
                        </label>
                        <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 0.3rem' }}></div>
                        <button className="btn-icon" onClick={resetTable} title="Reset Table Manually" style={{ color: 'var(--text-muted)', padding: '2px' }}>
                            <Trash2 size={14} />
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn" onClick={addRow} style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Plus size={16} /> Add Row
                        </button>
                        <button className="btn" onClick={handlePrintAll} style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Printer size={16} /> Print All Barcodes
                        </button>
                        <button className="btn btn-primary" onClick={handleSaveAll} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Save size={16} /> Add All to Inventory
                        </button>
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: '1rem' }}>
                <table className="table" style={{ width: '100%' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '150px' }}>Barcode</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Subcategory</th>
                            <th style={{ width: '100px' }}>Price</th>
                            <th style={{ width: '100px' }}>Cost</th>
                            <th style={{ width: '80px' }}>Quantity</th>
                            <th style={{ width: '80px' }}>Low Stock</th>
                            <th style={{ width: '100px' }}>Print Qty</th>
                            <th style={{ width: '100px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <tr key={row.id}>
                                <td>
                                    <input
                                        className="input"
                                        value={row.barcode}
                                        placeholder="Scan/Type"
                                        onChange={e => updateRow(row.id, 'barcode', e.target.value)}
                                        style={{ margin: 0, borderColor: row.isExisting ? 'var(--primary)' : 'var(--border)' }}
                                    />
                                    {row.isExisting && <span style={{ fontSize: '0.7rem', color: 'var(--primary)', display: 'block' }}>Existing</span>}
                                </td>
                                <td>
                                    <input
                                        className="input"
                                        value={row.name}
                                        placeholder="Product Name"
                                        onChange={e => updateRow(row.id, 'name', e.target.value)}
                                        style={{ margin: 0 }}
                                    />
                                </td>
                                <td>
                                    <select
                                        className="input"
                                        value={row.category}
                                        onChange={e => updateRow(row.id, 'category', e.target.value)}
                                        style={{ margin: 0 }}
                                    >
                                        <option value="">Select...</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <select
                                        className="input"
                                        value={row.subcategory_id || ''}
                                        onChange={e => updateRow(row.id, 'subcategory_id', e.target.value)}
                                        style={{ margin: 0 }}
                                        disabled={!row.category}
                                    >
                                        <option value="">Select...</option>
                                        {allSubcategories
                                            .filter(s => s.category_name === row.category)
                                            .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                        }
                                    </select>
                                </td>
                                <td>
                                    <input
                                        className="input"
                                        type="number"
                                        value={row.price}
                                        placeholder="0.00"
                                        onChange={e => updateRow(row.id, 'price', e.target.value)}
                                        style={{ margin: 0 }}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="input"
                                        type="number"
                                        value={row.cost_price}
                                        placeholder="0.00"
                                        onChange={e => updateRow(row.id, 'cost_price', e.target.value)}
                                        style={{ margin: 0 }}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="input"
                                        type="number"
                                        value={row.stock_quantity}
                                        placeholder={row.isExisting ? "Qty to Add" : "Quantity"}
                                        onChange={e => updateRow(row.id, 'stock_quantity', e.target.value)}
                                        style={{ margin: 0, fontWeight: row.isExisting ? 'bold' : 'normal' }}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="input"
                                        type="number"
                                        value={row.low_stock_threshold}
                                        placeholder="10"
                                        onChange={e => updateRow(row.id, 'low_stock_threshold', e.target.value)}
                                        style={{ margin: 0 }}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="input"
                                        type="number"
                                        min="1"
                                        value={row.printQty}
                                        onChange={e => updateRow(row.id, 'printQty', e.target.value)}
                                        style={{ margin: 0 }}
                                    />
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        {row.isExisting ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                {/* Check if details changed */}
                                                {row.original && (
                                                    row.name !== row.original.name ||
                                                    row.category !== row.original.category ||
                                                    row.subcategory_id !== row.original.subcategory_id ||
                                                    row.price != row.original.price || // loose equality for string/number diffs
                                                    row.cost_price != row.original.cost_price
                                                ) && (
                                                        <button
                                                            className="btn"
                                                            onClick={() => handleUpdateDetails(row)}
                                                            style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', padding: '0.2rem 0.6rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                                                            title="Update Name, Price, etc."
                                                        >
                                                            Update Info
                                                        </button>
                                                    )}

                                                <button
                                                    className="btn"
                                                    onClick={() => handleAddStock(row)}
                                                    style={{ background: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '0.2rem 0.6rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                                                    title="Add to Existing Stock"
                                                >
                                                    + Add Qty
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handlePrintRequest(row)}
                                                    disabled={!row.barcode || !row.name}
                                                    title="Print Labels for this row"
                                                    style={{ color: 'var(--primary)' }}
                                                >
                                                    <Printer size={18} />
                                                </button>
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => removeRow(row.id)}
                                                    style={{ color: '#ef4444' }}
                                                    title="Remove Row"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {rows.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No rows added. Click "Add Row" to start.
                    </div>
                )}
            </div>

            {/* <div style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>Tip: Print labels row-by-row before saving. Saving will clear the table locally.</span>
            </div> */}

            {/* Hidden Print Area */}
            <div style={{ position: 'fixed', top: '100vh', left: 0, opacity: 0, pointerEvents: 'none' }}>
                <div ref={componentRef}>
                    {renderPrintContent()}
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.title.toLowerCase().includes('delete') || confirmModal.title.toLowerCase().includes('clear') ? 'danger' : 'info'}
            />
        </div>
    );
};

export default QuickAddProduct;
