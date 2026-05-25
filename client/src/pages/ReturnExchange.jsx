import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { Search, Trash, User, CreditCard, Banknote, Smartphone, Printer, CheckCircle, Edit, Eye, Plus, ShoppingCart, RotateCcw, Share2, PauseCircle, LayoutList, Play, X, Gift, PlusCircle, FileText } from 'lucide-react';

import { clsx } from 'clsx';
import '../styles/POS.css';
import ViewBillModal from '../components/ViewBillModal';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

import { useCart } from '../context/CartContext';

const ReturnExchange = () => {
    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState('');

    // Loyalty State
    const [loyaltySettings, setLoyaltySettings] = useState(null);
    const [loyaltyInput, setLoyaltyInput] = useState('');
    const [pointsToRedeem, setPointsToRedeem] = useState('');

    useEffect(() => {
        axios.get('/api/loyalty/settings').then(res => setLoyaltySettings(res.data)).catch(err => console.error('Loyalty fetch error:', err));
    }, []);

    // Cart Context
    const {
        cart, addToCart: addToCartContext, removeFromCart, updateQuantity, updateDiscount, clearCart, cartTotal, setCart,
        customer: selectedCustomer, setCustomer: setSelectedCustomer,
        globalDiscount, setGlobalDiscount
    } = useCart();

    const location = useLocation();
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

    // Global Discount State
    // Derived from context
    const globalDiscountType = globalDiscount.type;
    const globalDiscountValue = globalDiscount.value;

    // Helper to update global discount
    const updateGlobalDiscountValue = (val) => setGlobalDiscount({ ...globalDiscount, value: parseFloat(val) || 0 });
    const updateGlobalDiscountType = (type) => setGlobalDiscount({ ...globalDiscount, type });

    // Payment State
    const [paymentMethod, setPaymentMethod] = useState('cash');
    // Split Payment State
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [splitAmounts, setSplitAmounts] = useState({ cash: '', card: '', upi: '', pay_later: '' });

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

    const [creditNotes, setCreditNotes] = useState([]); // Store fetched credit notes

    // --- RETURN MODE STATE ---
    // const [showModeSelectionModal, setShowModeSelectionModal] = useState(true); // Modal Removed
    const [isExchangeMode, setIsExchangeMode] = useState(true); // Always Exchange Mode now

    // We force ReturnMode = true effectively, but we use the existing specific flags to control UI
    const [isReturnMode, setIsReturnMode] = useState(true);
    const [returnCart, setReturnCart] = useState(() => {
        const saved = localStorage.getItem('return_cart');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('return_cart', JSON.stringify(returnCart));
    }, [returnCart]);
    const [activeScanMode, setActiveScanMode] = useState('return');

    // NO Toggle Return Mode needed (Modal sets it once)
    const toggleReturnMode = () => { };

    // Return Cart Helpers
    const addToReturnCart = (product) => {
        setReturnCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...product, quantity: 1, discount: 0, reason: 'Defective' }]; // Default reason
        });
        setSearch(''); // Clear search
    };

    const removeFromReturnCart = (productId) => {
        setReturnCart(prev => prev.filter(item => item.id !== productId));
    };

    const updateReturnQuantity = (productId, qty) => {
        if (qty < 1) return;
        setReturnCart(prev => prev.map(item => item.id === productId ? { ...item, quantity: qty } : item));
    };

    const returnTotal = returnCart.reduce((acc, item) => {
        const itemGross = item.price * item.quantity;
        const discountVal = parseFloat(item.discount) || 0;
        const refundAmount = Math.max(0, itemGross - discountVal);
        return acc + refundAmount;
    }, 0);


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
        setSearch('');
        setSearch('');
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
            fetchCreditNotes(bill.customer.id);
        }

        // Remove from held
        deleteHeldBill(bill.id, true);
        setShowHeldBillsModal(false);
    };

    const executeNewOrder = () => {
        clearCart();
        setReturnCart([]); // Clear returns too
        setCustomerHistory([]);
        setSearch('');
        setCustomerQuery('');
        // Full Reset of Payment/Mode States
        setEditingSaleId(null);
        setPaymentMethod('cash');
        setIsSplitPayment(false);
        setSplitAmounts({ cash: '', card: '', upi: '', pay_later: '' });
        setPointsToRedeem('');
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

    useEffect(() => {
        fetchProducts();
        fetchCustomers();
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
    }, []);

    const fetchProducts = async () => {
        try {
            // Use lite=true to fetch only essential fields to prevent Network Error
            const res = await axios.get('/api/products?limit=9999&lite=true');
            // Backend in lite mode returns flat array or { products: [] } depending on implementation, handle both
            const data = res.data.products ? res.data.products : (Array.isArray(res.data) ? res.data : []);
            setProducts(data);
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
            setCustomerHistory(res.data || []);
        } catch (e) { setCustomerHistory([]); }
    };

    const fetchCreditNotes = async (customerId) => {
        try {
            const res = await axios.get(`/api/credit-notes/customer/${customerId}`);
            setCreditNotes(res.data || []);
        } catch (e) { setCreditNotes([]); }
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
        fetchCreditNotes(customer.id);
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
                if (isReturnMode && activeScanMode === 'return') {
                    addToReturnCart(product);
                } else {
                    addToCart(product);
                }
            } else {
                // If not found by barcode, maybe try to match name exactly or just alert
                // Or user will use the dropdown search logic.
                // For now, if no match, check if it matches a name prefix?
                // The requirements say "dont render products... adding them just by searching".
                // We'll implement a suggestion list only when typing? 
                // Or assume "Search" is the main way.
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
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const distinctItemCount = cart.length;

    // Calculate Item Discounts Sum
    const itemDiscountsSum = cart.reduce((sum, item) => {
        const val = parseFloat(item.discountValue) || 0;
        if (item.discountType === 'rs') return sum + val;
        return sum + ((item.price * item.quantity) * (val / 100));
    }, 0);

    const afterItemDiscounts = subtotal - itemDiscountsSum;

    // Global Discount
    let globalDiscountAmount = 0;
    const globalDiscVal = parseFloat(globalDiscountValue) || 0;
    if (globalDiscountType === 'rs') {
        globalDiscountAmount = globalDiscVal;
    } else {
        globalDiscountAmount = afterItemDiscounts * (globalDiscVal / 100);
    }

    // Loyalty Discount
    let loyaltyDiscountAmount = 0;
    if (loyaltySettings && pointsToRedeem) {
        loyaltyDiscountAmount = parseFloat(pointsToRedeem) * (loyaltySettings.redeem_rate_amount / loyaltySettings.redeem_rate_points);
    }

    const finalTotal = Math.max(0, afterItemDiscounts - globalDiscountAmount - loyaltyDiscountAmount);


    // Auto-select "Issue Credit Note" id ('credit_note') if Net < 0
    useEffect(() => {
        const net = finalTotal - returnTotal;
        if (net < 0) {
            // Default to 'credit_note' if neither 'credit_note' nor 'refund_cash' is selected
            if (paymentMethod !== 'credit_note' && paymentMethod !== 'refund_cash') {
                setPaymentMethod('credit_note');
            }
        } else {
            // If we are back to positive, switch to cash if current method is refund related
            if (paymentMethod === 'credit_note' || paymentMethod === 'refund_cash') {
                setPaymentMethod('cash');
            }
        }
    }, [finalTotal, returnTotal, paymentMethod]);

    const handleCheckout = async (print = false) => {
        if (cart.length === 0 && returnCart.length === 0) return; // Allow return-only transactions

        // Net Calculation
        const netPayable = finalTotal - returnTotal;

        // Validation for Credit Note Issue
        if (netPayable < 0 && !selectedCustomer) {
            toast.error('Customer is MANDATORY when issuing a Credit Note (Return > Adjusted Sale). Please select a customer.');
            return;
        }

        // Validate Pay Later
        if (paymentMethod === 'pay_later' && !selectedCustomer) {
            toast.error('Customer is MANDATORY for "Pay Later" bills. Please select or add a customer.');
            return;
        }

        // Validate Loyalty Points
        if (pointsToRedeem > 0) {
            if (!selectedCustomer) {
                toast.error('Customer required to redeem points');
                return;
            }
            if (pointsToRedeem > selectedCustomer.loyalty_points) {
                toast.error('Insufficient loyalty points');
                return;
            }
            if (loyaltySettings && pointsToRedeem < loyaltySettings.minimum_redeem_points) {
                toast.error(`Minimum redemption is ${loyaltySettings.minimum_redeem_points} points`);
                return;
            }
        }

        try {
            const itemsPayload = cart.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                price: item.price,
                // Include name/barcode for manual items
                name: item.name,
                barcode: item.barcode,
                // Calculate per-item discount amount for the backend
                discount: item.discountType === 'rs' ? (parseFloat(item.discountValue) || 0) : ((item.price * item.quantity) * ((parseFloat(item.discountValue) || 0) / 100))
            }));

            const payload = {
                customer_id: selectedCustomer?.id,
                items: itemsPayload,

                // Return Items
                return_items: returnCart.map(item => ({
                    product_id: item.id,
                    quantity: item.quantity,
                    price: item.price,
                    discount: item.discount || 0,
                    reason: item.reason || 'Defective'
                })),

                // payment_method set below based on logic
                discount_total: globalDiscountAmount + loyaltyDiscountAmount, // Combine discounts for total calculation
                points_redeemed: parseFloat(pointsToRedeem) || 0
            };

            // LOGIC FOR EXCHANGE & PAYMENTS
            // Case 1: Return Value >= Sale Value (Net <= 0)
            // Result: Exchange covers full sale. Remaining Return Value -> Credit Note.
            if (netPayable <= 0) {
                // If it's a refund mode, the payload.payment_method is used to signal backend
                // either 'credit_note' (default logic) OR 'cash' (refund).

                // If selected 'credit_note', we send 'credit_note' -> backend triggers CN.
                // If selected 'refund_cash', we send 'refund_cash' (or handle via param).

                // Let's rely on `paymentMethod` state which is now 'credit_note' or 'refund_cash'.

                // NOTE: 'credit_note' logic in backend (lines 109-115 of sales.js) relies on `return_balance > 0`.
                // It does NOT check payment_method explicitly, but we plan to ADD that check.

                // We'll pass `refund_mode` in payload.
                payload.refund_mode = paymentMethod; // 'credit_note' or 'refund_cash'

                // The main `payment_method` for the sale record should probably be 'exchange'.
                // Because the SALE (items bought) is paid for by the EXCHANGE.
                payload.payment_method = 'exchange';

                // Payments array: "Exchange" covers the Final Total (Sale Value).
                payload.payments = [{ method: 'exchange', amount: finalTotal }];
            }
            // Case 2: Return Value < Sale Value (Net > 0)
            // Result: Customer pays the difference (Net Payable).
            else {
                const payments = [];
                // 1. Partial Payment via Return Value
                if (returnTotal > 0) {
                    payments.push({ method: 'exchange', amount: returnTotal });
                }

                // 2. Remaining Balance Payment
                // If Split Payment Active
                if (isSplitPayment) {
                    const c = parseFloat(splitAmounts.cash) || 0;
                    const cd = parseFloat(splitAmounts.card) || 0;
                    const u = parseFloat(splitAmounts.upi) || 0;
                    const pl = parseFloat(splitAmounts.pay_later) || 0;
                    const totalEntered = c + cd + u + pl;

                    if (Math.abs(totalEntered - netPayable) > 1) { // Validate User Net Input
                        toast.error(`Total split payment (₹${totalEntered.toFixed(2)}) must match Net Payable (₹${netPayable.toFixed(2)})`);
                        return;
                    }

                    if (c > 0) payments.push({ method: 'cash', amount: c });
                    if (cd > 0) payments.push({ method: 'card', amount: cd });
                    if (u > 0) payments.push({ method: 'upi', amount: u });
                    if (pl > 0) {
                        if (!selectedCustomer) { toast.error('Customer is MANDATORY for "Pay Later".'); return; }
                        payments.push({ method: 'pay_later', amount: pl });
                    }
                }
                // Single Payment Method for Balance
                else {
                    payments.push({ method: paymentMethod, amount: netPayable });
                }

                payload.payments = payments;
                payload.payment_method = payments.length > 1 ? 'split' : payments[0].method;
            }

            let saleId;
            if (editingSaleId) {
                // Update existing sale
                await axios.put(`/api/sales/${editingSaleId}`, payload);
                saleId = editingSaleId;
                toast.success('Bill updated successfully');
            } else {
                // Create new sale
                const res = await axios.post('/api/sales', payload);
                saleId = res.data.sale_id;
            }

            if (print) {
                // Fetch full sale data and Open Modal
                const saleRes = await axios.get(`/api/sales/${saleId}`);
                setViewingBill(saleRes.data);
            } else {
                if (!editingSaleId) toast.success('Sale completed successfully');
            }


            // If we have a customer selected, refresh their data (e.g. new credit note, new history)
            // But usually we clear everything for a new sale.
            // The User might want to see the credit note immediately.
            // Requirement: "reflect in credit notes and customer section"
            // If we clearCart, do we clear customer?
            // checking useCart hook... actually `clearCart` usually clears items, but `selectedCustomer` might persist if not cleared manually.
            // Let's see... Logic below lines 567+ currently implicitly clears specific local states.
            // BUT `selectedCustomer` comes from Context. 
            // `ReturnExchange` doesn't explicitly `setSelectedCustomer(null)` in `reset` logic unless we add it.
            // Wait, line 707 says "onClick={() => { clearCart(); ... }}" for "New Order".
            // If `handleCheckout` finishes, it calls `clearCart()`.

            // If the user wants to see the credit note *for that customer*, we should probably KEEP the customer selected 
            // OR at least if we keep them, we update them.
            // Standard POS flow: Sale Complete -> Reset for Next Customer.
            // If we reset, the customer section clears, so "Customer Section" is empty. This is valid.
            // BUT if the user wants to see it, they have to select the customer again.
            // If they select the customer again, it calls `selectCustomer` -> `fetchCreditNotes`. This WORKS.

            // However, maybe the user implies: "I want to see the credit note right after checkout".
            // Let's assume standard POS behavior: Reset.
            // If so, the "Customer Section" is hidden. So the requirement "reflect in customer section" implies 
            // "When I look at the customer section (now or later), it should be there".

            // IF the user blindly means "I want to see it right after checkout", then we shouldn't clear the customer.
            // But usually we clear.

            // Let's Stick to: 
            // 1. Transaction succeeds.
            // 2. Alert/Print.
            // 3. Clear Cart.
            // 4. If we want to be nice, maybe we keep the customer? 
            //    No, usually next person in line.

            // However, if we DO keep customer (maybe optional?), we must refresh.
            // The current code does NOT clear `selectedCustomer` explicitly in `handleCheckout` success block?
            // Line 28: `const { ... setCart, customer: selectedCustomer, setCustomer: setSelectedCustomer ... } = useCart();`
            // Line 567 in file view shows `clearCart()`.
            // Does `clearCart` in context clear customer? Usually no, just items.
            // IF `selectedCustomer` persists, then the UI still shows old data unless we refresh.
            // I suspect `selectedCustomer` persists.
            // So, I should Refetch Credit Notes if `selectedCustomer` exists.

            if (selectedCustomer) {
                fetchCreditNotes(selectedCustomer.id);
                fetchCustomerHistory(selectedCustomer.id);
                // Also update points balance if changed
                axios.get('/api/customers').then(res => {
                    const updated = res.data.find(c => c.id === selectedCustomer.id);
                    if (updated) setSelectedCustomer(updated);
                });
            }

            // Reset
            clearCart();
            setReturnCart([]);
            localStorage.removeItem('return_cart');
            // setCustomerHistory([]); // DON'T clear this if we want to show updated history!
            // Actually, if we keep customer, we should keep history.
            // The original code `setCustomerHistory([])` implies we wanted to clear.
            // If I remove `setCustomerHistory([])` and add fetch, it helps.

            setPaymentMethod('cash');
            setEditingSaleId(null);
            setIsSplitPayment(false);
            setSplitAmounts({ cash: '', card: '', upi: '', pay_later: '' });
            setPointsToRedeem('');
            fetchNextBillId();
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.message || err.message;
            if (msg.includes('Out of stock')) {
                toast.error('Stock Error: ' + msg);
            } else {
                toast.error('Transaction Failed: ' + msg);
            }
        }
    };


    const handleViewHistoryBill = async (saleId) => {
        try {
            const res = await axios.get(`/api/sales/${saleId}`);
            setViewingBill(res.data);
        } catch (err) {
            toast.error('Could not load bill details');
        }
    };

    const startAddCustomer = () => {
        setCustomerForm({ name: '', phone: '', email: '' });
        setEditingCustomer(null);
        setShowEditCustomer(true);
    };

    const startEditCustomer = () => {
        if (!selectedCustomer) return;
        setCustomerForm({
            name: selectedCustomer.name,
            phone: selectedCustomer.phone || '',
            email: selectedCustomer.email || ''
        });
        setEditingCustomer(selectedCustomer);
        setShowEditCustomer(true);
    };

    const saveCustomer = async (e) => {
        e.preventDefault();
        try {
            if (editingCustomer) {
                // Update existing
                await axios.put(`/api/customers/${editingCustomer.id}`, customerForm);
                const updated = { ...selectedCustomer, ...customerForm };
                setSelectedCustomer(updated);
                setCustomers(customers.map(c => c.id === updated.id ? { ...c, ...updated } : c));
                toast.success('Customer updated');
            } else {
                // Create new
                const res = await axios.post('/api/customers', customerForm);
                const newCustomer = { ...customerForm, id: res.data.id, loyalty_points: 0 };
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
                            className={`pos-search-input ${activeScanMode === 'return' ? 'input-return-mode' : ''}`}
                            placeholder={activeScanMode === 'return' ? "Scan item to RETURN..." : "Search product or scan..."}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={handleBarcode}
                        />
                    </div>
                    {/* 
                    <div className="mode-toggle-group">
                        <div style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '0.5rem',
                            background: '#f0f9ff',
                            color: '#0369a1',
                            border: '1px solid currentColor',
                            fontWeight: 'bold',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                            <RotateCcw size={16} />
                            EXCHANGE
                        </div>
                    </div>
                     */}

                    {isExchangeMode && (
                        <div className="scan-mode-switch">
                            <button
                                className={`scan-switch-btn ${activeScanMode === 'return' ? 'active-red' : ''}`}
                                onClick={() => setActiveScanMode('return')}
                            >
                                <RotateCcw size={14} /> Refunding
                            </button>
                            <button
                                className={`scan-switch-btn ${activeScanMode === 'sale' ? 'active-green' : ''}`}
                                onClick={() => setActiveScanMode('sale')}
                            >
                                <ShoppingCart size={14} /> Buying
                            </button>
                        </div>
                    )}

                    <div className="divider-vertical"></div>

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
                        Bill # <span style={{ color: 'var(--text-main)' }}>{editingSaleId || nextBillId}</span>
                    </div>
                </div>

                {/* Cart Table */}
                {/* Cart Table Area follows */}

                {/* Cart Table Area (Split or Single) */}
                <div className={`pos-table-area ${isExchangeMode ? 'split-view-active' : ''}`}>

                    {/* RETURN CART (Left side in Split View) */}
                    {isReturnMode && (
                        <div className="pos-table-container return-cart-container">
                            <div className="return-header-bar">
                                <span className="return-title">Returning Items</span>
                                <span className="return-total">Total: ₹{returnTotal.toFixed(2)}</span>
                            </div>
                            <table className="pos-table return-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Qty</th>
                                        <th>Disc ₹ (Total)</th>
                                        <th>Refund</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {returnCart.map((item, index) => {
                                        const grossRefund = item.price * item.quantity;
                                        const discountVal = parseFloat(item.discount) || 0;
                                        const finalRefund = Math.max(0, grossRefund - discountVal);
                                        return (
                                            <tr key={item.id}>
                                                <td>
                                                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                                                    <div style={{ fontSize: '0.75rem' }}>{item.barcode}</div>
                                                </td>
                                                <td>
                                                    <div className="pos-quantity-control small">
                                                        <button className="pos-action-btn" onClick={() => updateReturnQuantity(item.id, item.quantity - 1)}>-</button>
                                                        <span style={{ margin: '0 5px' }}>{item.quantity}</span>
                                                        <button className="pos-action-btn" onClick={() => updateReturnQuantity(item.id, item.quantity + 1)}>+</button>
                                                    </div>
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        className="pos-item-discount-input"
                                                        style={{ width: '70px', borderColor: '#fca5a5' }}
                                                        placeholder="0"
                                                        min="0"
                                                        value={item.discount || ''}
                                                        onChange={(e) => {
                                                            const validVal = Math.max(0, parseFloat(e.target.value) || 0);
                                                            setReturnCart(prev => prev.map(i => i.id === item.id ? { ...i, discount: validVal } : i))
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ fontWeight: '600', color: '#991b1b' }}>₹{finalRefund.toFixed(2)}</td>
                                                <td>
                                                    <button className="pos-action-btn pos-action-btn-red" onClick={() => removeFromReturnCart(item.id)}><X size={14} /></button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {returnCart.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', fontStyle: 'italic', color: '#aaa' }}>Scan items to return</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* SALE CART (Right side or Full) */}
                    {isExchangeMode && (
                        <div className="pos-table-container">
                            <table className="pos-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '50px' }}>S.No</th>
                                        <th>Barcode</th>
                                        <th>Item Name</th>
                                        <th>Price</th>
                                        <th>Qty</th>
                                        <th style={{ width: '90px' }}>Disc %</th>
                                        <th style={{ width: '90px' }}>Disc ₹</th>
                                        <th>Total</th>
                                        <th style={{ width: '50px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map((item, index) => (
                                        <tr key={item.id} className={item.isManual ? 'manual-item-row' : ''}>
                                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{index + 1}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
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
                                                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                                                )}
                                            </td>
                                            <td>
                                                {item.isManual ? (
                                                    <input
                                                        className="pos-manual-input"
                                                        type="number"
                                                        placeholder="Price"
                                                        style={{ width: '80px' }}
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
                                                    <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</span>
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
                                            <ShoppingCart size={48} style={{ opacity: 0.2 }} />
                                            <span>Cart is empty. Scan product or search to begin.</span>
                                        </div>
                                    </td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

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
                            {isCustomerExpanded ? <CheckCircle size={18} style={{ transform: 'rotate(180deg)' }} /> : <Plus size={18} />}
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
                                            <div style={{ padding: '8px', color: 'var(--text-muted)' }}>No results found</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {selectedCustomer ? (
                                <div className="customer-details-box">
                                    <button
                                        className="customer-clear-btn"
                                        onClick={() => { setSelectedCustomer(null); setCustomerHistory([]); }}
                                    >
                                        Clear
                                    </button>
                                    <div style={{ marginBottom: '5px' }}><strong>Name:</strong> {selectedCustomer.name}</div>
                                    <div style={{ marginBottom: '5px' }}><strong>Phone:</strong> {selectedCustomer.phone}</div>
                                    <div style={{ marginBottom: '5px' }}><strong>Loyalty Pts:</strong> {selectedCustomer.loyalty_points}</div>
                                    <div style={{ marginBottom: '5px' }}><strong>Credit Balance:</strong> ₹{selectedCustomer.credit_balance || '0.00'}</div>

                                    {creditNotes.length > 0 && (
                                        <div className="credit-notes-list" style={{ marginTop: '0.5rem', background: '#ecfdf5', padding: '0.5rem', borderRadius: '4px', border: '1px solid #10b981' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#047857', marginBottom: '4px' }}>Available Credit Notes</div>
                                            {creditNotes.map(cn => (
                                                <div key={cn.code} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{cn.code}</span>
                                                    <span style={{ fontWeight: '600' }}>₹{parseFloat(cn.balance).toFixed(2)}</span>
                                                </div>
                                            ))}
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
                                    <input
                                        type="number"
                                        className="pos-search-input"
                                        style={{ width: '70px', padding: '4px 8px', fontSize: '0.9rem', marginBottom: 0 }}
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

                            <div className="pos-total-box">
                                {(() => {
                                    const netPayable = finalTotal - returnTotal;
                                    const isCreditNote = netPayable < 0;

                                    return (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '1rem', opacity: 0.9 }}>
                                                    {isCreditNote ? 'Credit Note Issue' : 'Net Payable'}
                                                </span>
                                                {isCreditNote && (
                                                    <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>
                                                        (We owe customer)
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '2.2rem', fontWeight: '800', color: isCreditNote ? '#16a34a' : 'var(--text-main)' }}>
                                                ₹{Math.abs(netPayable).toFixed(2)}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Payment Types / Split Payment, OR Refund Options if Negative */}
                        {(() => {
                            const netPayable = finalTotal - returnTotal;
                            const isRefundScenario = netPayable < 0;

                            if (isRefundScenario) {
                                return (
                                    <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                            Refund Method (We owe customer)
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <button
                                                className={`pos-pay-btn ${paymentMethod === 'credit_note' ? 'selected' : ''}`}
                                                style={{ height: '60px', flexDirection: 'column', gap: '4px' }}
                                                onClick={() => setPaymentMethod('credit_note')}
                                            >
                                                <FileText size={24} />
                                                <span style={{ fontWeight: 600 }}>Issue Credit Note</span>
                                            </button>

                                            <button
                                                className={`pos-pay-btn ${paymentMethod === 'refund_cash' ? 'selected' : ''}`}
                                                style={{ height: '60px', flexDirection: 'column', gap: '4px' }}
                                                onClick={() => setPaymentMethod('refund_cash')}
                                            >
                                                <Banknote size={24} />
                                                <span style={{ fontWeight: 600 }}>Refund Cash</span>
                                            </button>
                                        </div>
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                            {paymentMethod === 'credit_note'
                                                ? 'Balance will be stored in customer account.'
                                                : 'Give cash back to customer directly.'}
                                        </div>
                                    </div>
                                );
                            }

                            // Standard Payment Grid
                            return (
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
                                                    <div className="split-label" style={{ textTransform: 'capitalize' }}>
                                                        {method === 'pay_later' ? 'Pay Later' : method.replace('_', ' ')}
                                                    </div>
                                                    <input
                                                        type="number"
                                                        className="pos-search-input"
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
                            );
                        })()}

                        <div className="checkout-actions">
                            <button className="btn" style={{ flex: 1, padding: '0.5rem', color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }} onClick={() => handleCheckout(true)}>
                                <Printer size={16} style={{ marginBottom: '4px' }} /> {editingSaleId ? 'Update & Print' : 'Checkout & Print'}
                            </button>
                            <button className="btn btn-primary" style={{ flex: 2, padding: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.4)' }} onClick={() => handleCheckout(false)}>
                                <CheckCircle size={20} /> {editingSaleId ? 'Update Bill' : 'Checkout'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

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
                                <div style={{ marginBottom: '1rem' }}><label>Email</label><input className="input" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} /></div>
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

export default ReturnExchange;
