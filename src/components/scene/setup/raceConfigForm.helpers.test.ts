// CR-SA-20-Followup-config-preview-offmode / 2026-06-12: フェーズ構成変更 OFF 時の
// 「現在の構成」表示（getOffModeConfigPreviewText）のテスト。
// 採用案 = 最小差分: 隊列 OFF は従来の固定表記と完全同一 / 隊列 ON は実走行
// （buildPhaseSequence の OFF 透過列）と同一位置に「隊列」を表示する。
import { describe, it, expect } from 'vitest';
import { getOffModeConfigPreviewText } from './raceConfigForm.helpers';
import { buildPhaseSequence, getPhaseLabel } from '../../../hooks/useRaceEngine';

describe('getOffModeConfigPreviewText - 隊列 OFF（従来表記と完全同一、最小差分案）', () => {
    it('中盤 0 → 序盤 → ペース → (中盤なし) → 終盤', () => {
        expect(getOffModeConfigPreviewText(0, false)).toBe('序盤 → ペース → (中盤なし) → 終盤');
    });
    it('中盤 1 → 序盤 → ペース → 中盤 → 終盤', () => {
        expect(getOffModeConfigPreviewText(1, false)).toBe('序盤 → ペース → 中盤 → 終盤');
    });
    it('中盤 2 以上 → 中盤 xN のまとめ表記を維持', () => {
        expect(getOffModeConfigPreviewText(2, false)).toBe('序盤 → ペース → 中盤 x2 → 終盤');
        expect(getOffModeConfigPreviewText(4, false)).toBe('序盤 → ペース → 中盤 x4 → 終盤');
    });
});

describe('getOffModeConfigPreviewText - 隊列 ON（CR-SA-20-Followup-config-preview-offmode）', () => {
    it('中盤 0 → 序盤 → ペース → 隊列 → 終盤（§6.4 序盤ブロック直後、ペース → 隊列順）', () => {
        expect(getOffModeConfigPreviewText(0, true)).toBe('序盤 → ペース → 隊列 → 終盤');
    });
    it('中盤 1 → 序盤 → ペース → 隊列 → 中盤 → 終盤（同一アンカー = ペース → 隊列順）', () => {
        expect(getOffModeConfigPreviewText(1, true)).toBe('序盤 → ペース → 隊列 → 中盤 → 終盤');
    });
    it('中盤 2 以上 → 隊列は中盤1 の直後（まとめ表記を解除して個別表記）', () => {
        expect(getOffModeConfigPreviewText(2, true)).toBe(
            '序盤 → ペース → 中盤1 → 隊列 → 中盤2 → 終盤',
        );
        expect(getOffModeConfigPreviewText(3, true)).toBe(
            '序盤 → ペース → 中盤1 → 隊列 → 中盤2 → 中盤3 → 終盤',
        );
    });
    it('実走行フェーズ列（buildPhaseSequence の OFF 透過列）と完全一致する（中盤 0〜4）', () => {
        // buildPhaseSequence の ID 列を「現在の構成」表示語彙へ変換して比較する
        //（Pace の進行画面ラベルは「ペース判定」だが、構成表示では「ペース」を用いる）。
        // enablePhaseConfig=false に可変値（序盤 2 / 終盤 3 / ペース 'Mid1'）を渡しても
        // OFF 透過ゲートで実効値（序盤 1 / 終盤 1 / 'Start'）へ解決されることも併せて担保する。
        const toDisplayLabel = (id: string): string =>
            id === 'Pace' ? 'ペース' : getPhaseLabel(id);
        for (const mid of [0, 1, 2, 3, 4]) {
            const engine = buildPhaseSequence(false, 2, mid, 3, 'Mid1', true)
                .map(toDisplayLabel)
                .join(' → ');
            expect(getOffModeConfigPreviewText(mid, true)).toBe(engine);
        }
    });
});
