// CR-SA-15-E3 / 2026-05-15: 固有スキル設定モーダル UI 用純粋関数群
// (modal-houserule.md §4 + houserule-features.md §5 SSoT 準拠)
// UI 表示・入力ハンドリング・フォーム状態変換を純粋関数として切り出し、
// UniqueSkillEditorModal.tsx 本体からロジックを分離する。テストは
// uniqueSkillEditor.helpers.test.ts に集約（strategyEditor.helpers.ts と同方針）。
// CR-SA-21+22-E1 / 2026-07-06: 固有スキル設定モーダルは組み込み 7 タイプ専用のため
// BuiltInUniqueSkillType を使用する（'None' / 'Custom' の編集は §5 対象外、カスタム追加は
// §8 = E2 スコープで別 UI として提供される）。
import type { BuiltInUniqueSkillType, UniqueDiceConfig, UniqueDiceEntry } from '../../../types';
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';
import { getUniqueDiceFormula } from '../race/phaseOutput.helpers';

// 固有スキル 7 タイプの表示名（modal-houserule.md §4 ワイヤーフレーム準拠、編集対象外）。
// houserule-features.md §5.2「表示名は編集不可」= 固有タイプ識別子に紐づく固定値。
// CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ / 安定型Ⅱ を追加（Record<BuiltInUniqueSkillType,...> の網羅強制で機械的）。
export const UNIQUE_SKILL_TYPE_LABELS: Record<BuiltInUniqueSkillType, string> = {
    Stability: '安定型',
    Gamble: 'ギャンブル型',
    Persistent: '持続型',
    SuperGamble: '超ギャンブル',
    SuperStability: '超安定',
    GambleII: 'ギャンブル型Ⅱ',
    StabilityII: '安定型Ⅱ',
};

// 固有スキル 7 タイプの表示順（modal-houserule.md §4 テーブル L100-104 の並び）。
// CR-SA-19 / 2026-06-06: 超安定の後に ギャンブル型Ⅱ → 安定型Ⅱ を末尾追加。
const ALL_UNIQUE_SKILL_TYPES_ORDER: BuiltInUniqueSkillType[] = [
    'Stability',
    'Gamble',
    'Persistent',
    'SuperGamble',
    'SuperStability',
    'GambleII',
    'StabilityII',
];

// 拡張固有タイプ（enableExtendedUnique ON 時のみ表示する 4 タイプ）。
// CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ / 安定型Ⅱ も enableExtendedUnique 共用（専用トグルなし）。
const EXTENDED_UNIQUE_SKILL_TYPES: BuiltInUniqueSkillType[] = [
    'SuperGamble',
    'SuperStability',
    'GambleII',
    'StabilityII',
];

// 複合固有スキル連動の固有タイプ（enableCompositeUnique ON 時のみ表示する 1 タイプ）。
// entryForm.helpers.ts getBuiltInUniqueSkillTypeOptions の挙動と整合させる
// （持続型は「複合固有スキル(発動位置複数選択)を許可」オプションで有効化される）。
const COMPOSITE_UNIQUE_SKILL_TYPES: BuiltInUniqueSkillType[] = ['Persistent'];

/**
 * 一覧テーブルに表示する固有タイプを算出する（modal-houserule.md §4 拡張固有タイプの表示条件）。
 *
 * Round 2 修正（2026-05-15 ユーザーフィードバック）: 持続型は `enableCompositeUnique` 連動。
 * `entryForm.helpers.ts` の `getBuiltInUniqueSkillTypeOptions` の挙動と整合させる。
 *
 * - `enableExtendedUnique` OFF + `enableCompositeUnique` OFF → 安定型 / ギャンブル型（2 種）
 * - `enableExtendedUnique` OFF + `enableCompositeUnique` ON  → 安定型 / ギャンブル型 / 持続型（3 種）
 * - `enableExtendedUnique` ON  + `enableCompositeUnique` OFF → 安定型 / ギャンブル型 / 超ギャンブル / 超安定 / ギャンブル型Ⅱ / 安定型Ⅱ（6 種）
 * - `enableExtendedUnique` ON  + `enableCompositeUnique` ON  → 7 種すべて
 *
 * 表示順: 安定型 → ギャンブル型 → (持続型) → (超ギャンブル) → (超安定) → (ギャンブル型Ⅱ) → (安定型Ⅱ)
 *
 * 表示の絞り込みのみ。`uniqueDiceConfig` のデータは OFF 時も 7 タイプ分を保持する
 * （houserule-features.md §5.6 Progressive Disclosure 原則）。
 * CR-SA-19 / 2026-06-06: 拡張固有タイプに ギャンブル型Ⅱ / 安定型Ⅱ を追加（5 → 7 タイプ）。
 */
export function getVisibleUniqueSkillTypes(
    enableExtendedUnique: boolean,
    enableCompositeUnique: boolean,
): BuiltInUniqueSkillType[] {
    return ALL_UNIQUE_SKILL_TYPES_ORDER.filter((type) => {
        if (EXTENDED_UNIQUE_SKILL_TYPES.includes(type)) {
            return enableExtendedUnique;
        }
        if (COMPOSITE_UNIQUE_SKILL_TYPES.includes(type)) {
            return enableCompositeUnique;
        }
        return true;
    });
}

// 編集サブモーダルのフォーム状態。
// 入力中は生文字列で保持し、保存時に UniqueDiceEntry へ変換する
// (HTML <input type="number"> の入力途中 "-" や空文字を扱うため、
//  strategyEditor.helpers.ts の StrategyFormState と同方針)。
export interface UniqueDiceFormState {
    fixValue: string;
    diceStr: string;
}

/**
 * 編集サブモーダルの初期フォーム生成（既存設定 UniqueDiceEntry を読み込んで文字列化）。
 */
export function createEditFormState(entry: UniqueDiceEntry): UniqueDiceFormState {
    return {
        fixValue: String(entry.fixValue),
        diceStr: entry.diceStr,
    };
}

/**
 * 「デフォルトに戻す」用フォーム生成（DEFAULT_UNIQUE_DICE_CONFIG[type] の値で初期化）。
 * 固有タイプは 5 種固定のため、脚質エディタの createDefaultResetFormState と異なり
 * null を返すケースはない。
 */
export function createDefaultResetFormState(type: BuiltInUniqueSkillType): UniqueDiceFormState {
    return createEditFormState(DEFAULT_UNIQUE_DICE_CONFIG[type]);
}

/**
 * フォーム状態 → UniqueDiceEntry 変換。
 * fixValue が空欄 / 非数値の場合は 0 にフォールバック（strategyEditor.helpers.ts の
 * formStateToStrategy と同方針。厳密検証は validateUniqueDiceFixValue 側で行い、
 * エラー時は呼び出し側で「保存」ボタンを Disabled にする）。
 */
export function formStateToEntry(form: UniqueDiceFormState): UniqueDiceEntry {
    const parsed = parseInt(form.fixValue, 10);
    return {
        fixValue: Number.isNaN(parsed) ? 0 : parsed,
        diceStr: form.diceStr.trim(),
    };
}

/**
 * 固定値（fixValue）の妥当性検証（houserule-features.md §5.2 設定項目）。
 *
 * - 空欄 → エラー（固定値未入力）
 * - 整数以外（小数 `1.5` / 非数値 `abc` / 符号のみ `-`）→ エラー
 * - 整数（負値 `-3` 含む）→ OK
 *
 * 範囲制約は設けない（固定値に上下限なし、houserule-features.md §5.2）。
 * 行番号 prefix なしのエラー文言を返す（脚質エディタの validateDiceFormat と同パターン）。
 *
 * @returns 妥当なら `[]`、エラーなら 1 件のエラーメッセージ配列。
 */
export function validateUniqueDiceFixValue(raw: string): string[] {
    const trimmed = raw.trim();
    if (trimmed === '') {
        return ['固定値を入力してください。'];
    }
    if (!/^-?\d+$/.test(trimmed)) {
        return ['固定値は整数で入力してください。'];
    }
    return [];
}

/**
 * 指定タイプのエントリのみ差し替えた新しい UniqueDiceConfig を生成する。
 *
 * 重要: `useRaceStore` の `updateHouseRules` は `uniqueDiceConfig` の変更を
 * 参照比較で検知する（CR-SA-15-E1 で確立）。本関数はスプレッドで必ず新しい
 * オブジェクトを返すため、これを `updateHouseRules({ uniqueDiceConfig })` に
 * 渡せば E2 で配線済の score 再計算トリガーが正しく発火する。
 */
export function buildUpdatedUniqueDiceConfig(
    current: UniqueDiceConfig,
    type: BuiltInUniqueSkillType,
    entry: UniqueDiceEntry,
): UniqueDiceConfig {
    return { ...current, [type]: entry };
}

/**
 * 単一の固有タイプ + エントリから「投稿用ダイス出力」プレビュー文字列を生成する。
 *
 * 符号別生成ルール（houserule-features.md §5.3）の SSoT は E2 成果物
 * `getUniqueDiceFormula`（phaseOutput.helpers.ts）であり、本関数はそれを再利用する
 * 薄いラッパー。§5.3 を helpers 側で再実装しないことで、プレビューと実出力の
 * 不一致を構造的に防ぐ（TASK_INSTRUCTION §1.2 / 案 V W4 準拠）。
 *
 * `getUniqueDiceFormula` は `(type, uniqueDiceConfig)` 形式で `uniqueDiceConfig[type]`
 * のみを参照するため、当該タイプのエントリだけ差し替えた config を渡して再利用する。
 */
export function getUniqueDicePreview(type: BuiltInUniqueSkillType, entry: UniqueDiceEntry): string {
    const config: UniqueDiceConfig = { ...DEFAULT_UNIQUE_DICE_CONFIG, [type]: entry };
    return getUniqueDiceFormula(type, config);
}
