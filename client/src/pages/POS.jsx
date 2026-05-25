import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Trash, User, CreditCard, Banknote, Smartphone, Printer, CheckCircle, Edit, Eye, Plus, ShoppingCart, RotateCcw, Share2, PauseCircle, LayoutList, Play, X, Gift, PlusCircle } from 'lucide-react';

import { clsx } from 'clsx';
import '../styles/POS.css';
import ViewBillModal from '../components/ViewBillModal';

import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

const POS = () => {
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');

    // Loyalty State
    const [loyaltySettings, setLoyaltySettings] = useState(null);
    const [loyaltyInput, setLoyaltyInput] = useState('');
    const [pointsToRedeem, setPointsToRedeem] = useState('');

    // Coupon State (Now from Context)
    const [couponCode, setCouponCode] = useState('');
    // appliedCoupon moved to Context

    // Credit Note State
    const [creditNoteCode, setCreditNoteCode] = useState('');
    const [appliedCreditNote, setAppliedCreditNote] = useState(null);
    const [customerCreditNotes, setCustomerCreditNotes] = useState([]);
    const [customerCreditBills, setCustomerCreditBills] = useState([]);
    const [storeSettings, setStoreSettings] = useState(null);

    useEffect(() => {
        axios.get('/api/loyalty/settings').then(res => setLoyaltySettings(res.data)).catch(err => console.error('Loyalty fetch error:', err));
        axios.get('/api/settings/store').then(res => setStoreSettings(res.data)).catch(err => console.error('Store settings fetch error:', err));
    }, []);



    // Cart Context
    const {
        cart, addToCart: addToCartContext, removeFromCart, updateQuantity, updateDiscount, clearCart, cartTotal, setCart,
        customer: selectedCustomer, setCustomer: setSelectedCustomer,
        globalDiscount, setGlobalDiscount,
        appliedCoupon, setAppliedCoupon,
        paymentMethod, setPaymentMethod
    } = useCart();

    // Split Payment — local state with localStorage persistence (NOT from context)
    const [isSplitPayment, setIsSplitPayment] = useState(() => {
        try { return JSON.parse(localStorage.getItem('pos_isSplitPayment')) || false; } catch { return false; }
    });
    const [splitAmounts, setSplitAmounts] = useState(() => {
        try { return JSON.parse(localStorage.getItem('pos_splitAmounts')) || { cash: '', card: '', upi: '', pay_later: '' }; } catch { return { cash: '', card: '', upi: '', pay_later: '' }; }
    });
    useEffect(() => {
        localStorage.setItem('pos_isSplitPayment', JSON.stringify(isSplitPayment));
        localStorage.setItem('pos_splitAmounts', JSON.stringify(splitAmounts));
    }, [isSplitPayment, splitAmounts]);
    // Global Discount Local UI State
    const [globalDiscountType, setLocalGlobalDiscountType] = useState(globalDiscount.type || 'rs');
    const [globalDiscountValue, setLocalGlobalDiscountValue] = useState(globalDiscount.value || '');

    useEffect(() => {
        setLocalGlobalDiscountType(globalDiscount.type);
        setLocalGlobalDiscountValue(globalDiscount.value > 0 ? globalDiscount.value : '');
    }, [globalDiscount]);

    const updateGlobalDiscountValue = (val) => {
        setLocalGlobalDiscountValue(val);
        setGlobalDiscount({ type: globalDiscountType, value: parseFloat(val) || 0 });
    };

    const updateGlobalDiscountType = (type) => {
        setLocalGlobalDiscountType(type);
        setGlobalDiscount({ type: type, value: parseFloat(globalDiscountValue) || 0 });
    };

    // --- Memoized Calculations ---
    const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

    const itemDiscountsSum = useMemo(() => cart.reduce((acc, item) => {
        const itemTotal = item.price * item.quantity;
        const discountAmt = item.discountType === '%'
            ? (itemTotal * (parseFloat(item.discountValue) || 0) / 100)
            : (parseFloat(item.discountValue) || 0);
        return acc + discountAmt;
    }, 0), [cart]);

    const afterItemDiscounts = useMemo(() => subtotal - itemDiscountsSum, [subtotal, itemDiscountsSum]);

    const globalDiscountAmount = useMemo(() => globalDiscount.type === '%'
        ? (afterItemDiscounts * (globalDiscount.value || 0) / 100)
        : (globalDiscount.value || 0), [globalDiscount, afterItemDiscounts]);

    const couponDiscountAmount = useMemo(() => appliedCoupon ? appliedCoupon.discount : 0, [appliedCoupon]);

    const loyaltyDiscountAmount = useMemo(() => loyaltySettings && pointsToRedeem
        ? ((parseFloat(pointsToRedeem) || 0) * (loyaltySettings.redeem_rate_amount / loyaltySettings.redeem_rate_points))
        : 0, [loyaltySettings, pointsToRedeem]);

    const creditNoteDeduction = useMemo(() => appliedCreditNote ? Math.min(appliedCreditNote.balance, afterItemDiscounts - globalDiscountAmount - loyaltyDiscountAmount - couponDiscountAmount) : 0, [appliedCreditNote, afterItemDiscounts, globalDiscountAmount, loyaltyDiscountAmount, couponDiscountAmount]);

    const finalTotal = useMemo(() => Math.max(0, afterItemDiscounts - globalDiscountAmount - couponDiscountAmount - loyaltyDiscountAmount - creditNoteDeduction), [afterItemDiscounts, globalDiscountAmount, couponDiscountAmount, loyaltyDiscountAmount, creditNoteDeduction]);

    // Payment State (Now from Context)



    // --- Handlers ---

    const applyCoupon = async () => {
        if (!couponCode) return;
        try {
            const res = await axios.post('/api/coupons/validate', {
                code: couponCode,
                cartTotal: afterItemDiscounts - globalDiscountAmount, // Validate against current total
                cartItems: cart
            });
            if (res.data.valid) {
                setAppliedCoupon(res.data);
                setCouponCode('');
                toast.success('Coupon applied');
            } else {
                toast.error(res.data.message);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Invalid coupon');
        }
    };

    const removeCoupon = () => setAppliedCoupon(null);

    const applyCreditNote = async (codeOverride = null) => {
        const code = codeOverride || creditNoteCode;
        if (!code) return;
        try {
            const res = await axios.get(`/api/credit-notes/${code}`);
            const cn = res.data;
            if (cn.balance <= 0) {
                toast.error('Credit note has no balance');
                return;
            }
            if (new Date(cn.expiry_date) < new Date()) {
                toast.error('Credit note expired');
                return;
            }
            if (cn.customer_id && selectedCustomer && cn.customer_id !== selectedCustomer.id) {
                toast.error('Credit note belongs to another customer');
                return;
            }
            setAppliedCreditNote(cn);
            setCreditNoteCode('');
            toast.success('Credit note applied');
        } catch (err) {
            toast.error('Invalid credit note');
        }
    };

    const removeCreditNote = () => setAppliedCreditNote(null);

    // Checkout
    const handleCheckout = async (shouldPrint = false) => {
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        // Validate Split Payment
        let payments = [];
        if (isSplitPayment) {
            // Read split amounts directly from DOM as failsafe against stale React state
            const domSplit = {};
            ['cash', 'card', 'upi', 'pay_later'].forEach(m => {
                const el = document.querySelector(`[data-split-method="${m}"]`);
                domSplit[m] = el ? el.value : '';
            });
            console.log('[Split Debug] React state:', JSON.stringify(splitAmounts));
            console.log('[Split Debug] DOM values:', JSON.stringify(domSplit));
            // Use DOM values (most reliable) with React state as fallback
            const sa = {
                cash: domSplit.cash || splitAmounts.cash || '',
                card: domSplit.card || splitAmounts.card || '',
                upi: domSplit.upi || splitAmounts.upi || '',
                pay_later: domSplit.pay_later || splitAmounts.pay_later || ''
            };
            const totalSplit = (parseFloat(sa.cash) || 0) +
                (parseFloat(sa.card) || 0) +
                (parseFloat(sa.upi) || 0) +
                (parseFloat(sa.pay_later) || 0);

            if (Math.abs(totalSplit - finalTotal) > 1) { // 1 rupee tolerance
                toast.error(`Payment mismatch. Total: ${finalTotal.toFixed(2)}, Split: ${totalSplit.toFixed(2)}`);
                return;
            }

            if (parseFloat(sa.cash) > 0) payments.push({ method: 'cash', amount: parseFloat(sa.cash) });
            if (parseFloat(sa.card) > 0) payments.push({ method: 'card', amount: parseFloat(sa.card) });
            if (parseFloat(sa.upi) > 0) payments.push({ method: 'upi', amount: parseFloat(sa.upi) });
            if (parseFloat(sa.pay_later) > 0) payments.push({ method: 'pay_later', amount: parseFloat(sa.pay_later) });
        } else {
            payments.push({ method: paymentMethod, amount: finalTotal });
        }

        // Credit Note is handled by the backend via credit_note_code in the payload.
        // Do NOT push it into payments[] to avoid duplicate insertion in sale_payments.

        // Payload
        const payload = {
            customer_id: selectedCustomer?.id || null,
            items: cart.map(item => ({
                product_id: item.id.toString().startsWith('manual_') ? null : item.id,
                name: item.name,
                quantity: item.quantity,
                price: Number(item.price || item.unit_price || 0),
                discount: item.discountType === '%' ? (Number(item.price || item.unit_price || 0) * item.quantity * (Number(item.discountValue) || 0) / 100) : (Number(item.discountValue) || 0),
                is_manual: item.isManual || false,
                cost_price: item.cost_price || 0,
                barcode: item.barcode || ''
            })),
            subtotal: afterItemDiscounts, // Net of item discounts
            discount_total: globalDiscountAmount,
            coupon_code: appliedCoupon?.code || null,
            coupon_amount: couponDiscountAmount || 0,
            loyalty_amount: loyaltyDiscountAmount || 0,
            points_redeemed: parseFloat(pointsToRedeem) || 0,
            credit_note_code: appliedCreditNote?.code || null,
            payments: payments,
            status: 'completed'
        };

        try {
            let res;
            if (editingSaleId) {
                res = await axios.put(`/api/sales/${editingSaleId}`, payload);
                toast.success('Sale updated');
            } else {
                res = await axios.post('/api/sales', payload);
                toast.success('Sale completed');
            }

            // Reset logic moved before opening modal to ensure clean state behind it
            clearCart();
            setIsSplitPayment(false);
            setSplitAmounts({ cash: '', card: '', upi: '', pay_later: '' });
            setAppliedCreditNote(null);
            setPointsToRedeem('');
            setEditingSaleId(null);
            fetchNextBillId();

            // If "Save & Print" (now just View Bill), open the modal
            if (shouldPrint) {
                // Fetch full bill details to display in modal
                const fullSaleRes = await axios.get(`/api/sales/${res.data.sale_id}`);
                setViewingBill(fullSaleRes.data);
            }

            // Refresh products/customers if needed?
        } catch (err) {
            console.error('Checkout Error:', err);
            const msg = err.response?.data?.message || err.message || 'Checkout failed';
            toast.error(msg);
        }
    };



    const location = useLocation();
    const navigate = useNavigate();
    const [editingSaleId, setEditingSaleId] = useState(null);

    // Wrapper for addToCart to handle local logic (search clearing)
    const addToCart = (product) => {
        addToCartContext(product);
        setSearch('');
    };

    // Handle incoming cart from Edit Bill
    useEffect(() => {
        if (location.state?.cartItems) {
            // Sanitize incoming data to prevent NaN
            const sanitizedCart = location.state.cartItems.map(item => ({
                ...item,
                price: Number(item.price) || 0,
                quantity: Number(item.quantity) || Number(item.count) || 1, // Handle both 'quantity' and 'count'
                discountValue: Number(item.discountValue) || 0,
                discountType: item.discountType || 'rs', // Ensure type is present
                id: item.id || Date.now() // Fallback ID
            }));

            setCart(sanitizedCart);

            // Handle Customer
            if (location.state.customerId) {
                // Fetch customer details if id provided
                axios.get('/api/customers').then(res => {
                    const c = res.data.find(cust => cust.id === location.state.customerId);
                    if (c) {
                        setSelectedCustomer(c);
                        fetchCustomerHistory(c.id);
                        fetchCustomerCreditNotes(c.id);
                        fetchCustomerCreditBills(c.id);
                    }
                });
            } else {
                setSelectedCustomer(null);
            }

            // Handle Editing Mode
            if (location.state.editingSale) {
                setEditingSaleId(location.state.editingSale.id);
                // Map discount: API has discount_total. POS has globalDiscount (type, value).
                // We don't know the original type (Fixed/Percent) unless we stored it.
                // For now, assume Fixed amount to match the total.
                // If discount_total > 0
                if (location.state.editingSale.discount_total > 0) {
                    setGlobalDiscount({ type: 'fixed', value: parseFloat(location.state.editingSale.discount_total) });
                } else {
                    setGlobalDiscount({ type: 'fixed', value: 0 });
                }

                // Set Payment Method (Critical for Edit)
                if (location.state.editingSale.paymentMethod) {
                    // Start simple: if split, we might need more logic, but user specific case is likely pay_later defaults
                    setPaymentMethod(location.state.editingSale.paymentMethod);
                    // TODO: If split, we'd need to parse payments array which isn't passed fully yet. 
                    // But for Credit Bills which are usually Pay Later, this fixes the "Default to Cash" bug.
                }
            } else {
                setEditingSaleId(null);
            }

            // Clear state so it doesn't re-apply on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Customer State
    const [customers, setCustomers] = useState([]);
    // selectedCustomer is now from Context
    const [customerHistory, setCustomerHistory] = useState([]);

    // Edit Customer State in POS
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [showEditCustomer, setShowEditCustomer] = useState(false);
    const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '' });

    // History Bill View State
    const [viewingBill, setViewingBill] = useState(null);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'danger' });
    // Search state
    const [customerQuery, setCustomerQuery] = useState('');
    const [showCustomerResults, setShowCustomerResults] = useState(false);



    // Held Bills State
    const [heldBills, setHeldBills] = useState(() => {
        try {
            const saved = localStorage.getItem('heldBills');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);

    // Customer Expansion State
    const [isCustomerExpanded, setIsCustomerExpanded] = useState(false);


    const holdBill = () => {
        if (cart.length === 0) return toast.error('Cart is empty');

        const bill = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            cart,
            customer: selectedCustomer,
            total: finalTotal
        };

        const updated = [...heldBills, bill];
        setHeldBills(updated);
        localStorage.setItem('heldBills', JSON.stringify(updated));

        // Clear active
        clearCart();
        setCustomerHistory([]);
        setCustomerCreditNotes([]);
        setCustomerCreditBills([]);
        setSearch('');
        setCouponCode('');
        setAppliedCoupon(null);
        toast.success('Bill put on Hold');
    };

    const resumeBill = (bill) => {
        if (cart.length > 0) {
            setConfirmModal({
                isOpen: true,
                title: 'Clear Current Cart?',
                message: 'You have items in your current cart. Resuming this bill will clear the current cart. Continue?',
                type: 'danger',
                onConfirm: () => {
                    executeResumeBill(bill);
                }
            });
            return;
        }

        executeResumeBill(bill);
    };

    const executeResumeBill = (bill) => {
        // Restore State
        setCart(bill.cart);
        setSelectedCustomer(bill.customer);
        if (bill.customer) {
            fetchCustomerHistory(bill.customer.id);
            fetchCustomerCreditNotes(bill.customer.id);
            fetchCustomerCreditBills(bill.customer.id);
        }

        // Remove from held
        deleteHeldBill(bill.id, true);
        setShowHeldBillsModal(false);
    };

    const executeNewOrder = () => {
        clearCart(); // Context handles cart, customer, coupon, payments

        // Reset local split payment state
        setIsSplitPayment(false);
        setSplitAmounts({ cash: '', card: '', upi: '', pay_later: '' });

        // Reset local UI states
        setCustomerHistory([]);
        setCustomerCreditNotes([]);
        setCustomerCreditBills([]);
        setSearch('');
        setCustomerQuery('');
        setEditingSaleId(null);
        setPointsToRedeem('');
        setCouponCode('');
        // remove local appliedCoupon/payment set calls as clearCart does it
        fetchNextBillId();
    };

    const deleteHeldBill = (id, silent = false) => {
        if (silent) {
            const updated = heldBills.filter(b => b.id !== id);
            setHeldBills(updated);
            localStorage.setItem('heldBills', JSON.stringify(updated));
            return;
        }

        setConfirmModal({
            isOpen: true,
            title: 'Delete Held Bill',
            message: 'Are you sure you want to delete this held bill? This action cannot be undone.',
            type: 'danger',
            onConfirm: () => {
                const updated = heldBills.filter(b => b.id !== id);
                setHeldBills(updated);
                localStorage.setItem('heldBills', JSON.stringify(updated));
                toast.success('Held bill deleted');
            }
        });
    };

    // Direct Item (Manual Entry)
    const addDirectItem = () => {
        const id = 'manual_' + Date.now();
        const newItem = {
            id,
            name: '',
            barcode: '',
            price: 0,
            quantity: 1,
            discountType: 'rs',
            discountValue: 0,
            isManual: true
        };
        // Use setCart from context directly to add
        setCart(prev => [...prev, newItem]);
    };

    const updateManualItem = (id, field, value) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    const barcodeInputRef = useRef(null);
    const endOfCartRef = useRef(null);

    // Auto-scroll to bottom of cart when new item is added
    useEffect(() => {
        if (endOfCartRef.current) {
            endOfCartRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [cart.length]);

    useEffect(() => {
        fetchProducts();
        fetchCustomers();
        if (barcodeInputRef.current) barcodeInputRef.current.focus();

        // Focus Restoration Logic: Ensure focus returns to barcode if lost to body
        const handleWindowFocus = () => {
            if (barcodeInputRef.current && document.activeElement === document.body) {
                barcodeInputRef.current.focus();
            }
        };
        window.addEventListener('focus', handleWindowFocus);
        return () => window.removeEventListener('focus', handleWindowFocus);
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await axios.get('/api/products');
            setProducts(Array.isArray(res.data) ? res.data : res.data.products || []);
        } catch (err) { console.error(err); }
    };

    const fetchCustomers = async () => {
        try {
            const res = await axios.get('/api/customers');
            setCustomers(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchCustomerHistory = async (customerId) => {
        try {
            // Placeholder: currently fetches just sales, ideally filtered by customer
            const res = await axios.get(`/api/customers/${customerId}/history`);
            // This endpoint doesn't exist yet in the backend provided in context, so likely returns 404
            // We'll treat it gracefully or implement it if needed. 
            // For now assume the backend MIGHT give 404 or empty list.
            setCustomerHistory(res.data || []);
        } catch (e) { setCustomerHistory([]); }
    };

    const fetchCustomerCreditNotes = async (customerId) => {
        try {
            const res = await axios.get(`/api/credit-notes/customer/${customerId}`);
            setCustomerCreditNotes(res.data || []);
        } catch (e) {
            console.error("Failed to fetch credit notes", e);
            setCustomerCreditNotes([]);
        }
    };

    const fetchCustomerCreditBills = async (customerId) => {
        try {
            console.log(`Fetching credit bills for customer: ${customerId}`);
            const res = await axios.get(`/api/customers/${customerId}/credit-bills`);
            console.log('Credit bills response:', res.data);
            setCustomerCreditBills(res.data || []);
        } catch (e) {
            console.error("Failed to fetch credit bills", e);
            setCustomerCreditBills([]);
        }
    };

    // Bill Number State
    const [nextBillId, setNextBillId] = useState('...');

    useEffect(() => {
        fetchNextBillId();
    }, []);

    const fetchNextBillId = async () => {
        try {
            const res = await axios.get('/api/sales/meta/next-id');
            setNextBillId(res.data.nextId);
        } catch (e) { console.error(e); }
    };

    const handleLoyaltyLookup = async () => {
        if (!loyaltyInput.trim()) return;
        try {
            const res = await axios.get(`/api/loyalty/cards/${loyaltyInput}`);
            const customer = res.data;
            // Customer object returned is from 'customers' table joined with card.
            // But we want the standard customer object.
            // The API returns c.*, lc.status.

            if (customer.status && customer.status !== 'active') {
                toast.error('This loyalty card is ' + customer.status);
                return;
            }

            selectCustomer(customer);
            setLoyaltyInput('');
        } catch (err) {
            toast.error('Card not found');
        }
    };

    const handleCustomerSearch = (query) => {
        setCustomerQuery(query);
        setShowCustomerResults(query.length > 0);
    };

    const selectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setCustomerQuery('');
        setShowCustomerResults(false);
        fetchCustomerHistory(customer.id);
        fetchCustomerCreditNotes(customer.id);
        fetchCustomerCreditBills(customer.id);
    };

    // Filter customers based on Name or Phone
    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(customerQuery.toLowerCase()) ||
        (c.phone && c.phone.includes(customerQuery))
    );



    const handleBarcode = (e) => {
        if (e.key === 'Enter') {
            const barcode = e.target.value.toUpperCase();
            const product = products.find(p => p.barcode === barcode);
            if (product) {
                addToCart(product);
            } else {
                const results = products.filter(p => p.name.toLowerCase().includes(barcode.toLowerCase()));
                if (results.length === 1) addToCart(results[0]);
                else if (results.length > 1) toast('Multiple products match, key select from list (not implemented yet, just type exact barcode)');
                else toast.error('Product not found');
            }
        }
    };



    // Item Calculations
    const calculateItemTotal = (item) => {
        let discount = 0;
        const val = parseFloat(item.discountValue) || 0;
        if (item.discountType === 'rs') {
            discount = val;
        } else {
            discount = (item.price * item.quantity) * (val / 100);
        }
        return (item.price * item.quantity) - discount;
    };

    const updateItemDiscount = (id, type, value) => {
        updateDiscount(id, { discountType: type, discountValue: value });
    };

    // Totals

    const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const distinctItemCount = cart.length;

    // Calculate Item Discounts Sum



    const handleViewHistoryBill = async (saleId) => {
        try {
            const res = await axios.get(`/api/sales/${saleId}`);
            setViewingBill(res.data);
        } catch (err) {
            toast.error('Could not load bill details');
        }
    };

    const startAddCustomer = (prefillPhone = '') => {
        setCustomerForm({ name: '', phone: prefillPhone || '' }); // Removed email
        setEditingCustomer(null);
        setShowEditCustomer(true);
    };

    const startEditCustomer = () => {
        if (!selectedCustomer) return;
        setCustomerForm({
            name: selectedCustomer.name,
            phone: selectedCustomer.phone || ''
        }); // Removed email
        setEditingCustomer(selectedCustomer);
        setShowEditCustomer(true);
    };

    const saveCustomer = async (e) => {
        e.preventDefault();

        // Phone Validation
        const cleanPhone = customerForm.phone.replace(/\D/g, '');
        let formattedPhone = customerForm.phone;

        if (cleanPhone.length === 10) {
            formattedPhone = '+91' + cleanPhone;
        } else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
            formattedPhone = '+' + cleanPhone;
        } else {
            return toast.error('Wrong number: Please enter a valid 10-digit phone number.');
        }

        try {
            const payload = { ...customerForm, phone: formattedPhone };

            if (editingCustomer) {
                // Update existing
                await axios.put(`/api/customers/${editingCustomer.id}`, payload);
                const updated = { ...selectedCustomer, ...payload };
                setSelectedCustomer(updated);
                setCustomers(customers.map(c => c.id === updated.id ? { ...c, ...updated } : c));
                toast.success('Customer updated');
            } else {
                // Create new
                const res = await axios.post('/api/customers', payload);
                const newCustomer = { ...payload, id: res.data.id, loyalty_points: 0 };
                setCustomers([...customers, newCustomer]);
                selectCustomer(newCustomer);
                toast.success('Customer created');
            }
            setShowEditCustomer(false);
            setEditingCustomer(null);
        } catch (err) {
            toast.error('Operation failed: ' + (err.response?.data?.message || err.message));
        }
    };



    return (
        <div className="pos-wrapper animate-fade-in">
            {/* LEFT SECTION */}
            <div className="pos-card pos-left">
                {/* Search Bar & Bill Info */}
                <div className="pos-top-bar">
                    <div className="pos-search-container">
                        <Search className="pos-search-icon" />
                        <input
                            ref={barcodeInputRef}
                            className="pos-search-input"
                            placeholder="Search product or scan..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={handleBarcode}
                        />
                    </div>



                    <button
                        className="pos-btn-icon-text"
                        onClick={() => setShowHeldBillsModal(true)}
                        title="Held Bills"
                    >
                        <LayoutList size={16} />
                        <span>Unhold</span>
                        {heldBills.length > 0 && (
                            <span className="held-count-badge">
                                {heldBills.length}
                            </span>
                        )}
                    </button>
                    <button
                        className="pos-btn-icon-text"
                        onClick={holdBill}
                        title="Hold Bill"
                    >
                        <PauseCircle size={16} /> Hold
                    </button>
                    <button
                        className="pos-btn-icon-text"
                        onClick={addDirectItem}
                        title="Add Manual Item"
                    >
                        <PlusCircle size={16} /> Direct
                    </button>
                    <button
                        className="pos-btn-icon-text"
                        onClick={() => {
                            if (cart.length > 0) {
                                setConfirmModal({
                                    isOpen: true,
                                    title: 'Clear Current Cart?',
                                    message: 'Are you sure you want to clear the current cart and start a new order?',
                                    type: 'danger',
                                    onConfirm: () => {
                                        executeNewOrder();
                                    }
                                });
                                return;
                            }
                            executeNewOrder();
                        }}
                        title="Start New Order"
                    >
                        <RotateCcw size={16} /> New
                    </button>
                    <div className="bill-number-badge">
                        Bill # <span className="pos-bill-id">{editingSaleId || nextBillId}</span>
                    </div>
                </div>

                {/* Cart Table */}
                {/* Cart Table Area follows */}

                {/* Cart Table Area (Sales Only) */}
                <div className="pos-table-area">
                    {/* Return Cart Removed */}

                    {/* SALE CART (Right side or Full) */}
                    <div className="pos-table-container">
                        {/* Dynamic Background Logo / Watermark */}
                        {storeSettings?.pos_background_url && (
                            <div
                                className="pos-background-watermark"
                                style={{
                                    backgroundImage: `url("${storeSettings.pos_background_url}")`,
                                    width: storeSettings.pos_background_width || '400px',
                                    height: (storeSettings.pos_background_height && storeSettings.pos_background_height !== 'auto') ? storeSettings.pos_background_height : (storeSettings.pos_background_width || '400px'),
                                    opacity: (storeSettings.pos_background_opacity !== undefined && storeSettings.pos_background_opacity !== null) ? storeSettings.pos_background_opacity : 0.1
                                }}
                            />
                        )}
                        <table className="pos-table">
                            <thead>
                                <tr>
                                    <th className="pos-table-col-sno">S.No</th>
                                    <th>Barcode</th>
                                    <th>Item Name</th>
                                    <th>Price</th>
                                    <th>Qty</th>
                                    <th className="pos-table-col-disc">Disc %</th>
                                    <th className="pos-table-col-disc">Disc ₹</th>
                                    <th>Total</th>
                                    <th className="pos-table-col-empty"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {cart.map((item, index) => (
                                    <tr key={item.id} className={item.isManual ? 'manual-item-row' : ''}>
                                        <td className="pos-table-col-sno">{index + 1}</td>
                                        <td className="pos-barcode-text">
                                            {item.isManual ? (
                                                <input
                                                    className="pos-manual-input"
                                                    placeholder="Barcode"
                                                    value={item.barcode}
                                                    onChange={(e) => updateManualItem(item.id, 'barcode', e.target.value)}
                                                />
                                            ) : item.barcode}
                                        </td>
                                        <td>
                                            {item.isManual ? (
                                                <input
                                                    className="pos-manual-input"
                                                    placeholder="Item Name"
                                                    value={item.name}
                                                    onChange={(e) => updateManualItem(item.id, 'name', e.target.value)}
                                                    autoFocus // Auto focus on name when added
                                                />
                                            ) : (
                                                <div className="pos-item-name">{item.name}</div>
                                            )}
                                        </td>
                                        <td>
                                            {item.isManual ? (
                                                <input
                                                    className="pos-manual-input pos-input-price"
                                                    type="number"
                                                    placeholder="Price"
                                                    value={item.price}
                                                    onChange={(e) => updateManualItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                                />
                                            ) : (
                                                `₹${item.price}`
                                            )}
                                        </td>
                                        <td>
                                            <div className="pos-quantity-control">
                                                <button className="pos-action-btn" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                                                <span className="pos-qty-display">{item.quantity}</span>
                                                <button className="pos-action-btn" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="pos-item-discount-input"
                                                placeholder="%"
                                                value={item.discountType === '%' ? item.discountValue : (item.price * item.quantity > 0 && (parseFloat(item.discountValue) || 0) !== 0 ? (((parseFloat(item.discountValue) || 0) / (item.price * item.quantity)) * 100).toFixed(2) : '')}
                                                onChange={(e) => updateDiscount(item.id, { discountType: '%', discountValue: e.target.value })}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="pos-item-discount-input"
                                                placeholder="₹"
                                                value={item.discountType === 'rs' ? item.discountValue : ((parseFloat(item.discountValue) || 0) !== 0 ? ((item.price * item.quantity) * ((parseFloat(item.discountValue) || 0) / 100)).toFixed(2) : '')}
                                                onChange={(e) => updateDiscount(item.id, { discountType: 'rs', discountValue: e.target.value })}
                                            />
                                        </td>
                                        <td style={{ fontWeight: 'bold' }}>₹{calculateItemTotal(item).toFixed(2)}</td>
                                        <td>
                                            <button className="pos-action-btn pos-action-btn-red" onClick={() => removeFromCart(item.id)}><Trash size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {cart.length === 0 && <tr><td colSpan="9">
                                    <div className="empty-cart-state">
                                        <ShoppingCart />
                                        <span>Cart is empty. Scan product or search to begin.</span>
                                    </div>
                                </td></tr>}
                                {/* Invisible element to anchor the scroll-to-bottom action */}
                                <tr ref={endOfCartRef} style={{ height: 0, border: 'none', padding: 0 }} />
                            </tbody>
                        </table>
                    </div>

                    {/* Left Panel Summary (Items & Qty Boxes) */}
                    <div className="pos-left-summary">
                        <div className="pos-summary-box">
                            <div className="pos-summary-label">Total Items</div>
                            <div className="pos-summary-value">{distinctItemCount}</div>
                        </div>

                        <div className="pos-summary-box">
                            <div className="pos-summary-label">Total Quantity</div>
                            <div className="pos-summary-value">{totalItemCount}</div>
                        </div>
                        <div className="pos-summary-box">
                            <div className="pos-summary-label">Subtotal</div>
                            <div className="pos-summary-value">₹{cart.reduce((sum, item) => sum + calculateItemTotal(item), 0).toFixed(2)}</div>
                        </div>
                        <div className="pos-summary-box">
                            <div className="pos-summary-label">Total Discount</div>
                            <div className="pos-summary-value" style={{ color: '#16a34a' }}>₹{(itemDiscountsSum + globalDiscountAmount).toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT SECTION */}
            <div className="pos-right">
                {/* Section 1: Customer Details (Collapsible) */}
                <div className={`pos-card customer-section ${isCustomerExpanded ? 'expanded' : ''}`}>
                    <div
                        className="customer-header"
                        onClick={() => setIsCustomerExpanded(!isCustomerExpanded)}
                        style={{ paddingBottom: isCustomerExpanded ? '0.5rem' : '0' }}
                    >
                        <div className="customer-header-left">
                            <div className={`customer-icon ${isCustomerExpanded ? 'active' : ''}`}>
                                <User size={20} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1rem', margin: 0 }}>Customer</h3>
                                {!isCustomerExpanded && selectedCustomer && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '500' }}>{selectedCustomer.name}</div>
                                )}
                                {!isCustomerExpanded && !selectedCustomer && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Walk-in Customer</div>
                                )}
                            </div>
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                            {isCustomerExpanded ? <CheckCircle size={18} /> : <Plus size={18} />}
                        </div>
                    </div>

                    {isCustomerExpanded && (
                        <div className="animate-fade-in" style={{ marginTop: '1rem' }}>
                            <div className="customer-actions-row">
                                {selectedCustomer && (
                                    <button className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); startEditCustomer(); }}>
                                        <Edit size={14} /> Edit
                                    </button>
                                )}
                                <button className="btn" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); startAddCustomer(); }} title="Add New Customer">
                                    <Plus size={14} /> New
                                </button>
                            </div>

                            {/* Customer Search Input */}
                            <div className="customer-search-wrapper">
                                <input
                                    className="pos-search-input"
                                    style={{ padding: '0.5rem', fontSize: '0.9rem' }}
                                    placeholder="Search Name / Phone..."
                                    value={customerQuery}
                                    onChange={(e) => handleCustomerSearch(e.target.value)}
                                    onFocus={() => customerQuery.length > 1 && setShowCustomerResults(true)}
                                />
                                {showCustomerResults && (
                                    <div className="customer-results-dropdown">
                                        {filteredCustomers.length > 0 ? (
                                            filteredCustomers.map(c => (
                                                <div
                                                    key={c.id}
                                                    className="customer-result-item"
                                                    onClick={() => selectCustomer(c)}
                                                >
                                                    <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.phone}</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ padding: '8px', textAlign: 'center' }}>
                                                <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>No results found</div>
                                                {/* Quick Add Button if query looks like phone number */}
                                                {(customerQuery.length >= 3) && (
                                                    <button
                                                        className="btn btn-primary"
                                                        style={{ width: '100%', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                                                        onClick={() => startAddCustomer(customerQuery)} // Pass query as phone
                                                    >
                                                        <Plus size={14} /> Add Customer: {customerQuery}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {selectedCustomer ? (
                                <div className="customer-details-box">
                                    <button
                                        className="customer-clear-btn"
                                        onClick={() => { setSelectedCustomer(null); setCustomerHistory([]); setCustomerCreditNotes([]); setCustomerCreditBills([]); }}
                                    >
                                        Clear
                                    </button>
                                    <div style={{ marginBottom: '5px' }}><strong>Name:</strong> {selectedCustomer.name}</div>
                                    <div style={{ marginBottom: '5px' }}><strong>Phone:</strong> {selectedCustomer.phone}</div>
                                    <div style={{ marginBottom: '5px' }}><strong>Loyalty Pts:</strong> {selectedCustomer.loyalty_points}</div>
                                    <div style={{ marginBottom: '5px' }}><strong>Credit Balance:</strong> ₹{selectedCustomer.credit_balance || '0.00'}</div>

                                    {customerCreditNotes.length > 0 && (
                                        <div style={{ marginTop: '0.5rem', background: 'var(--bg-input)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>Available Credit Notes</div>
                                            <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                                {customerCreditNotes.map(cn => (
                                                    <div key={cn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '2px 0', borderBottom: '1px dashed var(--border)', color: 'var(--text-main)' }}>
                                                        <span>{cn.code} (₹{cn.balance})</span>
                                                        {appliedCreditNote && appliedCreditNote.code === cn.code ? (
                                                            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Applied</span>
                                                        ) : (
                                                            <button
                                                                className="btn"
                                                                style={{ padding: '0px 6px', fontSize: '0.7rem', background: 'var(--primary)', color: 'white', height: '20px' }}
                                                                onClick={() => applyCreditNote(cn.code)}
                                                            >
                                                                Apply
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {customerCreditBills.filter(b => b.status === 'pending' || b.status === 'partial').length > 0 && (
                                        <div style={{ marginTop: '0.5rem', background: '#fff1f2', padding: '0.5rem', borderRadius: '4px', border: '1px solid #fecdd3' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#be123c', marginBottom: '4px' }}>Pending Credit Bills</div>
                                            <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                                {customerCreditBills.filter(b => b.status === 'pending' || b.status === 'partial').map(bill => (
                                                    <div key={bill.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '2px 0', borderBottom: '1px dashed #fda4af', color: '#881337' }}>
                                                        <span>
                                                            #{bill.id} - {new Date(bill.created_at).toLocaleDateString()}
                                                            {bill.status === 'partial' && <span style={{ fontSize: '0.7rem', marginLeft: '4px', background: '#fb7185', color: 'white', padding: '0 4px', borderRadius: '4px' }}>Partial</span>}
                                                        </span>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontWeight: 'bold' }}>₹{parseFloat(bill.pending_amount || bill.credit_amount).toFixed(2)}</div>
                                                            {bill.status === 'partial' && <div style={{ fontSize: '0.7rem', color: '#9f1239' }}>(Paid: {parseFloat(bill.paid_amount).toFixed(2)})</div>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {customerCreditBills.filter(b => b.status === 'paid').length > 0 && (
                                        <div style={{ marginTop: '0.5rem', background: '#f0fdf4', padding: '0.5rem', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#15803d', marginBottom: '4px' }}>Paid Credit Bills</div>
                                            <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                                {customerCreditBills.filter(b => b.status === 'paid').map(bill => (
                                                    <div key={bill.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', padding: '2px 0', borderBottom: '1px dashed #86efac', color: '#166534' }}>
                                                        <span>#{bill.id} - {new Date(bill.created_at).toLocaleDateString()}</span>
                                                        <span style={{ fontWeight: 'bold', textDecoration: 'line-through', opacity: 0.7 }}>₹{parseFloat(bill.credit_amount).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <hr style={{ margin: '1rem 0', borderColor: 'var(--border)' }} />
                                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Recent History</div>
                                    {customerHistory.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>No history found</div> : (
                                        <ul className="history-list">
                                            {customerHistory.slice(0, 5).map((h, idx) => (
                                                <li key={idx} className="history-item">
                                                    <span className={clsx({ 'pay-later-text': (h.payment_method === 'pay_later' || (h.payment_details && h.payment_details.includes('pay_later'))) })}>
                                                        #{h.id} - ₹{h.total_amount} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({new Date(h.created_at).toLocaleDateString()})</span>
                                                    </span>
                                                    <button className="btn-icon" onClick={() => handleViewHistoryBill(h.id)} title="View Bill"><Eye size={14} /></button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ) : (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', marginTop: '1rem' }}>
                                    No customer selected
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Section 2: Checkout & Summary */}
                {!isCustomerExpanded && (
                    <div className="pos-card checkout-section">


                        <div className="pos-summary-container">
                            <div className="pos-summary-group">
                                <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                                <span style={{ fontWeight: '600', fontSize: '1.1rem' }}>₹{subtotal.toFixed(2)}</span>
                            </div>

                            <div className="pos-summary-group" style={{ color: '#16a34a' }}>
                                <span>Item Disc.</span>
                                <span style={{ fontWeight: '600' }}>-₹{itemDiscountsSum.toFixed(2)}</span>
                            </div>

                            <div className="pos-summary-group">
                                <span style={{ color: 'var(--text-muted)' }}>Global Disc.</span>
                                <div className="global-discount-controls">

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="number"
                                            className="pos-discount-input"
                                            value={globalDiscountValue}
                                            onChange={(e) => updateGlobalDiscountValue(e.target.value)}
                                        />
                                        <div className="discount-toggle-group">
                                            <button
                                                onClick={() => updateGlobalDiscountType('rs')}
                                                className={`discount-toggle-btn ${globalDiscountType === 'rs' ? 'active' : ''}`}
                                            >₹</button>
                                            <button
                                                onClick={() => updateGlobalDiscountType('%')}
                                                className={`discount-toggle-btn ${globalDiscountType === '%' ? 'active' : ''}`}
                                            >%</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Loyalty Redemption */}
                            {selectedCustomer && loyaltySettings && loyaltySettings.is_active === 1 && (
                                <div className="pos-summary-group">
                                    <span style={{ color: 'var(--text-muted)' }}>
                                        Redeem Points
                                        <div style={{ fontSize: '0.7rem', color: '#16a34a' }}>
                                            (Max: {selectedCustomer.loyalty_points})
                                        </div>
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="number"
                                            className="pos-search-input"
                                            style={{ width: '80px', padding: '4px 8px', fontSize: '0.9rem', marginBottom: 0 }}
                                            placeholder="Pts"
                                            value={pointsToRedeem}
                                            onChange={(e) => {
                                                const val = Math.min(parseInt(e.target.value) || 0, selectedCustomer.loyalty_points);
                                                setPointsToRedeem(val > 0 ? val : '');
                                            }}
                                        />
                                        <div style={{ fontSize: '0.9rem', width: '60px', textAlign: 'right' }}>
                                            -₹{((parseFloat(pointsToRedeem) || 0) * (loyaltySettings.redeem_rate_amount / loyaltySettings.redeem_rate_points)).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Coupon Code Section */}
                            <div className="pos-summary-group">
                                <span style={{ color: 'var(--text-muted)' }}>Coupon</span>
                                {appliedCoupon ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: '600' }}>
                                            {appliedCoupon.code} (-₹{appliedCoupon.discount})
                                        </span>
                                        <button
                                            onClick={removeCoupon}
                                            className="btn-icon"
                                            style={{ color: 'red', padding: '2px' }}
                                            title="Remove Coupon"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <input
                                            className="pos-search-input"
                                            style={{ width: '80px', padding: '4px 8px', fontSize: '0.9rem', marginBottom: 0, textTransform: 'uppercase' }}
                                            placeholder="CODE"
                                            value={couponCode}
                                            onChange={e => setCouponCode(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                                        />
                                        <button
                                            className="btn"
                                            style={{ padding: '2px 8px', fontSize: '0.8rem', background: 'var(--primary)', color: 'white' }}
                                            onClick={applyCoupon}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Credit Note Section (Display Only) */}
                            {appliedCreditNote && (
                                <div className="pos-summary-group">
                                    <span style={{ color: 'var(--text-muted)' }}>Credit Note</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'flex-end' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: '600' }}>
                                            {appliedCreditNote.code} (-₹{Math.min(appliedCreditNote.balance, afterItemDiscounts - globalDiscountAmount - loyaltyDiscountAmount - couponDiscountAmount)})
                                        </span>
                                        <button
                                            onClick={removeCreditNote}
                                            className="btn-icon"
                                            style={{ color: 'red', padding: '2px' }}
                                            title="Remove Credit Note"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="pos-total-box">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '1rem', opacity: 0.9 }}>To Pay</span>
                                    <span style={{ fontSize: '2.2rem', fontWeight: '800' }}>₹{finalTotal.toFixed(2)}</span>
                                </div>

                            </div>

                            {/* Payment Types / Split Payment */}
                            <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Payment Method</div>
                                    <button
                                        className="btn"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', background: isSplitPayment ? 'var(--primary)' : 'transparent', color: isSplitPayment ? 'white' : 'var(--primary)', border: '1px solid var(--primary)' }}
                                        onClick={() => setIsSplitPayment(!isSplitPayment)}
                                    >
                                        <Share2 size={14} /> Split Payment
                                    </button>
                                </div>

                                {isSplitPayment ? (
                                    <div className="split-payment-box">
                                        {['cash', 'card', 'upi', 'pay_later'].map(method => (
                                            <div key={method} className="split-row">
                                                <div className="split-label" style={{ textTransform: 'capitalize' }}>{method.replace('_', ' ')}</div>
                                                <input
                                                    type="number"
                                                    className="pos-search-input"
                                                    data-split-method={method}
                                                    style={{ marginBottom: 0, padding: '0.4rem', flex: 1 }}
                                                    placeholder="0.00"
                                                    value={splitAmounts[method]}
                                                    onChange={(e) => setSplitAmounts(prev => ({ ...prev, [method]: e.target.value }))}
                                                />
                                            </div>
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
                                            <span>Total: ₹{((parseFloat(splitAmounts.cash) || 0) + (parseFloat(splitAmounts.card) || 0) + (parseFloat(splitAmounts.upi) || 0) + (parseFloat(splitAmounts.pay_later) || 0)).toFixed(2)}</span>
                                            <span style={{ color: Math.abs(((parseFloat(splitAmounts.cash) || 0) + (parseFloat(splitAmounts.card) || 0) + (parseFloat(splitAmounts.upi) || 0) + (parseFloat(splitAmounts.pay_later) || 0)) - finalTotal) < 1 ? 'green' : 'red' }}>
                                                Remaining: ₹{(finalTotal - ((parseFloat(splitAmounts.cash) || 0) + (parseFloat(splitAmounts.card) || 0) + (parseFloat(splitAmounts.upi) || 0) + (parseFloat(splitAmounts.pay_later) || 0))).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="payment-methods-grid">
                                        {[
                                            { id: 'cash', label: 'Cash', icon: Banknote },
                                            { id: 'card', label: 'Card', icon: CreditCard },
                                            { id: 'upi', label: 'UPI', icon: Smartphone },
                                            { id: 'pay_later', label: 'Pay Later', icon: User }
                                        ].map(method => (
                                            <button
                                                key={method.id}
                                                className={`pos-pay-btn ${paymentMethod === method.id ? 'selected' : ''}`}
                                                onClick={() => setPaymentMethod(method.id)}
                                            >
                                                <method.icon size={20} />
                                                <span>{method.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="checkout-actions">
                                <button className="btn" style={{ flex: 1, padding: '0.5rem', color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }} onClick={() => handleCheckout(true)}>
                                    <Printer size={16} style={{ marginBottom: '4px' }} /> {editingSaleId ? 'Update & Print' : 'Save & Print'}
                                </button>
                                <button className="btn btn-primary" style={{ flex: 2, padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4)' }} onClick={() => handleCheckout(false)}>
                                    <CheckCircle size={20} /> {editingSaleId ? 'Update Bill' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* View Bill Modal */}
                {viewingBill && <ViewBillModal sale={viewingBill} onClose={() => setViewingBill(null)} />}

                {/* Edit Customer Modal */}
                {
                    showEditCustomer && (
                        <div className="pos-modal-overlay">
                            <div className="pos-modal-content edit-customer-modal">
                                <h3>{editingCustomer ? 'Edit Customer' : 'New Customer'}</h3>
                                <form onSubmit={saveCustomer}>
                                    <div style={{ marginBottom: '1rem' }}><label>Name</label><input className="input" required value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} /></div>
                                    <div style={{ marginBottom: '1rem' }}><label>Phone</label><input className="input" value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} /></div>
                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                        <button type="button" className="btn" onClick={() => setShowEditCustomer(false)}>Cancel</button>
                                        <button type="submit" className="btn btn-primary">Save</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }
                {/* Held Bills Modal */}
                {
                    showHeldBillsModal && (
                        <div className="pos-modal-overlay">
                            <div className="pos-modal-content held-bills-modal">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3>Held Bills ({heldBills.length})</h3>
                                    <button className="btn-icon" onClick={() => setShowHeldBillsModal(false)}><X size={20} /></button>
                                </div>

                                {heldBills.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No held bills</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {heldBills.map(bill => (
                                            <div key={bill.id} className="held-bill-item">
                                                <div>
                                                    <div style={{ fontWeight: 'bold' }}>
                                                        {bill.customer ? bill.customer.name : 'Walk-in Customer'}
                                                        <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                                                            ({new Date(bill.timestamp).toLocaleTimeString()})
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.9rem' }}>
                                                        {bill.cart.length} items | <span style={{ fontWeight: '600' }}>Total: ₹{bill.total.toFixed(2)}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                        {bill.cart.map(i => i.name).join(', ').slice(0, 50)}...
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => resumeBill(bill)}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <Play size={14} /> Resume
                                                    </button>
                                                    <button
                                                        className="btn"
                                                        onClick={() => deleteHeldBill(bill.id)}
                                                        style={{ color: 'red', border: '1px solid var(--border)' }}
                                                    >
                                                        <Trash size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }
            </div>
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
            />
        </div >
    );
};

export default POS;
