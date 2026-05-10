import { useMemo } from 'react';
import { useRaceStore } from '../store/useRaceStore';

// Bundle-6 / P4-4 + CR-19 / 2026-05-10: 仕様 scene3-race.md §6「完全な状態復元」準拠。
// CR-8 (2026-04) で導入された削除型設計（{ revertPhaseId, resetPace, prevPhaseId } を返し
// useRaceStore.revertPhaseHistory で history 削除 + paceResult リセットを行う）は本 Bundle で
// 廃止した。本関数は単に戻り先 phaseId を決定するのみで、history / paceResult / specialStrategy /
// manualModifier はすべて保持される。no-op（序盤 / 不正フェーズ / レースループ外）の場合は null。
export const computePrevPhasePlan = (
    currentPhaseId: string,
    phaseSequence: readonly string[]
): { prevPhaseId: string } | null => {
    const currentIndex = phaseSequence.indexOf(currentPhaseId);
    if (currentIndex <= 0) return null;

    return {
        prevPhaseId: phaseSequence[currentIndex - 1],
    };
};

export const useRaceEngine = () => {
    const { config, currentPhaseId, setCurrentPhase } = useRaceStore();

    // Determine phase sequence based on config
    const phaseSequence = useMemo(() => {
        // Sequence: Start (序盤) -> Pace (ペース) -> [Mid] -> End (終盤)
        const seq = ['Start', 'Pace'];

        if (config.midPhaseCount === 1) {
            seq.push('Mid');
        } else if (config.midPhaseCount > 1) {
            for (let i = 1; i <= config.midPhaseCount; i++) {
                seq.push(`Mid${i}`);
            }
        }

        seq.push('End');
        return seq;
    }, [config.midPhaseCount]);

    const currentIndex = phaseSequence.indexOf(currentPhaseId);

    // Safety fallback
    if (currentIndex === -1 && currentPhaseId !== 'setup' && currentPhaseId !== 'gate_lottery') {
        // Warning: Invalid phase
    }

    const isLastPhase = currentIndex === phaseSequence.length - 1; // End
    const isFirstPhase = currentIndex === 0; // Start

    const nextPhase = () => {
        if (isLastPhase) {
            // TODO: Transition to Result Scene (Step 4)
            // For now, no-op or handled by parent UI
            return;
        }
        if (currentIndex === -1) return;

        const nextId = phaseSequence[currentIndex + 1];
        setCurrentPhase(nextId);
    };

    const prevPhase = () => {
        // Bundle-6 / P4-4 + CR-19 / 2026-05-10: 仕様 scene3-race.md §6「完全な状態復元」準拠。
        // 単に戻り先 phaseId に setCurrentPhase するのみ。history / paceResult / specialStrategy /
        // manualModifier は保持される。序盤からの戻り（Scene 2 への遷移）は RaceScene.tsx の
        // handleBack() が担う（本関数は null を返して no-op）。
        const plan = computePrevPhasePlan(currentPhaseId, phaseSequence);
        if (plan === null) return;

        setCurrentPhase(plan.prevPhaseId);
    };

    const getPhaseLabel = (id: string) => {
        if (id === 'Start') return '序盤';
        if (id === 'Pace') return 'ペース判定';
        if (id === 'Mid') return '中盤';
        if (id.startsWith('Mid')) return id.replace('Mid', '中盤');
        if (id === 'End') return '終盤';
        return id;
    };

    return {
        phaseSequence,
        currentPhaseId,
        nextPhase,
        prevPhase,
        isLastPhase,
        isFirstPhase,
        currentIndex,
        getPhaseLabel
    };
};
