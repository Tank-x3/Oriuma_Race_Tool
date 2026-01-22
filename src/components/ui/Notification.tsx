import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../../utils/cn';
import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info';

interface Notification {
    id: string;
    type: NotificationType;
    message: string;
}

interface NotificationStore {
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

export const NotificationContainer = () => {
    const { notifications, removeNotification } = useNotificationStore();

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={cn(
                        "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md animate-in slide-in-from-right fade-in duration-300",
                        notification.type === 'success' && "bg-primary-950/80 border-primary-500/50 text-primary-200",
                        notification.type === 'error' && "bg-red-950/80 border-red-500/50 text-red-200",
                        notification.type === 'info' && "bg-slate-800/80 border-slate-600/50 text-slate-200"
                    )}
                >
                    {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-primary-400" />}
                    {notification.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                    {notification.type === 'info' && <Info className="w-5 h-5 text-slate-400" />}
                    <p className="text-sm font-medium pr-2">{notification.message}</p>
                    <button
                        onClick={() => removeNotification(notification.id)}
                        className="opacity-70 hover:opacity-100 transition-opacity"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};
