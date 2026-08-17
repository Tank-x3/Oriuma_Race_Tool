// Bundle-10-T2 / CR-SA-12 / 2026-05-11: 脚質エディタモーダル UI 用純粋関数群
// (modal-houserule.md §2 + houserule-features.md §1 + SA20 §5.3 Engineer 裁量範囲)
// UI 表示・入力ハンドリング・状態遷移を純粋関数として切り出し、StrategyEditorModal.tsx 本体から
// ロジックを分離する。テストは strategyEditor.helpers.test.ts に集約。
import type { FormationRowId, Strategy, Umamusume } from '../../../types';
import { isMidRace, isStrategyInUse, isDefaultStrategy } from '../../../core/strategy.helpers';
import { DEFAULT_STRATEGIES, PACE_MODIFIERS } from '../../../core/strategies';
import { FORMATION_EFFECT_TABLE, FORMATION_ROW_IDS } from '../../../core/formation';

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

// CR-SA-24-E2 / 2026-08-16: 隊列〔バ群〕補正マトリクスの組み込み値を FORMATION_EFFECT_TABLE から
// 抽出する (getDefaultPaceModifiers と対になるヘルパー、houserule-features.md §6.10.3 解決順 2)。
// 効果表に列を持つ DEFAULT 5 脚質のみ値が返り、カスタム脚質は空オブジェクトになる。
// 編集サブモーダル表示時のフォールバック /「初期値に戻す」操作で利用する。
export function getDefaultFormationModifiers(
    strategyName: string,
): Partial<Record<FormationRowId, number>> {
    const result: Partial<Record<FormationRowId, number>> = {};
    for (const row of FORMATION_EFFECT_TABLE) {
        const value = row.modifiers[strategyName];
        if (value !== undefined) {
            result[row.id] = value;
        }
    }
    return result;
}

// CR-SA-24-E2 / 2026-08-16: 隊列補正マトリクスの行ラベル (modal-houserule.md §2 ワイヤーフレーム)。
// 「出目 + 形態名 + ペース条件」を効果表から生成する。表示専用であり編集対象ではない
// (出目区切り・形態名・ペース分岐は houserule-features.md §6.10.2「変更対象外」)。
export interface FormationRowLabel {
    id: FormationRowId;
    label: string;
}

const FORMATION_PACE_SUFFIX: Record<string, string> = {
    middleOrSlower: '（ペース〜ミドル）',
    highOrFaster: '（ペース ハイ〜）',
    any: '',
};

export const FORMATION_ROW_LABELS: readonly FormationRowLabel[] = FORMATION_EFFECT_TABLE.map(
    (row) => ({
        id: row.id,
        label: `${row.faces.join('.')} ${row.label}${FORMATION_PACE_SUFFIX[row.pace] ?? ''}`,
    }),
);

// 隊列補正 7 行分のフォーム値を組み立てる (走査順 = FORMATION_ROW_IDS = 効果表の行順)。
const buildFormationFormValues = (
    resolve: (rowId: FormationRowId) => string,
): Partial<Record<FormationRowId, string>> => {
    const result: Partial<Record<FormationRowId, string>> = {};
    for (const rowId of FORMATION_ROW_IDS) {
        result[rowId] = resolve(rowId);
    }
    return result;
};

// 編集 / 挿入サブモーダルのフォーム状態。
// 入力中は生文字列で保持し、保存時に Strategy オブジェクトへ変換する
// (HTML <input type="number"> の入力途中 "-" や空文字を扱うため)。
//
// CR-SA-24-E2 / 2026-08-16: 隊列〔バ群〕補正 (7 行) を追加。paceModifiers と同型で、
// enableFormationDice OFF (入力欄が非表示) のときもフォーム状態には値を保持する
// = 画面に出ていない設定値を保存時に失わないための造り (modal-houserule.md §2 表示条件)。
export interface StrategyFormState {
    name: string;
    fixValue: string;
    diceStart: string;
    diceMid: string;
    diceEnd: string;
    paceModifiers: Record<number, string>;
    formationModifiers: Partial<Record<FormationRowId, string>>;
}

// 編集サブモーダルの初期フォーム生成 (既存 Strategy を読み込んで文字列化)。
// DEFAULT 5 脚質編集時は paceModifiers が空オブジェクトのため、PACE_MODIFIERS グローバルから
// フォールバック取得して表示する (ユーザーに有効値が見えるようにする)。
//
// CR-SA-24-E2 / 2026-08-16: 隊列補正も同じ方針で解決する (modal-houserule.md §2 初期表示値)。
// 解決順は houserule-features.md §6.10.3 と一致させる:
//   ① 脚質の設定値にキーがある → その値 / ② なく効果表に列がある → 効果表の値 / ③ それ以外 → 空欄。
// これにより「フォームの表示値 = getFormationModifier が返す有効値」が保たれる。
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
    const formationFallback = getDefaultFormationModifiers(strategy.name);
    const formationModifiers = buildFormationFormValues((rowId) => {
        const configured = strategy.formationModifiers?.[rowId];
        if (configured !== undefined) return String(configured);
        const fallback = formationFallback[rowId];
        if (fallback !== undefined) return String(fallback);
        return '';
    });
    return {
        name: strategy.name,
        fixValue: String(strategy.fixValue),
        diceStart: strategy.dice.start,
        diceMid: strategy.dice.mid,
        diceEnd: strategy.dice.end,
        paceModifiers,
        formationModifiers,
    };
}

// DEFAULT 5 脚質の「初期値に戻す」フォーム生成。
// DEFAULT_STRATEGIES + PACE_MODIFIERS グローバルから基本ルール値で初期化する。
// DEFAULT 脚質名以外を渡された場合は null を返す (UI 側で「初期値に戻す」ボタン非表示判定に使う)。
// CR-SA-24-E2 / 2026-08-16: 隊列補正も FORMATION_EFFECT_TABLE の値へ戻す (modal-houserule.md §2)。
export function createDefaultResetFormState(strategyName: string): StrategyFormState | null {
    if (!isDefaultStrategy(strategyName)) return null;
    const baseStrategy = DEFAULT_STRATEGIES.find((s) => s.name === strategyName);
    if (!baseStrategy) return null;
    const paceModifiers: Record<number, string> = {};
    const defaults = getDefaultPaceModifiers(strategyName);
    for (const roll of PACE_ROLL_RANGE) {
        paceModifiers[roll] = defaults[roll] !== undefined ? String(defaults[roll]) : '';
    }
    const formationDefaults = getDefaultFormationModifiers(strategyName);
    const formationModifiers = buildFormationFormValues((rowId) => {
        const value = formationDefaults[rowId];
        return value !== undefined ? String(value) : '';
    });
    return {
        name: baseStrategy.name,
        fixValue: String(baseStrategy.fixValue),
        diceStart: baseStrategy.dice.start,
        diceMid: baseStrategy.dice.mid,
        diceEnd: baseStrategy.dice.end,
        paceModifiers,
        formationModifiers,
    };
}

// 新規挿入サブモーダルの初期フォーム生成。
// houserule-features.md §1 Insert「選択した（直前の）脚質の全パラメータをコピー」
// → 名前のみ空欄初期化、その他は直前脚質と同値。
// CR-SA-24-E2 / 2026-08-16: 隊列補正も createEditFormState 経由でコピーされる。コピー元は
// フォールバック解決済みの「表示上の有効値」のため、直前が DEFAULT 5 脚質（設定値が空）でも
// 効果表の値が入り、保存時に実値化される = カスタム脚質は挿入直後から隊列補正が効く（§1 Insert）。
// enableFormationDice OFF で入力欄が非表示のときもコピーはデータ層で行われる。
export function createInsertFormState(prevStrategy: Strategy): StrategyFormState {
    const base = createEditFormState(prevStrategy);
    return { ...base, name: '' };
}

// フォーム状態 → Strategy オブジェクト変換。
// 空欄 / 不正値は 0 にフォールバック (T2 スコープでは Validation は最小限、
// 厳密検証 / エラー文言は T3 スコープ Bundle-10-T3)。
//
// CR-SA-24-E2 / 2026-08-16: 隊列補正はフォーム値優先で構築する
// （E1 の「sourceStrategy の値を無条件パススルー」から方式転換。入力欄が付いたため
//   フォームが SSoT になった）。空欄 / 数値化できない値はキーを立てない = 未設定
// （houserule-features.md §6.10.3 空欄保存の扱い。`?? 0` にすると「明示的な 0」と
//   区別できなくなり、DEFAULT 5 脚質が組み込み値へ戻る挙動が壊れる）。
//
// 値の消失防止（modal-houserule.md §2 表示条件 / CLAUDE.md「破壊的動作のデフォルト禁止」）:
// - enableFormationDice OFF でセクションが非表示のときも、フォーム状態には
//   createEditFormState / createInsertFormState が解決した値が入っているため、
//   「画面に出ていない設定値が保存時に消える」経路は成立しない。
// - 効果表 7 行に該当しないキー（zod は行 ID を列挙制限しないため、旧 / 将来形式の
//   JSON プリセット経由で入り得る）はフォームが関知しないため sourceStrategy から引き継ぐ。
export function formStateToStrategy(form: StrategyFormState, sourceStrategy?: Strategy): Strategy {
    const paceModifiers: Record<number, number> = {};
    for (const roll of PACE_ROLL_RANGE) {
        const raw = form.paceModifiers[roll] ?? '';
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed)) {
            paceModifiers[roll] = parsed;
        }
    }
    const fixValueParsed = parseInt(form.fixValue, 10);
    const strategy: Strategy = {
        name: form.name.trim(),
        fixValue: Number.isNaN(fixValueParsed) ? 0 : fixValueParsed,
        dice: {
            start: form.diceStart.trim(),
            mid: form.diceMid.trim(),
            end: form.diceEnd.trim(),
        },
        paceModifiers,
    };
    const formationModifiers: Partial<Record<FormationRowId, number>> = {};
    // ① フォームが関知しないキー（効果表 7 行以外）を編集元から引き継ぐ。
    for (const [key, value] of Object.entries(sourceStrategy?.formationModifiers ?? {})) {
        if (value === undefined) continue;
        if (!FORMATION_ROW_IDS.includes(key as FormationRowId)) {
            formationModifiers[key as FormationRowId] = value;
        }
    }
    // ② 効果表 7 行はフォーム値で構築する（空欄はキーを立てない = 未設定へ戻す明示操作）。
    for (const rowId of FORMATION_ROW_IDS) {
        const raw = form.formationModifiers?.[rowId] ?? '';
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed)) {
            formationModifiers[rowId] = parsed;
        }
    }
    // 値がある場合のみキーを付ける（未設定と空オブジェクトの区別は不要だが、
    // 既存の Strategy 形状を変えずに済むため差分を最小化する）。
    if (Object.keys(formationModifiers).length > 0) {
        strategy.formationModifiers = formationModifiers;
    }
    return strategy;
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
