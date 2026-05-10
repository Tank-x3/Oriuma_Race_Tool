import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Umamusume, RaceState, GateAssignment, Strategy } from '../types';
import { DEFAULT_STRATEGIES as STRATEGIES } from '../core/strategies';
import { getActivePhaseIds } from '../core/calculator';
import { isDefaultStrategy } from '../core/strategy.helpers';
import { useNotificationStore } from './useNotificationStore';
// Bundle-4 / P4-1, P4-5 / 2026-05-10: 特殊戦法（捲り/溜め）の score 補正計算を純粋関数に委譲。
// calculator.ts は不変厳守エリアのため、Calculator 戻り値に上乗せする運用とする。
// Round 2 改修: 解析未実行 history を fixValue 加算から除外する一元化関数 `calculateScoreWithSpecialStrategy` を採用。
// Bundle-8-T6 / CR-SA-4 / 2026-05-10: 絆スキルの最終加算を上乗せした統合 score 計算関数
// `calculateScoreWithBondSkill` に切り替え。calculator.ts 不変厳守は維持し、
// `bondSkill.helpers` 内で `calculateScoreWithSpecialStrategy` をラップする構造に改修。
import { calculateScoreWithBondSkill } from '../components/scene/race/bondSkill.helpers';
// Bundle-7 / P4-6 / 2026-05-10: 永続化マイグレーションで houseRules を zod 検証する。
// houserule-features.md §4 zod 検証範囲表に基づく検証 + Bundle-1 で追加された 2 フィールドの補完。
import { houseRulesSchema, type HouseRulesData } from '../core/schema/houseRules';

interface RaceStoreState extends RaceState {
    uiState: {
        scene: 'setup' | 'gate' | 'race' | 'judgment' | 'result';
        isParsingInput: boolean;
    };

    // Actions
    setMidPhaseCount: (count: number) => void;
    setFullGateSize: (size: number) => void;
    // Bundle-9 / 2026-05-10: ハウスルール 5 フィールドの部分更新 action。
    // Bundle-4 / 2026-05-10: effectValue 変更時は specialStrategy 設定済参加者の score を自動再計算する。
    updateHouseRules: (updates: Partial<RaceState['config']['houseRules']>) => void;
    // Bundle-4 / P4-1, P4-5 / 2026-05-10: 特殊戦法（捲り/溜め）の設定 + score 即時加減算。
    // value === null で取り消し（未使用扱い）。1 レース 1 回制限の判定は UI 側で行い、
    // 本 action は呼ばれた値をそのまま反映する（防御的判定なし）。
    setSpecialStrategy: (
        participantId: string,
        phaseId: string,
        value: 'Makuri' | 'Tame' | null
    ) => void;
    // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 絆スキル種別の設定 (houserule-features.md §2 [v] 絆スキル)。
    // 値域チェックは UI / validator 層に委ねる（既存 setSpecialStrategy / setManualModifier と同方針 = 防御的判定なし）。
    // score 再計算は行わない（絆スキル分加算は T6 でスコア計算統合時に追加、T1 では値の保存のみ）。
    setBondSkill: (
        participantId: string,
        type: 'BondGamble' | 'BondStable' | null
    ) => void;
    // Bundle-8-T1 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 特殊戦法発動位置 Scene 1 事前申告 (scene1-setup.md §2)。
    // 値域: 'Start' | 'Mid' | 'Mid1' | 'Mid2' | 'Mid3' | 'Mid4' | null（'End' は含めない）。
    // score 再計算は行わない（戦法ボタンの初期値連動は T4 で実装、T1 では値の保存のみ）。
    setSpecialStrategyPhase: (
        participantId: string,
        phaseId: string | null
    ) => void;
    // Bundle-8-T2 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 特殊戦法種別 Scene 1 事前申告 (scene1-setup.md §2)。
    // 既存 setSpecialStrategy（history 配下、Scene 3 戦法ボタン操作専用）とは責務分離。本 action は participants 直下フィールドを更新のみ。
    // 値域チェックは UI / validator 層に委ねる（防御的判定なし）。score 再計算は T6 で実装。
    setSpecialStrategyType: (
        participantId: string,
        type: 'Makuri' | 'Tame' | null
    ) => void;
    // Bundle-10-T1 / CR-SA-12 / 2026-05-11: 脚質エディタ Insert/Edit/Delete actions
    // (houserule-features.md §1 / modal-houserule.md §2 SSoT)
    // 名前重複・値域・ダイス式 validation はすべて UI / validator 層（T2/T3 スコープ）に委ねる。
    // 本 actions は呼ばれた値をそのまま反映する（防御的判定なし、setSpecialStrategy / setManualModifier 同方針）。
    addStrategy: (insertAfterName: string, strategy: Strategy) => void;
    updateStrategy: (name: string, updates: Partial<Strategy>) => void;
    removeStrategy: (name: string) => void;
    // Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 汎用補正の設定 / クリア + score 即時加減算。
    // value は整数、reason は trim 後非空（CR-22 統合）。バリデーション通過済の値が渡る前提で
    // 防御的判定はモーダル側で実施し、本 action は呼ばれた値をそのまま反映する。
    setManualModifier: (
        participantId: string,
        phaseId: string,
        value: number,
        reason: string
    ) => void;
    clearManualModifier: (participantId: string, phaseId: string) => void;
    generateParticipants: (count: number) => void;
    addParticipant: (participant: Omit<Umamusume, 'score' | 'history'>) => void;
    removeParticipant: (id: string) => void;
    updateParticipant: (id: string, updates: Partial<Umamusume>) => void;
    applyGateAssignments: (assignments: { id: string; gate: number }[]) => void;
    // CR-5a-2: Scene 2 解析実行直後の中間状態（gateAssignments）の上書き / null クリア。
    setGateAssignments: (value: GateAssignment[] | null) => void;
    moveToGate: () => void;
    startRace: () => void;
    setCurrentPhase: (phaseId: string) => void;
    setPaceResult: (face: number, label: string) => void;
    // Bundle-6 / P4-4 + CR-19 / 2026-05-10: 仕様 scene3-race.md §6「完全な状態復元」準拠。
    // CR-8 (2026-04) で導入された revertPhaseHistory action は本 Bundle で完全削除した。
    // 戻る操作（useRaceEngine.prevPhase）は setCurrentPhase で前フェーズに戻すのみで、
    // history / paceResult / specialStrategy / manualModifier すべて保持する。
    moveToJudgment: () => void;
    moveToResult: () => void;
    moveToSetup: () => void;
    resetRace: () => void;
}

// CR-5a: localStorage に永続化される state の形。
// uiState.isParsingInput は一時 UI フラグのため除外（リロード後 false で初期化）。
// CR-5a-2: gateAssignments を中間状態として永続化対象に含める（houserule-features.md §4.2 #6）。
export type PersistedRaceState = Pick<
    RaceStoreState,
    'config' | 'participants' | 'currentPhaseId' | 'paceResult' | 'strategies' | 'gateAssignments'
> & {
    uiState: { scene: RaceStoreState['uiState']['scene'] };
};

// CR-5a: persist 設定値（テスト容易性のため module-level に分離して export）
export const PERSIST_NAME = 'race-store';
// Bundle-7 / P4-6 / 2026-05-10: PERSIST_VERSION 1 → 2 にバンプ。
// version=1 旧データ（Bundle-1 D-5 で houseRules.enableExtendedUnique / effectValue 追加前）→
// version=2 へのデフォルト補完を persistMigrate で実施する。
// Bundle-8-T1 / 2026-05-10: PERSIST_VERSION 2 → 3 にバンプ。
// version=2 旧データ（Bundle-7 で houseRules 5 フィールド確定）→ version=3 へのデフォルト補完を
// persistMigrate で実施（DEFAULT_HOUSE_RULES.enableBondSkill 追加で透過対応）。
export const PERSIST_VERSION = 3;
export const RESTORE_ERROR_MESSAGE = '保存データの復元に失敗しました。新規セッションを開始します。';

// Bundle-7 / 2026-05-10: マイグレーション時の houseRules デフォルト補完値。
// 下記 create() の初期 state と同一値を保持。新規セッションと旧データ補完で同じ初期値が使われる。
// Bundle-8-T1 / CR-SA-4 / 2026-05-10: enableBondSkill 追加（5 → 6 フィールド）。
export const DEFAULT_HOUSE_RULES: HouseRulesData = {
    enableModifier: false,
    enableSpecialStrategy: false,
    enableCompositeUnique: false,
    enableExtendedUnique: false,
    enableBondSkill: false,
    effectValue: 15,
};

export const persistPartialize = (state: RaceStoreState): PersistedRaceState => ({
    config: state.config,
    participants: state.participants,
    currentPhaseId: state.currentPhaseId,
    paceResult: state.paceResult,
    strategies: state.strategies,
    gateAssignments: state.gateAssignments,
    uiState: {
        scene: state.uiState.scene,
    },
});

// Bundle-7 / P4-6 / 2026-05-10: 実マイグレーション化。
// version=1 旧データ: houseRules.enableExtendedUnique / effectValue を補完（Bundle-7 から）。
// Bundle-8-T1 / 2026-05-10: version=2 旧データ: houseRules.enableBondSkill を補完（Bundle-8-T1 から）。
// 実装方針: DEFAULT_HOUSE_RULES でマージ補完するため version 引数分岐は不要（DEFAULT 拡張のみで透過対応）。
// zod 検証で型不正・値域違反（effectValue 小数/負値/上限超等）を検知し、
// 失敗時は throw → onRehydrateStorage の handleRehydrateError に合流（RESTORE_ERROR_MESSAGE 通知 +
// デフォルト state 起動）。
export const persistMigrate = (persistedState: unknown, version: number): PersistedRaceState => {
    void version; // 現状全旧データ共通で同じ補完を行うため version 分岐は不要

    if (persistedState === null || typeof persistedState !== 'object') {
        throw new Error('persisted state is not an object');
    }

    const state = persistedState as Partial<PersistedRaceState> & {
        config?: Partial<PersistedRaceState['config']> & {
            houseRules?: Partial<HouseRulesData>;
        };
    };

    const persistedHouseRules = state.config?.houseRules ?? {};
    const mergedHouseRules: HouseRulesData = {
        ...DEFAULT_HOUSE_RULES,
        ...persistedHouseRules,
    };

    const validation = houseRulesSchema.safeParse(mergedHouseRules);
    if (!validation.success) {
        throw new Error(
            `houseRules schema validation failed: ${validation.error.message}`
        );
    }

    const baseConfig = state.config ?? { midPhaseCount: 1, fullGateSize: null };
    return {
        ...state,
        config: {
            ...baseConfig,
            houseRules: validation.data,
        },
    } as PersistedRaceState;
};

export const handleRehydrateError = (error: unknown): void => {
    if (error) {
        // 破損データ復元失敗時: zustand persist はエラー時 rehydrate を skip するため
        // 初期 state（デフォルト値）が維持される。併せてユーザー通知を発行する。
        // Bundle-7 / 2026-05-10: persistMigrate の zod 検証失敗 throw もここに合流する。
        useNotificationStore.getState().addNotification('error', RESTORE_ERROR_MESSAGE);
    }
};

export const useRaceStore = create<RaceStoreState>()(
    persist(
        (set) => ({
            config: {
                midPhaseCount: 1,
                fullGateSize: null,
                houseRules: {
                    enableModifier: false,
                    enableSpecialStrategy: false,
                    enableCompositeUnique: false,
                    // Bundle-1 / D-5 / 2026-05-09: 拡張固有タイプ ON/OFF
                    enableExtendedUnique: false,
                    // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 絆スキル ON/OFF（houserule-features.md §2 [v] 絆スキル）
                    enableBondSkill: false,
                    // Bundle-1 / D-5 / 2026-05-09: 状態異常効果値 (N)（houserule-features.md §3 デフォルト 15）
                    effectValue: 15,
                },
            },
            participants: [],
            currentPhaseId: 'setup',
            paceResult: {
                face: null,
                label: null,
            },
            strategies: STRATEGIES,
            gateAssignments: null,

            uiState: {
                scene: 'setup',
                isParsingInput: false,
            },

            setCurrentPhase: (phaseId) => set({ currentPhaseId: phaseId }),
            setPaceResult: (face, label) => set({ paceResult: { face, label } }),

            // #1-3a-9 Soft Delete:
            // midPhaseCount を変更しても history は削除しない（データ保持）。
            // ただし合計スコア計算は「現在設定されているフェーズ」のみを合算対象とするため、
            // participants.score を新しい midPhaseCount で再計算する。
            // 回数を増やした場合は、保持されていた history[Mid2] 等が自動的に合算復帰する。
            setMidPhaseCount: (count) =>
                set((state) => {
                    const activePhaseIds = getActivePhaseIds(count);
                    return {
                        config: {
                            ...state.config,
                            midPhaseCount: count,
                        },
                        participants: state.participants.map(p => ({
                            ...p,
                            // Bundle-4 Round 2 / 2026-05-10: 解析未実行 phase 除外 + specialStrategy delta 一元化
                            // Bundle-8-T6 / CR-SA-4 / 2026-05-10: 絆スキル最終加算統合
                            score: calculateScoreWithBondSkill(
                                p,
                                state.strategies,
                                state.paceResult.face,
                                activePhaseIds,
                                state.config.houseRules,
                            ),
                        })),
                    };
                }),

            setFullGateSize: (size: number) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        fullGateSize: size,
                    }
                })),

            // Bundle-9 / 2026-05-10: 5 フィールドのいずれか/複数を部分更新する。
            // 既存値とマージするため、未指定のフィールドは現状維持される。
            // Bundle-4 / P4-1, P4-5 / 2026-05-10: effectValue 変更時、specialStrategy 設定済の
            // 参加者は score に effectValue が反映されているため、新値で再計算する。
            updateHouseRules: (updates) =>
                set((state) => {
                    const newHouseRules = {
                        ...state.config.houseRules,
                        ...updates,
                    };
                    const newConfig = { ...state.config, houseRules: newHouseRules };

                    const effectValueChanged =
                        updates.effectValue !== undefined &&
                        updates.effectValue !== state.config.houseRules.effectValue;
                    const enableChanged =
                        updates.enableSpecialStrategy !== undefined &&
                        updates.enableSpecialStrategy !==
                            state.config.houseRules.enableSpecialStrategy;
                    // Bundle-8-T6 / CR-SA-4 / 2026-05-10: enableBondSkill OFF→ON / ON→OFF 切替時にも
                    // 絆スキル分の delta が score へ加減されるよう再計算をトリガーする。
                    const bondSkillChanged =
                        updates.enableBondSkill !== undefined &&
                        updates.enableBondSkill !==
                            state.config.houseRules.enableBondSkill;

                    if (!effectValueChanged && !enableChanged && !bondSkillChanged) {
                        return { config: newConfig };
                    }

                    const activePhaseIds = getActivePhaseIds(state.config.midPhaseCount);
                    return {
                        config: newConfig,
                        participants: state.participants.map((p) => ({
                            ...p,
                            score: calculateScoreWithBondSkill(
                                p,
                                state.strategies,
                                state.paceResult.face,
                                activePhaseIds,
                                newHouseRules,
                            ),
                        })),
                    };
                }),

            // Bundle-4 / P4-1, P4-5 / 2026-05-10: 特殊戦法設定 + score 即時加減算。
            // history[phaseId].specialStrategy を更新後、解析未実行 phase を除外した score を再計算。
            setSpecialStrategy: (participantId, phaseId, value) =>
                set((state) => {
                    const activePhaseIds = getActivePhaseIds(state.config.midPhaseCount);
                    return {
                        participants: state.participants.map((p) => {
                            if (p.id !== participantId) return p;

                            const oldEntry = p.history[phaseId] ?? { computedScore: 0 };
                            const newHistory = {
                                ...p.history,
                                [phaseId]: { ...oldEntry, specialStrategy: value },
                            };
                            const next: Umamusume = { ...p, history: newHistory };

                            return {
                                ...next,
                                score: calculateScoreWithBondSkill(
                                    next,
                                    state.strategies,
                                    state.paceResult.face,
                                    activePhaseIds,
                                    state.config.houseRules,
                                ),
                            };
                        }),
                    };
                }),

            // Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 汎用補正の設定 + score 即時加減算。
            // history[phaseId].manualModifier = { value, reason } を更新後、Bundle-4 の純粋関数
            // calculateScoreWithSpecialStrategy 経由で score 再計算（manualModifier は Calculator 内
            // で `.value` のみ加算されるため、戦法 delta との合算挙動も統一される）。
            setManualModifier: (participantId, phaseId, value, reason) =>
                set((state) => {
                    const activePhaseIds = getActivePhaseIds(state.config.midPhaseCount);
                    return {
                        participants: state.participants.map((p) => {
                            if (p.id !== participantId) return p;

                            const oldEntry = p.history[phaseId] ?? { computedScore: 0 };
                            const newHistory = {
                                ...p.history,
                                [phaseId]: {
                                    ...oldEntry,
                                    manualModifier: { value, reason },
                                },
                            };
                            const next: Umamusume = { ...p, history: newHistory };

                            return {
                                ...next,
                                score: calculateScoreWithBondSkill(
                                    next,
                                    state.strategies,
                                    state.paceResult.face,
                                    activePhaseIds,
                                    state.config.houseRules,
                                ),
                            };
                        }),
                    };
                }),

            // Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 汎用補正のクリア + score 復元。
            // history[phaseId] から manualModifier フィールドを削除する（updateParticipant の
            // uniqueDice クリア処理と同パターン: { ...entry } して delete）。
            clearManualModifier: (participantId, phaseId) =>
                set((state) => {
                    const activePhaseIds = getActivePhaseIds(state.config.midPhaseCount);
                    return {
                        participants: state.participants.map((p) => {
                            if (p.id !== participantId) return p;

                            const oldEntry = p.history[phaseId];
                            if (!oldEntry || oldEntry.manualModifier === undefined) {
                                return p;
                            }
                            const cleared = { ...oldEntry };
                            delete cleared.manualModifier;
                            const newHistory = { ...p.history, [phaseId]: cleared };
                            const next: Umamusume = { ...p, history: newHistory };

                            return {
                                ...next,
                                score: calculateScoreWithBondSkill(
                                    next,
                                    state.strategies,
                                    state.paceResult.face,
                                    activePhaseIds,
                                    state.config.houseRules,
                                ),
                            };
                        }),
                    };
                }),

            // Bundle-8-T1 / CR-SA-4 / 2026-05-10: 絆スキル種別の設定 (houserule-features.md §2 [v] 絆スキル)。
            // フェーズ非依存で participants[*] 直下に配置。
            // Bundle-8-T6 / CR-SA-4 / 2026-05-10: 種別変更時に score 再計算を追加。
            // 終盤後に既に bondDice が格納されている状態で種別を切り替えた場合（種別 null → BondGamble、
            // BondGamble → null 等）、calculateBondSkillDelta が新しい種別判定で 0/sum を返すため
            // score へ即時反映される。bondDice 不在時（Scene 1 段階）は delta = 0 で score 変動なし。
            setBondSkill: (participantId, type) =>
                set((state) => {
                    const activePhaseIds = getActivePhaseIds(state.config.midPhaseCount);
                    return {
                        participants: state.participants.map((p) => {
                            if (p.id !== participantId) return p;
                            const next: Umamusume = { ...p, bondSkill: { type } };
                            return {
                                ...next,
                                score: calculateScoreWithBondSkill(
                                    next,
                                    state.strategies,
                                    state.paceResult.face,
                                    activePhaseIds,
                                    state.config.houseRules,
                                ),
                            };
                        }),
                    };
                }),

            // Bundle-8-T1 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 特殊戦法発動位置 Scene 1 事前申告 (scene1-setup.md §2)。
            // 値域チェックは UI / validator 層に委ねる（防御的判定なし）。score 再計算は行わない（T4 で戦法ボタン連動時に追加）。
            setSpecialStrategyPhase: (participantId, phaseId) =>
                set((state) => ({
                    participants: state.participants.map((p) => {
                        if (p.id !== participantId) return p;
                        return { ...p, specialStrategyPhase: phaseId };
                    }),
                })),

            // Bundle-8-T2 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 特殊戦法種別 Scene 1 事前申告 (scene1-setup.md §2)。
            // 既存 setSpecialStrategy（history 配下、Scene 3 戦法ボタン操作専用）と責務分離。
            // 値域チェックは UI / validator 層に委ねる（防御的判定なし）。score 再計算は T6 で追加。
            setSpecialStrategyType: (participantId, type) =>
                set((state) => ({
                    participants: state.participants.map((p) => {
                        if (p.id !== participantId) return p;
                        return { ...p, specialStrategyType: type };
                    }),
                })),

            // Bundle-10-T1 / CR-SA-12 / 2026-05-11: 脚質エディタ Insert 用 action
            // (houserule-features.md §1 Insert / modal-houserule.md §2 Insert)
            // 既存配列内で `insertAfterName` の脚質を探し、その直後に新規 strategy を挿入。
            // 該当 name 不在時は no-op（state 不変）。重複チェック / 値域チェックは UI / validator 層。
            // strategies は persist 対象 (partialize に含まれる) のため、本 action 経由の追加で透過的に永続化される。
            addStrategy: (insertAfterName, strategy) =>
                set((state) => {
                    const idx = state.strategies.findIndex((s) => s.name === insertAfterName);
                    if (idx === -1) {
                        return state;
                    }
                    const next = [...state.strategies];
                    next.splice(idx + 1, 0, strategy);
                    return { strategies: next };
                }),

            // Bundle-10-T1 / CR-SA-12 / 2026-05-11: 脚質エディタ Edit 用 action
            // (houserule-features.md §1 Edit / modal-houserule.md §2 Edit)
            // 既存配列内で `name` の脚質を `updates` でマージ更新。デフォルト 5 脚質も編集可能（仕様 §1 Edit）。
            // 編集した脚質を選択している participant の score を再計算する（fixValue / dice / paceModifiers
            // 変更時に Calculator が新値を参照するため、setSpecialStrategy / setManualModifier 同パターンで
            // calculateScoreWithBondSkill 経由 score 再計算を組み込む）。
            updateStrategy: (name, updates) =>
                set((state) => {
                    const idx = state.strategies.findIndex((s) => s.name === name);
                    if (idx === -1) {
                        return state;
                    }
                    const newStrategies = [...state.strategies];
                    newStrategies[idx] = { ...newStrategies[idx], ...updates };
                    const activePhaseIds = getActivePhaseIds(state.config.midPhaseCount);
                    return {
                        strategies: newStrategies,
                        participants: state.participants.map((p) => ({
                            ...p,
                            score: calculateScoreWithBondSkill(
                                p,
                                newStrategies,
                                state.paceResult.face,
                                activePhaseIds,
                                state.config.houseRules,
                            ),
                        })),
                    };
                }),

            // Bundle-10-T1 / CR-SA-12 / 2026-05-11: 脚質エディタ Delete 用 action
            // (houserule-features.md §1 Delete / modal-houserule.md §2 Delete)
            // デフォルト 5 脚質名は no-op（仕様「カスタム脚質のみ削除可能」）。
            // 削除実行時、当該脚質を選択していた participant の strategy を '' (未選択) に強制リセット +
            // score を再計算（Calculator がベーススコア 0 扱いに復帰）。2 段階確認 / 警告ダイアログ表示は
            // UI 層 (T2 スコープ) の責務、本 action は呼ばれた時点で削除を実行するのみ。
            removeStrategy: (name) =>
                set((state) => {
                    if (isDefaultStrategy(name)) {
                        return state;
                    }
                    const exists = state.strategies.some((s) => s.name === name);
                    if (!exists) {
                        return state;
                    }
                    const newStrategies = state.strategies.filter((s) => s.name !== name);
                    const activePhaseIds = getActivePhaseIds(state.config.midPhaseCount);
                    return {
                        strategies: newStrategies,
                        participants: state.participants.map((p) => {
                            const next: Umamusume =
                                p.strategy === name ? { ...p, strategy: '' } : p;
                            return {
                                ...next,
                                score: calculateScoreWithBondSkill(
                                    next,
                                    newStrategies,
                                    state.paceResult.face,
                                    activePhaseIds,
                                    state.config.houseRules,
                                ),
                            };
                        }),
                    };
                }),

            generateParticipants: (count: number) =>
                set((state) => {
                    const current = state.participants;
                    let newParticipants: Umamusume[] = [];

                    if (count >= current.length) {
                        // Keep existing and add new
                        const toAdd = count - current.length;
                        const added = Array.from({ length: toAdd }, (_, i) => ({
                            id: crypto.randomUUID(),
                            entryIndex: current.length + i + 1,
                            name: '',
                            strategy: undefined as unknown as string,
                            uniqueSkill: {
                                type: undefined as unknown as any,
                                phases: [],
                            },
                            gate: null,
                            score: 0,
                            history: {},
                        }));
                        newParticipants = [...current, ...added];
                    } else {
                        // Truncate
                        newParticipants = current.slice(0, count);
                    }

                    return { participants: newParticipants };
                }),

            addParticipant: (input) =>
                set((state) => ({
                    participants: [
                        ...state.participants,
                        {
                            ...input,
                            score: 0,
                            history: {},
                        },
                    ],
                })),

            removeParticipant: (id) =>
                set((state) => ({
                    participants: state.participants.filter((p) => p.id !== id),
                })),

            updateParticipant: (id, updates) =>
                set((state) => ({
                    participants: state.participants.map((p) => {
                        if (p.id !== id) return p;
                        const next: Umamusume = { ...p, ...updates };

                        // CR-38 / basic-rules.md §6 Case 4:
                        // uniqueSkill.phases から外れたフェーズの uniqueDice をサイレント自動クリアし、
                        // スコアを再計算する。baseDice / manualModifier / specialStrategy / computedScore は保持する。
                        if (updates.uniqueSkill) {
                            const oldPhases = p.uniqueSkill?.phases ?? [];
                            const newPhases = next.uniqueSkill?.phases ?? [];
                            const removed = oldPhases.filter((ph) => !newPhases.includes(ph));

                            if (removed.length > 0) {
                                const newHistory: typeof next.history = { ...next.history };
                                for (const ph of removed) {
                                    const entry = newHistory[ph];
                                    if (entry && entry.uniqueDice !== undefined) {
                                        const cleared = { ...entry };
                                        delete cleared.uniqueDice;
                                        newHistory[ph] = cleared;
                                    }
                                }
                                next.history = newHistory;
                            }

                            // Bundle-4 / 2026-05-10: 解析未実行 phase 除外 + specialStrategy delta 上乗せの一元化関数
                            // Bundle-8-T6 / CR-SA-4 / 2026-05-10: 絆スキル最終加算統合
                            next.score = calculateScoreWithBondSkill(
                                next,
                                state.strategies,
                                state.paceResult.face,
                                getActivePhaseIds(state.config.midPhaseCount),
                                state.config.houseRules,
                            );
                        } else if (updates.history) {
                            // Bundle-4 Round 2 / 2026-05-10: history 単独更新時も score 再計算（PhaseInput 解析実行経路で
                            // specialStrategy delta が反映されるようにするための連動）。
                            // Bundle-8-T6 / CR-SA-4 / 2026-05-10: PhaseInput が history.End.bondDice を
                            // 格納する経路（T5 で実装）にも本分岐が反応し、絆スキル分が score へ即時反映される。
                            next.score = calculateScoreWithBondSkill(
                                next,
                                state.strategies,
                                state.paceResult.face,
                                getActivePhaseIds(state.config.midPhaseCount),
                                state.config.houseRules,
                            );
                        }

                        return next;
                    }),
                })),

            applyGateAssignments: (assignments) =>
                set((state) => ({
                    participants: state.participants.map((p) => {
                        const assignment = assignments.find((a) => a.id === p.id);
                        return assignment ? { ...p, gate: assignment.gate } : p;
                    }),
                })),

            setGateAssignments: (value) => set({ gateAssignments: value }),

            // Bundle-6 / P4-4 + CR-19 / 2026-05-10: CR-8 由来の revertPhaseHistory action は
            // 仕様 scene3-race.md §6「完全な状態復元」準拠のため本 Bundle で完全削除した。
            // 戻る操作で消したい場合は戻り先で個別 action（clearManualModifier / setSpecialStrategy(null) /
            // ダイス再貼付けによる history 上書き）を使用する。

            // #1-3a-3: エントリー確定時に名前空欄行を除外し、以降の Scene では
            // 名前入力済みの有効参加者のみを扱う。仕様: scene1-setup.md ワイヤーフレーム
            // 「名前が空欄の行は無視される」。
            moveToGate: () =>
                set((state) => ({
                    participants: state.participants.filter(p => p.name.trim() !== ''),
                    uiState: { ...state.uiState, scene: 'gate' },
                    currentPhaseId: 'gate_lottery', // Use a clear ID
                })),

            startRace: () =>
                set((state) => ({
                    uiState: { ...state.uiState, scene: 'race' },
                    currentPhaseId: 'Start',
                })),

            moveToJudgment: () =>
                set((state) => ({
                    uiState: { ...state.uiState, scene: 'judgment' },
                    currentPhaseId: 'judgment_phase',
                })),

            moveToResult: () =>
                set((state) => ({
                    uiState: { ...state.uiState, scene: 'result' },
                    currentPhaseId: 'result_phase',
                })),

            moveToSetup: () =>
                set((state) => ({
                    uiState: { ...state.uiState, scene: 'setup' },
                    currentPhaseId: 'setup',
                })),

            resetRace: () => {
                set((state) => ({
                    participants: [],
                    config: {
                        ...state.config,
                        fullGateSize: null,
                    },
                    currentPhaseId: 'setup',
                    uiState: { scene: 'setup', isParsingInput: false },
                    paceResult: { face: null, label: null },
                    // CR-5a-2: 中間状態もリセット（houserule-features.md §4.5）
                    gateAssignments: null,
                }));
                // CR-5a: localStorage 側もクリア（storage 未提供環境では persist API 自体が未付与のため no-op）
                void useRaceStore.persist?.clearStorage?.();
            },
        }),
        {
            name: PERSIST_NAME,
            version: PERSIST_VERSION,
            migrate: persistMigrate,
            partialize: persistPartialize,
            onRehydrateStorage: () => (_state, error) => handleRehydrateError(error),
        }
    )
);
