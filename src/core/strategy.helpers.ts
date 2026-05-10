// Bundle-10-T1 / CR-SA-12 / 2026-05-11: 脚質エディタ削除時 Pre-Race/Mid-Race 判定 + 使用状況判定 helpers
// (modal-houserule.md §2 Delete + houserule-features.md §1 Delete + SA20 §5.3)
import type { Umamusume } from '../types';

export const DEFAULT_STRATEGY_NAMES = ['大逃げ', '逃げ', '先行', '差し', '追込'] as const;

export function isMidRace(participants: Umamusume[]): boolean {
    return participants.some((p) => p.history.Start?.baseDice !== undefined);
}

export function isStrategyInUse(strategyName: string, participants: Umamusume[]): boolean {
    return participants.some((p) => p.strategy === strategyName);
}

export function isDefaultStrategy(name: string): boolean {
    return (DEFAULT_STRATEGY_NAMES as readonly string[]).includes(name);
}
