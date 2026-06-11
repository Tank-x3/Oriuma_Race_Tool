// CR-SA-17-E3 / 2026-06-07: ペース挿入位置（アンカー方式）の純粋関数群テスト
// （houserule-features.md §7.5 ペース挿入位置の指定とバリデーション）。
import { describe, it, expect } from 'vitest';
import {
    getValidPaceAnchors,
    getPaceAnchorOptions,
    getDefaultPacePosition,
    getFormationSlotAnchorId,
    isPacePositionValid,
    resolvePacePosition,
    isPhaseConfigValid,
    getPhaseConfigDisplayLabels,
    PACE_NONE_LABEL,
} from './paceAnchor';
// CR-SA-20-Followup / 2026-06-12: 表示列と実走行フェーズ列の一致担保テスト用
//（buildPhaseSequence = 挿入規則の正、getPhaseLabel = ID → ラベル変換）。
import { buildPhaseSequence, getPhaseLabel } from '../hooks/useRaceEngine';
import type { PacePosition } from '../types';

describe('getValidPaceAnchors - §7.5 有効アンカー（end 後除外）', () => {
    it('序盤1/中盤1/終盤1 → 序盤・中盤（終盤の後は除外）', () => {
        expect(getValidPaceAnchors(1, 1, 1).map(a => a.id)).toEqual(['Start', 'Mid']);
    });

    it('中盤0（序盤1/終盤1）→ 序盤のみ（最後=終盤を除外）', () => {
        expect(getValidPaceAnchors(1, 0, 1).map(a => a.id)).toEqual(['Start']);
    });

    it('序盤1/中盤2/終盤1 → 序盤・中盤1・中盤2（終盤の後は除外）', () => {
        expect(getValidPaceAnchors(1, 2, 1).map(a => a.id)).toEqual(['Start', 'Mid1', 'Mid2']);
    });

    it('序盤2/中盤0/終盤1 → 序盤1・序盤2（最後=終盤を除外）', () => {
        expect(getValidPaceAnchors(2, 0, 1).map(a => a.id)).toEqual(['Start1', 'Start2']);
    });

    it('序盤2/中盤1/終盤2 → 序盤1・序盤2・中盤・終盤1（最後=終盤2を除外）', () => {
        expect(getValidPaceAnchors(2, 1, 2).map(a => a.id)).toEqual(['Start1', 'Start2', 'Mid', 'End1']);
    });
});

describe('getPaceAnchorOptions - アンカー + 「なし」', () => {
    it('末尾に「なし」（value=null）を含む', () => {
        const opts = getPaceAnchorOptions(1, 1, 1);
        expect(opts.map(o => o.value)).toEqual(['Start', 'Mid', null]);
        expect(opts[opts.length - 1].label).toBe(PACE_NONE_LABEL);
    });

    it('アンカーのラベルは「○○の後」形式', () => {
        const opts = getPaceAnchorOptions(1, 2, 1);
        expect(opts.map(o => o.label)).toEqual(['序盤の後', '中盤1の後', '中盤2の後', 'なし']);
    });
});

describe('getDefaultPacePosition - 序盤ブロック直後', () => {
    it('序盤1 → Start', () => {
        expect(getDefaultPacePosition(1)).toBe('Start');
    });
    it('序盤2 → Start2（最後の序盤）', () => {
        expect(getDefaultPacePosition(2)).toBe('Start2');
    });
    it('序盤4 → Start4', () => {
        expect(getDefaultPacePosition(4)).toBe('Start4');
    });
});

describe('isPacePositionValid', () => {
    it('null（なし）は常に有効', () => {
        expect(isPacePositionValid(null, 1, 1, 1)).toBe(true);
        expect(isPacePositionValid(null, 4, 4, 4)).toBe(true);
    });
    it('有効アンカーは true', () => {
        expect(isPacePositionValid('Start', 1, 1, 1)).toBe(true);
        expect(isPacePositionValid('Mid2', 1, 2, 1)).toBe(true);
    });
    it('end 後（最後の終盤）は無効', () => {
        expect(isPacePositionValid('End', 1, 1, 1)).toBe(false);
        expect(isPacePositionValid('End2', 1, 1, 2)).toBe(false);
    });
    it('存在しないフェーズ ID は無効', () => {
        expect(isPacePositionValid('Mid2', 1, 1, 1)).toBe(false);
        expect(isPacePositionValid('Start2', 1, 1, 1)).toBe(false);
    });
});

describe('resolvePacePosition - 無効時デフォルトリセット（§7.5）', () => {
    it('有効ならそのまま保持', () => {
        expect(resolvePacePosition('Mid1', 1, 2, 1)).toBe('Mid1');
    });
    it('無効ならデフォルト（序盤ブロック直後）へ', () => {
        // 中盤2の後に置いていた状態で中盤1に縮小 → Mid2 無効 → デフォルト Start
        expect(resolvePacePosition('Mid2', 1, 1, 1)).toBe('Start');
    });
    it('null（なし）は無効化されず保持', () => {
        expect(resolvePacePosition(null, 1, 1, 1)).toBe(null);
    });
    it('序盤縮小で序盤アンカー無効化 → デフォルトは縮小後の最後の序盤', () => {
        // 序盤3/Start3 アンカー → 序盤1 に縮小 → Start3 無効 → デフォルト Start
        expect(resolvePacePosition('Start3', 1, 1, 1)).toBe('Start');
    });
});

describe('isPhaseConfigValid - 禁止構成データブロック（§7.5）', () => {
    it('既定構成（序盤1/中盤1/終盤1/ペース序盤直後）は有効 = OFF 透過', () => {
        expect(isPhaseConfigValid(1, 1, 1, 'Start')).toBe(true);
    });
    it('ペースなし（null）も有効', () => {
        expect(isPhaseConfigValid(1, 1, 1, null)).toBe(true);
    });
    it('序盤回数が値域外（0 / 5）は無効', () => {
        expect(isPhaseConfigValid(0, 1, 1, 'Start')).toBe(false);
        expect(isPhaseConfigValid(5, 1, 1, 'Start')).toBe(false);
    });
    it('終盤回数が値域外（0 / 5）は無効', () => {
        expect(isPhaseConfigValid(1, 1, 0, 'Start')).toBe(false);
        expect(isPhaseConfigValid(1, 1, 5, 'Start')).toBe(false);
    });
    it('中盤回数が値域外（負 / 5）は無効', () => {
        expect(isPhaseConfigValid(1, -1, 1, 'Start')).toBe(false);
        expect(isPhaseConfigValid(1, 5, 1, 'Start')).toBe(false);
    });
    it('end 後にペース（禁止構成）は無効', () => {
        expect(isPhaseConfigValid(1, 1, 1, 'End')).toBe(false);
    });
});

// CR-SA-20-E3 / 2026-06-11: 隊列〔バ群〕ダイス連動（houserule-features.md §6.4 + §7.6）
describe('getFormationSlotAnchorId - 隊列スロット位置の自動決定（§6.4）', () => {
    it('中盤0回 → 序盤ブロック直後（序盤1 = Start）', () => {
        expect(getFormationSlotAnchorId(1, 0)).toBe('Start');
    });
    it('中盤1回 → 序盤ブロック直後（序盤1 = Start）', () => {
        expect(getFormationSlotAnchorId(1, 1)).toBe('Start');
    });
    it('中盤2回以上 → 中盤1の直後（Mid1）', () => {
        expect(getFormationSlotAnchorId(1, 2)).toBe('Mid1');
        expect(getFormationSlotAnchorId(1, 3)).toBe('Mid1');
        expect(getFormationSlotAnchorId(1, 4)).toBe('Mid1');
    });
    it('序盤2回以上 × 中盤0/1回 → 最後の序盤の直後（序盤ブロック = 最後の序盤までの拡張解釈）', () => {
        expect(getFormationSlotAnchorId(2, 0)).toBe('Start2');
        expect(getFormationSlotAnchorId(3, 1)).toBe('Start3');
    });
    it('序盤2回以上 × 中盤2回以上 → 中盤1の直後（序盤回数に依存しない）', () => {
        expect(getFormationSlotAnchorId(2, 2)).toBe('Mid1');
        expect(getFormationSlotAnchorId(4, 4)).toBe('Mid1');
    });
});

describe('getValidPaceAnchors - 隊列 ON で隊列スロット以降を除外（§7.6）', () => {
    it('中盤2回: 「中盤1の後」までが候補（中盤2以降のアンカーを除外）', () => {
        expect(getValidPaceAnchors(1, 2, 1, true).map(a => a.id)).toEqual(['Start', 'Mid1']);
    });
    it('中盤1回: 「序盤の後」のみが候補（中盤の後を除外）', () => {
        expect(getValidPaceAnchors(1, 1, 1, true).map(a => a.id)).toEqual(['Start']);
    });
    it('中盤0回: 「序盤の後」のみが候補（従来と同一 = 除外対象なし）', () => {
        expect(getValidPaceAnchors(1, 0, 1, true).map(a => a.id)).toEqual(['Start']);
    });
    it('中盤4回 × 終盤2回: 「中盤1の後」まで（中盤2〜4・終盤1の後を除外）', () => {
        expect(getValidPaceAnchors(1, 4, 2, true).map(a => a.id)).toEqual(['Start', 'Mid1']);
    });
    it('序盤2回 × 中盤1回: 序盤アンカーすべてが候補（隊列スロット = 序盤2の後まで）', () => {
        expect(getValidPaceAnchors(2, 1, 1, true).map(a => a.id)).toEqual(['Start1', 'Start2']);
    });
    it('序盤3回 × 中盤2回: 序盤1〜3 + 中盤1 が候補', () => {
        expect(getValidPaceAnchors(3, 2, 1, true).map(a => a.id)).toEqual(['Start1', 'Start2', 'Start3', 'Mid1']);
    });
    it('隊列 OFF（引数省略 / false）は従来と完全同一', () => {
        expect(getValidPaceAnchors(1, 2, 1).map(a => a.id)).toEqual(['Start', 'Mid1', 'Mid2']);
        expect(getValidPaceAnchors(1, 2, 1, false).map(a => a.id)).toEqual(['Start', 'Mid1', 'Mid2']);
    });
    it('隊列 ON でも最低 1 アンカー（デフォルト位置 = 序盤ブロック直後）は必ず残る', () => {
        for (let start = 1; start <= 4; start++) {
            for (let mid = 0; mid <= 4; mid++) {
                for (let end = 1; end <= 4; end++) {
                    const anchors = getValidPaceAnchors(start, mid, end, true);
                    expect(anchors.length).toBeGreaterThanOrEqual(1);
                    expect(anchors.map(a => a.id)).toContain(getDefaultPacePosition(start));
                }
            }
        }
    });
});

describe('getPaceAnchorOptions - 隊列 ON でも「なし」は候補に残る', () => {
    it('中盤2回 × 隊列 ON: 序盤の後・中盤1の後 + なし', () => {
        const opts = getPaceAnchorOptions(1, 2, 1, true);
        expect(opts.map(o => o.value)).toEqual(['Start', 'Mid1', null]);
        expect(opts[opts.length - 1].label).toBe(PACE_NONE_LABEL);
    });
    it('中盤1回 × 隊列 ON: 序盤の後 + なし', () => {
        const opts = getPaceAnchorOptions(1, 1, 1, true);
        expect(opts.map(o => o.label)).toEqual(['序盤の後', 'なし']);
    });
});

describe('isPacePositionValid - 隊列 ON の制約込み判定（§7.6）', () => {
    it('null（なし）は隊列 ON でも本関数では有効（L301 ブロックは validator 側の責務）', () => {
        expect(isPacePositionValid(null, 1, 2, 1, true)).toBe(true);
    });
    it('隊列スロット以前のアンカーは有効', () => {
        expect(isPacePositionValid('Start', 1, 2, 1, true)).toBe(true);
        expect(isPacePositionValid('Mid1', 1, 2, 1, true)).toBe(true);
    });
    it('隊列スロットより後ろのアンカーは無効', () => {
        expect(isPacePositionValid('Mid2', 1, 2, 1, true)).toBe(false);
        expect(isPacePositionValid('Mid', 1, 1, 1, true)).toBe(false);
    });
    it('隊列 OFF なら従来どおり有効（後方互換）', () => {
        expect(isPacePositionValid('Mid2', 1, 2, 1)).toBe(true);
        expect(isPacePositionValid('Mid', 1, 1, 1, false)).toBe(true);
    });
});

describe('resolvePacePosition - 隊列 ON 切替時の強制リセット（§7.6）', () => {
    it('隊列スロットより後ろの位置 → デフォルト（序盤ブロック直後）へリセット', () => {
        expect(resolvePacePosition('Mid2', 1, 2, 1, true)).toBe('Start');
        expect(resolvePacePosition('Mid', 1, 1, 1, true)).toBe('Start');
    });
    it('隊列スロット以前の位置は保持', () => {
        expect(resolvePacePosition('Mid1', 1, 2, 1, true)).toBe('Mid1');
        expect(resolvePacePosition('Start2', 2, 1, 1, true)).toBe('Start2');
    });
    it('null（なし）は隊列 ON でも保持（確定ブロック L301 で捕捉する設計）', () => {
        expect(resolvePacePosition(null, 1, 2, 1, true)).toBe(null);
    });
    it('リセット先デフォルトは隊列 ON でも常に有効な位置', () => {
        const resolved = resolvePacePosition('End1', 2, 3, 2, true);
        expect(resolved).toBe('Start2');
        expect(isPacePositionValid(resolved, 2, 3, 2, true)).toBe(true);
    });
});

describe('isPhaseConfigValid - 隊列 ON のデータブロック（§7.6）', () => {
    it('隊列 ON × ペースが隊列スロットより後ろ → 不正（Import / state 復元由来の捕捉）', () => {
        expect(isPhaseConfigValid(1, 2, 1, 'Mid2', true)).toBe(false);
        expect(isPhaseConfigValid(1, 1, 1, 'Mid', true)).toBe(false);
    });
    it('隊列 ON × ペースが隊列スロット以前 → 有効', () => {
        expect(isPhaseConfigValid(1, 2, 1, 'Mid1', true)).toBe(true);
        expect(isPhaseConfigValid(1, 1, 1, 'Start', true)).toBe(true);
    });
    it('隊列 ON × ペースなし（null）は本関数では有効（L301 は validator 側の責務）', () => {
        expect(isPhaseConfigValid(1, 1, 1, null, true)).toBe(true);
    });
    it('隊列 OFF（引数省略）は従来と完全同一', () => {
        expect(isPhaseConfigValid(1, 2, 1, 'Mid2')).toBe(true);
    });
});

describe('getPhaseConfigDisplayLabels - 現在の構成表示', () => {
    it('序盤1/中盤1/終盤1/ペース序盤直後 → 序盤 → ペース → 中盤 → 終盤', () => {
        expect(getPhaseConfigDisplayLabels(1, 1, 1, 'Start')).toEqual(['序盤', 'ペース', '中盤', '終盤']);
    });
    it('ペースなし（null）はペースを挟まない', () => {
        expect(getPhaseConfigDisplayLabels(1, 1, 1, null)).toEqual(['序盤', '中盤', '終盤']);
    });
    it('序盤2/中盤2/終盤1/ペース=中盤1の後', () => {
        expect(getPhaseConfigDisplayLabels(2, 2, 1, 'Mid1')).toEqual([
            '序盤1', '序盤2', '中盤1', 'ペース', '中盤2', '終盤',
        ]);
    });
});

// CR-SA-20-Followup / 2026-06-12: 隊列 ON 時の「現在の構成」表示（§6.4 隊列スロット位置 +
// buildPhaseSequence〔E4〕と同一挿入規則）。表示と実走行のフェーズ列が食い違わないことが目的。
describe('getPhaseConfigDisplayLabels - 隊列 ON（CR-SA-20-Followup）', () => {
    it('中盤1/ペース序盤直後（同一アンカー）→ ペース → 隊列の順（§6.4）', () => {
        expect(getPhaseConfigDisplayLabels(1, 1, 1, 'Start', true)).toEqual([
            '序盤', 'ペース', '隊列', '中盤', '終盤',
        ]);
    });
    it('中盤2/ペース序盤直後 → 隊列は中盤1の後（§6.4 中盤2以上）', () => {
        expect(getPhaseConfigDisplayLabels(1, 2, 1, 'Start', true)).toEqual([
            '序盤', 'ペース', '中盤1', '隊列', '中盤2', '終盤',
        ]);
    });
    it('中盤0/ペース序盤直後 → 序盤 → ペース → 隊列 → 終盤', () => {
        expect(getPhaseConfigDisplayLabels(1, 0, 1, 'Start', true)).toEqual([
            '序盤', 'ペース', '隊列', '終盤',
        ]);
    });
    it('序盤2の可変構成/ペース=序盤1の後 → 隊列は序盤ブロック（序盤2）直後', () => {
        expect(getPhaseConfigDisplayLabels(2, 1, 1, 'Start1', true)).toEqual([
            '序盤1', 'ペース', '序盤2', '隊列', '中盤', '終盤',
        ]);
    });
    it('禁止構成（ペースなし × 隊列 ON）は buildPhaseSequence と同じく隊列のみ挿入（固定挙動）', () => {
        expect(getPhaseConfigDisplayLabels(1, 1, 1, null, true)).toEqual([
            '序盤', '隊列', '中盤', '終盤',
        ]);
    });
    it('隊列 OFF（明示 false / 引数省略）は従来と完全同一', () => {
        expect(getPhaseConfigDisplayLabels(1, 1, 1, 'Start', false)).toEqual(
            getPhaseConfigDisplayLabels(1, 1, 1, 'Start'),
        );
        expect(getPhaseConfigDisplayLabels(1, 1, 1, 'Start', false)).toEqual(['序盤', 'ペース', '中盤', '終盤']);
    });
    it('代表構成で実走行フェーズ列（buildPhaseSequence）と一致する（表示と実走行の一致担保）', () => {
        // buildPhaseSequence の ID 列を「現在の構成」表示語彙へ変換して比較する
        //（Pace の進行画面ラベルは「ペース判定」だが、構成表示では「ペース」を用いる）。
        const toDisplayLabel = (id: string): string =>
            id === 'Pace' ? 'ペース' : getPhaseLabel(id);
        const cases: [number, number, number, PacePosition][] = [
            [1, 1, 1, 'Start'],   // 同一アンカー（ペース → 隊列順)
            [1, 2, 1, 'Start'],   // 中盤2（隊列 = 中盤1の後)
            [1, 0, 1, 'Start'],   // 中盤0
            [2, 1, 1, 'Start1'],  // 序盤2の可変構成
            [2, 3, 2, 'Mid1'],    // 複数終盤 + ペース = 隊列と同一アンカー（Mid1）
        ];
        for (const [start, mid, end, pace] of cases) {
            const engine = buildPhaseSequence(true, start, mid, end, pace, true).map(toDisplayLabel);
            expect(getPhaseConfigDisplayLabels(start, mid, end, pace, true)).toEqual(engine);
        }
    });
});
