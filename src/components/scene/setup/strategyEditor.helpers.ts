// Bundle-10-T2 / CR-SA-12 / 2026-05-11: 脚質エディタモーダル UI 用純粋関数群
// (modal-houserule.md §2 + houserule-features.md §1 + SA20 §5.3 Engineer 裁量範囲)
// UI 表示・入力ハンドリング・状態遷移を純粋関数として切り出し、StrategyEditorModal.tsx 本体から
// ロジックを分離する。テストは strategyEditor.helpers.test.ts に集約。
import type { Strategy, Umamusume } from '../../../types';
import { isMidRace, isStrategyInUse, isDefaultStrategy } from '../../../core/strategy.helpers';
import { DEFAULT_STRATEGIES, PACE_MODIFIERS } from '../../../core/strategies';

// ペース補正マトリクス対象の出目 (1〜9)
export const PACE_ROLL_RANGE = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

// DEFAULT 5 脚質の有効ペース補正値を PACE_MODIFIERS グローバルから抽出する。
// DEFAULT_STRATEGIES.paceModifiers は仕様上 {} 空で、PACE_MODIFIERS グローバルが SSoT のため、
// 編集サブモーダル表示時のフォールバック / 「初期値に戻す」操作で利用する。
export function getDefaultPaceModifiers(strategyName: string): Record<number, number> {
    const result: Record<number, number> = {};
    for (const roll of PACE_ROLL_RANGE) {
        const value = PACE_MODIFIERS[roll]?.[strategyName];
        if (value !== undefined) {
            result[roll] = value;
        }
    }
    return result;
}

// 編集 / 挿入サブモーダルのフォーム状態。
// 入力中は生文字列で保持し、保存時に Strategy オブジェクトへ変換する
// (HTML <input type="number"> の入力途中 "-" や空文字を扱うため)。
export interface StrategyFormState {
    name: string;
    fixValue: string;
    diceStart: string;
    diceMid: string;
    diceEnd: string;
    paceModifiers: Record<number, string>;
}

// 編集サブモーダルの初期フォーム生成 (既存 Strategy を読み込んで文字列化)。
// DEFAULT 5 脚質編集時は paceModifiers が空オブジェクトのため、PACE_MODIFIERS グローバルから
// フォールバック取得して表示する (ユーザーに有効値が見えるようにする)。
export function createEditFormState(strategy: Strategy): StrategyFormState {
    const fallback = isDefaultStrategy(strategy.name)
        ? getDefaultPaceModifiers(strategy.name)
        : null;
    const paceModifiers: Record<number, string> = {};
    for (const roll of PACE_ROLL_RANGE) {
        const value = strategy.paceModifiers[roll];
        if (value !== undefined) {
            paceModifiers[roll] = String(value);
        } else if (fallback && fallback[roll] !== undefined) {
            paceModifiers[roll] = String(fallback[roll]);
        } else {
            paceModifiers[roll] = '';
        }
    }
    return {
        name: strategy.name,
        fixValue: String(strategy.fixValue),
        diceStart: strategy.dice.start,
        diceMid: strategy.dice.mid,
        diceEnd: strategy.dice.end,
        paceModifiers,
    };
}

// DEFAULT 5 脚質の「初期値に戻す」フォーム生成。
// DEFAULT_STRATEGIES + PACE_MODIFIERS グローバルから基本ルール値で初期化する。
// DEFAULT 脚質名以外を渡された場合は null を返す (UI 側で「初期値に戻す」ボタン非表示判定に使う)。
export function createDefaultResetFormState(strategyName: string): StrategyFormState | null {
    if (!isDefaultStrategy(strategyName)) return null;
    const baseStrategy = DEFAULT_STRATEGIES.find((s) => s.name === strategyName);
    if (!baseStrategy) return null;
    const paceModifiers: Record<number, string> = {};
    const defaults = getDefaultPaceModifiers(strategyName);
    for (const roll of PACE_ROLL_RANGE) {
        paceModifiers[roll] = defaults[roll] !== undefined ? String(defaults[roll]) : '';
    }
    return {
        name: baseStrategy.name,
        fixValue: String(baseStrategy.fixValue),
        diceStart: baseStrategy.dice.start,
        diceMid: baseStrategy.dice.mid,
        diceEnd: baseStrategy.dice.end,
        paceModifiers,
    };
}

// 新規挿入サブモーダルの初期フォーム生成。
// houserule-features.md §1 Insert「選択した（直前の）脚質の全パラメータをコピー」
// → 名前のみ空欄初期化、その他は直前脚質と同値。
export function createInsertFormState(prevStrategy: Strategy): StrategyFormState {
    const base = createEditFormState(prevStrategy);
    return { ...base, name: '' };
}

// フォーム状態 → Strategy オブジェクト変換。
// 空欄 / 不正値は 0 にフォールバック (T2 スコープでは Validation は最小限、
// 厳密検証 / エラー文言は T3 スコープ Bundle-10-T3)。
export function formStateToStrategy(form: StrategyFormState): Strategy {
    const paceModifiers: Record<number, number> = {};
    for (const roll of PACE_ROLL_RANGE) {
        const raw = form.paceModifiers[roll] ?? '';
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed)) {
            paceModifiers[roll] = parsed;
        }
    }
    const fixValueParsed = parseInt(form.fixValue, 10);
    return {
        name: form.name.trim(),
        fixValue: Number.isNaN(fixValueParsed) ? 0 : fixValueParsed,
        dice: {
            start: form.diceStart.trim(),
            mid: form.diceMid.trim(),
            end: form.diceEnd.trim(),
        },
        paceModifiers,
    };
}

// 削除確認の段階。
// Pre-Race の場合は単一ダイアログで完了、Mid-Race は 2 段階確認。
export type DeleteConfirmStep = 'pre-race' | 'mid-race-warning' | 'mid-race-final';

// 削除確認の初期段階を判定 (modal-houserule.md §2 Delete Case A/B)。
export function getInitialDeleteStep(participants: Umamusume[]): DeleteConfirmStep {
    return isMidRace(participants) ? 'mid-race-warning' : 'pre-race';
}

// Mid-Race 2 段階確認の進行 (warning → final)。
// pre-race / mid-race-final は終端段階のため呼ばれた場合はそのまま返す。
export function progressDeleteStep(current: DeleteConfirmStep): DeleteConfirmStep {
    if (current === 'mid-race-warning') return 'mid-race-final';
    return current;
}

// 削除確認ダイアログのメッセージ生成 (isStrategyInUse の判定で文言補足を切替)。
// 仕様 SSoT (modal-houserule.md §2 Delete Case B Step 1) の文言を採用、
// Engineer 裁量範囲で「使用中ではない場合」「Pre-Race」の文言を補完。
export interface DeleteConfirmMessage {
    title: string;
    body: string;
    primaryLabel: string;
    cancelLabel: string;
}

export function getDeleteConfirmMessage(
    step: DeleteConfirmStep,
    strategyName: string,
    participants: Umamusume[],
): DeleteConfirmMessage {
    const inUse = isStrategyInUse(strategyName, participants);
    if (step === 'pre-race') {
        return {
            title: '脚質の削除',
            body: inUse
                ? `脚質「${strategyName}」を削除しますか？該当する出走者の脚質設定がリセットされます。`
                : `脚質「${strategyName}」を削除しますか？`,
            primaryLabel: '削除',
            cancelLabel: 'キャンセル',
        };
    }
    if (step === 'mid-race-warning') {
        return {
            title: '脚質の削除（警告）',
            body: inUse
                ? `この脚質「${strategyName}」は現在使用されています。削除すると、該当する出走者の設定がリセットされます。`
                : `脚質「${strategyName}」を削除します。`,
            primaryLabel: '次へ',
            cancelLabel: 'キャンセル',
        };
    }
    // mid-race-final
    return {
        title: '最終確認',
        body: `最終確認: 本当に「${strategyName}」を削除しますか？`,
        primaryLabel: '削除',
        cancelLabel: 'キャンセル',
    };
}
