export const ADMIN_SIDEBAR_OPTIONS = [
    { key: 'dashboard', label: 'Dashboard', path: '/admin/dashboard' },
    { key: 'orders', label: 'Orders', path: '/admin/orders' },
    { key: 'returns', label: 'Returns', path: '/admin/returns' },
    { key: 'replacements', label: 'Replacements', path: '/admin/replacements' },
    { key: 'deliverySlip', label: 'Delivery Slip', path: '/admin/delivery-slip' },
    { key: 'shippingCharges', label: 'Shipping Charges', path: '/admin/shipping-charges' },
    { key: 'pinCodes', label: 'PIN Codes', path: '/admin/pincodes' },
    { key: 'demoBookings', label: 'Demo Bookings', path: '/admin/demo-bookings' },
    { key: 'products', label: 'Products', path: '/admin/products' },
    { key: 'maxSellingQty', label: 'Max Selling Qty', path: '/admin/products/max-selling-quantity' },
    { key: 'productViews', label: 'Product Views', path: '/admin/product-views' },
    { key: 'stockManagement', label: 'Stock Management', path: '/admin/stock' },
    { key: 'categories', label: 'Categories', path: '/admin/categories' },
    { key: 'categoryPageBuilder', label: 'Category Page Builder', path: '/admin/categories/page-builder' },
    { key: 'subcategories', label: 'Subcategories', path: '/admin/subcategories' },
    { key: 'subCategoryPageBuilder', label: 'Subcategory Page Builder', path: '/admin/subcategories/page-builder' },
    { key: 'brands', label: 'Brands', path: '/admin/brands' },
    { key: 'coupons', label: 'Coupons', path: '/admin/coupons' },
    { key: 'bankOffers', label: 'Bank Offers', path: '/admin/bank-offers' },
    { key: 'play', label: 'Play', path: '/admin/play' },
    { key: 'users', label: 'Users', path: '/admin/users' },
    { key: 'sellerRequests', label: 'Seller Requests', path: '/admin/seller-requests' },
    { key: 'reviews', label: 'Reviews', path: '/admin/reviews' },
    { key: 'adminNotifications', label: 'Admin Notifications', path: '/admin/notifications' },
    { key: 'userNotifications', label: 'User Notifications', path: '/admin/user-notifications' },
    { key: 'b2b', label: 'B2B Enquiries', path: '/admin/b2b' },
    { key: 'agentManagement', label: 'Agent Management', path: '/admin/agent-management' },
    { key: 'staticPages', label: 'Static Pages', path: '/admin/pages' },
    { key: 'helpCenterContent', label: 'Help Center Content', path: '/admin/content/help-center' },
    { key: 'homepageFooter', label: 'Homepage Footer', path: '/admin/footer-settings' },
    { key: 'apiCredentials', label: 'API Credentials', path: '/admin/api-credentials' },
    { key: 'storeSettings', label: 'Store Settings', path: '/admin/settings' },
    { key: 'codAdvancedPayment', label: 'COD Advanced Payment', path: '/admin/cod-advanced-payment' },
    { key: 'adminManagement', label: 'Admin Management', path: '/admin/admin-management' }
];

export const ALL_ADMIN_SIDEBAR_KEYS = ADMIN_SIDEBAR_OPTIONS.map((option) => option.key);
export const SUBADMIN_BLOCKED_KEYS = ['adminManagement'];

export const normalizeAdminRole = (role) => {
    if (role === 'subadmin') {
        return 'subadmin';
    }

    return 'superadmin';
};

export const normalizeSidebarPermissions = (role, permissions = []) => {
    const normalizedRole = normalizeAdminRole(role);

    if (normalizedRole === 'superadmin') {
        return ALL_ADMIN_SIDEBAR_KEYS;
    }

    const incomingPermissions = Array.isArray(permissions) ? permissions : [];
    return [
        ...new Set(
            incomingPermissions.filter(
                (permission) =>
                    ALL_ADMIN_SIDEBAR_KEYS.includes(permission) &&
                    !SUBADMIN_BLOCKED_KEYS.includes(permission)
            )
        )
    ];
};
