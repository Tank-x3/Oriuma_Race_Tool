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
