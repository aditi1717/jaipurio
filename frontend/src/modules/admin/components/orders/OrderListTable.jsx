import React from 'react';
import Pagination from '../../../../components/Pagination';
import AdminTable, { AdminTableHead, AdminTableHeaderCell, AdminTableHeaderRow } from '../common/AdminTable';
import { getVariantDetails } from '../../../../utils/orderItemDisplay';
import OrderListRow from './list/OrderListRow';
import OrderSerialEditorRow from './list/OrderSerialEditorRow';

const getVariantSummary = (items = []) => (
    (Array.isArray(items) ? items : [])
        .slice(0, 2)
        .map((item) => getVariantDetails(item.variant).join(', '))
        .filter(Boolean)
);

const OrderListTable = ({
    orders,
    totalPages,
    currentPage,
    onPageChange,
    isRefreshing,
    allVisibleSelected,
    someVisibleSelected,
    selectedOrderIds,
    onToggleVisibleOrders,
    onToggleOrder,
    getStatusStyle,
    getStatusIcon,
    syncingOrderIds,
    serialEditorOrderId,
    onOpenSerialEditor,
    onResetSerialEditor,
    onSaveSerial,
    serialInputs,
    serialTypes,
    setSerialInputs,
    setSerialTypes,
    serialSavingOrderId,
    navigate,
    isLiveSyncing
}) => (
    <div className="space-y-4">
        {isLiveSyncing && (
            <div className="flex items-center gap-2 rounded-2xl border border-primary-100 bg-primary-50/70 px-4 py-3 text-primary-700">
                <div className="h-4 w-4 rounded-full border-2 border-primary-200 border-t-primary-700 animate-spin" />
                <span className="text-xs font-black uppercase tracking-[0.14em]">Syncing live courier statuses for visible orders</span>
            </div>
        )}
        <div className="relative md:mx-0">
            {isRefreshing && (
                <div className="absolute inset-0 z-30 flex items-start justify-center rounded-2xl bg-white/65 pt-10 backdrop-blur-[1px]">
                    <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
                        <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
                        <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-600">Refreshing orders</span>
                    </div>
                </div>
            )}
            <AdminTable
                shellClassName="md:rounded-2xl border-y md:border"
                scrollClassName="pb-2 custom-scrollbar"
                tableClassName="min-w-[1000px] text-left border-collapse"
            >
                <AdminTableHead>
                    <AdminTableHeaderRow>
                        <AdminTableHeaderCell className="w-10 text-center sticky left-0 z-20 bg-slate-900">
                            <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                ref={(input) => {
                                    if (input) input.indeterminate = !allVisibleSelected && someVisibleSelected;
                                }}
                                onChange={onToggleVisibleOrders}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600 cursor-pointer"
                            />
                        </AdminTableHeaderCell>
                        
                        {/* ACTIONS MOVED TO SECOND COLUMN AND MADE STICKY */}
                        <AdminTableHeaderCell className="w-36 text-center bg-slate-900 sticky left-10 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.1)]">Actions</AdminTableHeaderCell>
                        
                        <AdminTableHeaderCell className="whitespace-nowrap">Order ID & Date</AdminTableHeaderCell>
                        <AdminTableHeaderCell className="whitespace-nowrap">Customer</AdminTableHeaderCell>
                        <AdminTableHeaderCell className="whitespace-nowrap">Items</AdminTableHeaderCell>
                        <AdminTableHeaderCell className="whitespace-nowrap">Variants</AdminTableHeaderCell>
                        <AdminTableHeaderCell className="whitespace-nowrap text-center">Status</AdminTableHeaderCell>
                        <AdminTableHeaderCell className="whitespace-nowrap text-center">Fulfillment</AdminTableHeaderCell>
                        <AdminTableHeaderCell className="whitespace-nowrap text-center">Payment</AdminTableHeaderCell>
                        <AdminTableHeaderCell className="whitespace-nowrap text-right">Amount</AdminTableHeaderCell>
                    </AdminTableHeaderRow>
                </AdminTableHead>
                <tbody className="divide-y divide-gray-200">
                    {orders.map((order, index) => (
                        <React.Fragment key={order.id || `order-${index}`}>
                            <OrderListRow
                                order={order}
                                index={index}
                                selectedOrderIds={selectedOrderIds}
                                onToggleOrder={onToggleOrder}
                                navigate={navigate}
                                getStatusStyle={getStatusStyle}
                                getStatusIcon={getStatusIcon}
                                getVariantSummary={getVariantSummary}
                                syncingOrderIds={syncingOrderIds}
                                onOpenSerialEditor={onOpenSerialEditor}
                                serialEditorOrderId={serialEditorOrderId}
                            />
                            
                            {serialEditorOrderId === order.id && (
                                <tr className="bg-indigo-50/40">
                                    <td colSpan={10} className="px-3 py-4 md:px-6 md:py-5">
                                        <div className="rounded-2xl border border-indigo-100 bg-white p-3 md:p-4 shadow-sm">
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                                                <div>
                                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Update Serial / IMEI</h3>
                                                    <p className="text-xs text-gray-500 font-medium">Save serial details for this order directly from the list page.</p>
                                                </div>
                                                <div className="text-xs font-bold text-gray-500 uppercase">{order.displayId || order.id}</div>
                                            </div>
                                            <div className="space-y-3">
                                                {(order.items || []).map((item, itemIndex) => (
                                                    <OrderSerialEditorRow
                                                        key={item._id || itemIndex}
                                                        item={item}
                                                        itemIndex={itemIndex}
                                                        serialInputs={serialInputs}
                                                        serialTypes={serialTypes}
                                                        setSerialInputs={setSerialInputs}
                                                        setSerialTypes={setSerialTypes}
                                                    />
                                                ))}
                                            </div>
                                            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
                                                <button
                                                    type="button"
                                                    onClick={onResetSerialEditor}
                                                    disabled={serialSavingOrderId === order.id}
                                                    className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-black uppercase hover:bg-gray-50 disabled:opacity-60"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onSaveSerial(order)}
                                                    disabled={serialSavingOrderId === order.id}
                                                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase hover:bg-indigo-700 disabled:bg-indigo-300"
                                                >
                                                    {serialSavingOrderId === order.id ? 'Saving...' : 'Save Serial / IMEI'}
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </AdminTable>

            <Pagination
                page={currentPage}
                pages={totalPages}
                changePage={onPageChange}
            />
        </div>
    </div>
);

export default OrderListTable;
