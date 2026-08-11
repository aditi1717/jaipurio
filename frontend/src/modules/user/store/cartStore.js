import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import API from '../../../services/api';

const isSameItem = (item, product, variant = product?.variant || {}) => (
    item.id === product.id &&
    JSON.stringify(item.variant || {}) === JSON.stringify(variant || {})
);

const getItemPurchaseLimit = (item) => {
    const maxAllowedQuantity = Number(item?.maxAllowedQuantity);
    if (Number.isFinite(maxAllowedQuantity) && maxAllowedQuantity > 0) {
        return Math.floor(maxAllowedQuantity);
    }

    const configuredLimit = Number(item?.maxOrderQuantity);
    const stockLimit = Number(item?.stock);

    if (Number.isFinite(configuredLimit) && configuredLimit > 0 && Number.isFinite(stockLimit) && stockLimit > 0) {
        return Math.min(Math.floor(configuredLimit), Math.floor(stockLimit));
    }

    if (Number.isFinite(configuredLimit) && configuredLimit > 0) {
        return Math.floor(configuredLimit);
    }
    return Number.isFinite(stockLimit) && stockLimit > 0 ? 1 : 0;
};

const clampQuantity = (item, quantity) => {
    const nextQuantity = Math.max(1, Number(quantity) || 1);
    return Math.min(nextQuantity, getItemPurchaseLimit(item));
};

export const useCartStore = create()(
    persist(
        (set, get) => ({
            cart: [],
            wishlist: [],
            savedForLater: [],
            orders: [],
            addresses: [],
            language: 'English',
            userProfile: null,
            appliedCoupon: null, // { code, discount, type }

            applyCoupon: (coupon) => set({ appliedCoupon: coupon }),
            removeCoupon: () => set({ appliedCoupon: null }),

            updateUserProfile: (profile) => set((state) => ({
                userProfile: { ...state.userProfile, ...profile }
            })),

            addToCart: (product, variant = {}) => {
                set((state) => {
                    const cartItem = { ...product, variant };
                    const existingItem = state.cart.find((item) =>
                        item.id === product.id &&
                        JSON.stringify(item.variant) === JSON.stringify(variant)
                    );

                    if (existingItem) {
                        return {
                            cart: state.cart.map((item) =>
                                item === existingItem
                                    ? { ...item, quantity: clampQuantity(item, item.quantity + 1) }
                                    : item
                            ),
                        };
                    }
                    return { cart: [...state.cart, { ...cartItem, quantity: clampQuantity(cartItem, 1) }] };
                });
            },

            /**
             * Cart items are a snapshot of the product taken when it was added,
             * and the cart is persisted to localStorage. Without this refresh an
             * admin changing "max selling quantity" never reaches carts that
             * already hold the item, so the old limit applies indefinitely.
             * Re-reads the live limit and stock, then re-clamps quantities.
             *
             * b2bEnabled is refreshed for the same reason: checkout decides B2B
             * eligibility from the cart item, so a snapshot taken before the flag
             * existed on the listing payload would never qualify.
             */
            refreshCartLimits: async () => {
                const items = get().cart;
                const ids = [...new Set(items.map((item) => item?.id).filter(Boolean))];
                if (!ids.length) return;

                let live = [];
                try {
                    const { data } = await API.get('/products', {
                        params: { ids: ids.join(','), lite: true }
                    });
                    live = Array.isArray(data) ? data : (data?.products || []);
                } catch {
                    return; // Offline or failed: keep whatever limits we have.
                }

                const byId = new Map(live.map((product) => [String(product.id), product]));

                set((state) => ({
                    cart: state.cart.map((item) => {
                        const product = byId.get(String(item?.id));
                        if (!product) return item;

                        // For a variant item the SKU's own stock is the real cap.
                        let stock = Number(product.stock) || 0;
                        const variant = item.variant || {};
                        if (Object.keys(variant).length && Array.isArray(product.skus)) {
                            const sku = product.skus.find((candidate) => {
                                const combination = candidate?.combination || {};
                                const keys = Object.keys(variant);
                                return keys.length === Object.keys(combination).length
                                    && keys.every((key) => String(variant[key]) === String(combination[key]));
                            });
                            if (sku) stock = Number(sku.stock) || 0;
                        }

                        const refreshed = {
                            ...item,
                            maxOrderQuantity: product.maxOrderQuantity,
                            b2bEnabled: Boolean(product.b2bEnabled),
                            stock,
                            // Drop the stale precomputed cap so it is derived again.
                            maxAllowedQuantity: undefined
                        };

                        return { ...refreshed, quantity: clampQuantity(refreshed, item.quantity) };
                    })
                }));
            },

            removeFromCart: (productId, variant = {}) => {
                set((state) => ({
                    cart: state.cart.filter((item) => !(
                        item.id === productId &&
                        JSON.stringify(item.variant) === JSON.stringify(variant)
                    )),
                }));
            },

            updateQuantity: (productId, quantity, variant = {}) => {
                set((state) => ({
                    cart: state.cart.map((item) =>
                        (item.id === productId &&
                            JSON.stringify(item.variant) === JSON.stringify(variant))
                            ? { ...item, quantity: clampQuantity(item, quantity) } : item
                    ),
                }));
            },

            toggleWishlist: (product) => {
                set((state) => {
                    const exists = state.wishlist.find(item => item.id === product.id);
                    if (exists) {
                        return { wishlist: state.wishlist.filter(item => item.id !== product.id) };
                    }
                    return { wishlist: [...state.wishlist, product] };
                });
            },

            moveToSavedForLater: (product) => {
                set((state) => {
                    const existingSavedItem = state.savedForLater.find((item) => isSameItem(item, product));

                    if (existingSavedItem) {
                        return {
                            savedForLater: state.savedForLater.filter((item) => !isSameItem(item, product))
                        };
                    }

                    return {
                        cart: state.cart.filter((item) => !isSameItem(item, product)),
                        savedForLater: [...state.savedForLater, product]
                    };
                });
            },

            moveToCart: (product) => {
                set((state) => {
                    const isInSaved = state.savedForLater.find((item) => isSameItem(item, product));
                    if (isInSaved) {
                        const existingCartItem = state.cart.find((item) => isSameItem(item, product));

                        return {
                            savedForLater: state.savedForLater.filter((item) => !isSameItem(item, product)),
                            cart: existingCartItem
                                ? state.cart.map((item) =>
                                    isSameItem(item, product)
                                        ? { ...item, quantity: clampQuantity(item, item.quantity + 1) }
                                        : item
                                )
                                : [...state.cart, { ...product, quantity: clampQuantity(product, 1) }]
                        };
                    }
                    const isInWishlist = state.wishlist.find(item => item.id === product.id);
                    if (isInWishlist) {
                        return {
                            wishlist: state.wishlist.filter(item => item.id !== product.id),
                            cart: [...state.cart, { ...product, quantity: clampQuantity(product, 1) }]
                        };
                    }
                    return state;
                });
            },

            removeFromSavedForLater: (productId, variant = {}) => {
                set((state) => ({
                    savedForLater: state.savedForLater.filter((item) => !(
                        item.id === productId &&
                        JSON.stringify(item.variant || {}) === JSON.stringify(variant || {})
                    ))
                }));
            },

            setAddresses: (addresses = []) => {
                set({
                    addresses: (Array.isArray(addresses) ? addresses : []).map((address) => ({
                        ...address,
                        id: address.id || address._id || Date.now()
                    }))
                });
            },

            addAddress: (address) => {
                set((state) => ({
                    addresses: [...state.addresses, { ...address, id: address.id || address._id || Date.now() }]
                }));
            },

            updateAddress: (id, updatedAddress) => {
                set((state) => ({
                    addresses: state.addresses.map(addr => String(addr.id) === String(id) ? { ...addr, ...updatedAddress, id: addr.id } : addr)
                }));
            },

            removeAddress: (id) => {
                set((state) => ({
                    addresses: state.addresses.filter(addr => String(addr.id) !== String(id))
                }));
            },

            placeOrder: (order, shouldClearCart = true) => {
                const normalizedOrder = {
                    id: order._id || order.id,
                    _id: order._id || order.id,
                    date: order.createdAt || order.date,
                    createdAt: order.createdAt || order.date,
                    updatedAt: order.updatedAt || order.createdAt || order.date,
                    displayId: order.displayId || '',
                    totalPrice: Number(order.totalPrice || order.total || 0),
                    itemsPrice: Number(order.itemsPrice || 0),
                    shippingPrice: Number(order.shippingPrice || 0),
                    taxPrice: Number(order.taxPrice || 0),
                    isPaid: Boolean(order.isPaid),
                    paymentMethod: order.paymentMethod || '',
                    status: order.status || 'PLACED',
                    items: (order.orderItems || order.items || []).map(item => ({
                        id: item.product || item.id, // product is the number ID
                        _id: item._id,
                        product: item.product || item.id,
                        name: item.name,
                        image: item.image,
                        price: Number(item.price || 0),
                        qty: Number(item.qty || item.quantity || 1),
                        quantity: Number(item.qty || item.quantity || 1),
                        variant: item.variant,
                        status: item.status || order.status || 'PLACED'
                    })),
                    orderItems: (order.orderItems || order.items || []).map(item => ({
                        _id: item._id,
                        product: item.product || item.id,
                        name: item.name,
                        image: item.image,
                        price: Number(item.price || 0),
                        qty: Number(item.qty || item.quantity || 1),
                        quantity: Number(item.qty || item.quantity || 1),
                        variant: item.variant,
                        status: item.status || order.status || 'PLACED'
                    }))
                };
                set((state) => ({
                    orders: [normalizedOrder, ...state.orders].slice(0, 10),
                    cart: shouldClearCart ? [] : state.cart
                }));
            },

            updateItemStatus: (orderId, productId, newStatus) => {
                const statusMap = {
                    'RETURN_REQUESTED': 'Return Requested',
                    'RETURN_PICKED_UP': 'Item Picked Up',
                    'REFUND_PROCESSED': 'Refund Processed',
                    'REPLACEMENT_REQUESTED': 'Replacement Requested',
                    'REPLACEMENT_PICKED_UP': 'Item Picked Up',
                    'REPLACEMENT_SHIPPED': 'Replacement Shipped',
                    'REPLACEMENT_DELIVERED': 'Replacement Delivered'
                };

                set((state) => ({
                    orders: state.orders.map(order =>
                        order.id === orderId ? {
                            ...order,
                            items: order.items.map(item =>
                                item.id === productId ? {
                                    ...item,
                                    status: newStatus,
                                    trackingHistory: [
                                        ...(item.trackingHistory || []),
                                        {
                                            status: newStatus,
                                            title: statusMap[newStatus] || newStatus,
                                            time: new Date().toISOString()
                                        }
                                    ]
                                } : item
                            )
                        } : order
                    )
                }));
            },

            updateOrderStatus: (orderId, newStatus) => {
                const statusMap = {
                    'PLACED': 'Order Placed',
                    'PACKED': 'Packed',
                    'SHIPPED': 'Shipped',
                    'OUT_FOR_DELIVERY': 'Out for Delivery',
                    'DELIVERED': 'Delivered',
                    'CANCELLED': 'Cancelled'
                };

                set((state) => ({
                    orders: state.orders.map(order =>
                        order.id === orderId ? {
                            ...order,
                            status: newStatus,
                            items: order.items.map(item =>
                                (!item.status || item.status === order.status || ['PLACED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(item.status))
                                    ? { ...item, status: newStatus }
                                    : item
                            ),
                            tracking: [
                                ...(order.tracking || []),
                                {
                                    status: newStatus,
                                    title: statusMap[newStatus] || newStatus,
                                    time: new Date().toISOString(),
                                    completed: true,
                                    current: true
                                }
                            ].map(t => ({ ...t, current: t.status === newStatus }))
                        } : order
                    )
                }));
            },

            setLanguage: (language) => set({ language }),

            startSimulation: (orderId) => {
                const orderStatuses = ['PLACED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
                const returnStatuses = ['RETURN_REQUESTED', 'RETURN_PICKED_UP', 'REFUND_PROCESSED'];
                const replacementStatuses = ['REPLACEMENT_REQUESTED', 'REPLACEMENT_PICKED_UP', 'REPLACEMENT_SHIPPED', 'REPLACEMENT_DELIVERED'];

                const interval = setInterval(() => {
                    const state = get();
                    const order = state.orders.find(o => o.id === orderId);

                    if (!order || order.status === 'CANCELLED') {
                        clearInterval(interval);
                        return;
                    }

                    // Order Level Simulation
                    if (order.status !== 'DELIVERED' && !order.status.startsWith('RETURN')) {
                        const currentIdx = orderStatuses.indexOf(order.status);
                        if (currentIdx !== -1 && currentIdx < orderStatuses.length - 1) {
                            state.updateOrderStatus(orderId, orderStatuses[currentIdx + 1]);
                            return; // Wait for next tick
                        }
                    }

                    // Item Level Simulation (for returns/replacements)
                    let itemsUpdated = false;
                    order.items.forEach(item => {
                        if (item.status && item.status.startsWith('RETURN')) {
                            const currentIdx = returnStatuses.indexOf(item.status);
                            if (currentIdx !== -1 && currentIdx < returnStatuses.length - 1) {
                                state.updateItemStatus(orderId, item.id, returnStatuses[currentIdx + 1]);
                                itemsUpdated = true;
                            }
                        } else if (item.status && item.status.startsWith('REPLACEMENT')) {
                            const currentIdx = replacementStatuses.indexOf(item.status);
                            if (currentIdx !== -1 && currentIdx < replacementStatuses.length - 1) {
                                state.updateItemStatus(orderId, item.id, replacementStatuses[currentIdx + 1]);
                                itemsUpdated = true;
                            }
                        }
                    });

                    // If order reached DELIVERED and no return/replacement items are being updated, clear interval
                    if (order.status === 'DELIVERED' && !itemsUpdated) {
                        // Check if any items are still in a transition state
                        const anyActiveItems = order.items.some(item =>
                            (item.status && item.status.startsWith('RETURN') && item.status !== 'REFUND_PROCESSED') ||
                            (item.status && item.status.startsWith('REPLACEMENT') && item.status !== 'DELIVERED')
                        );

                        if (!anyActiveItems) {
                            clearInterval(interval);
                        }
                    }
                }, 5000);
            },

            clearCart: () => set({ cart: [] }),
            getTotalItems: () => {
                const { cart } = get();
                return cart.reduce((total, item) => total + item.quantity, 0);
            },
            getTotalPrice: () => {
                const { cart } = get();
                return cart.reduce((total, item) => total + item.price * item.quantity, 0);
            },
            getTotalOriginalPrice: () => {
                const { cart } = get();
                return cart.reduce((total, item) => total + (item.originalPrice || item.price) * item.quantity, 0);
            },
            getTotalSavings: () => {
                const { cart } = get();
                const original = cart.reduce((total, item) => total + (item.originalPrice || item.price) * item.quantity, 0);
                const current = cart.reduce((total, item) => total + item.price * item.quantity, 0);
                return original - current;
            },

            clearStore: () => set({
                cart: [],
                wishlist: [],
                savedForLater: [],
                orders: [],
                addresses: [],
                appliedCoupon: null,
                userProfile: null
            })
        }),
        {
            name: 'cart-storage',
            version: 3,
            partialize: (state) => ({
                cart: state.cart,
                wishlist: state.wishlist,
                savedForLater: state.savedForLater,
                addresses: state.addresses,
                language: state.language,
                userProfile: state.userProfile,
                appliedCoupon: state.appliedCoupon
            }),
            migrate: (persistedState, version) => {
                if (!persistedState) {
                    return persistedState;
                }

                if (version < 2) {
                    return {
                        ...persistedState,
                        savedForLater: []
                    };
                }

                 if (version < 3) {
                    return {
                        ...persistedState,
                        orders: []
                    };
                }

                return persistedState;
            }
        }
    )
);
