import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useNotificationStore } from '../../store/useNotificationStore';

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
