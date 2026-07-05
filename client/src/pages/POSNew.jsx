import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Trash, User, CreditCard, Banknote, Smartphone, Printer, CheckCircle, Edit, Eye, Plus, ShoppingCart, RotateCcw, Share2, PauseCircle, LayoutList, Play, X, Gift, PlusCircle, Barcode, Phone, PanelRightClose, PanelRightOpen, ArrowRight, FileText, ListOrdered } from 'lucide-react';


import '../styles/POSNew.css';
import ViewBillModal from '../components/ViewBillModal';
import CustomerDetailModal from '../components/CustomerDetailModal';

import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import QuantityInput from '../components/QuantityInput';

const POSNew = () => {
    // --- State Management ---
    const [products, setProducts] = useState([]);
    const [activeCartIndex, setActiveCartIndex] = useState(-1);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const [editingSaleId, setEditingSaleId] = useState(null);
    // Bill Date State (Default Today Local)
    const [billDate, setBillDate] = useState(new Date().toLocaleDateString('en-CA'));

    // Split Search States
    const [cashReceived, setCashReceived] = useState(''); // New State for Change Calculator
    const [barcodeInput, setBarcodeInput] = useState('');
    const [productSearchInput, setProductSearchInput] = useState('');
    const [customerNameInput, setCustomerNameInput] = useState('');
    const [customerPhoneInput, setCustomerPhoneInput] = useState('');

    // Layout States
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

    // Existing Logic States
    const [loyaltySettings, setLoyaltySettings] = useState(null);
    const [couponCode, setCouponCode] = useState('');
    const [creditNoteCode, setCreditNoteCode] = useState('');
    const [customerCreditNotes, setCustomerCreditNotes] = useState([]);
    const [customerCreditBills, setCustomerCreditBills] = useState([]);
    const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
    const [showCustomerDetailModal, setShowCustomerDetailModal] = useState(false);
    const [quickCustomerForm, setQuickCustomerForm] = useState({ name: '', phone: '' });

    const [storeSettings, setStoreSettings] = useState(null);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'danger' });

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
        appliedCreditNote, setAppliedCreditNote,
        pointsToRedeem, setPointsToRedeem,
        paymentMethod, setPaymentMethod
    } = useCart();

    // Split Payment — local state with localStorage persistence (NOT from context)
    const [isSplitPayment, setIsSplitPayment] = useState(() => {
        try { return JSON.parse(localStorage.getItem('posn_isSplitPayment')) || false; } catch { return false; }
    });
    const [splitAmounts, setSplitAmounts] = useState(() => {
        try { return JSON.parse(localStorage.getItem('posn_splitAmounts')) || { cash: '', card: '', upi: '', pay_later: '' }; } catch { return { cash: '', card: '', upi: '', pay_later: '' }; }
    });
    useEffect(() => {
        localStorage.setItem('posn_isSplitPayment', JSON.stringify(isSplitPayment));
        localStorage.setItem('posn_splitAmounts', JSON.stringify(splitAmounts));
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

    // --- Calculations ---
    const subtotal = React.useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

    const itemDiscountsSum = React.useMemo(() => cart.reduce((acc, item) => {
        const itemTotal = item.price * item.quantity;
        const discountAmt = item.discountType === '%'
            ? (itemTotal * (parseFloat(item.discountValue) || 0) / 100)
            : (parseFloat(item.discountValue) || 0);
        return acc + discountAmt;
    }, 0), [cart]);

    const afterItemDiscounts = React.useMemo(() => subtotal - itemDiscountsSum, [subtotal, itemDiscountsSum]);

    const globalDiscountAmount = React.useMemo(() => globalDiscount.type === '%'
        ? (afterItemDiscounts * (globalDiscount.value || 0) / 100)
        : (globalDiscount.value || 0), [afterItemDiscounts, globalDiscount]);

    const couponDiscountAmount = React.useMemo(() => appliedCoupon ? appliedCoupon.discount : 0, [appliedCoupon]);

    const loyaltyDiscountAmount = React.useMemo(() => loyaltySettings && pointsToRedeem
        ? ((parseFloat(pointsToRedeem) || 0) * (loyaltySettings.redeem_rate_amount / loyaltySettings.redeem_rate_points))
        : 0, [loyaltySettings, pointsToRedeem]);

    const creditNoteDeduction = React.useMemo(() => appliedCreditNote ? Math.min(appliedCreditNote.balance, afterItemDiscounts - globalDiscountAmount - loyaltyDiscountAmount - couponDiscountAmount) : 0,
        [appliedCreditNote, afterItemDiscounts, globalDiscountAmount, loyaltyDiscountAmount, couponDiscountAmount]);

    const finalTotal = React.useMemo(() => Math.max(0, afterItemDiscounts - globalDiscountAmount - couponDiscountAmount - loyaltyDiscountAmount - creditNoteDeduction),
        [afterItemDiscounts, globalDiscountAmount, couponDiscountAmount, loyaltyDiscountAmount, creditNoteDeduction]);

    // --- Handlers ---
    const applyCoupon = async () => {
        if (!couponCode) return;
        try {
            const res = await axios.post('/api/coupons/validate', {
                code: couponCode,
                cartTotal: afterItemDiscounts - globalDiscountAmount,
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
            if (cn.balance <= 0) return toast.error('Credit note has no balance');
            if (new Date(cn.expiry_date) < new Date()) return toast.error('Credit note expired');
            if (cn.customer_id && selectedCustomer && cn.customer_id !== selectedCustomer.id) {
                return toast.error('Credit note belongs to another customer');
            }
            setAppliedCreditNote(cn);
            setCreditNoteCode('');
            toast.success('Credit note applied');
        } catch (err) {
            toast.error('Invalid credit note');
        }
    };

    const removeCreditNote = () => setAppliedCreditNote(null);

    const clearWholeState = React.useCallback(() => {
        clearCart(); // Context handles cart, customer, coupon, payments
        setCustomerHistory([]);
        setCustomerCreditNotes([]);
        setCustomerCreditBills([]);

        // Reset local split payment state
        setIsSplitPayment(false);
        setSplitAmounts({ cash: '', card: '', upi: '', pay_later: '' });

        // Reset Inputs
        setBarcodeInput('');
        setProductSearchInput('');
        setCustomerNameInput('');
        setCustomerPhoneInput('');

        setEditingSaleId(null);
        setCouponCode('');
        // Reset date to today on new bill (Local Time)
        setBillDate(new Date().toLocaleDateString('en-CA'));
        fetchNextBillId();
        setIsRightSidebarOpen(false);
    }, [clearCart]);

    // --- Handlers ---
    const handleCheckout = React.useCallback(async (shouldPrint = false, paymentMethodOverride = null) => {
        if (isCheckingOut) return;
        if (cart.length === 0) return toast.error('Cart is empty');

        setIsCheckingOut(true);

        let payments = [];

        // Use override if provided, effectively disabling split payment logic for that specific transaction
        const effectiveMethod = paymentMethodOverride || paymentMethod;
        const effectiveSplit = paymentMethodOverride ? false : isSplitPayment;

        if (effectiveSplit) {
            // Read split amounts directly from DOM as failsafe against stale React state
            const domSplit = {};
            ['cash', 'card', 'upi', 'pay_later'].forEach(m => {
                const el = document.querySelector(`[data-split-method="${m}"]`);
                domSplit[m] = el ? el.value : '';
            });

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
                setIsCheckingOut(false);
                return toast.error(`Payment mismatch. Total: ${finalTotal.toFixed(2)}, Split: ${totalSplit.toFixed(2)}`);
            }

            if (parseFloat(sa.cash) > 0) payments.push({ method: 'cash', amount: parseFloat(sa.cash) });
            if (parseFloat(sa.card) > 0) payments.push({ method: 'card', amount: parseFloat(sa.card) });
            if (parseFloat(sa.upi) > 0) payments.push({ method: 'upi', amount: parseFloat(sa.upi) });
            if (parseFloat(sa.pay_later) > 0) payments.push({ method: 'pay_later', amount: parseFloat(sa.pay_later) });
        } else {
            payments.push({ method: effectiveMethod, amount: finalTotal });
        }

        if (appliedCreditNote && creditNoteDeduction > 0) {
            payments.push({ method: 'credit_note', amount: creditNoteDeduction, code: appliedCreditNote.code });
        }

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
            subtotal: afterItemDiscounts,
            payment_method: effectiveSplit ? 'split' : effectiveMethod,
            discount_total: globalDiscountAmount,
            coupon_code: appliedCoupon?.code || null,
            coupon_amount: couponDiscountAmount || 0,
            loyalty_amount: loyaltyDiscountAmount || 0,
            points_redeemed: parseFloat(pointsToRedeem) || 0,
            credit_note_code: appliedCreditNote?.code || null,
            created_at: billDate, // Send selected date
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
                // Trigger success animation
                setShowSuccessPopup(true);
                setTimeout(() => setShowSuccessPopup(false), 1500); // Reduced from 2500
            }

            clearWholeState();

            if (shouldPrint && res.data.sale_details) {
                setViewingBill(res.data.sale_details);
            }
        } catch (err) {
            console.error('Checkout Error:', err);
            toast.error(err.response?.data?.message || 'Checkout failed');
        } finally {
            setIsCheckingOut(false);
        }
    }, [cart, paymentMethod, isSplitPayment, finalTotal, selectedCustomer, globalDiscountAmount, appliedCoupon, loyaltyDiscountAmount, pointsToRedeem, appliedCreditNote, creditNoteDeduction, editingSaleId, isCheckingOut, billDate, clearWholeState]);

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isCheckingOut) return;
            const activeEl = document.activeElement;
            const isTyping = activeEl && (
                activeEl.tagName === 'INPUT' || 
                activeEl.tagName === 'TEXTAREA' || 
                activeEl.isContentEditable
            );

            // Esc: Reset inputs and focus barcode input
            if (e.key === 'Escape') {
                e.preventDefault();
                setBarcodeInput('');
                setProductSearchInput('');
                setCustomerNameInput('');
                setCustomerPhoneInput('');
                setShowCustomerResults(false);
                if (barcodeInputRef.current) {
                    barcodeInputRef.current.focus();
                }
                return;
            }

            // F1: Start New Bill / Reset
            if (e.key === 'F1') {
                e.preventDefault();
                clearWholeState();
                toast.success('New Bill Started');
                if (barcodeInputRef.current) {
                    barcodeInputRef.current.focus();
                }
                return;
            }

            // Ctrl + S: Save current bill (no print)
            if (e.key === 's' && e.ctrlKey) {
                e.preventDefault();
                handleCheckout(false);
                return;
            }

            // Ctrl + Enter: Save and Print
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                handleCheckout(true);
                return;
            }

            // Alt + C: Focus Customer search name field
            if (e.altKey && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                if (customerInputRef.current) {
                    customerInputRef.current.focus();
                    customerInputRef.current.select();
                }
                return;
            }

            // Alt + D: Focus Global Discount
            if (e.altKey && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                if (discountInputRef.current) {
                    discountInputRef.current.focus();
                    discountInputRef.current.select();
                }
                return;
            }

            // Backtick / Tilde: Cycle payment methods
            if ((e.key === '`' || e.key === '~') && !isTyping) {
                e.preventDefault();
                const methods = ['cash', 'card', 'upi', 'pay_later'];
                setPaymentMethod(prev => {
                    const nextIndex = (methods.indexOf(prev) + 1) % methods.length;
                    return methods[nextIndex];
                });
                return;
            }

            // F6: Instant Checkout Cash (Save & Print)
            if (e.key === 'F6') {
                e.preventDefault();
                handleCheckout(true, 'cash');
                return;
            }

            // F7: Instant Checkout UPI (Save & Print)
            if (e.key === 'F7') {
                e.preventDefault();
                handleCheckout(true, 'upi');
                return;
            }

            // F8: Instant Checkout Card (Save & Print)
            if (e.key === 'F8') {
                e.preventDefault();
                handleCheckout(true, 'card');
                return;
            }

            // Ctrl + + / Ctrl + = : Adjust quantity of highlighted or last added item
            if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
                e.preventDefault();
                if (cart.length > 0) {
                    const targetIndex = (activeCartIndex !== -1 && activeCartIndex < cart.length) 
                        ? activeCartIndex 
                        : cart.length - 1;
                    const targetItem = cart[targetIndex];
                    updateQuantity(targetItem.id, targetItem.quantity + 1);
                }
                return;
            }

            // Ctrl + - : Adjust quantity of highlighted or last added item
            if (e.ctrlKey && e.key === '-') {
                e.preventDefault();
                if (cart.length > 0) {
                    const targetIndex = (activeCartIndex !== -1 && activeCartIndex < cart.length) 
                        ? activeCartIndex 
                        : cart.length - 1;
                    const targetItem = cart[targetIndex];
                    if (targetItem.quantity > 1) {
                        updateQuantity(targetItem.id, targetItem.quantity - 1);
                    }
                }
                return;
            }

            // Arrow down: Navigate cart
            if (e.key === 'ArrowDown') {
                if (cart.length > 0) {
                    e.preventDefault();
                    if (activeCartIndex === -1) {
                        setActiveCartIndex(0);
                    } else {
                        setActiveCartIndex(prev => Math.min(prev + 1, cart.length - 1));
                    }
                }
                return;
            }

            // Arrow up: Navigate cart or return to barcode search
            if (e.key === 'ArrowUp') {
                if (cart.length > 0 && activeCartIndex !== -1) {
                    e.preventDefault();
                    if (activeCartIndex === 0) {
                        setActiveCartIndex(-1);
                        barcodeInputRef.current?.focus();
                    } else {
                        setActiveCartIndex(prev => prev - 1);
                    }
                }
                return;
            }

            // Highlighted cart row operations
            if (activeCartIndex !== -1 && activeCartIndex < cart.length && !isTyping) {
                const activeItem = cart[activeCartIndex];
                if (e.key === '+' || e.key === '=') {
                    e.preventDefault();
                    updateQuantity(activeItem.id, activeItem.quantity + 1);
                } else if (e.key === '-') {
                    e.preventDefault();
                    if (activeItem.quantity > 1) {
                        updateQuantity(activeItem.id, activeItem.quantity - 1);
                    }
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    removeFromCart(activeItem.id);
                    setActiveCartIndex(prev => {
                        if (cart.length <= 1) return -1;
                        return Math.min(prev, cart.length - 2);
                    });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart, paymentMethod, activeCartIndex, clearWholeState, handleCheckout, isCheckingOut]);


    // Handle incoming cart from Edit Bill
    useEffect(() => {
        if (location.state?.cartItems) {
            // Sanitize incoming data
            const sanitizedCart = location.state.cartItems.map(item => ({
                ...item,
                price: Number(item.price) || 0,
                quantity: Number(item.quantity) || Number(item.count) || 1,
                discountValue: Number(item.discountValue) || 0,
                discountType: item.discountType || 'rs',
                id: item.id || Date.now()
            }));

            setCart(sanitizedCart);

            // Handle Customer
            if (location.state.customerId) {
                axios.get('/api/customers').then(res => {
                    const c = res.data.find(cust => cust.id === location.state.customerId);
                    if (c) selectCustomer(c);
                }).catch(err => console.error('Error fetching customer for edit:', err));
            } else {
                resetCustomer();
            }

            // Handle Editing Mode
            if (location.state.editingSale) {
                setEditingSaleId(location.state.editingSale.id);
                if (location.state.editingSale.discount_total > 0) {
                    setGlobalDiscount({ type: 'fixed', value: parseFloat(location.state.editingSale.discount_total) });
                } else {
                    setGlobalDiscount({ type: 'fixed', value: 0 });
                }

                if (location.state.editingSale.paymentMethod) {
                    setPaymentMethod(location.state.editingSale.paymentMethod);
                }
            } else {
                setEditingSaleId(null);
            }

            // Clear state so it doesn't re-apply on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Wrapper for addToCart
    const addToCart = React.useCallback((product) => {
        addToCartContext(product);
        const index = cart.findIndex(item => item.id == product.id);
        if (index !== -1) {
            setActiveCartIndex(index);
        } else {
            setActiveCartIndex(cart.length);
        }
        setProductSearchInput('');
        setBarcodeInput('');
        setTimeout(() => {
            if (barcodeInputRef.current) {
                barcodeInputRef.current.focus();
            }
        }, 50);
    }, [addToCartContext, cart]);

    // --- Search & Input Handlers ---

    // 1. Barcode Handler
    const handleBarcodeKey = (e) => {
        if (e.key === 'Enter') {
            const code = barcodeInput.toUpperCase().trim();
            if (!code) return;
            const product = products.find(p => p.barcode === code);
            if (product) {
                addToCart(product);
            } else {
                toast.error('Product not found by barcode');
            }
        }
    };

    // 2. Product Search Handler (Fuzzy)
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [showProductResults, setShowProductResults] = useState(false);

    useEffect(() => {
        if (productSearchInput.trim().length > 1) {
            const q = productSearchInput.toLowerCase();
            const res = products.filter(p =>
                p.name.toLowerCase().includes(q) ||
                (p.category && p.category.toLowerCase().includes(q)) ||
                (p.sub_category && p.sub_category.toLowerCase().includes(q))
            );
            setFilteredProducts(res);
            setShowProductResults(true);
        } else {
            setShowProductResults(false);
        }
    }, [productSearchInput, products]);

    // 3. Customer Handlers
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [showCustomerResults, setShowCustomerResults] = useState(false);

    useEffect(() => {
        const qName = customerNameInput.toLowerCase();
        const qPhone = customerPhoneInput;

        // Prevent showing results if the input exactly matches the selected customer (avoids re-opening on select)
        if (selectedCustomer && (customerNameInput === selectedCustomer.name || customerPhoneInput === selectedCustomer.phone)) {
            setShowCustomerResults(false);
            return;
        }

        if (qName.length > 1 || qPhone.length > 2) {
            const res = customers.filter(c => {
                const matchName = qName ? (c.name && c.name.toLowerCase().includes(qName)) : true;
                const matchPhone = qPhone ? (c.phone && c.phone.includes(qPhone)) : true;
                return matchName && matchPhone;
            });
            setFilteredCustomers(res);
            setShowCustomerResults(true);
        } else {
            setShowCustomerResults(false);
        }
    }, [customerNameInput, customerPhoneInput, customers, selectedCustomer]);


    const selectCustomer = (customer) => {
        setSelectedCustomer(customer);
        setCustomerNameInput(customer.name);
        setCustomerPhoneInput(customer.phone || '');
        setShowCustomerResults(false);

        fetchCustomerHistory(customer.id);
        fetchCustomerCreditNotes(customer.id);
        fetchCustomerCreditBills(customer.id);

        // setIsRightSidebarOpen(true); // Disabled auto-open
    };

    // --- Effects & Data Fetching ---
    const barcodeInputRef = useRef(null);
    const discountInputRef = useRef(null);
    const customerInputRef = useRef(null);
    const endOfCartRef = useRef(null);

    // Auto-scroll to bottom of cart when new item is added
    useEffect(() => {
        if (endOfCartRef.current) {
            endOfCartRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [cart.length]);

    // Keep activeCartIndex in bounds
    useEffect(() => {
        if (cart.length === 0) {
            setActiveCartIndex(-1);
        } else if (activeCartIndex >= cart.length) {
            setActiveCartIndex(cart.length - 1);
        }
    }, [cart.length, activeCartIndex]);

    // Auto-scroll selected keyboard row into view
    useEffect(() => {
        if (activeCartIndex !== -1) {
            const element = document.querySelector(`.cart-item-row-${activeCartIndex}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [activeCartIndex]);

    // Initial Data Fetch
    useEffect(() => {
        fetchProducts();
        fetchCustomers();
        fetchNextBillId();
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
    }, []); // Only on mount

    // Customer Specific Data Fetch
    useEffect(() => {
        if (selectedCustomer) {
            setCustomerNameInput(selectedCustomer.name);
            setCustomerPhoneInput(selectedCustomer.phone || '');
            fetchCustomerHistory(selectedCustomer.id);
            fetchCustomerCreditNotes(selectedCustomer.id);
            fetchCustomerCreditBills(selectedCustomer.id);
        } else {
            setCustomerHistory([]);
            setCustomerCreditNotes([]);
            setCustomerCreditBills([]);
        }
    }, [selectedCustomer?.id]);

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
        try { const res = await axios.get('/api/customers'); setCustomers(res.data); } catch (err) { console.error(err); }
    };
    const [nextBillId, setNextBillId] = useState('...');
    const fetchNextBillId = async () => {
        try { const res = await axios.get('/api/sales/meta/next-id'); setNextBillId(res.data.nextId); } catch (e) { console.error(e); }
    };

    // Customer History
    const [customerHistory, setCustomerHistory] = useState([]);
    const fetchCustomerHistory = async (id) => {
        try { const res = await axios.get(`/api/customers/${id}/history`); setCustomerHistory(res.data || []); } catch (e) { setCustomerHistory([]); }
    };
    const fetchCustomerCreditNotes = async (id) => {
        try { const res = await axios.get(`/api/credit-notes/customer/${id}`); setCustomerCreditNotes(res.data || []); } catch (e) { setCustomerCreditNotes([]); }
    };
    const fetchCustomerCreditBills = async (id) => {
        try { const res = await axios.get(`/api/customers/${id}/credit-bills`); setCustomerCreditBills(res.data || []); } catch (e) { setCustomerCreditBills([]); }
    };

    // Modals
    const [viewingBill, setViewingBill] = useState(null);
    const [heldBills, setHeldBills] = useState(() => {
        try { return JSON.parse(localStorage.getItem('heldBills')) || []; } catch { return []; }
    });
    const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);

    // Add Manual Item logic
    const addDirectItem = () => {
        const id = 'manual_' + Date.now();
        setCart(prev => [...prev, {
            id,
            name: '',
            barcode: '',
            price: 0,
            quantity: 1,
            discountType: 'rs',
            discountValue: 0,
            discountPercent: 0,
            discountRs: 0,
            isManual: true
        }]);
    };

    // Manual Item Update
    const updateManualItem = (id, field, value) => {
        setCart(prev => prev.map(item => {
            if (item.id !== id) return item;

            const newItem = { ...item, [field]: value };

            // Recalculate discounts if price changes
            if (field === 'price') {
                const price = Number(value || 0);
                const quantity = Number(item.quantity || 1);
                const total = price * quantity;

                if (item.discountType === '%') {
                    newItem.discountRs = (total * (item.discountPercent || 0)) / 100;
                } else {
                    newItem.discountPercent = total > 0 ? ((item.discountRs || 0) / total) * 100 : 0;
                }
            }

            return newItem;
        }));
    };

    const addNewCustomerShortcut = () => {
        setQuickCustomerForm({ name: customerNameInput, phone: customerPhoneInput });
        setShowQuickCustomerModal(true);
    };

    const saveQuickCustomer = async (e) => {
        if (e) e.preventDefault();
        if (!quickCustomerForm.name || !quickCustomerForm.phone) return toast.error('Name and Phone are required');

        // Phone Validation (Simple)
        const cleanPhone = quickCustomerForm.phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) return toast.error('Enter a valid phone number');
        let formattedPhone = cleanPhone.length === 10 ? '+91' + cleanPhone : '+' + cleanPhone;

        try {
            const res = await axios.post('/api/customers', { ...quickCustomerForm, phone: formattedPhone });
            const newCustomer = { ...quickCustomerForm, phone: formattedPhone, id: res.data.id, loyalty_points: 0 };
            setCustomers(prev => [...prev, newCustomer]);
            selectCustomer(newCustomer);
            setShowQuickCustomerModal(false);
            toast.success('Customer added and selected');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add customer');
        }
    };

    // --- Hold/Unhold Logic ---
    const holdBill = () => {
        if (cart.length === 0) return toast.error('Cart is empty');

        const bill = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            cart,
            customer: selectedCustomer,
            total: finalTotalRounded
        };

        const updated = [...heldBills, bill];
        setHeldBills(updated);
        localStorage.setItem('heldBills', JSON.stringify(updated));

        clearCart();
        setCustomerHistory([]);
        setCustomerCreditNotes([]);
        setCustomerCreditBills([]);
        setBarcodeInput('');
        setProductSearchInput('');
        setCustomerNameInput('');
        setCustomerPhoneInput('');
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
        setCart(bill.cart);
        setSelectedCustomer(bill.customer);
        if (bill.customer) {
            setCustomerNameInput(bill.customer.name);
            setCustomerPhoneInput(bill.customer.phone || '');
            fetchCustomerHistory(bill.customer.id);
            fetchCustomerCreditNotes(bill.customer.id);
            fetchCustomerCreditBills(bill.customer.id);
        }

        deleteHeldBill(bill.id, true);
        setShowHeldBillsModal(false);
        toast.success('Bill resumed');
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

    // Calculate Totals with Tax/Rounding
    const taxRate = 0; // Default 0% for now
    const taxAmount = (subtotal - itemDiscountsSum) * (taxRate / 100);
    const totalBeforeRound = subtotal - itemDiscountsSum - globalDiscountAmount - couponDiscountAmount - loyaltyDiscountAmount - creditNoteDeduction + taxAmount;
    const roundOff = Math.round(totalBeforeRound) - totalBeforeRound;
    const finalTotalRounded = Math.round(totalBeforeRound);

    // --- Render ---
    const totalQty = cart.reduce((acc, item) => acc + item.quantity, 0);

    // Reset Customer
    const resetCustomer = () => {
        setSelectedCustomer(null);
        setCustomerNameInput('');
        setCustomerPhoneInput('');
        setCustomerHistory([]);
        setCustomerCreditNotes([]);
        setCustomerCreditBills([]);
        setPointsToRedeem('');
        setIsRightSidebarOpen(false);
    };

    // --- View Bill (with Full Details Fetch) ---
    const handleViewBill = async (bill) => {
        const toastId = toast.loading('Loading bill details...');
        try {
            const res = await axios.get(`/api/sales/${bill.id}`);
            // Ensure customer details are present (fetch from API might have them, but fallback to selectedCustomer if needed)
            const fullBill = res.data;
            if (!fullBill.customer_name && selectedCustomer) {
                fullBill.customer_name = selectedCustomer.name;
                fullBill.customer_phone = selectedCustomer.phone;
            }
            setViewingBill(fullBill);
            toast.dismiss(toastId);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load bill details', { id: toastId });
        }
    };

    // --- Render ---
    return (
        <div className={`posn-wrapper ${isRightSidebarOpen ? 'sidebar-open' : ''}`}>
            {/* MAIN CONTENT AREA */}
            <div className="posn-main">
                {/* 1. TOP BAR SECTION */}
                <header className="posn-header">
                    <div className="posn-header-primary">
                        <img
                            src={storeSettings?.logo_url || "/Salescope.png"}
                            alt="Brand"
                            className="posn-header-logo"
                            style={{
                                width: storeSettings?.logo_width || 'auto',
                                height: storeSettings?.logo_height || '42px'
                            }}
                            onError={(e) => { e.target.onerror = null; e.target.src = "/Salescope.png"; }}
                        />
                        <div className="posn-search-section">
                            {/* Product Search Group */}
                            <div className="posn-search-group product-search">
                                <div className="posn-input-wrapper">
                                    <Barcode className="posn-input-icon" />
                                    <input
                                        ref={barcodeInputRef}
                                        className="posn-input"
                                        placeholder="Scan..."
                                        value={barcodeInput}
                                        onChange={e => setBarcodeInput(e.target.value)}
                                        onKeyDown={handleBarcodeKey}
                                    />
                                </div>
                                <div className="posn-input-wrapper flex-grow">
                                    <Search className="posn-input-icon" />
                                    <input
                                        className="posn-input"
                                        placeholder="Search products..."
                                        value={productSearchInput}
                                        onChange={e => setProductSearchInput(e.target.value)}
                                    />
                                    {showProductResults && (
                                        <div className="posn-dropdown product-dropdown">
                                            {filteredProducts.slice(0, 15).map(p => (
                                                <div key={p.id} className="posn-dropdown-item" onClick={() => addToCart(p)}>
                                                    <div className="item-name">{p.name}</div>
                                                    <div className="item-info">
                                                        ₹{p.price} • {p.barcode}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Customer Search Group */}
                            <div className="posn-search-group customer-search">
                                <div className="posn-input-wrapper">
                                    <User className="posn-input-icon" />
                                    <input
                                        ref={customerInputRef}
                                        className="posn-input"
                                        placeholder="Name"
                                        value={customerNameInput}
                                        onChange={e => setCustomerNameInput(e.target.value)}
                                    />
                                </div>
                                <div className="posn-input-wrapper">
                                    <Phone className="posn-input-icon" />
                                    <input
                                        className="posn-input"
                                        placeholder="Phone"
                                        value={customerPhoneInput}
                                        onChange={e => setCustomerPhoneInput(e.target.value)}
                                    />
                                    {(selectedCustomer || customerNameInput || customerPhoneInput) && (
                                        <button className="posn-input-action danger" title="Clear Customer" onClick={resetCustomer}>
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                {showCustomerResults && (
                                    <div className="posn-dropdown customer-dropdown">
                                        {filteredCustomers.map(c => (
                                            <div key={c.id} className="posn-dropdown-item" onClick={() => selectCustomer(c)}>
                                                <div className="item-name">{c.name}</div>
                                                <div className="item-info">{c.phone}</div>
                                            </div>
                                        ))}
                                        {filteredCustomers.length === 0 && (customerNameInput || customerPhoneInput) && (
                                            <div className="posn-dropdown-item action" onClick={addNewCustomerShortcut}>
                                                <Plus size={16} /> Add New
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="posn-action-group compact">
                            <button className="posn-btn secondary sm" onClick={addDirectItem} title="Direct Item">
                                <PlusCircle size={16} /> {!isRightSidebarOpen && <span className="hide-mobile">Direct</span>}
                            </button>
                            <button className="posn-btn secondary sm" onClick={clearWholeState} title="New Order">
                                <RotateCcw size={16} /> {!isRightSidebarOpen && <span className="hide-mobile">New</span>}
                            </button>
                            <div className="posn-split-btn-group">
                                <button className="posn-btn secondary sm split-main" onClick={holdBill} title="Hold">
                                    <PauseCircle size={16} /> {!isRightSidebarOpen && <span className="hide-mobile">Hold</span>}
                                </button>
                                <button className="posn-btn secondary sm split-icon" onClick={() => setShowHeldBillsModal(true)} title={`Unhold (${heldBills.length})`}>
                                    <ListOrdered size={16} />
                                    {heldBills.length > 0 && <span className="posn-badge mini hold-badge">{heldBills.length}</span>}
                                </button>
                            </div>



                            <div className="posn-header-meta">
                                <span className="posn-badge main">#{nextBillId}</span>
                                <button
                                    className="posn-sidebar-toggle"
                                    onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                                    title="Toggle Customer Details"
                                >
                                    {isRightSidebarOpen ? <PanelRightClose size={24} /> : <PanelRightOpen size={24} />}
                                </button>
                            </div>




                        </div>


                    </div>
                </header>

                {/* 2. CART AREA */}
                <main className="posn-cart-area">
                    <div className="posn-table-wrapper">
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
                        <table className="posn-table">
                            <thead>
                                <tr>
                                    <th className="col-idx">#</th>
                                    <th className="col-barcode">Barcode</th>
                                    <th className="col-item">Item Name</th>
                                    <th className="col-price">Unit Price</th>
                                    <th className="col-qty">Quantity</th>
                                    <th className="col-total">Subtotal</th>
                                    <th className="col-disc">Discount (%)</th>
                                    <th className="col-disc">Discount (₹)</th>
                                    <th className="col-total">Line Total</th>
                                    <th className="col-actions"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {cart.map((item, index) => (
                                    <tr 
                                        key={item.id}
                                        className={`cart-item-row-${index} ${activeCartIndex === index ? 'active-keyboard-row' : ''}`}
                                        onClick={() => setActiveCartIndex(index)}
                                    >
                                        <td className="col-idx">{index + 1}</td>
                                        <td className="col-barcode">
                                            {item.isManual ? (
                                                <input className="table-input" value={item.barcode} onChange={e => updateManualItem(item.id, 'barcode', e.target.value)} />
                                            ) : (
                                                <code>{item.barcode}</code>
                                            )}
                                        </td>
                                        <td className="col-item">
                                            {item.isManual ? (
                                                <input className="table-input" value={item.name} onChange={e => updateManualItem(item.id, 'name', e.target.value)} />
                                            ) : (
                                                <span>{item.name}</span>
                                            )}
                                        </td>
                                        <td className="col-price">
                                            {item.isManual ? (
                                                <input className="table-input price" type="number" value={item.price} onChange={e => updateManualItem(item.id, 'price', e.target.value)} />
                                            ) : (
                                                `₹${item.price}`
                                            )}
                                        </td>
                                        <td className="col-qty">
                                            <div className="posn-qty-control">
                                                <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                                                <QuantityInput
                                                    value={item.quantity}
                                                    onChange={(val) => updateQuantity(item.id, val)}
                                                />
                                                <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                                            </div>
                                        </td>
                                        <td className="col-total">
                                            ₹{(item.price * item.quantity).toFixed(2)}
                                        </td>
                                        <td className="col-disc">
                                            <input
                                                className="table-input center"
                                                placeholder="%"
                                                type="number"
                                                value={item.discountPercent > 0 ? Number(item.discountPercent).toString() : ''}
                                                onChange={(e) => updateDiscount(item.id, { discountType: '%', discountValue: e.target.value })}
                                            />
                                        </td>
                                        <td className="col-disc">
                                            <input
                                                className="table-input center"
                                                placeholder="₹"
                                                type="number"
                                                value={item.discountRs > 0 ? Number(item.discountRs).toString() : ''}
                                                onChange={(e) => updateDiscount(item.id, { discountType: 'rs', discountValue: e.target.value })}
                                            />
                                        </td>

                                        <td className="col-total line-total">
                                            ₹{((item.price * item.quantity) - (item.discountRs || 0)).toFixed(2)}
                                        </td>
                                        <td className="col-actions">
                                            <button className="posn-row-delete" onClick={() => removeFromCart(item.id)}>
                                                <Trash size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {/* Invisible element to anchor the scroll-to-bottom action */}
                                <tr ref={endOfCartRef} style={{ height: 0, border: 'none', padding: 0 }} />
                            </tbody>
                        </table>
                    </div>
                </main>


                {/* 3. FOOTER SECTION */}
                <footer className="posn-footer">

                    <div className="footer-promos-area">
                        <div className="discount-row">
                            <div className="global-discount-box card-style">
                                <div className="discount-header-row">
                                    <label>Discount</label>
                                    <div className="posn-toggle-group mini">
                                        <button className={globalDiscountType === 'rs' ? 'active' : ''} onClick={() => updateGlobalDiscountType('rs')}>₹</button>
                                        <button className={globalDiscountType === '%' ? 'active' : ''} onClick={() => updateGlobalDiscountType('%')}>%</button>
                                    </div>
                                </div>
                                <div className="discount-inputs">
                                    <input
                                        ref={discountInputRef}
                                        type="number"
                                        value={globalDiscountValue}
                                        onChange={e => updateGlobalDiscountValue(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* Cash Change Calculator - Moved Here */}
                            {!isSplitPayment && paymentMethod === 'cash' && (
                                <div className="cash-change-calculator card-style">
                                    <div className="cash-change-content">
                                        <div>
                                            <label>Cash</label>
                                            <input
                                                type="number"
                                                className="posn-input compact"
                                                placeholder="Amount"
                                                value={cashReceived}
                                                onChange={e => setCashReceived(e.target.value)}
                                            />
                                        </div>
                                        {parseFloat(cashReceived) > finalTotal && (
                                            <div className="cash-change-display">
                                                <label>Change</label>
                                                <div>
                                                    ₹{(parseFloat(cashReceived) - finalTotal).toFixed(2)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="promotions-box">
                            <div className="promo-header-row">
                                <label>Promotions</label>
                                {selectedCustomer && <span className="avail-pts-info">Avail: {Number(selectedCustomer.loyalty_points).toFixed(2)} pts</span>}
                            </div>
                            <div className="promo-inputs">
                                {appliedCoupon ? (
                                    <div className="applied-promo-pill">
                                        <Gift size={14} /> <span>{appliedCoupon.code} (₹{appliedCoupon.discount} Off)</span>
                                        <button onClick={removeCoupon}><X size={14} /></button>
                                    </div>
                                ) : (
                                    <div className="promo-input-group">
                                        <div className="input-row">
                                            <input
                                                placeholder="Coupon"
                                                value={couponCode}
                                                onChange={e => setCouponCode(e.target.value)}
                                            />
                                            <button className="promo-btn" onClick={applyCoupon}>Apply</button>
                                        </div>
                                    </div>
                                )}

                                <div className="promo-input-group loyalty">
                                    <div className="input-row">
                                        <input
                                            type="number"
                                            placeholder="Redeem"
                                            value={pointsToRedeem}
                                            onChange={e => setPointsToRedeem(e.target.value)}
                                        />
                                        {pointsToRedeem > 0 && <span className="points-preview">₹{loyaltyDiscountAmount.toFixed(2)}</span>}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>


                    <div className="posn-footer-payment">
                        <div className="payment-config">
                            <div className="payment-header">
                                <label>Payment Method</label>
                                <button
                                    className={`split-toggle-btn ${isSplitPayment ? 'active' : ''}`}
                                    onClick={() => setIsSplitPayment(!isSplitPayment)}
                                    title="Toggle Split Payment"
                                >
                                    <div className="toggle-track">
                                        <div className="toggle-thumb"></div>
                                    </div>
                                    <span>Split Payment</span>
                                </button>
                            </div>

                            {isSplitPayment ? (
                                <>
                                    <div className="split-payment-grid">
                                        <div className="split-input-group">
                                            <div className="split-icon"><Banknote size={16} /></div>
                                            <input
                                                data-split-method="cash"
                                                type="number"
                                                placeholder="Cash"
                                                value={splitAmounts.cash}
                                                onChange={e => setSplitAmounts({ ...splitAmounts, cash: e.target.value })}
                                            />
                                        </div>
                                        <div className="split-input-group">
                                            <div className="split-icon"><Smartphone size={16} /></div>
                                            <input
                                                data-split-method="upi"
                                                type="number"
                                                placeholder="UPI"
                                                value={splitAmounts.upi}
                                                onChange={e => setSplitAmounts({ ...splitAmounts, upi: e.target.value })}
                                            />
                                        </div>
                                        <div className="split-input-group">
                                            <div className="split-icon"><CreditCard size={16} /></div>
                                            <input
                                                data-split-method="card"
                                                type="number"
                                                placeholder="Card"
                                                value={splitAmounts.card}
                                                onChange={e => setSplitAmounts({ ...splitAmounts, card: e.target.value })}
                                            />
                                        </div>
                                        <div className="split-input-group danger">
                                            <div className="split-icon"><User size={16} /></div>
                                            <input
                                                data-split-method="pay_later"
                                                type="number"
                                                placeholder="Credit"
                                                value={splitAmounts.pay_later}
                                                onChange={e => setSplitAmounts({ ...splitAmounts, pay_later: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="split-payment-status split-status-row">
                                        <span>Total Paid: ₹{((parseFloat(splitAmounts.cash) || 0) + (parseFloat(splitAmounts.card) || 0) + (parseFloat(splitAmounts.upi) || 0) + (parseFloat(splitAmounts.pay_later) || 0)).toFixed(2)}</span>
                                        <span className={Math.abs(((parseFloat(splitAmounts.cash) || 0) + (parseFloat(splitAmounts.card) || 0) + (parseFloat(splitAmounts.upi) || 0) + (parseFloat(splitAmounts.pay_later) || 0)) - finalTotal) < 1 ? 'text-pos-emerald' : 'text-pos-rose'}>
                                            Remaining: ₹{(finalTotal - ((parseFloat(splitAmounts.cash) || 0) + (parseFloat(splitAmounts.card) || 0) + (parseFloat(splitAmounts.upi) || 0) + (parseFloat(splitAmounts.pay_later) || 0))).toFixed(2)}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="method-grid">
                                    {[
                                        { id: 'cash', icon: Banknote, label: 'Cash' },
                                        { id: 'upi', icon: Smartphone, label: 'UPI' },
                                        { id: 'card', icon: CreditCard, label: 'Card' },
                                        { id: 'pay_later', icon: User, label: 'Credit' }
                                    ].map(m => (
                                        <button
                                            key={m.id}
                                            className={`method-btn ${paymentMethod === m.id ? 'selected' : ''}`}
                                            onClick={() => setPaymentMethod(m.id)}
                                        >
                                            <m.icon size={18} />
                                            <span>{m.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}



                            {appliedCreditNote && (
                                <div className="applied-promo-pill cn mt-2">
                                    <CreditCard size={14} /> <span>{appliedCreditNote.code} (₹{creditNoteDeduction.toFixed(2)} Off)</span>
                                    <button onClick={removeCreditNote}><X size={14} /></button>
                                </div>
                            )}

                            {/* Date Selector Card */}
                            <div className="date-selector-card" style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
                                <input
                                    type="date"
                                    className="posn-input"
                                    value={billDate}
                                    onChange={(e) => setBillDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    style={{ width: 'auto', minWidth: '140px', height: '36px', cursor: 'pointer' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="posn-footer-checkout">
                        <div className="summary-section checkout-summary">
                            <div className="summary-item">
                                <label>Items</label>
                                <div className="value">{cart.length}</div>
                            </div>
                            <div className="summary-item">
                                <label>Qty</label>
                                <div className="value">{totalQty}</div>
                            </div>
                            <div className="summary-item">
                                <label>Total</label>
                                <div className="value">{subtotal.toFixed(2)}</div>
                            </div>
                            <div className="summary-item">
                                <label>Disc.</label>
                                <div className="value discount">{(itemDiscountsSum + globalDiscountAmount + couponDiscountAmount + loyaltyDiscountAmount + creditNoteDeduction).toFixed(2)}</div>
                            </div>
                        </div>
                        <div className="final-amount">
                            <label>To Pay</label>
                            <div className="total-value">₹{finalTotalRounded.toFixed(2)}</div>
                        </div>
                        <div className="checkout-btns">
                            <button 
                                className="posn-checkout-btn secondary" 
                                onClick={() => handleCheckout(true)}
                                disabled={isCheckingOut}
                            >
                                <Printer size={18} /> <span>{isCheckingOut ? 'Printing...' : 'Print'}</span>
                            </button>
                            <button 
                                className="posn-checkout-btn primary" 
                                onClick={() => handleCheckout(false)}
                                disabled={isCheckingOut}
                            >
                                <ArrowRight size={20} /> <span>{isCheckingOut ? 'Saving...' : 'Save'}</span>
                            </button>
                        </div>
                    </div>
                </footer>
            </div >

            {/* CUSTOMER SIDEBAR DRAWER */}
            <aside className={`posn-sidebar ${isRightSidebarOpen ? 'open' : ''}`}>
                <header className="sidebar-header">
                    <h3>Customer Insight</h3>
                    <button className="sidebar-close" onClick={() => setIsRightSidebarOpen(false)}>
                        <X size={20} />
                    </button>
                </header>

                <div className="sidebar-content">
                    {selectedCustomer ? (
                        <div className="customer-detail-flow">
                            <section className="customer-info-card">
                                <div className="customer-main">
                                    <div className="avatar-placeholder">{selectedCustomer.name[0]}</div>
                                    <div className="text">
                                        <h4>{selectedCustomer.name}</h4>
                                        <p>{selectedCustomer.phone}</p>
                                    </div>
                                </div>
                                <div className="stats-grid">
                                    <div className="stat-item">
                                        <label>Loyalty Points</label>
                                        <div className="value indigo">{Number(selectedCustomer.loyalty_points).toFixed(2)}</div>
                                    </div>
                                    <div className="stat-item">
                                        <label>Credit Balance</label>
                                        <div className="value rose">₹{selectedCustomer.credit_balance || '0.00'}</div>
                                    </div>
                                </div>
                            </section>

                            <section className="sidebar-list-section">
                                <h5>Credit Notes</h5>
                                {customerCreditNotes.length === 0 ? <p className="empty-text">No active credit notes</p> : (
                                    <div className="list-items">
                                        {customerCreditNotes.map(cn => (
                                            <div key={cn.id} className="list-item">
                                                <div className="info">
                                                    <strong>{cn.code}</strong>
                                                    <span>₹{cn.balance}</span>
                                                </div>
                                                <button className="apply-btn" onClick={() => applyCreditNote(cn.code)}>Apply</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className="sidebar-list-section">
                                <h5>Pending Credit Bills</h5>
                                {customerCreditBills.filter(b => b.status === 'pending' || b.status === 'partial').length === 0 ? <p className="empty-text">No pending credit bills</p> : (
                                    <div className="list-items">
                                        {customerCreditBills.filter(b => b.status === 'pending' || b.status === 'partial').map(b => (
                                            <div key={b.id} className="list-item bill danger">
                                                <div className="info">
                                                    <strong>#{b.id}</strong>
                                                    <span>{new Date(b.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <div className="amount">₹{parseFloat(b.pending_amount).toFixed(2)}</div>
                                                <button className="view-btn sm" onClick={() => handleViewBill(b)} title="View Bill">
                                                    <Eye size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                            <section className="sidebar-list-section">
                                <h5>Recent History</h5>
                                <div className="history-items">
                                    {customerHistory.slice(0, 5).map(h => (
                                        <div key={h.id} className="history-item">
                                            <span>#{h.id} • {new Date(h.created_at).toLocaleDateString()}</span>
                                            <strong>₹{h.total_amount}</strong>
                                            <button className="view-btn sm" onClick={() => handleViewBill(h)} title="View Bill">
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    ) : (
                        <div className="sidebar-empty-state">
                            <User size={64} className="ghost-icon" />
                            <p>Select a customer to view loyalty, credit notes, and purchase history.</p>
                        </div>
                    )}
                </div>
            </aside >

            {/* View Bill Modal */}
            {viewingBill && <ViewBillModal sale={viewingBill} onClose={() => setViewingBill(null)} />}

            {/* Held Bills (Unhold) Modal */}
            {
                showHeldBillsModal && (
                    <div className="posn-modal-overlay">
                        <div className="posn-modal held-bills-modal">
                            <div className="modal-header">
                                <h3>Held Bills (Unhold)</h3>
                                <button onClick={() => setShowHeldBillsModal(false)}><X size={20} /></button>
                            </div>
                            <div className="modal-content">
                                {heldBills.length === 0 ? (
                                    <div className="empty-state">No held bills found.</div>
                                ) : (
                                    <div className="held-list">
                                        {heldBills.map(bill => (
                                            <div key={bill.id} className="held-item">
                                                <div className="info">
                                                    <strong>{bill.customer ? bill.customer.name : 'Walk-in Customer'}</strong>
                                                    <span>{new Date(bill.timestamp).toLocaleString()}</span>
                                                    <small>{bill.cart.length} items • ₹{bill.total.toFixed(2)}</small>
                                                </div>
                                                <div className="actions">
                                                    <button className="resume-btn" onClick={() => resumeBill(bill)}>Resume</button>
                                                    <button className="delete-btn" onClick={() => deleteHeldBill(bill.id)}><Trash size={16} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Quick Add Customer Modal */}
            {
                showQuickCustomerModal && (
                    <div className="posn-modal-overlay">
                        <div className="posn-modal quick-customer-modal">
                            <div className="modal-header">
                                <h3>Quick Add New Customer</h3>
                                <button onClick={() => setShowQuickCustomerModal(false)}><X size={20} /></button>
                            </div>
                            <form onSubmit={saveQuickCustomer} className="flex-col-hidden">
                                <div className="modal-content modal-content-scroll">
                                    <div className="posn-form-group">
                                        <label>Customer Name *</label>
                                        <input
                                            className="posn-input"
                                            placeholder="Full Name"
                                            value={quickCustomerForm.name}
                                            onChange={e => setQuickCustomerForm({ ...quickCustomerForm, name: e.target.value })}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="posn-form-group">
                                        <label>Phone Number *</label>
                                        <input
                                            className="posn-input"
                                            placeholder="10-digit number"
                                            value={quickCustomerForm.phone}
                                            onChange={e => setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer modal-footer-sticky">
                                    <button type="button" className="posn-btn secondary" onClick={() => setShowQuickCustomerModal(false)}>Cancel</button>
                                    <button type="submit" className="posn-btn primary">Save Customer</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Customer Detail Modal (Alt + C) */}
            {showCustomerDetailModal && selectedCustomer && (
                <CustomerDetailModal
                    customer={selectedCustomer}
                    onClose={() => setShowCustomerDetailModal(false)}
                />
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
            />

            {/* Success Animation Popup */}
            {showSuccessPopup && (
                <div className="pos-success-overlay">
                    <div className="pos-success-popup">
                        <div className="success-icon-ring">
                            <CheckCircle size={64} className="success-checkmark" />
                        </div>
                        <h2>Bill Saved!</h2>
                        <p>Transaction completed successfully</p>
                    </div>
                </div>
            )}
        </div >
    );
};

export default POSNew;
