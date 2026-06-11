// CR-SA-20-E2 / 2026-06-11: 隊列〔バ群〕ダイスの効果表・補正ロジック（純粋関数層）。
// SSoT: houserule-features.md §6.2（隊列形態）/ §6.3（効果表）/ §6.6（影響値テンプレート）。
// ペース境界「ミドルまで = 出目 1〜6 / ハイ以上 = 出目 7〜9」は basic-rules.md §3 対応。
//
// 本モジュールは E2 時点では未配線（既存プロダクトコードから呼ばれない）。
// enableFormationDice の ON/OFF 分岐・隊列フェーズ挿入・UI・計算反映は E3/E4 スコープ。
// 補正取得は getPaceModifier（strategies.ts）と同型の純粋関数だが、隊列効果表は
// デフォルト 5 脚質固定であり、カスタム脚質は常に ±0（§6.3 SA 判断、strategies 経由の拡張はしない）。

/** §6.3 効果表のペース条件（'any' = ペース無関係の行）。 */
export type FormationPaceCondition = 'any' | 'middleOrSlower' | 'highOrFaster';

/** §6.3 効果表の 1 行（隊列出目グループ × ペース条件 → 脚質別補正値）。 */
export interface FormationEffectRow {
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
 */
export const FORMATION_EFFECT_TABLE: readonly FormationEffectRow[] = [
    { faces: [1], label: '超縦長', pace: 'middleOrSlower', modifiers: { '大逃げ': 10, '逃げ': 7, '先行': 0, '差し': -5, '追込': -5 } },
    { faces: [1], label: '超縦長', pace: 'highOrFaster', modifiers: { '大逃げ': 0, '逃げ': 0, '先行': 0, '差し': 7, '追込': 10 } },
    { faces: [2, 3], label: '縦長', pace: 'any', modifiers: { '大逃げ': 5, '逃げ': 5, '先行': 5, '差し': 0, '追込': 0 } },
    { faces: [4, 5, 6], label: '普通', pace: 'any', modifiers: { '大逃げ': 0, '逃げ': 0, '先行': 0, '差し': 0, '追込': 0 } },
    { faces: [7, 8], label: '団子', pace: 'any', modifiers: { '大逃げ': 0, '逃げ': 0, '先行': 0, '差し': 5, '追込': 5 } },
    { faces: [9], label: '超団子', pace: 'middleOrSlower', modifiers: { '大逃げ': -10, '逃げ': -7, '先行': 0, '差し': 8, '追込': 12 } },
    { faces: [9], label: '超団子', pace: 'highOrFaster', modifiers: { '大逃げ': 7, '逃げ': 5, '先行': 0, '差し': 0, '追込': 0 } },
];

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
 * （隊列出目, ペース出目, 脚質名）→ 隊列補正値（§6.3 効果表）。
 *
 * - デフォルト 5 脚質は効果表どおり（±0 セル含む）
 * - カスタム脚質（効果表に列がない脚質名）は常に 0（§6.3 SA 判断）
 * - 範囲外の隊列出目・ペース出目は 0（getPaceModifier のフォールバック方針に準拠）
 */
export function getFormationModifier(
    formationRoll: number,
    paceRoll: number,
    strategyName: string,
): number {
    if (!isValidPaceRoll(paceRoll)) return 0;
    const paceCondition: FormationPaceCondition =
        isHighOrFasterPace(paceRoll) ? 'highOrFaster' : 'middleOrSlower';
    const row = FORMATION_EFFECT_TABLE.find(r =>
        r.faces.includes(formationRoll) && (r.pace === 'any' || r.pace === paceCondition));
    if (!row) return 0;
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
 * - カスタム脚質は ±0 のため含めない（効果表のデフォルト 5 脚質のみ走査）。
 *
 * `dice1d9=` ヘッダーとの結合は E4（PhaseOutput 側）で行う。
 * 範囲外のペース出目では全セルが 0 扱いとなり空配列を返す（不正入力フォールバック）。
 */
export function getFormationTemplateLines(paceRoll: number): string[] {
    const lines: string[] = [];
    for (const faces of FORMATION_FACE_GROUPS) {
        const representativeFace = faces[0];
        const entries = DEFAULT_STRATEGY_ORDER
            .map(name => ({ name, value: getFormationModifier(representativeFace, paceRoll, name) }))
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
