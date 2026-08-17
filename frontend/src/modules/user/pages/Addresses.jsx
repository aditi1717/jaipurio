import { ALL_INDIAN_STATES } from '../../../constants/indianStates';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import API from '../../../services/api';
import TranslatedText from '../components/common/TranslatedText';
import { useGoogleTranslation } from '../../../hooks/useGoogleTranslation';

import toast from 'react-hot-toast';
import { confirmToast } from '../../../utils/toastUtils.jsx';
import { useAddressAutocomplete } from '../../../hooks/useAddressAutocomplete';

const Addresses = () => {
    const navigate = useNavigate();
    const { user, syncAddresses } = useAuthStore();
    const { addresses, setAddresses } = useCartStore();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showMenu, setShowMenu] = useState(null);
    const [pincodeStatus, setPincodeStatus] = useState({}); // { addressId: { isServiceable, message, deliveryTime, unit } }
    const [isLoadingLocation, setIsLoadingLocation] = useState(false);
    const formContainerRef = useRef(null);
    const nameInputRef = useRef(null);
    
    const { 
        suggestions, 
        loading: autocompleteLoading, 
        fetchSuggestions, 
        fetchPlaceDetails,
        setSuggestions 
    } = useAddressAutocomplete();

    const initialAddr = {
        name: user?.name || '',
        mobile: user?.phone || user?.mobile || '',
        pincode: '',
        address: '',
        city: '',
        state: '',
        type: 'Home'
    };


    // Static text translations for complex usage (if any) or attributes
    const addressesText = useGoogleTranslation('Addresses');
    const manageAddressesText = useGoogleTranslation('Manage Addresses');
    const addNewAddressText = useGoogleTranslation('Add New Address');
    const editAddressText = useGoogleTranslation('Edit Address');
    const useCurrentLocationText = useGoogleTranslation('Use Current Location');
    
    // Form Labels
    const fullNameText = useGoogleTranslation('Full Name');
    const phoneNumberText = useGoogleTranslation('Phone Number');
    const pincodeText = useGoogleTranslation('Pincode');
    const addressAreaText = useGoogleTranslation('Address (Area and Street)');
    const cityText = useGoogleTranslation('City/District/Town');
    const stateText = useGoogleTranslation('State');
    const addressTypeText = useGoogleTranslation('Address Type');
    const homeTypeText = useGoogleTranslation('Home (All day delivery)');
    const workTypeText = useGoogleTranslation('Work (Delivery between 10 AM - 5 PM)');
    const cancelText = useGoogleTranslation('Cancel');
    const updateAddressText = useGoogleTranslation('Update Address');
    const saveAddressText = useGoogleTranslation('Save Address');

    const [newAddr, setNewAddr] = useState(initialAddr);

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validate Indian mobile number
        const mobileRegex = /^[6-9]\d{9}$/;
        const pincodeRegex = /^\d{6}$/;
        if (!mobileRegex.test(newAddr.mobile)) {
            return toast.error('Please enter a valid 10-digit Indian mobile number (starting with 6-9)');
        }
        if (!pincodeRegex.test(String(newAddr.pincode || '').trim())) {
            return toast.error('Please enter a valid 6-digit pincode');
        }

        if (/\d/.test(String(newAddr.city || '').trim())) {
            return toast.error('City should not contain numbers');
        }

        if (/\d/.test(String(newAddr.state || '').trim())) {
            return toast.error('State should not contain numbers');
        }

        try {
            const payload = {
                ...newAddr,
                name: user?.name || newAddr.name,
                email: user?.email || '',
                isDefault: false
            };

            const { data } = editingId
                ? await API.put(`/auth/profile/addresses/${editingId}`, payload)
                : await API.post('/auth/profile/addresses', payload);

            setAddresses(data);
            syncAddresses(data);
            toast.success(editingId ? 'Address updated!' : 'Address added!');
            setEditingId(null);
            setIsAdding(false);
            setNewAddr({ ...initialAddr, name: user?.name || '', mobile: user?.phone || user?.mobile || '' });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save address');
        }
    };

    const handleEdit = (addr) => {
        setNewAddr(addr);
        setEditingId(addr.id);
        setIsAdding(true);
        setShowMenu(null);

        // Bring the edit form into view when editing a lower list item.
        requestAnimationFrame(() => {
            formContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            nameInputRef.current?.focus();
        });
    };

    const handleDelete = (id) => {
        confirmToast({
            message: 'Are you sure you want to delete this address?',
            onConfirm: async () => {
                try {
                    const { data } = await API.delete(`/auth/profile/addresses/${id}`);
                    setAddresses(data);
                    syncAddresses(data);
                    toast.success('Address deleted!');
                } catch (error) {
                    toast.error(error.response?.data?.message || 'Failed to delete address');
                }
            },
            type: 'danger',
            icon: 'delete_forever',
            confirmText: 'Delete'
        });
        setShowMenu(null);
    };

    // Check pincode serviceability
    const checkPincodeServiceability = async (addressId, pincode) => {
        if (!pincode || pincode.length < 6) return;
        
        try {
            const { data } = await API.get(`/pincodes/check/${pincode}`);
            setPincodeStatus(prev => ({
                ...prev,
                [addressId]: {
                    isServiceable: data.isServiceable,
                    message: data.isServiceable 
                        ? `Delivery in ${data.deliveryTime} ${data.unit}` 
                        : 'Not deliverable in your area',
                    deliveryTime: data.deliveryTime,
                    unit: data.unit
                }
            }));
        } catch (error) {
            console.error('Error checking pincode:', error);
            setPincodeStatus(prev => ({
                ...prev,
                [addressId]: {
                    isServiceable: false,
                    message: 'Unable to check delivery availability'
                }
            }));
        }
    };

    // Check all addresses on mount
    useEffect(() => {
        addresses.forEach(addr => {
            if (addr.pincode) {
                checkPincodeServiceability(addr.id, addr.pincode);
            }
        });
    }, [addresses]);

    useEffect(() => {
        const fetchAddresses = async () => {
            try {
                const { data } = await API.get('/auth/profile/addresses');
                setAddresses(data);
                syncAddresses(data);
            } catch (error) {
                console.error('Failed to fetch addresses:', error);
            }
        };

        if (user) {
            fetchAddresses();
        }
    }, [user, setAddresses, syncAddresses]);

    return (
        <div className="bg-[#f1f3f6] min-h-screen pb-10 md:py-6">

            {/* Mobile Header - Hidden on Desktop */}
            <div className="bg-white px-4 py-4 flex items-center gap-4 border-b md:hidden">
                <button onClick={() => navigate(-1)} className="material-icons text-gray-700">arrow_back</button>
                <h1 className="text-lg font-bold text-gray-800">{addressesText}</h1>
            </div>

            {/* Desktop Container */}
            <div className="md:max-w-[1000px] md:mx-auto md:flex md:gap-6 md:items-start">

                {/* Desktop Sidebar (Optional - or just breadcrumbs/title) */}
                <div className="hidden md:block w-[280px] shrink-0 space-y-4">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <span onClick={() => navigate('/')} className="cursor-pointer hover:text-primary-600"><TranslatedText text="Home" /></span>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <span onClick={() => navigate('/account')} className="cursor-pointer hover:text-primary-600"><TranslatedText text="My Account" /></span>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <span className="text-gray-800 font-bold">{addressesText}</span>
                    </div>

                    <div className="bg-white p-4 shadow-sm rounded-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                <span className="material-icons text-gray-600">person</span>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500"><TranslatedText text="Hello" />,</p>
                                <p className="text-sm font-bold text-gray-800">{user?.name || 'User'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="md:flex-1 space-y-4">

                    <h1 className="hidden md:block text-lg font-bold text-gray-800 mb-4">{manageAddressesText}</h1>

                    <div className="p-2 space-y-2 md:p-0">
                        {/* Add New Address Button */}
                        {!isAdding && (
                            <button
                                onClick={() => {
                                    setNewAddr(initialAddr);
                                    setEditingId(null);
                                    setIsAdding(true);
                                }}
                                className="w-full bg-white p-4 flex items-center gap-3 text-primary-600 font-bold text-sm shadow-sm active:bg-gray-50 transition-colors md:rounded-sm md:border md:border-gray-200 md:hover:bg-primary-50"
                            >
                                <span className="material-icons text-lg">add</span>
                                {addNewAddressText.toUpperCase()}
                            </button>
                        )}

                        {/* Add/Edit Address Form */}
                        {isAdding && (
                            <div ref={formContainerRef} className="bg-white p-4 shadow-sm animate-in slide-in-from-top duration-300 md:rounded-sm md:border md:border-gray-200">
                                <div className="flex items-center justify-between mb-4 border-b pb-3">
                                    <h2 className="text-primary-600 font-bold uppercase text-[12px] tracking-wider">
                                        {editingId ? editAddressText : addNewAddressText}
                                    </h2>
                                    <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-gray-400 hover:text-red-500">
                                        <span className="material-icons">close</span>
                                    </button>
                                </div>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    
                                    {/* Detect Location Button */}
                                    {!editingId && (
                                        <button
                                            type="button"
                                            disabled={isLoadingLocation}
                                            onClick={async () => {
                                                if (!navigator.geolocation) {
                                                    toast.error('Geolocation is not supported by your browser.');
                                                    return;
                                                }

                                                const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                                                if (!apiKey) {
                                                    toast.error('Google Maps API Key is missing. Please contact support.');
                                                    return;
                                                }

                                                setIsLoadingLocation(true);
                                                const loadingToast = toast.loading('Fetching your location...');

                                                try {
                                                    const position = await new Promise((resolve, reject) => {
                                                        navigator.geolocation.getCurrentPosition(resolve, reject);
                                                    });

                                                    const { latitude, longitude } = position.coords;
                                                    
                                                    // Fetch address from Google Maps Geocoding API
                                                    const response = await fetch(
                                                        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
                                                    );
                                                    const data = await response.json();

                                                    if (data.status === 'OK' && data.results?.[0]) {
                                                        const result = data.results[0];
                                                        const addressComponents = result.address_components;

                                                        let city = '';
                                                        let state = '';
                                                        let pincode = '';
                                                        let area = '';

                                                        addressComponents.forEach(component => {
                                                            const types = component.types;
                                                            if (types.includes('locality') || types.includes('administrative_area_level_2')) {
                                                                city = component.long_name;
                                                            }
                                                            if (types.includes('administrative_area_level_1')) {
                                                                state = component.long_name;
                                                            }
                                                            if (types.includes('postal_code')) {
                                                                pincode = component.long_name;
                                                            }
                                                            if (types.includes('sublocality') || types.includes('neighborhood')) {
                                                                area = component.long_name;
                                                            }
                                                        });

                                                        const fullAddress = result.formatted_address || `${area}, ${city}, ${state}`;

                                                        setNewAddr(prev => ({
                                                            ...prev,
                                                            city,
                                                            state,
                                                            pincode,
                                                            address: fullAddress
                                                        }));
                                                        toast.success('Address fetched successfully!', { id: loadingToast });
                                                    } else {
                                                        console.error('Google Maps Error:', data);
                                                        toast.error(`Google Maps Error: ${data.status} - ${data.error_message || 'Unknown error'}`, { id: loadingToast });
                                                    }

                                                } catch (error) {
                                                    console.error('Location Error:', error);
                                                    if (error.code === 1) {
                                                        toast.error('Location permission denied. Please allow location access.', { id: loadingToast });
                                                    } else {
                                                        toast.error('Failed to detect location. Please try again or fill manually.', { id: loadingToast });
                                                    }
                                                } finally {
                                                    setIsLoadingLocation(false);
                                                }
                                            }}
                                            className={`w-full bg-primary-50 text-primary-600 py-3 rounded-sm font-bold text-xs uppercase flex items-center justify-center gap-2 hover:bg-primary-100 transition-colors mb-4 border border-primary-100 ${isLoadingLocation ? 'opacity-70 cursor-wait' : ''}`}
                                        >
                                            {isLoadingLocation ? (
                                                <>
                                                    <span className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></span>
                                                    DETECTING...
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-icons text-sm">my_location</span>
                                                    {useCurrentLocationText}
                                                </>
                                            )}
                                        </button>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 md:col-span-1 space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">{fullNameText}</label>
                                            <input 
                                                required 
                                                type="text" 
                                                ref={nameInputRef}
                                                className="w-full border border-gray-200 p-3 rounded-sm text-sm outline-none focus:border-primary-500 text-gray-900" 
                                                value={newAddr.name} 
                                                onChange={e => setNewAddr({ ...newAddr, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-span-2 md:col-span-1 space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">{phoneNumberText}</label>
                                            <input required type="tel" className="w-full border border-gray-200 p-3 rounded-sm text-sm outline-none focus:border-primary-500 text-gray-900" value={newAddr.mobile} onChange={e => setNewAddr({ ...newAddr, mobile: e.target.value })} />
                                        </div>
                                        <div className="col-span-2 md:col-span-1 space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">{pincodeText}</label>
                                            <input
                                                required
                                                type="text"
                                                inputMode="numeric"
                                                maxLength="6"
                                                className="w-full border border-gray-200 p-3 rounded-sm text-sm outline-none focus:border-primary-500 text-gray-900"
                                                value={newAddr.pincode}
                                                onChange={e => {
                                                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                                    setNewAddr({ ...newAddr, pincode: value });
                                                }}
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-1 relative">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">{addressAreaText}</label>
                                            <textarea 
                                                required 
                                                rows="3" 
                                                className="w-full border border-gray-200 p-3 rounded-sm text-sm outline-none focus:border-primary-500 text-gray-900" 
                                                value={newAddr.address} 
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setNewAddr({ ...newAddr, address: val });
                                                    fetchSuggestions(val);
                                                }} 
                                            />
                                            {suggestions.length > 0 && (
                                                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 shadow-xl rounded-sm max-h-60 overflow-y-auto">
                                                    {suggestions.map((suggestion) => (
                                                        <button
                                                            key={suggestion.place_id}
                                                            type="button"
                                                            onClick={async () => {
                                                                const details = await fetchPlaceDetails(suggestion.place_id);
                                                                if (details) {
                                                                    setNewAddr(prev => ({
                                                                        ...prev,
                                                                        address: details.address,
                                                                        city: details.city || prev.city,
                                                                        state: details.state || prev.state,
                                                                        pincode: details.pincode || prev.pincode
                                                                    }));
                                                                    setSuggestions([]);
                                                                }
                                                            }}
                                                            className="w-full text-left p-3 hover:bg-gray-50 border-b last:border-0 border-gray-100 transition-colors flex items-start gap-2"
                                                        >
                                                            <span className="material-icons text-gray-400 text-sm mt-0.5">location_on</span>
                                                            <div className="flex-1">
                                                                <p className="text-sm text-gray-800 font-medium">{suggestion.description}</p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-2 md:col-span-1 space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">{cityText}</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full border border-gray-200 p-3 rounded-sm text-sm outline-none focus:border-primary-500 text-gray-900"
                                                value={newAddr.city}
                                                onChange={e => {
                                                    const value = e.target.value;
                                                    if (/\d/.test(value)) return;
                                                    setNewAddr({ ...newAddr, city: value });
                                                }}
                                            />
                                        </div>
                                        <div className="col-span-2 md:col-span-1 space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase">{stateText}</label>
                                            {/* A dropdown, not free text: this field used to collect
                                                districts, towns and typos, which split one state's
                                                analytics across several buckets. */}
                                            <select
                                                required
                                                className="w-full border border-gray-200 p-3 rounded-sm text-sm outline-none focus:border-primary-500 text-gray-900 bg-white"
                                                value={ALL_INDIAN_STATES.includes(newAddr.state) ? newAddr.state : ''}
                                                onChange={e => setNewAddr({ ...newAddr, state: e.target.value })}
                                            >
                                                <option value="">Select state</option>
                                                {ALL_INDIAN_STATES.map((stateName) => (
                                                    <option key={stateName} value={stateName}>{stateName}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">{addressTypeText}</label>
                                        <div className="flex gap-6">
                                            {['Home', 'Work'].map(type => (
                                                <label key={type} className="flex items-center gap-2 cursor-pointer group">
                                                    <input type="radio" checked={newAddr.type === type} onChange={() => setNewAddr({ ...newAddr, type })} className="accent-primary-600 w-4 h-4 cursor-pointer" />
                                                    <span className="text-sm text-gray-700">{type === 'Home' ? homeTypeText : workTypeText}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <button type="button" onClick={() => { setIsAdding(false); setEditingId(null); }} className="flex-1 py-4 text-gray-500 font-bold uppercase text-[12px] hover:text-gray-700">{cancelText}</button>
                                        <button type="submit" className="flex-1 bg-primary-600 text-white py-4 rounded-sm font-bold uppercase text-[12px] shadow-lg active:scale-95 transition-all hover:bg-primary-700">
                                            {editingId ? updateAddressText : saveAddressText}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Addresses List */}
                        <div className="space-y-2">
                            {addresses.map(addr => (
                                <div key={addr.id} className="bg-white p-4 shadow-sm relative border-l-4 border-transparent hover:border-primary-600 transition-all md:rounded-sm md:border md:border-gray-200 md:hover:border-primary-600 md:hover:shadow-md">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] bg-gray-100 px-2 py-0.5 rounded-sm text-gray-500 font-bold uppercase tracking-tighter">{addr.type}</span>
                                            {addr.isDefault && <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-sm font-bold uppercase">Default</span>}
                                        </div>
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowMenu(showMenu === addr.id ? null : addr.id)}
                                                className="material-icons text-gray-400 text-lg p-1 hover:bg-gray-50 rounded-full cursor-pointer"
                                            >
                                                more_vert
                                            </button>
                                            {showMenu === addr.id && (
                                                <div className="absolute right-0 top-8 bg-white shadow-xl border border-gray-100 rounded-md py-1 w-32 z-50 animate-in fade-in zoom-in duration-200">
                                                    <button
                                                        onClick={() => handleEdit(addr)}
                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                    >
                                                        <span className="material-icons text-sm">edit</span> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(addr.id)}
                                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                    >
                                                        <span className="material-icons text-sm text-red-600">delete</span> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-[14px] text-gray-800">{user?.name || addr.name}</span>
                                            <span className="font-bold text-[14px] text-gray-800">{addr.mobile}</span>
                                        </div>
                                        <p className="text-[13px] text-gray-500 leading-relaxed max-w-[90%]">
                                            {addr.address}, {addr.city}, {addr.state} - <span className="font-bold">{addr.pincode}</span>
                                        </p>
                                        {/* Delivery Status Badge */}
                                        {pincodeStatus[addr.id] && (
                                            <div className="flex items-center gap-2 mt-2">
                                                {pincodeStatus[addr.id].isServiceable ? (
                                                    <>
                                                        <span className="material-icons text-green-600 text-sm">check_circle</span>
                                                        <span className="text-xs font-bold text-green-600">
                                                            {pincodeStatus[addr.id].message}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="material-icons text-red-500 text-sm">cancel</span>
                                                        <span className="text-xs font-bold text-red-500">
                                                            {pincodeStatus[addr.id].message}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Overlay to close menu on outside click */}
            {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(null)}></div>}
        </div>
    );
};

export default Addresses;
