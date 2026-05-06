import { useMemo } from 'react';
import { useRaceStore } from '../store/useRaceStore';

// CR-8: prevPhase() の副作用部分（store 操作）から純粋な計画決定ロジックを切り出した関数。
// 戻り元フェーズ・戻り先フェーズ・ペース判定リセット要否を決定する。
// no-op（序盤 / 不正フェーズ / レースループ外）の場合は null を返す。
// ペース判定リセット条件: 戻り元が 'Pace'、または戻り元が phaseSequence の最初の Mid
// （midPhaseCount=1 なら 'Mid'、>=2 なら 'Mid1'、いずれも phaseSequence[2]）。
export const computePrevPhasePlan = (
    currentPhaseId: string,
    phaseSequence: readonly string[]
): { revertPhaseId: string; resetPace: boolean; prevPhaseId: string } | null => {
    const currentIndex = phaseSequence.indexOf(currentPhaseId);
    if (currentIndex <= 0) return null;

    const prevPhaseId = phaseSequence[currentIndex - 1];
    const firstMidId = phaseSequence[2];
    const shouldResetPace = currentPhaseId === 'Pace' || currentPhaseId === firstMidId;

    return {
        revertPhaseId: currentPhaseId,
        resetPace: shouldResetPace,
        prevPhaseId,
    };
};

export const useRaceEngine = () => {
    const { config, currentPhaseId, setCurrentPhase, revertPhaseHistory } = useRaceStore();

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
        // CR-8: 戻り元フェーズの history を削除 + score 再計算 + 必要なら paceResult リセット。
        // 序盤からの戻り（Scene 2 への遷移）は RaceScene.tsx:153-160 の handleBack() が担う。
        const plan = computePrevPhasePlan(currentPhaseId, phaseSequence);
        if (plan === null) return;

        revertPhaseHistory(plan.revertPhaseId, { resetPace: plan.resetPace });
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
