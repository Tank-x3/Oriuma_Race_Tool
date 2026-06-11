// CR-SA-20-Followup-config-preview-offmode / 2026-06-12: フェーズ構成変更 OFF 時の
// 「現在の構成」表示文字列（RaceConfigForm OFF 分岐専用、scene1-setup.md §2）。
//
// 採用案 = 最小差分（Round 1 ユーザー承認）: 隊列 OFF 時は従来の固定表記
// （序盤 → ペース → 中盤 xN → 終盤）を 1 文字も変えず、隊列〔バ群〕ダイス ON 時のみ
// getPhaseConfigDisplayLabels（ENG66 完成品 = buildPhaseSequence と同一挿入規則）へ
// 切り替えて、実走行と同一位置に「隊列」を表示する。
//
// OFF 時の実効値（序盤 1 / 終盤 1 / ペース = 序盤直後 'Start'）は
// buildPhaseSequence（useRaceEngine.ts）の OFF 透過ゲートと同一の解決値。
import { getPhaseConfigDisplayLabels } from '../../../core/paceAnchor';

export const getOffModeConfigPreviewText = (
    midPhaseCount: number,
    enableFormationDice: boolean,
): string => {
    if (enableFormationDice) {
        return getPhaseConfigDisplayLabels(1, midPhaseCount, 1, 'Start', true).join(' → ');
    }
    const mid =
        midPhaseCount === 0 ? '(中盤なし)' :
            midPhaseCount === 1 ? '中盤' :
                `中盤 x${midPhaseCount}`;
    return `序盤 → ペース → ${mid} → 終盤`;
};
