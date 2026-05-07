import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNotificationStore } from './useNotificationStore';

describe('useNotificationStore - CR-SA-7-Followup-notification-store', () => {
    beforeEach(() => {
        useNotificationStore.setState({ notifications: [] });
    });

    it('addNotification: notifications 配列に通知が追加される', () => {
        useNotificationStore.getState().addNotification('success', '保存しました');
        const notifications = useNotificationStore.getState().notifications;

        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe('success');
        expect(notifications[0].message).toBe('保存しました');
        expect(notifications[0].id).toBeTruthy();
    });

    it('removeNotification: 指定 id の通知のみ削除される', () => {
        useNotificationStore.getState().addNotification('info', 'A');
        useNotificationStore.getState().addNotification('error', 'B');
        const before = useNotificationStore.getState().notifications;
        expect(before).toHaveLength(2);

        const targetId = before[0].id;
        useNotificationStore.getState().removeNotification(targetId);
        const after = useNotificationStore.getState().notifications;

        expect(after).toHaveLength(1);
        expect(after[0].message).toBe('B');
    });

    it('addNotification: 5 秒経過で自動削除される', () => {
        vi.useFakeTimers();
        try {
            useNotificationStore.getState().addNotification('info', '一時通知');
            expect(useNotificationStore.getState().notifications).toHaveLength(1);

            vi.advanceTimersByTime(4999);
            expect(useNotificationStore.getState().notifications).toHaveLength(1);

            vi.advanceTimersByTime(1);
            expect(useNotificationStore.getState().notifications).toHaveLength(0);
        } finally {
            vi.useRealTimers();
        }
    });
});
