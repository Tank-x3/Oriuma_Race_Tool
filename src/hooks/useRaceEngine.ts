import { useMemo } from 'react';
import { useRaceStore } from '../store/useRaceStore';
import { getNonPacePhaseSequence } from '../core/phaseSequence';
import type { PacePosition } from '../types';

// CR-SA-17-E4 / 2026-06-08: フェーズ構成変更（houserule-features.md §7）の進行フェーズ列生成（純粋関数）。
// 非ペース列（getNonPacePhaseSequence）を生成し、pacePosition アンカーの直後に 'Pace' を挿入する。
//
// ★OFF 透過ゲート（★必須）: enablePhaseConfig === false のとき、引数に可変値（startPhaseCount=2 等）が
// 残っていても序盤 1 / 終盤 1 / ペース = 序盤直後（'Start'）の固定構成で列を生成する。OFF 時の列は現行
// `['Start','Pace',...mids,'End']` と 1 要素も違わない（getNonPacePhaseSequence(1, mid, 1) の 'Start' 直後に 'Pace' 挿入）。
// React / store に依存しない純粋関数として単体テスト可能にする。
export const buildPhaseSequence = (
    enablePhaseConfig: boolean,
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
    pacePosition: PacePosition,
): string[] => {
    const on = enablePhaseConfig;
    const startCount = on ? startPhaseCount : 1;
    const endCount = on ? endPhaseCount : 1;
    // ペース位置: ON はアンカー基準フェーズ ID（null = なし）、OFF は現行どおり序盤直後（'Start'）固定。
    const pacePos = on ? pacePosition : 'Start';

    const nonPace = getNonPacePhaseSequence(startCount, midPhaseCount, endCount);
    const seq: string[] = [];
    for (const phase of nonPace) {
        seq.push(phase.id);
        // pacePos === null（なし）ならペースフェーズを挿入しない。
        if (pacePos !== null && phase.id === pacePos) {
            seq.push('Pace');
        }
    }
    return seq;
};

// CR-SA-17-E4 / 2026-06-08: フェーズ ID → 表示ラベル（houserule-features.md §7.3、純粋関数）。
// Start1→'序盤1' / End1→'終盤1'（既存 Mid{n}→'中盤{n}' と同方針）。単一 Start/End/Pace は従来どおり。
export const getPhaseLabel = (id: string): string => {
    if (id === 'Start') return '序盤';
    if (id.startsWith('Start')) return id.replace('Start', '序盤');
    if (id === 'Pace') return 'ペース判定';
    if (id === 'Mid') return '中盤';
    if (id.startsWith('Mid')) return id.replace('Mid', '中盤');
    if (id === 'End') return '終盤';
    if (id.startsWith('End')) return id.replace('End', '終盤');
    return id;
};

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
    // CR-SA-17-E4 / 2026-06-08: フェーズ構成変更（houserule-features.md §7）の進行列生成。
    // 純粋関数 buildPhaseSequence へ委譲（OFF 透過ゲート + ペース挿入のロジックはそちらに集約）。
    const phaseSequence = useMemo(() => buildPhaseSequence(
        config.houseRules.enablePhaseConfig,
        config.startPhaseCount,
        config.midPhaseCount,
        config.endPhaseCount,
        config.pacePosition,
    ), [
        config.houseRules.enablePhaseConfig,
        config.startPhaseCount,
        config.midPhaseCount,
        config.endPhaseCount,
        config.pacePosition,
    ]);

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

    return {
        phaseSequence,
        currentPhaseId,
        nextPhase,
        prevPhase,
        isLastPhase,
        isFirstPhase,
        currentIndex,
        // CR-SA-17-E4 / 2026-06-08: モジュールレベルの純粋関数 getPhaseLabel を再公開（フック利用箇所は無改修）。
        getPhaseLabel,
    };
};
