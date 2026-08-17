import React from 'react';
import { getOrderedItemDisplayName } from '../../../../../utils/orderItemDisplay';
import { getAdminPaymentStatusClass } from '../../../utils/paymentStatus';
import OrderListRowActions from './OrderListRowActions';

const formatDeliveredAt = (value) => {
    if (!value) return '';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';

    return parsed.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const OrderListRow = ({
    order,
    index,
    selectedOrderIds,
    onToggleOrder,
    navigate,
    getStatusStyle,
    getStatusIcon,
    getVariantSummary,
    syncingOrderIds,
    onOpenSerialEditor,
    serialEditorOrderId
}) => {
    const isSyncingLiveStatus = syncingOrderIds?.has(order.id);
    const fulfillmentMode = String(order.fulfillment?.mode || 'unassigned').trim().toLowerCase();
    const trackingId = order.delhivery?.waybill || order.ekart?.trackingNumber || '';
    const isCourierDelivered = ['ekart', 'delhivery'].includes(fulfillmentMode)
        && order.status === 'Delivered'
        && Boolean(order.deliveredAt);
    const deliveredAtLabel = formatDeliveredAt(order.deliveredAt);

    return (
        <tr className="hover:bg-primary-50/10 transition-colors group">
            {/* Checkbox */}
            {/* Checkbox - STICKY */}
            <td className="px-2 py-2 text-center align-middle sticky left-0 z-10 bg-white border-r border-gray-50">
                <input
                    type="checkbox"
                    checked={selectedOrderIds.has(order.id)}
                    onChange={() => onToggleOrder(order.id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 cursor-pointer"
                />
            </td>

            {/* ACTIONS - STICKY LEFT-10 */}
            <td className="px-2 py-2 align-middle bg-gray-50 sticky left-10 z-10 group-hover:bg-primary-50 border-r border-gray-100 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                <OrderListRowActions
                    order={order}
                    onOpenSerialEditor={onOpenSerialEditor}
                    serialEditorOrderId={serialEditorOrderId}
                    navigate={navigate}
                />
            </td>

            {/* Order ID */}
            <td className="px-4 py-3 align-middle">
                <div className="flex flex-col">
                    <span className="text-xs font-black text-gray-900 group-hover:text-primary-600 transition-colors">
                        {order.displayId || order.id}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                        {new Date(order.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                </div>
            </td>

            {/* Customer */}
            <td className="px-4 py-3 align-middle">
                <div className="flex flex-col max-w-[120px]">
                    {order.user?._id || order.user?.id ? (
                        <button
                            type="button"
                            onClick={() => navigate(`/admin/users/${order.user?._id || order.user?.id}`)}
                            className="text-xs font-bold text-primary-700 hover:text-primary-800 hover:underline transition-colors text-left truncate"
                        >
                            {order.user?.name || order.shippingAddress?.name || 'Unknown'}
                        </button>
                    ) : (
                        <span className="text-xs font-bold text-gray-800 truncate">
                            {order.user?.name || order.shippingAddress?.name || 'Unknown'}
                        </span>
                    )}
                </div>
            </td>

            {/* Items */}
            <td className="px-3 py-3 align-middle max-w-[220px]">
                <div className="flex flex-col gap-1.5">
                    {(order.items || []).slice(0, 2).map((item, idx) => {
                        const name = getOrderedItemDisplayName(item);
                        return (
                            <div key={item._id || idx} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white/50 px-2 py-1">
                                <img src={item.image} alt={name} className="h-7 w-7 rounded object-cover flex-shrink-0" />
                                <div className="text-[10px] font-bold text-gray-700 line-clamp-1 flex-1">{name}</div>
                            </div>
                        );
                    })}
                </div>
            </td>

            {/* Variants */}
            <td className="px-3 py-3 align-middle max-w-[150px]">
                <div className="flex flex-wrap gap-1">
                    {getVariantSummary(order.items).map((summary, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded border border-primary-50 bg-primary-50/50 text-[9px] font-bold text-primary-600 truncate">
                            {summary}
                        </span>
                    ))}
                </div>
            </td>

            {/* Status */}
            <td className="px-3 py-3 text-center align-middle">
                <div className="flex flex-col items-center gap-1">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-tight shadow-sm ${getStatusStyle(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status}
                    </span>
                    {isCourierDelivered && deliveredAtLabel && (
                        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 px-3 py-2 text-left shadow-sm">
                            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-emerald-700">
                                Delivered On
                            </p>
                            <p className="mt-1 text-[11px] font-black leading-tight text-gray-900">
                                {deliveredAtLabel}
                            </p>
                        </div>
                    )}
                    {isSyncingLiveStatus && (
                        <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.12em] text-primary-600">
                            <span className="h-2.5 w-2.5 rounded-full border border-primary-200 border-t-primary-600 animate-spin" />
                            Syncing
                        </span>
                    )}
                </div>
            </td>

            {/* Fulfillment */}
            <td className="px-3 py-3 text-center align-middle">
                <div className="flex flex-col items-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider ${
                        fulfillmentMode === 'manual'
                            ? 'bg-amber-50 text-amber-700 border-amber-100'
                            : fulfillmentMode === 'ekart'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                : fulfillmentMode === 'delhivery'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-gray-50 text-gray-500 border-gray-150'
                    }`}>
                        {fulfillmentMode || 'unassigned'}
                    </span>
                    {trackingId && (
                        <div className="mt-1 flex flex-col items-center gap-1">
                            <span className="text-[8px] font-mono text-gray-500 select-all hover:text-primary-600 transition-colors">
                                {trackingId}
                            </span>
                            {isCourierDelivered && (
                                <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-white">
                                    Proof of delivery synced
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </td>

            {/* Payment */}
            <td className="px-3 py-3 text-center align-middle">
                <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase">{order.payment?.method || 'N/A'}</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase mt-0.5 ${getAdminPaymentStatusClass(order.payment?.status || 'Pending')}`}>
                        {order.payment?.status || 'Pending'}
                    </span>
                </div>
            </td>

            {/* Amount */}
            <td className="px-4 py-3 text-right align-middle">
                <div className="flex flex-col items-end">
                    <span className="text-xs font-black text-gray-900">Rs.{order.total?.toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-gray-400">{(order.items || []).length} items</span>
                </div>
            </td>
        </tr>
    );
};

export default OrderListRow;
