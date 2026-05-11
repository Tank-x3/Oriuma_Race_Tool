import { Dice } from './dice';

// Bundle-3 / D-4 / 2026-05-09: 持続型「連続 2 フェーズ」検証 SA 確定仕様
// （architecture/validation-responsibilities.md §4 SSoT 準拠）
// 既存 Validator クラス 3 関数は CR-6 別管理のため本タスクスコープ外、削除しない。

/**
 * `EntryForm.tsx` の `availablePhases` 計算ロジック（L132-147）と完全整合する
 * フェーズ ID 列挙生成。validation-responsibilities.md §4 availablePhases 列挙表参照。
 *
 * - midPhaseCount === 0: [Start, End]
 * - midPhaseCount === 1: [Start, Mid, End]
 * - midPhaseCount >= 2: [Start, Mid1, ..., MidN, End]
 */
const getAvailablePhaseIds = (midPhaseCount: number): string[] => {
    const ids: string[] = ['Start'];
    if (midPhaseCount === 1) {
        ids.push('Mid');
    } else if (midPhaseCount >= 2) {
        for (let i = 1; i <= midPhaseCount; i++) {
            ids.push(`Mid${i}`);
        }
    }
    ids.push('End');
    return ids;
};

/**
 * Bundle-3 / D-4: 持続型固有スキルの発動位置検証（Layer 2、validation-responsibilities.md §4）。
 *
 * 検証ロジック:
 * 1. phases.length === 0 はスキップ（Layer 1「発動位置が未選択です」で補足）
 * 2. phases.length !== 2 → エラー（選択数違反）
 * 3. availablePhases 列挙でのインデックス位置を取得し
 *    Math.abs(idx_a - idx_b) === 1 でない場合 → エラー（非連続）
 *
 * エラー文言は行番号 prefix なし版を返し、呼び出し元（EntryForm.tsx）で `[#行番号] ` を付与する。
 */
export const validatePersistentSkillPhases = (
    phases: string[],
    midPhaseCount: number,
): string[] => {
    // Layer 1 委譲: 空配列は「発動位置が未選択です」で補足されるため本検証スキップ
    if (phases.length === 0) return [];

    const errorMsg = '持続型の発動位置は連続する 2 フェーズを選択してください';

    // 選択数チェック
    if (phases.length !== 2) return [errorMsg];

    // 連続性チェック
    const availableIds = getAvailablePhaseIds(midPhaseCount);
    const idxA = availableIds.indexOf(phases[0]);
    const idxB = availableIds.indexOf(phases[1]);

    // 列挙にないフェーズが含まれる場合（自動修復前の中盤回数縮小直後等）も非連続扱い
    if (idxA === -1 || idxB === -1) return [errorMsg];
    if (Math.abs(idxA - idxB) !== 1) return [errorMsg];

    return [];
};

// Bundle-8-T2 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 絆スキル + 特殊戦法 Scene 1 事前申告バリデーション
// （scene1-setup.md §2 + houserule-features.md §2 [v] 絆スキル + §3 §捲り 前 cross-reference SSoT）。
// 既存 validatePersistentSkillPhases と同パターン（Layer 2 純粋関数、行番号 prefix なし、呼び出し側で付与）。

/**
 * 絆スキル種別の値域検証（houserule-features.md §2 [v] 絆スキル SSoT）。
 * 値域: `'BondGamble' | 'BondStable' | null`。`enableBondSkill === true` 時のみ呼び出される想定。
 *
 * @returns 妥当なら `[]`、エラーなら 1 件のエラーメッセージ配列。
 */
export const validateBondSkillType = (
    type: 'BondGamble' | 'BondStable' | null | undefined,
): string[] => {
    if (type === null || type === undefined) return [];
    if (type === 'BondGamble' || type === 'BondStable') return [];
    return ['絆スキル種別の値が不正です'];
};

/**
 * 特殊戦法発動位置の値域検証（houserule-features.md §3 §捲り 前 cross-reference SSoT、`'End'` 除外）。
 * 値域: `'Start' | 'Mid' | 'Mid1' | ... | 'Mid{midPhaseCount}' | null`。
 * `enableSpecialStrategy === true` 時のみ呼び出される想定。
 *
 * @returns 妥当なら `[]`、エラーなら 1 件のエラーメッセージ配列。
 */
export const validateSpecialStrategyPhase = (
    phaseId: string | null | undefined,
    midPhaseCount: number,
): string[] => {
    if (phaseId === null || phaseId === undefined) return [];

    const validPhaseIds = new Set<string>(['Start']);
    if (midPhaseCount === 1) {
        validPhaseIds.add('Mid');
    } else if (midPhaseCount >= 2) {
        for (let i = 1; i <= midPhaseCount; i++) {
            validPhaseIds.add(`Mid${i}`);
        }
    }

    if (validPhaseIds.has(phaseId)) return [];
    return ['特殊戦法の発動位置が不正です（終盤・現在の中盤回数外は選択不可）'];
};

/**
 * 特殊戦法 種別 + 発動位置のセット必須性検証
 * （scene1-setup.md §2 + houserule-features.md §3 §捲り 前 cross-reference SSoT）。
 *
 * - 種別 `'Makuri' | 'Tame'` + 発動位置 phaseId（任意の値）→ ok
 * - 種別 `null` + 発動位置 `null` → ok
 * - 種別 `'Makuri' | 'Tame'` + 発動位置 `null` → エラー
 * - 種別 `null` + 発動位置 phaseId → エラー
 */
export const validateSpecialStrategyTypeAndPhase = (
    type: 'Makuri' | 'Tame' | null | undefined,
    phaseId: string | null | undefined,
): string[] => {
    const hasType = type === 'Makuri' || type === 'Tame';
    const hasPhase = phaseId !== null && phaseId !== undefined;

    if (hasType && !hasPhase) {
        return ['特殊戦法を選択した場合、発動位置の指定が必須です'];
    }
    if (!hasType && hasPhase) {
        return ['発動位置を選択した場合、特殊戦法種別の指定が必須です'];
    }
    return [];
};

// Bundle-10-T3 / CR-SA-12 / 2026-05-11: 脚質エディタ Validation 統合
// (modal-houserule.md §Critical Errors + houserule-features.md §1 Validation SSoT)
// 既存 Layer 2 純粋関数群 (validatePersistentSkillPhases / validateBondSkillType /
// validateSpecialStrategyPhase / validateSpecialStrategyTypeAndPhase) と同パターン。

/**
 * 脚質名の重複・空欄検証 (modal-houserule.md §Critical Errors SSoT)。
 *
 * - 空文字 / 空白のみ trim 後空 → エラー（脚質名未入力）
 * - 編集モード時 `editingName === name`（名前未変更）→ 重複扱いしない
 * - `existingNames` 内に同名がある場合 → エラー（脚質名重複）
 *
 * @param name 入力された脚質名（trim 前）
 * @param existingNames 既存脚質名の配列（state.strategies から抽出した name の集合）
 * @param editingName 編集モード時の元の脚質名（新規追加時は undefined）
 * @returns 妥当なら `[]`、エラーなら 1 件のエラーメッセージ配列。
 */
export const validateStrategyName = (
    name: string,
    existingNames: string[],
    editingName?: string,
): string[] => {
    const trimmed = name.trim();
    if (trimmed === '') {
        return ['脚質名を入力してください。'];
    }
    if (editingName !== undefined && editingName === name) {
        return [];
    }
    if (existingNames.includes(name)) {
        return [`脚質名 '${name}' は既に使用されています。別の名前を指定してください。`];
    }
    return [];
};

/**
 * ダイス式 `XdY` 形式の検証 (modal-houserule.md §Critical Errors SSoT)。
 *
 * 仕様 houserule-features.md §1 Validation は「`XdY` 形式以外を拒否」と規定。
 * ただし既存 DEFAULT_STRATEGIES「大逃げ」`dice.end: '-1d27'` 等の負号付き値と
 * 整合性を取るため `-?\d+d\d+` の正規表現で負号付きも許容する
 * （Engineer 裁量範囲、SA20 §5.3 推奨形 (b)）。
 *
 * @returns 妥当なら `[]`、エラーなら 1 件のエラーメッセージ配列。
 */
export const validateDiceFormat = (diceStr: string): string[] => {
    if (/^-?\d+d\d+$/.test(diceStr.trim())) {
        return [];
    }
    return [`ダイス式は '3d6' の形式で入力してください`];
};

export class Validator {
    /**
     * Validates if the line count matches the expected number of participants.
     */
    static validateLineCount(text: string, expectedCount: number): { valid: boolean; actual: number } {
        // Filter empty lines? Usually standard paste might have empty lines.
        // We assume valid dice lines.
        // This is simple line counting, more complex logic might be in Parser.
        const lines = text.split('\n').filter(line => line.trim() !== '');
        return {
            valid: lines.length === expectedCount,
            actual: lines.length
        };
    }

    /**
     * Validates a dice equation string from a post.
     * Expected format: "diceXdY=Total" or similar, but often users paste:
     * "name 10+dice3d6=25 (25)"
     * This validator checks if the equality holds.
     * 
     * @param equationPart The part containing the numbers e.g. "10+15=25" or parsed values.
     */
    static validateChecksum(calculated: number, statedTotal: number): boolean {
        return calculated === statedTotal;
    }

    /**
     * Checks if dice format is valid (e.g. 3d6, not 3d0 or 0d6)
     */
    static validateDiceFormat(diceStr: string): boolean {
        try {
            const config = Dice.parse(diceStr);
            return config.count > 0 && config.face > 0;
        } catch {
            return false;
        }
    }
}
