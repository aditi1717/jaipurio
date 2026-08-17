import React from 'react';
import { useParams } from 'react-router-dom';

const DelhiveryRedirect = () => {
    const { waybill, trackingId } = useParams();
    const safeWaybill = String(waybill || trackingId || '').trim();
    const targetUrl = safeWaybill
        ? `https://www.delhivery.com/tracking?waybill=${encodeURIComponent(safeWaybill)}`
        : 'https://www.delhivery.com/tracking';

    React.useEffect(() => {
        window.location.replace(targetUrl);
    }, [targetUrl]);

    return (
        <div className="min-h-screen bg-white flex items-center justify-center px-6">
            <div className="max-w-md text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Redirecting</p>
                <h1 className="mt-3 text-2xl font-black text-gray-900">Opening Delhivery tracking</h1>
                <p className="mt-3 text-sm text-gray-600">
                    If the redirect does not happen automatically, use the link below.
                </p>
                <a
                    href={targetUrl}
                    className="mt-6 inline-flex rounded-xl bg-primary-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white"
                >
                    Open Delhivery
                </a>
            </div>
        </div>
    );
};

export default DelhiveryRedirect;
