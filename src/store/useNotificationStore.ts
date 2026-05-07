import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
    id: string;
    type: NotificationType;
    message: string;
}

export interface NotificationStore {
    notifications: Notification[];
    addNotification: (type: NotificationType, message: string) => void;
    removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
    notifications: [],
    addNotification: (type, message) => {
        const id = Math.random().toString(36).substring(7);
        set((state) => ({
            notifications: [...state.notifications, { id, type, message }],
        }));
        setTimeout(() => {
            set((state) => ({
                notifications: state.notifications.filter((n) => n.id !== id),
            }));
        }, 5000);
    },
    removeNotification: (id) =>
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
        })),
}));
