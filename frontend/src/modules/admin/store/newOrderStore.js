import { create } from 'zustand';
import API from '../../../services/api';

const POLL_MS = 60 * 1000;

/**
 * Unread-order badge state, shared between the sidebar and the orders page.
 * The count is per admin account and lives on the server, so it survives a
 * reload and does not clear for other admins.
 */
const useNewOrderStore = create((set, get) => ({
    count: 0,
    pollTimer: null,

    fetchCount: async () => {
        try {
            const { data } = await API.get('/orders/new-count');
            set({ count: Number(data?.count) || 0 });
        } catch {
            // Badge is non-critical; leave the last known value on failure.
        }
    },

    markSeen: async () => {
        // Clear immediately so the badge does not linger while the request runs.
        set({ count: 0 });
        try {
            await API.put('/orders/mark-seen');
        } catch {
            // A failed write just means the badge reappears on the next poll.
        }
    },

    startPolling: () => {
        if (get().pollTimer) return;
        get().fetchCount();
        const pollTimer = setInterval(() => {
            if (document.visibilityState === 'visible') get().fetchCount();
        }, POLL_MS);
        set({ pollTimer });
    },

    stopPolling: () => {
        const { pollTimer } = get();
        if (pollTimer) clearInterval(pollTimer);
        set({ pollTimer: null });
    }
}));

export default useNewOrderStore;
