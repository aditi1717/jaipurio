import React from 'react';
import { MdVisibility } from 'react-icons/md';
import { getOrderedItemDisplayName } from '../../../../../utils/orderItemDisplay';

const OrderListRowActions = ({ order, onOpenSerialEditor, serialEditorOrderId, navigate }) => {
    return (
        <div className="flex items-center justify-center gap-2 min-w-[120px]">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/admin/orders/${order.id}`);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary-100 bg-white text-primary-600 shadow-sm transition-all hover:bg-primary-600 hover:text-white hover:border-primary-700"
                title="View Details"
                aria-label={`View order ${order.displayId || order.id}`}
            >
                <MdVisibility size={18} className="shrink-0" />
            </button>
            {order.status !== 'Cancelled' && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenSerialEditor(order);
                    }}
                    className={`px-3 py-2 text-[10px] font-black uppercase rounded-lg border transition-colors ${
                        serialEditorOrderId === order.id
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50'
                    }`}
                >
                    {serialEditorOrderId === order.id ? 'Close' : 'Serial / IMEI'}
                </button>
            )}
        </div>
    );
};

export default OrderListRowActions;
