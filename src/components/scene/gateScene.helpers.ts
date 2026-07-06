// Bundle-8-T3 / CR-SA-4 / 2026-05-10: GateScene 確認リスト併記 helpers（scene2-gate.md §2）。
// Scene 1 で事前申告した「特殊戦法 (発動位置 + 種別)」「絆スキル種別」を
// 確認用リストの基本形式末尾に併記するための純粋関数群。
// CR-SA-21+22-E3 / 2026-07-06: エントリー確認リストの固有スキル表示ラベル解決
// （scene2-gate.md §2 L82-83 SSoT、houserule-features.md §8.8）を helpers へ抽出。
import type { RaceState, Umamusume, UniqueSkillType, CustomUniqueSkill } from '../../types';

type HouseRules = RaceState['config']['houseRules'];

/**
 * CR-SA-21+22-E3 / 2026-07-06: エントリー確認リストの固有スキル表示ラベルを解決する。
 *
 * SSoT: scene2-gate.md §2 L82-83（「なし」= `(脚質 / なし / ---)` / カスタム = ユーザー命名そのまま）
 * + houserule-features.md §8.8「Scene 2 / Scene 4 への反映」。
 *
 * 判定:
 *  - 組み込み 7 タイプ: 日本語ラベル（'安定' / 'ギャンブル' / 'ギャンブルⅡ' 等）
 *  - 'None': 'なし'（§2 [v] 固有スキルなし出走者、phases=[] 経由で phaseStr='---' も自然出力）
 *  - 'Custom': `customUniqueSkills` から id 経由で `name` を lookup
 *  - Custom 参照切れ（当該 id 不在）: 現行フォールバック `'Custom'` 文字列（Scene 1 の
 *    自動リセット useEffect で本来防ぐが、防御的に視認性を優先）
 */
export const getEntryListUniqueTypeLabel = (
    type: UniqueSkillType,
    customUniqueSkillId: string | undefined,
    customUniqueSkills: readonly CustomUniqueSkill[],
): string => {
    const typeMap: Record<string, string> = {
        'Stability': '安定',
        'Gamble': 'ギャンブル',
        'Persistent': '持続',
        'SuperGamble': '超ギャンブル',
        'SuperStability': '超安定',
        'GambleII': 'ギャンブルⅡ',
        'StabilityII': '安定Ⅱ',
        'None': 'なし',
    };
    if (type === 'Custom') {
        const custom = customUniqueSkillId
            ? customUniqueSkills.find(c => c.id === customUniqueSkillId)
            : undefined;
        return custom?.name || type;
    }
    return typeMap[type] || type;
};

/**
 * 特殊戦法併記文字列を返す。
 *
 * 形式: ` [発動位置]【種別】`（先頭に半角スペース 1 個、種別は `【捲り】` / `【溜め】` 固定）。
 * 種別 / 発動位置のいずれかが null/undefined の場合は空文字列（セット入力必須、scene2-gate.md §2）。
 */
export const getSpecialStrategyAnnotation = (
    specialStrategyType: 'Makuri' | 'Tame' | null | undefined,
    specialStrategyPhase: string | null | undefined,
    getPhaseLabel: (pId: string) => string,
): string => {
    if (!specialStrategyType || !specialStrategyPhase) return '';
    const typeLabel = specialStrategyType === 'Makuri' ? '捲り' : '溜め';
    const phaseLabel = getPhaseLabel(specialStrategyPhase);
    return ` ${phaseLabel}【${typeLabel}】`;
};

/**
 * 絆スキル併記文字列を返す。
 *
 * 形式: ` 【種別】`（先頭に半角スペース 1 個、`【絆ギャンブル】` / `【絆安定】` 固定）。
 * 種別が null/undefined の場合は空文字列（未獲得 = 併記なし、scene2-gate.md §2）。
 * 発動位置は終盤後一括固定のため記載しない（仕様 §2 SSoT）。
 */
export const getBondSkillAnnotation = (
    bondSkillType: 'BondGamble' | 'BondStable' | null | undefined,
): string => {
    if (!bondSkillType) return '';
    const typeLabel = bondSkillType === 'BondGamble' ? '絆ギャンブル' : '絆安定';
    return ` 【${typeLabel}】`;
};

/**
 * エントリー確認リスト基本形式末尾の HR 連動併記文字列を返す。
 *
 * 並び順 = 特殊戦法 → 絆スキル（scene2-gate.md §2 SSoT、レース進行順整合）。
 * HR フラグ OFF 時は当該機能の併記を完全抑制（Scene 1 入力値が残っていてもフラグ OFF 優先）。
 * 両機能 OFF または両未申告の場合は空文字列を返す。
 */
export const getEntryListAnnotations = (
    participant: Umamusume,
    houseRules: Pick<HouseRules, 'enableBondSkill' | 'enableSpecialStrategy'>,
    getPhaseLabel: (pId: string) => string,
): string => {
    let result = '';
    if (houseRules.enableSpecialStrategy) {
        result += getSpecialStrategyAnnotation(
            participant.specialStrategyType ?? null,
            participant.specialStrategyPhase ?? null,
            getPhaseLabel,
        );
    }
    if (houseRules.enableBondSkill) {
        result += getBondSkillAnnotation(participant.bondSkill?.type ?? null);
    }
    return result;
};
