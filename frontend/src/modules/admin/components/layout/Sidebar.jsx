import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { MdMenu, MdClose } from 'react-icons/md';
import useAdminAuthStore from '../../store/adminAuthStore';
import useNewOrderStore from '../../store/newOrderStore';
import { ADMIN_MENU_GROUPS, hasAdminPermission } from '../../constants/adminPermissions';

const logo = '/logo.png';

const Sidebar = () => {
    const [isOpen, setIsOpen] = useState(true);
    const adminUser = useAdminAuthStore((state) => state.adminUser);
    const newOrderCount = useNewOrderStore((state) => state.count);
    const startPolling = useNewOrderStore((state) => state.startPolling);
    const stopPolling = useNewOrderStore((state) => state.stopPolling);

    useEffect(() => {
        if (!adminUser) return undefined;
        startPolling();
        return stopPolling;
    }, [adminUser, startPolling, stopPolling]);

    const menuGroups = ADMIN_MENU_GROUPS
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => hasAdminPermission(adminUser, item.key))
        }))
        .filter((group) => group.items.length > 0);

    return (
        <>
            {/* Mobile Toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden fixed top-3 left-4 z-50 p-2 text-white bg-transparent rounded-lg"
            >
                {isOpen ? <MdClose size={28} /> : <MdMenu size={28} />}
            </button>

            {/* Sidebar */}
            <aside
                className={`fixed left-0 top-0 h-full bg-gradient-to-b from-gray-900 to-gray-800 text-white transition-all duration-300 z-40 ${isOpen ? 'w-64' : 'w-0 lg:w-20'
                    } flex flex-col overflow-hidden shadow-2xl`}
            >
                {/* Logo */}
                <div className="h-20 flex items-center px-3 border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-sm overflow-hidden">
                    <div className="flex items-center gap-2 pl-12 lg:pl-0">
                        <img
                            src={logo}
                            alt="Logo"
                            className={`w-16 h-16 object-contain transition-all duration-500 ease-in-out ${!isOpen && 'lg:scale-125 lg:translate-x-1'}`}
                        />
                        <div className={`transition-all duration-300 delay-100 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none w-0'}`}>
                            <h1 className="font-black text-xl tracking-tighter leading-none bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent italic">
                                JAIPUR<span className="text-primary-500 not-italic">IO</span>
                            </h1>
                            <p className="text-[10px] font-black text-primary-500 tracking-[0.2em] uppercase mt-1">Admin Central</p>
                        </div>
                    </div>
                </div>

                {/* Menu Items */}
                <nav
                    data-lenis-prevent
                    className="mt-4 px-2 flex-1 overflow-y-auto custom-scrollbar pb-10"
                >
                    {menuGroups.map((group) => (
                        <div key={group.title} className="mb-5">
                            <div className={`px-4 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500 ${isOpen ? 'block' : 'hidden lg:hidden'}`}>
                                {group.title}
                            </div>
                            <div>
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const badge = item.key === 'orders' ? newOrderCount : 0;
                                    return (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            end={['/admin/categories', '/admin/products', '/admin/subcategories'].includes(item.path)}
                                            className={({ isActive }) =>
                                                `flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${isActive
                                                    ? 'bg-primary-600 text-white'
                                                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                                }`
                                            }
                                        >
                                            <span className="relative shrink-0">
                                                <Icon size={22} />
                                                {/* Collapsed rail has no room for the label, so show a dot there. */}
                                                {badge > 0 && !isOpen && (
                                                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-gray-900" />
                                                )}
                                            </span>
                                            <span className={`${isOpen ? 'block' : 'hidden lg:hidden'}`}>
                                                {item.name}
                                            </span>
                                            {badge > 0 && isOpen && (
                                                <span className="ml-auto min-w-[20px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[11px] font-black leading-none text-white">
                                                    {badge > 99 ? '99+' : badge}
                                                </span>
                                            )}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
};

export default Sidebar;
