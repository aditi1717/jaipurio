import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';

export const confirmToast = ({ 
    message, 
    onConfirm, 
    onCancel, 
    confirmText = 'Confirm', 
    cancelText = 'Cancel',
    icon = 'help_outline',
    type = 'info' 
}) => {
    return toast.custom((t) => (
        typeof document !== 'undefined'
            ? createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-[1px] p-4">
                    <div className={`${t.visible ? 'animate-in fade-in zoom-in' : 'animate-out fade-out zoom-out'} max-w-md w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex flex-col border border-primary-100 overflow-hidden ring-1 ring-black/5`}>
                        <div className="flex-1 p-6">
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-2xl flex-shrink-0 ${
                                    type === 'danger' ? 'bg-red-50 text-red-600' : 
                                    type === 'warning' ? 'bg-orange-50 text-orange-600' : 
                                    'bg-primary-50 text-primary-600'
                                }`}>
                                    <span className="material-icons text-2xl">{icon}</span>
                                </div>
                                <div className="flex-1 pt-0.5">
                                    <p className="text-sm font-black text-gray-900 leading-relaxed whitespace-pre-wrap">
                                        {message}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex border-t border-gray-100 bg-gray-50/50 p-3 gap-3">
                            <button
                                onClick={() => {
                                    toast.dismiss(t.id);
                                    if (onCancel) onCancel();
                                }}
                                className="flex-1 px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-widest hover:text-gray-700 transition-colors"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={() => {
                                    toast.dismiss(t.id);
                                    if (onConfirm) onConfirm();
                                }}
                                className={`flex-1 px-6 py-3 rounded-xl text-xs font-black text-white uppercase tracking-widest shadow-lg shadow-primary-500/20 active:scale-[0.98] transition-all ${
                                    type === 'danger' ? 'bg-gradient-to-r from-red-600 to-pink-600' : 
                                    type === 'warning' ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 
                                    'bg-gradient-to-r from-primary-600 to-purple-600'
                                }`}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </div>
                , document.body)
            : null
    ), {
        duration: 4500,
        position: 'top-left'
    });
};
