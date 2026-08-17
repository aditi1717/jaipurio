import React from 'react';
import { getOrderedItemDisplayName, getVariantDetails } from '../../../../../utils/orderItemDisplay';

const OrderSerialEditorRow = ({
    item,
    itemIndex,
    serialInputs,
    serialTypes,
    setSerialInputs,
    setSerialTypes
}) => {
    const variantDetails = getVariantDetails(item.variant);

    return (
        <div key={item._id || itemIndex} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_180px_minmax(0,1fr)] gap-3 rounded-xl border border-gray-100 p-3">
            <div className="min-w-0">
                <div className="text-sm font-black text-gray-900 line-clamp-2">{getOrderedItemDisplayName(item)}</div>
                <div className="mt-1 text-[11px] font-bold text-gray-400 uppercase">Qty: {item.quantity}</div>
                {variantDetails.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {variantDetails.map((detail) => (
                            <span
                                key={detail}
                                className="rounded-full border border-primary-100 bg-primary-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-primary-700"
                            >
                                {detail}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Type</label>
                <select
                    value={serialTypes[item._id] || item.serialType || 'Serial Number'}
                    onChange={(e) => setSerialTypes((prev) => ({ ...prev, [item._id]: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-indigo-400 focus:bg-white"
                >
                    <option value="Serial Number">Serial Number</option>
                    <option value="IMEI">IMEI</option>
                </select>
            </div>
            <div>
                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Number</label>
                <input
                    type="text"
                    value={serialInputs[item._id] !== undefined ? serialInputs[item._id] : (item.serialNumber || '')}
                    onChange={(e) => setSerialInputs((prev) => ({ ...prev, [item._id]: e.target.value }))}
                    placeholder="Enter serial or IMEI"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-900 outline-none focus:border-indigo-400 focus:bg-white"
                />
            </div>
        </div>
    );
};

export default OrderSerialEditorRow;
