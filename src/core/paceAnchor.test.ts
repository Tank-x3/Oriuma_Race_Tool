// CR-SA-17-E3 / 2026-06-07: ペース挿入位置（アンカー方式）の純粋関数群テスト
// （houserule-features.md §7.5 ペース挿入位置の指定とバリデーション）。
import { describe, it, expect } from 'vitest';
import {
    getValidPaceAnchors,
    getPaceAnchorOptions,
    getDefaultPacePosition,
    isPacePositionValid,
    resolvePacePosition,
    isPhaseConfigValid,
    getPhaseConfigDisplayLabels,
    PACE_NONE_LABEL,
} from './paceAnchor';

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
