import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState(() => {
        try {
            const saved = localStorage.getItem('pos_cart');
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    });

    const [customer, setCustomer] = useState(() => {
        try {
            const saved = localStorage.getItem('pos_customer');
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    });

    const [globalDiscount, setGlobalDiscount] = useState(() => {
        try {
            const saved = localStorage.getItem('pos_discount');
            return saved ? JSON.parse(saved) : { type: 'rs', value: 0 };
        } catch (e) { return { type: 'rs', value: 0 }; }
    });

    const [appliedCoupon, setAppliedCoupon] = useState(() => {
        try {
            const saved = localStorage.getItem('pos_coupon');
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    });

    const [paymentMethod, setPaymentMethod] = useState(() => {
        try {
            const saved = localStorage.getItem('pos_paymentMethod');
            return saved ? JSON.parse(saved) : 'cash';
        } catch (e) { return 'cash'; }
    });

    const [isSplitPayment, setIsSplitPayment] = useState(() => {
        try {
            const saved = localStorage.getItem('pos_isSplitPayment');
            return saved ? JSON.parse(saved) : false;
        } catch (e) { return false; }
    });

    const [splitAmounts, setSplitAmounts] = useState(() => {
        try {
            const saved = localStorage.getItem('pos_splitAmounts');
            return saved ? JSON.parse(saved) : { cash: '', card: '', upi: '', pay_later: '' };
        } catch (e) { return { cash: '', card: '', upi: '', pay_later: '' }; }
    });

    const [appliedCreditNote, setAppliedCreditNote] = useState(() => {
        try {
            const saved = localStorage.getItem('pos_appliedCreditNote');
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    });

    const [pointsToRedeem, setPointsToRedeem] = useState(() => {
        try {
            const saved = localStorage.getItem('pos_pointsToRedeem');
            return saved ? JSON.parse(saved) : '';
        } catch (e) { return ''; }
    });

    // Sound Logic
    const productAddSoundRef = useRef(null);

    useEffect(() => {
        // Fetch store settings to get sound URL
        axios.get('/api/settings/store').then(res => {
            if (res.data.product_add_sound_url) {
                const audio = new Audio(res.data.product_add_sound_url);
                audio.volume = 1.0;
                productAddSoundRef.current = audio;
            }
        }).catch(err => console.error('Failed to load sound settings:', err));
    }, []);

    useEffect(() => {
        localStorage.setItem('pos_cart', JSON.stringify(cart));
        localStorage.setItem('pos_customer', JSON.stringify(customer));
        localStorage.setItem('pos_discount', JSON.stringify(globalDiscount));
        localStorage.setItem('pos_coupon', JSON.stringify(appliedCoupon));
        localStorage.setItem('pos_paymentMethod', JSON.stringify(paymentMethod));
        localStorage.setItem('pos_isSplitPayment', JSON.stringify(isSplitPayment));
        localStorage.setItem('pos_splitAmounts', JSON.stringify(splitAmounts));
        localStorage.setItem('pos_appliedCreditNote', JSON.stringify(appliedCreditNote));
        localStorage.setItem('pos_pointsToRedeem', JSON.stringify(pointsToRedeem));
    }, [cart, customer, globalDiscount, appliedCoupon, paymentMethod, isSplitPayment, splitAmounts, appliedCreditNote, pointsToRedeem]);

    const addToCart = (product) => {
        // Play Sound
        if (productAddSoundRef.current) {
            productAddSoundRef.current.currentTime = 0;
            productAddSoundRef.current.play().catch(e => console.error('Audio play error:', e));
        }

        setCart(prev => {
            const existing = prev.find(item => item.id == product.id);
            if (existing) {
                // When increasing quantity, preserve discount PERCENTAGE if type is %, or AMOUNT if type is rs
                return prev.map(item => {
                    if (item.id != product.id) return item;
                    const newQty = item.quantity + 1;
                    const price = Number(item.price || 0);
                    const total = price * newQty;

                    let newPercent = item.discountPercent || 0;
                    let newRs = item.discountRs || 0;

                    if (item.discountType === '%') {
                        newRs = (total * newPercent) / 100;
                    } else {
                        newPercent = total > 0 ? (newRs / total) * 100 : 0;
                    }

                    return { ...item, quantity: newQty, discountRs: newRs, discountPercent: newPercent };
                });
            }
            // Initialize with synced fields
            return [...prev, {
                ...product,
                quantity: 1,
                discountType: 'rs',
                discountValue: 0,
                discountPercent: 0,
                discountRs: 0
            }];
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id != productId));
    };

    const updateQuantity = (productId, quantity) => {
        if (quantity < 1) return;
        setCart(prev => prev.map(item => {
            if (item.id != productId) return item;

            const price = Number(item.price || 0);
            const total = price * quantity;

            let newPercent = item.discountPercent || 0;
            let newRs = item.discountRs || 0;

            // Recalculate based on dominant type
            if (item.discountType === '%') {
                newRs = (total * newPercent) / 100;
            } else {
                newPercent = total > 0 ? (newRs / total) * 100 : 0;
            }

            return { ...item, quantity, discountRs: newRs, discountPercent: newPercent };
        }));
    };

    const updateDiscount = (productId, { discountType, discountValue }) => {
        setCart(prev => prev.map(item => {
            if (item.id != productId) return item;

            const price = Number(item.price || 0);
            const quantity = Number(item.quantity || 1);
            const total = price * quantity;

            let newPercent = 0;
            let newRs = 0;
            const val = Number(discountValue);

            if (discountType === '%') {
                newPercent = val;
                newRs = total > 0 ? (total * val) / 100 : 0;
            } else {
                newRs = val;
                newPercent = total > 0 ? (val / total) * 100 : 0;
            }

            return {
                ...item,
                discountType,
                discountValue, // Keep for raw input state if needed
                discountPercent: newPercent,
                discountRs: newRs
            };
        }));
    };

    const clearCart = () => {
        setCart([]);
        setCustomer(null);
        setGlobalDiscount({ type: 'rs', value: 0 });
        setAppliedCoupon(null);
        setAppliedCreditNote(null);
        setPointsToRedeem('');
        setPaymentMethod('cash');
        setIsSplitPayment(false);
        setSplitAmounts({ cash: '', card: '', upi: '', pay_later: '' });
    };

    const cartTotal = cart.reduce((sum, item) => sum + ((item.price * item.quantity) - (item.discount || 0)), 0);

    return (
        <CartContext.Provider value={{
            cart, addToCart, removeFromCart, updateQuantity, updateDiscount, clearCart, cartTotal, setCart,
            customer, setCustomer,
            globalDiscount, setGlobalDiscount,
            appliedCoupon, setAppliedCoupon,
            appliedCreditNote, setAppliedCreditNote,
            pointsToRedeem, setPointsToRedeem,
            paymentMethod, setPaymentMethod,
            isSplitPayment, setIsSplitPayment,
            splitAmounts, setSplitAmounts
        }}>
            {children}
        </CartContext.Provider>
    );
};
