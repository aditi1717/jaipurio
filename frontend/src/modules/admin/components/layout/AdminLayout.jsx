import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import AdminHeader from './AdminHeader';
import Loader from '../../../../components/common/Loader';

const AdminLayout = () => {
    return (
        <div className="admin-layout flex h-screen bg-gray-50 overflow-hidden">
            <Sidebar />

            {/* min-w-0 lets this column shrink below its content width so <main>'s
                overflow-x-auto actually engages; without it wide pages push past the viewport. */}
            <div className="flex-1 flex flex-col lg:ml-64 min-w-0">
                <AdminHeader />

                <main
                    data-lenis-prevent
                    className="flex-1 overflow-y-auto overflow-x-auto p-2 md:p-4"
                >
                    <Suspense fallback={<Loader message="Loading content..." />}>
                        <Outlet />
                    </Suspense>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
