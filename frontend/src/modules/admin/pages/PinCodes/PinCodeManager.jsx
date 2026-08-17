import React, { useState, useEffect } from 'react';
import { MdLocationOn, MdDelete, MdAdd, MdUpload, MdDownload } from 'react-icons/md';
import usePinCodeStore from '../../store/pinCodeStore';
import API from '../../../../services/api';
import toast from 'react-hot-toast';

const PinCodeManager = () => {
    const {
        pinCodes,
        fetchPinCodes,
        addPinCode,
        deletePinCode,
        bulkImportPinCodes,
        updatePinCode,
        isLoading,
        currentPage,
        totalCount,
        totalPages,
        setCurrentPage
    } = usePinCodeStore();
    const [formData, setFormData] = useState({
        code: '',
        isCOD: true,
        deliveryTime: '3',
        deliveryUnit: 'days'
    });
    const [importResults, setImportResults] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const importSummaryStyles = {
        success: {
            container: 'bg-green-50 border-green-200',
            title: 'text-green-900',
            body: 'text-green-800'
        },
        partial: {
            container: 'bg-amber-50 border-amber-200',
            title: 'text-amber-900',
            body: 'text-amber-800'
        },
        error: {
            container: 'bg-red-50 border-red-200',
            title: 'text-red-900',
            body: 'text-red-800'
        }
    };

    // Toggle COD status for a pincode
    const toggleCOD = async (id, currentStatus) => {
        await updatePinCode(id, { isCOD: !currentStatus });
    };

    useEffect(() => {
        fetchPinCodes();
    }, [fetchPinCodes]);

    const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((page) => (
        page === 1 ||
        page === totalPages ||
        Math.abs(page - currentPage) <= 1
    ));

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = await addPinCode(formData);
        if (success) {
            setFormData({ code: '', isCOD: true, deliveryTime: '3', deliveryUnit: 'days' });
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsImporting(true);
        setImportResults(null);

        const result = await bulkImportPinCodes(file);
        setImportResults(result);
        setIsImporting(false);

        // Reset file input
        e.target.value = '';
    };

    const downloadCurrentPinCodes = async () => {
        try {
            setIsExporting(true);
            const response = await API.get('/pincodes/export', {
                responseType: 'blob'
            });

            const contentDisposition = response.headers['content-disposition'] || '';
            const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
            const fileName = fileNameMatch?.[1] || 'indiakart_pincodes.csv';

            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Current pincode list downloaded');
        } catch (error) {
            console.error(error);
            toast.error('Failed to download current pincodes');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-2 md:space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-2 md:gap-4 mb-2 md:mb-6">
                <div className="p-2 md:p-3 bg-primary-100 text-primary-600 rounded-xl">
                    <MdLocationOn size={28} className="w-5 h-5 md:w-7 md:h-7" />
                </div>
                <div>
                    <h1 className="text-lg md:text-2xl font-bold text-gray-800">Delivery PIN Codes</h1>
                    <p className="text-gray-500 text-sm">Manage serviceable areas and COD availability</p>
                </div>
            </div>

            {/* Add PIN Code Form */}
            <div className="bg-white p-3 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <MdAdd className="text-primary-500" /> Add New Serviceable Area
                </h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 items-end">
                    <div className="space-y-1.5 md:col-span-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">PIN Code</label>
                        <input
                            type="text"
                            name="code"
                            value={formData.code}
                            onChange={handleChange}
                            required
                            placeholder="e.g. 110001"
                            className="w-full px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-500 outline-none font-bold text-gray-700"
                        />
                    </div>
                    <div className="space-y-1.5 md:col-span-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">COD Available</label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                name="isCOD"
                                checked={formData.isCOD}
                                onChange={(e) => setFormData(prev => ({ ...prev, isCOD: e.target.checked }))}
                                className="w-5 h-5 accent-primary-600 rounded"
                            />
                            <span className="text-sm font-bold text-gray-700">{formData.isCOD ? 'Yes' : 'No'}</span>
                        </label>
                    </div>
                    <div className="space-y-1.5 md:col-span-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Delivery Time</label>
                        <input
                            type="number"
                            min="1"
                            name="deliveryTime"
                            value={formData.deliveryTime}
                            onChange={handleChange}
                            required
                            className="w-full px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-500 outline-none font-bold text-gray-700"
                        />
                    </div>
                    <div className="space-y-1.5 md:col-span-1">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Delivery Unit</label>
                        <select
                            name="deliveryUnit"
                            value={formData.deliveryUnit}
                            onChange={handleChange}
                            className="w-full px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-500 outline-none font-bold text-gray-700"
                        >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                        </select>
                    </div>
                    <div className="md:col-span-2 mt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2 md:py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition shadow-lg shadow-primary-200 disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Adding...' : 'Add PIN Code'}
                        </button>
                    </div>
                </form>

                {/* Import Results */}
                {importResults && (
                    <div className={`mt-4 p-4 border rounded-xl ${importSummaryStyles[importResults.status || 'success'].container}`}>
                        <h3 className={`font-bold mb-2 ${importSummaryStyles[importResults.status || 'success'].title}`}>
                            {importResults.status === 'success' && 'Import completed successfully'}
                            {importResults.status === 'partial' && 'Import completed with some issues'}
                            {importResults.status === 'error' && 'Import failed'}
                        </h3>
                        <p className={`text-sm mb-3 ${importSummaryStyles[importResults.status || 'success'].body}`}>
                            {importResults.message}
                        </p>
                        <div className="text-sm space-y-1">
                            <p className="text-gray-700"><span className="font-bold">Total Rows:</span> {importResults.total}</p>
                            <p className="text-green-700"><span className="font-bold">Added:</span> {importResults.successful}</p>
                            <p className="text-primary-700"><span className="font-bold">Updated:</span> {importResults.updated || 0}</p>
                            <p className="text-yellow-700"><span className="font-bold">Skipped:</span> {importResults.skipped}</p>
                            <p className="text-red-700"><span className="font-bold">Errors:</span> {importResults.errors?.length || 0}</p>
                            {importResults.meta?.fileName && (
                                <p className="text-gray-700"><span className="font-bold">File:</span> {importResults.meta.fileName}</p>
                            )}
                            {importResults.errors && importResults.errors.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-red-700 font-bold">Row Details:</p>
                                    <ul className="list-disc list-inside text-red-600 text-xs max-h-40 overflow-y-auto">
                                        {importResults.errors.map((err, idx) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Import Section */}
            <div className="bg-gradient-to-r from-purple-50 to-primary-50 p-3 md:p-6 rounded-2xl shadow-sm border border-purple-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <MdUpload className="text-purple-500" /> Bulk Import from Excel
                </h2>
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div className="flex-1">
                        <p className="text-sm text-gray-600 mb-2">Upload an Excel/CSV file (.xlsx, .csv) with columns: <span className="font-mono font-bold">Pincode, isCOD, deliveryTime, deliveryUnit</span></p>
                        <label className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition shadow-lg shadow-purple-200 cursor-pointer">
                            <MdUpload size={20} />
                            {isImporting ? 'Importing...' : 'Choose Excel File'}
                            <input
                                type="file"
                                accept=".xlsx,.csv"
                                onChange={handleFileUpload}
                                disabled={isImporting}
                                className="hidden"
                            />
                        </label>
                        <p className="text-xs text-gray-500 mt-2">Supported formats: `.xlsx`, `.csv`. Large files and duplicate rows are handled automatically.</p>
                    </div>
                    <button
                        onClick={downloadCurrentPinCodes}
                        disabled={isExporting}
                        className="px-4 py-2.5 bg-white text-purple-600 border border-purple-300 font-bold rounded-xl hover:bg-purple-50 transition flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <MdDownload size={18} />
                        {isExporting ? 'Downloading...' : 'Download Current CSV'}
                    </button>
                </div>
            </div>

            {/* List of PIN Codes */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-2 md:p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">Serviceable Locations ({totalCount})</h3>
                    <span className="text-xs md:text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
                </div>

                {pinCodes.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <MdLocationOn className="mx-auto mb-3 opacity-20" size={48} />
                        <p>No PIN codes added yet.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {pinCodes.map((pin) => (
                            <div key={pin._id} className="p-2 md:p-4 flex items-center justify-between hover:bg-primary-50/30 transition-colors group">
                                <div className="flex items-center gap-2 md:gap-6">
                                    <span className="text-sm md:text-lg font-black text-gray-800 font-mono tracking-wider">{pin.code}</span>
                                    <button
                                        onClick={() => toggleCOD(pin._id, pin.isCOD !== false)}
                                        className={`flex items-center gap-1.5 px-2 py-1 md:px-3 md:py-1.5 rounded-full transition-all border shadow-sm active:scale-95 ${pin.isCOD !== false ? 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700' : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'}`}
                                        title="Click to Toggle COD"
                                    >
                                        <span className="material-icons text-[14px]">{pin.isCOD !== false ? 'payments' : 'money_off'}</span>
                                        <span className="text-xs font-bold">{pin.isCOD !== false ? 'COD ON' : 'COD OFF'}</span>
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            value={pin.deliveryTime || 3}
                                            onChange={(e) => updatePinCode(pin._id, { deliveryTime: e.target.value })}
                                            className="w-16 px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 focus:border-primary-500 outline-none text-sm font-bold text-gray-700"
                                        />
                                        <select
                                            value={pin.deliveryUnit || 'days'}
                                            onChange={(e) => updatePinCode(pin._id, { deliveryUnit: e.target.value })}
                                            className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 focus:border-primary-500 outline-none text-sm font-bold text-gray-700"
                                        >
                                            <option value="minutes">Minutes</option>
                                            <option value="hours">Hours</option>
                                            <option value="days">Days</option>
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onClick={() => deletePinCode(pin._id)}
                                    className="p-1 md:p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Remove PIN Code"
                                >
                                    <MdDelete size={20} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-3 py-4 md:px-4 border-t border-gray-100 bg-gray-50">
                        <p className="text-sm text-gray-500">
                            Showing page {currentPage} of {totalPages}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(currentPage - 1)}
                                disabled={currentPage === 1 || isLoading}
                                className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary-300 hover:text-primary-600"
                            >
                                Previous
                            </button>
                            {visiblePages.map((page, index) => {
                                const previousPage = visiblePages[index - 1];
                                const showGap = previousPage && page - previousPage > 1;

                                return (
                                    <React.Fragment key={page}>
                                        {showGap && <span className="px-1 text-gray-400">...</span>}
                                        <button
                                            onClick={() => setCurrentPage(page)}
                                            disabled={isLoading}
                                            className={`min-w-10 px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                                                page === currentPage
                                                    ? 'bg-primary-600 text-white border-primary-600'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                            <button
                                onClick={() => setCurrentPage(currentPage + 1)}
                                disabled={currentPage === totalPages || isLoading}
                                className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary-300 hover:text-primary-600"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PinCodeManager;
