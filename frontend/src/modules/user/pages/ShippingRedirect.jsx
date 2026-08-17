import React from 'react';
import { useParams } from 'react-router-dom';

const buildTrackingUrl = (provider, trackingId) => {
    const safeProvider = String(provider || '').trim().toLowerCase();
    const safeTrackingId = String(trackingId || '').trim();

    if (safeProvider === 'ekart') {
        return safeTrackingId
            ? `https://ekartlogistics.com/shipmenttrack/${encodeURIComponent(safeTrackingId)}`
            : 'https://ekartlogistics.com/';
    }

    return safeTrackingId
        ? `https://www.delhivery.com/tracking?waybill=${encodeURIComponent(safeTrackingId)}`
        : 'https://www.delhivery.com/tracking';
};

const ShippingRedirect = () => {
    const { provider, trackingId } = useParams();
    const safeProvider = String(provider || 'delhivery').trim().toLowerCase();
    const providerLabel = safeProvider === 'ekart' ? 'Ekart' : 'Delhivery';
    const targetUrl = buildTrackingUrl(safeProvider, trackingId);

    React.useEffect(() => {
        window.location.replace(targetUrl);
    }, [targetUrl]);

    return (
        <div className="min-h-screen bg-white flex items-center justify-center px-6">
            <div className="max-w-md text-center">
                <p className="text-sm font-bold uppercase tracking-widest text-gray-500">Redirecting</p>
                <h1 className="mt-3 text-2xl font-black text-gray-900">Opening {providerLabel} tracking</h1>
                <p className="mt-3 text-sm text-gray-600">
                    If the redirect does not happen automatically, use the link below.
                </p>
                <a
                    href={targetUrl}
                    className="mt-6 inline-flex rounded-xl bg-primary-600 px-5 py-3 text-xs font-black uppercase tracking-widest text-white"
                >
                    Open {providerLabel}
                </a>
            </div>
        </div>
    );
};

export default ShippingRedirect;
