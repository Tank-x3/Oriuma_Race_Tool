import { useMemo } from 'react';
import { useRaceStore } from '../store/useRaceStore';

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
        // Standard back: Go to previous race phase
        if (currentIndex > 0) {
            const prevId = phaseSequence[currentIndex - 1];
            setCurrentPhase(prevId);
        } else if (isFirstPhase) {
            // Requirement Logic: Back from Start -> Go to Gate Lottery?
            // "現在が 序盤 の場合: Scene 2（枠順抽選）に戻る。"
            // This requires changing 'scene' not just 'phase'.
            // The hook primarily manages Race Loop phases.
            // Caller might handle "Back from Start".
        }
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
