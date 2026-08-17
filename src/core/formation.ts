// CR-SA-20-E2 / 2026-06-11: 隊列〔バ群〕ダイスの効果表・補正ロジック（純粋関数層）。
// SSoT: houserule-features.md §6.2（隊列形態）/ §6.3（効果表）/ §6.6（影響値テンプレート）。
// ペース境界「ミドルまで = 出目 1〜6 / ハイ以上 = 出目 7〜9」は basic-rules.md §3 対応。
//
// CR-SA-24-E1 / 2026-08-16: 隊列補正テーブルの GM 設定（§6.10）に対応。
// 本モジュールは calculator.ts（計算反映）/ PhaseOutput.tsx（隊列フェーズ出力）から配線済み。
// 補正取得は getPaceModifier（strategies.ts）と同型の純粋関数で、脚質リスト（state.strategies）を
// 受け取り §6.10.3 の解決順「脚質の設定値 → 効果表 → ±0」で解決する。効果表はデフォルト値であり、
// カスタム脚質にも設定値があれば補正が効く（旧 §6.3「カスタム脚質は常に ±0」の SA 判断は SA30 で撤回）。

import type { FormationRowId, Strategy } from '../types';

/** §6.3 効果表のペース条件（'any' = ペース無関係の行）。 */
export type FormationPaceCondition = 'any' | 'middleOrSlower' | 'highOrFaster';

/** §6.3 効果表の 1 行（隊列出目グループ × ペース条件 → 脚質別補正値）。 */
export interface FormationEffectRow {
    /**
     * CR-SA-24-E1 / 2026-08-16: 行 ID（§6.10.2）。
     * Strategy.formationModifiers のキーであり、脚質ごとの設定値との対応付けに使う。
     */
    id: FormationRowId;
    /** 隊列出目グループ（例: [2, 3]）。 */
    faces: readonly number[];
    /** 隊列形態名（§6.2）。 */
    label: string;
    /** ペース条件。超縦長（出目 1）・超団子（出目 9）のみペース依存。 */
    pace: FormationPaceCondition;
    /** デフォルト 5 脚質の補正値。±0 セルも明示的に 0 で保持する。 */
    modifiers: Readonly<Record<string, number>>;
}

/**
 * §6.3 効果表（7 行 × 5 脚質 = 35 セル）。
 * 「±0」セルはすべて 0 で明示（GM 確認点 ①）。
 * CR-SA-24-E1 / 2026-08-16: 位置づけを「固定表」から「デフォルト値」へ変更（§6.3 / §6.10.1）。
 * 値 35 セルは完全不変。
 */
export const FORMATION_EFFECT_TABLE: readonly FormationEffectRow[] = [
    { id: '1:middleOrSlower', faces: [1], label: '超縦長', pace: 'middleOrSlower', modifiers: { '大逃げ': 10, '逃げ': 7, '先行': 0, '差し': -5, '追込': -5 } },
    { id: '1:highOrFaster', faces: [1], label: '超縦長', pace: 'highOrFaster', modifiers: { '大逃げ': 0, '逃げ': 0, '先行': 0, '差し': 7, '追込': 10 } },
    { id: '2-3', faces: [2, 3], label: '縦長', pace: 'any', modifiers: { '大逃げ': 5, '逃げ': 5, '先行': 5, '差し': 0, '追込': 0 } },
    { id: '4-6', faces: [4, 5, 6], label: '普通', pace: 'any', modifiers: { '大逃げ': 0, '逃げ': 0, '先行': 0, '差し': 0, '追込': 0 } },
    { id: '7-8', faces: [7, 8], label: '団子', pace: 'any', modifiers: { '大逃げ': 0, '逃げ': 0, '先行': 0, '差し': 5, '追込': 5 } },
    { id: '9:middleOrSlower', faces: [9], label: '超団子', pace: 'middleOrSlower', modifiers: { '大逃げ': -10, '逃げ': -7, '先行': 0, '差し': 8, '追込': 12 } },
    { id: '9:highOrFaster', faces: [9], label: '超団子', pace: 'highOrFaster', modifiers: { '大逃げ': 7, '逃げ': 5, '先行': 0, '差し': 0, '追込': 0 } },
];

/**
 * CR-SA-24-E1 / 2026-08-16: 隊列補正マトリクスの行 ID 一覧（§6.10.2 の表順 = 効果表の行順）。
 * E2 の編集 UI・「初期値に戻す」の走査順として利用する。
 */
export const FORMATION_ROW_IDS: readonly FormationRowId[] =
    FORMATION_EFFECT_TABLE.map(r => r.id);

/** §6.6 影響値テンプレートの隊列出目グループ（テンプレート行の走査順）。 */
const FORMATION_FACE_GROUPS: readonly (readonly number[])[] = [
    [1],
    [2, 3],
    [4, 5, 6],
    [7, 8],
    [9],
];

/** §6.6 テンプレートの脚質列挙順（= §6.3 効果表の列順 = デフォルト 5 脚質の定義順）。 */
const DEFAULT_STRATEGY_ORDER: readonly string[] = ['大逃げ', '逃げ', '先行', '差し', '追込'];

/** ペース出目がハイペース以上（出目 7〜9、basic-rules.md §3）か判定する。 */
const isHighOrFasterPace = (paceRoll: number): boolean => paceRoll >= 7;

/** ペース出目が正常範囲（1〜9 の整数）か判定する。 */
const isValidPaceRoll = (paceRoll: number): boolean =>
    Number.isInteger(paceRoll) && paceRoll >= 1 && paceRoll <= 9;

/**
 * 隊列出目から隊列形態名（§6.2）を返す。範囲外は '不明'（getPaceLabel と同方針）。
 */
export function getFormationLabel(formationRoll: number): string {
    const row = FORMATION_EFFECT_TABLE.find(r => r.faces.includes(formationRoll));
    return row?.label ?? '不明';
}

/**
 * （隊列出目, ペース出目, 脚質名, 脚質リスト）→ 隊列補正値。
 *
 * CR-SA-24-E1 / 2026-08-16: §6.10.3 の解決順で解決する（getPaceModifier と同型の optional 引数）。
 * 1. 当該脚質の設定値（formationModifiers）に当該行のキーがある → その値
 * 2. なく、脚質名が効果表に列を持つ（デフォルト 5 脚質）→ 効果表の値
 * 3. それ以外（カスタム脚質でキー未設定）→ 0
 *
 * - 「空欄（キー未設定）」と「明示的な 0」は区別する（`!== undefined` 判定、`?? 0` は不可）
 * - 脚質リスト省略時は効果表のみで解決（＝改訂前と同一動作）
 * - 範囲外の隊列出目・ペース出目は 0（getPaceModifier のフォールバック方針に準拠）
 */
export function getFormationModifier(
    formationRoll: number,
    paceRoll: number,
    strategyName: string,
    strategies?: Strategy[],
): number {
    if (!isValidPaceRoll(paceRoll)) return 0;
    const paceCondition: FormationPaceCondition =
        isHighOrFasterPace(paceRoll) ? 'highOrFaster' : 'middleOrSlower';
    const row = FORMATION_EFFECT_TABLE.find(r =>
        r.faces.includes(formationRoll) && (r.pace === 'any' || r.pace === paceCondition));
    if (!row) return 0;
    const strategy = strategies?.find(s => s.name === strategyName);
    const configured = strategy?.formationModifiers?.[row.id];
    if (configured !== undefined) return configured;
    return row.modifiers[strategyName] ?? 0;
}

/** 補正値を §6.6 書式（`+10` / `-5`）に整形する。 */
const formatModifierValue = (value: number): string => (value > 0 ? `+${value}` : `${value}`);

/**
 * （確定済みペース出目）→ 影響値テンプレート行の配列（§6.6）。
 *
 * 生成規則:
 * - 各隊列出目グループ（1 / 2,3 / 4,5,6 / 7,8 / 9）に対し、効果表から変動がある
 *   （±0 でない）脚質のみを列挙。全脚質 ±0 のグループ（普通 = 4,5,6）は行ごと省略。
 * - 超縦長・超団子のペース依存行は、引数の確定済みペース出目に対応する 1 行のみ。
 * - 行書式: `[出目グループのドット結合],[形態名]　[補正列挙]`（形態名の後は全角スペース）。
 * - 同値まとめ: 変動脚質が「すべて同値」の行のみ `大逃げ・逃げ・先行に+5` 形式で
 *   「・」結合し、値が混在する行は `大逃げに+10、逃げに+7、…` と「、」で個別列挙する
 *   （§6.6 出力例 4 行すべてと整合する規則。例の超縦長行は差し・追込が同値 -5 でも
 *   個別列挙されているため、「部分的な同値ペアはまとめない」と解釈）。
 * - CR-SA-24-E1 / 2026-08-16: 走査対象は渡された脚質リスト全体（§6.6 改訂）。列挙順は
 *   脚質リストの並び順で、カスタム脚質も特別扱いせず含める（±0 なら列挙対象外は全脚質共通）。
 *   脚質リスト省略時はデフォルト 5 脚質順で走査（＝改訂前と同一出力）。
 *
 * `dice1d9=` ヘッダーとの結合は E4（PhaseOutput 側）で行う。
 * 範囲外のペース出目では全セルが 0 扱いとなり空配列を返す（不正入力フォールバック）。
 */
export function getFormationTemplateLines(paceRoll: number, strategies?: Strategy[]): string[] {
    const strategyNames = strategies?.map(s => s.name) ?? DEFAULT_STRATEGY_ORDER;
    const lines: string[] = [];
    for (const faces of FORMATION_FACE_GROUPS) {
        const representativeFace = faces[0];
        const entries = strategyNames
            .map(name => ({ name, value: getFormationModifier(representativeFace, paceRoll, name, strategies) }))
            .filter(e => e.value !== 0);
        if (entries.length === 0) continue;
        const allSameValue = entries.every(e => e.value === entries[0].value);
        const body = allSameValue
            ? `${entries.map(e => e.name).join('・')}に${formatModifierValue(entries[0].value)}`
            : entries.map(e => `${e.name}に${formatModifierValue(e.value)}`).join('、');
        lines.push(`${faces.join('.')},${getFormationLabel(representativeFace)}　${body}`);
    }
    return lines;
}
