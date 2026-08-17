import React from 'react';
import { MdFilterList, MdSearch } from 'react-icons/md';
import { DATE_RANGE_PRESETS } from './orderDateRange';

const selectClass = 'px-4 py-2 md:px-5 md:py-3 bg-gray-50 border border-transparent rounded-xl md:rounded-2xl outline-none focus:bg-white focus:border-primary-500 text-sm font-bold text-gray-900 appearance-none shadow-sm cursor-pointer';

const OrderListFilters = ({
    searchTerm,
    statusFilter,
    dateRange = 'all',
    customStart = '',
    customEnd = '',
    onSearchChange,
    onStatusChange,
    onDateRangeChange,
    onCustomRangeChange
}) => (
    <div className="bg-white p-3 md:p-4 rounded-xl md:rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3 md:gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
            <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
                type="text"
                placeholder="Search by Order ID, Customer, or Product Name..."
                className="w-full pl-12 pr-4 py-2 bg-gray-50 border border-transparent rounded-xl md:rounded-2xl focus:bg-white focus:border-primary-500 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-400 caret-primary-600 shadow-inner"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
            />
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full md:w-auto">
            <MdFilterList className="text-gray-400" size={20} />
            <select
                className={`${selectClass} min-w-[150px]`}
                value={statusFilter}
                onChange={(e) => onStatusChange(e.target.value)}
            >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Packed">Packed</option>
                <option value="Manifested">Manifested</option>
                <option value="Not Picked">Not Picked</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Dispatched">Dispatched</option>
                <option value="In Transit">In Transit</option>
                <option value="Out for Delivery">Out for Delivery</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
            </select>
            <select
                className={`${selectClass} min-w-[140px]`}
                value={dateRange}
                onChange={(e) => onDateRangeChange(e.target.value)}
            >
                {DATE_RANGE_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                ))}
            </select>
            {dateRange === 'custom' && (
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={customStart}
                        max={customEnd || undefined}
                        onChange={(e) => onCustomRangeChange(e.target.value, customEnd)}
                        className={selectClass}
                    />
                    <span className="text-xs font-black text-gray-400">to</span>
                    <input
                        type="date"
                        value={customEnd}
                        min={customStart || undefined}
                        onChange={(e) => onCustomRangeChange(customStart, e.target.value)}
                        className={selectClass}
                    />
                </div>
            )}
        </div>
    </div>
);

export default OrderListFilters;
