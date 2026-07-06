// CR-SA-15-E3 / 2026-05-15: 固有スキル設定モーダル UI 用純粋関数群
// (modal-houserule.md §4 + houserule-features.md §5 SSoT 準拠)
// UI 表示・入力ハンドリング・フォーム状態変換を純粋関数として切り出し、
// UniqueSkillEditorModal.tsx 本体からロジックを分離する。テストは
// uniqueSkillEditor.helpers.test.ts に集約（strategyEditor.helpers.ts と同方針）。
// CR-SA-21+22-E1 / 2026-07-06: 固有スキル設定モーダルは組み込み 7 タイプ専用のため
// BuiltInUniqueSkillType を使用する（'None' / 'Custom' の編集は §5 対象外、カスタム追加は
// §8 = E2 スコープで別 UI として提供される）。
import type { BuiltInUniqueSkillType, CustomUniqueSkill, UniqueDiceConfig, UniqueDiceEntry, Umamusume } from '../../../types';
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';
import { getUniqueDiceFormula } from '../race/phaseOutput.helpers';
import { isMidRace } from '../../../core/strategy.helpers';
import {
    CUSTOM_UNIQUE_SKILL_NAME_MAX,
    CUSTOM_UNIQUE_SKILL_NAME_FORBIDDEN_PATTERN,
    CUSTOM_UNIQUE_SKILL_RESERVED_NAMES,
} from '../../../core/schema/houseRules';
// CR-SA-21+22-E2 / 2026-07-06: カスタム固有ラベルは EntryForm 選択肢と同一の生成規則を用いる
// （scene1-setup.md §2 L189-193 SSoT。表示名 + fixValue 符号別 2 パターン）。
import { formatUniqueDiceLabel } from './entryForm.helpers';

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

// ===== CR-SA-21+22-E2 / 2026-07-06: カスタム固有スキル用 helpers =====
// modal-houserule.md §4 追加・編集サブモーダル + Case A/B 削除 + houserule-features.md §8 SSoT。
// 名称バリデーションは E1 の zod（`customUniqueSkillSchema`）と完全同ルールで UI 側先出し実装。

export interface CustomUniqueFormState {
    name: string;
    fixValue: string;
    diceStr: string;
}

/**
 * 追加用の空フォーム。
 */
export function createNewCustomFormState(): CustomUniqueFormState {
    return { name: '', fixValue: '0', diceStr: '' };
}

/**
 * 既存カスタム編集時の初期フォーム。
 */
export function createEditCustomFormState(skill: CustomUniqueSkill): CustomUniqueFormState {
    return {
        name: skill.name,
        fixValue: String(skill.fixValue),
        diceStr: skill.diceStr,
    };
}

/**
 * フォーム状態 → CustomUniqueSkill 変換（id は呼び出し側で採番済みのものを渡す）。
 * fixValue が空欄 / 非数値の場合は 0 にフォールバック（既存 formStateToEntry と同方針。
 * 厳密検証は validateCustomUniqueSkillName / validateUniqueDiceFixValue / validateDiceFormat 側）。
 */
export function formStateToCustomSkill(
    form: CustomUniqueFormState,
    id: string,
): CustomUniqueSkill {
    const parsed = parseInt(form.fixValue, 10);
    return {
        id,
        name: form.name.trim(),
        fixValue: Number.isNaN(parsed) ? 0 : parsed,
        diceStr: form.diceStr.trim(),
    };
}

/**
 * カスタム固有名のリアルタイムバリデーション（modal-houserule.md §Error Handling L302-307 SSoT）。
 *
 * 順序（先頭一致で 1 件返却）:
 * 1. trim 後空 → `固有スキル名を入力してください。`
 * 2. 20 文字超過 → `固有スキル名は 20 文字以内で入力してください。`
 * 3. 禁止文字（+ / = / 改行）→ `固有スキル名に計算記号(+, =)や改行は使用できません`
 * 4. 予約語（組み込み 7 表示名 +「なし」）→ `固有スキル名 'XXX' は既に使用されています…`
 * 5. 他カスタムとの trim 後重複（編集時は自分自身を除外）→ `固有スキル名 'XXX' は既に使用されています…`
 *
 * editingId を渡した場合、同 id のカスタムは重複判定から除外する（編集時の自己重複回避、
 * strategyEditor の validateStrategyName と同パターン）。
 */
export function validateCustomUniqueSkillName(
    name: string,
    existingCustoms: CustomUniqueSkill[],
    editingId?: string,
): string[] {
    const trimmed = name.trim();
    if (trimmed === '') {
        return ['固有スキル名を入力してください。'];
    }
    if (name.length > CUSTOM_UNIQUE_SKILL_NAME_MAX) {
        return [`固有スキル名は ${CUSTOM_UNIQUE_SKILL_NAME_MAX} 文字以内で入力してください。`];
    }
    if (CUSTOM_UNIQUE_SKILL_NAME_FORBIDDEN_PATTERN.test(name)) {
        return ['固有スキル名に計算記号(+, =)や改行は使用できません'];
    }
    if (CUSTOM_UNIQUE_SKILL_RESERVED_NAMES.includes(trimmed)) {
        return [`固有スキル名 '${trimmed}' は既に使用されています。別の名前を指定してください。`];
    }
    for (const c of existingCustoms) {
        if (editingId !== undefined && c.id === editingId) continue;
        if (c.name.trim() === trimmed) {
            return [`固有スキル名 '${trimmed}' は既に使用されています。別の名前を指定してください。`];
        }
    }
    return [];
}

/**
 * カスタム編集・追加サブモーダルの出力プレビュー生成
 * （scene1-setup.md §2 L189-193 SSoT。組み込み型の EntryForm 選択肢ラベルと同一規則）。
 * §5.3 生成ルールは投稿用ダイス出力（`dice1d25=` / `-5+dice1d30=` 等）だが、
 * カスタム編集モーダルのプレビューは「プルダウンラベル形式」で表示する（modal-houserule.md §4 L130
 * 「出力プレビュー: dice1d25=」の記述は組み込み型と同じ投稿用フォーマット）。
 *
 * modal-houserule.md L130 のワイヤーフレーム例は `dice1d25=` のため、投稿用ダイス出力
 * （§5.3）を生成する。fixValue 符号ルール:
 * - `fixValue === 0` → `dice{diceStr}=`
 * - `fixValue > 0`  → `{fixValue}+dice{diceStr}=`
 * - `fixValue < 0`  → `{fixValue}+dice{diceStr}=`（負値は符号込みで先頭に付く = 現行 §5.3 生成規則）
 *
 * 引数は「入力途中の生値」であり不正値時はフォールバック（プレビュー内文字列に無効値を混ぜない）。
 */
export function getCustomUniqueDicePreview(entry: UniqueDiceEntry): string {
    const { fixValue, diceStr } = entry;
    if (fixValue === 0) return `dice${diceStr}=`;
    if (fixValue > 0) return `${fixValue}+dice${diceStr}=`;
    return `${fixValue}+dice${diceStr}=`;
}

/**
 * カスタム固有スキルが出走者に使用されているか判定
 * （scene1-setup.md §2 L188 削除時の整合性強制 + modal-houserule.md §4 SSoT）。
 */
export function isCustomUniqueSkillInUse(
    id: string,
    participants: Umamusume[],
): boolean {
    return participants.some((p) => p.uniqueSkill.customUniqueSkillId === id);
}

// カスタム固有削除確認の段階（脚質エディタ DeleteConfirmStep と同構造）。
// Case A（序盤ダイス未入力 = pre-race）+ 使用者ゼロ → 確認省略で即削除（Engineer 裁量、ユーザー承認済）。
// Case A + 使用者あり → 1 段階確認。
// Case B（序盤ダイス入力済 = mid-race）→ 2 段階確認（modal-houserule.md §4 削除 SSoT）。
export type CustomDeleteConfirmStep = 'pre-race' | 'mid-race-warning' | 'mid-race-final';

export function getCustomInitialDeleteStep(participants: Umamusume[]): CustomDeleteConfirmStep {
    return isMidRace(participants) ? 'mid-race-warning' : 'pre-race';
}

export function progressCustomDeleteStep(current: CustomDeleteConfirmStep): CustomDeleteConfirmStep {
    if (current === 'mid-race-warning') return 'mid-race-final';
    return current;
}

export interface CustomDeleteConfirmMessage {
    title: string;
    body: string;
    primaryLabel: string;
    cancelLabel: string;
}

export function getCustomDeleteConfirmMessage(
    step: CustomDeleteConfirmStep,
    skillName: string,
    id: string,
    participants: Umamusume[],
): CustomDeleteConfirmMessage {
    const inUse = isCustomUniqueSkillInUse(id, participants);
    if (step === 'pre-race') {
        return {
            title: 'カスタム固有スキルの削除',
            body: inUse
                ? `カスタム固有「${skillName}」を削除しますか？該当する出走者の固有タイプがリセットされます。`
                : `カスタム固有「${skillName}」を削除しますか？`,
            primaryLabel: '削除',
            cancelLabel: 'キャンセル',
        };
    }
    if (step === 'mid-race-warning') {
        return {
            title: 'カスタム固有スキルの削除（警告）',
            body: inUse
                ? `この固有スキルは現在使用されています。削除すると、該当する出走者の設定がリセットされます。`
                : `カスタム固有「${skillName}」を削除します。`,
            primaryLabel: '次へ',
            cancelLabel: 'キャンセル',
        };
    }
    // mid-race-final
    return {
        title: '最終確認',
        body: `最終確認: 本当に「${skillName}」を削除しますか？`,
        primaryLabel: '削除',
        cancelLabel: 'キャンセル',
    };
}

/**
 * カスタム固有スキルのプルダウンラベル生成（EntryForm 選択肢と同一規則）。
 * UniqueSkillEditorModal 一覧表示・カスタム名列など、EntryForm 外で同じラベルが必要な箇所で共用する。
 */
export function formatCustomUniqueLabel(skill: CustomUniqueSkill): string {
    return formatUniqueDiceLabel(skill.name, {
        fixValue: skill.fixValue,
        diceStr: skill.diceStr,
    });
}
