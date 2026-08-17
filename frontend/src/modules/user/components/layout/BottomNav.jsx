import React from 'react';
import { NavLink } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore';

const BottomNav = () => {
    const totalItems = useCartStore((state) => state.getTotalItems());

    const navItems = [
        { name: 'Home', icon: 'home', path: '/' },
        { name: 'Categories', icon: 'grid_view', path: '/categories' },
        { name: 'Play', icon: 'play_circle', path: '/play' },
        { name: 'Account', icon: 'person_outline', path: '/account' },
        { name: 'Cart', icon: 'shopping_cart', path: '/cart', badge: totalItems },
    ];

    return (
        <footer className="fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-md border-t border-primary-50/50 flex items-center justify-between px-4 py-3 z-50 md:hidden rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
            {navItems.map((item) => (
                <NavLink
                    key={item.name}
                    to={item.path}
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 transition-all duration-300 relative group ${isActive ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
                        }`
                    }
                >
                    {({ isActive }) => (
                        <>
                            <div className={`relative p-1.5 rounded-full transition-all duration-300 ${isActive ? 'bg-primary-50 -translate-y-1' : ''}`}>
                                <span className="material-icons-outlined text-[24px]">
                                    {item.icon}
                                </span>
                                {item.badge > 0 && (
                                    <div className="absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                        {item.badge}
                                    </div>
                                )}
                            </div>
                            <span className={`text-[10px] font-bold transition-all duration-300 ${isActive ? 'scale-105' : 'scale-100'}`}>
                                {item.name}
                            </span>
                            {isActive && (
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-600 rounded-full"></div>
                            )}
                        </>
                    )}
                </NavLink>
            ))}
        </footer>
    );
};

export default BottomNav;
