// scripts/build-fixture-header.test.mjs
//
// DEV-TOOL-1 純関数の単体テスト
// 仕様根拠: docs/specs/architecture/fixture-header-builder.md §B-4 / §B-5 / §E

import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  selectPrimaryCategory,
  buildOrderedCategories,
  nextSerialFromFilenames,
  formatSerial,
  getNextSerial,
  buildAllowedPhases,
  autoAppendExtendedUnique,
  PRIORITY,
} from './build-fixture-header.mjs';

describe('selectPrimaryCategory（仕様書 §B-4）', () => {
  it('該当なしの空配列は null を返す', () => {
    expect(selectPrimaryCategory([])).toBe(null);
  });

  it('単一カテゴリはそのカテゴリを返す', () => {
    expect(selectPrimaryCategory(['variety'])).toBe('variety');
    expect(selectPrimaryCategory(['houserule_impl'])).toBe('houserule_impl');
  });

  it('複合カテゴリは PRIORITY 最上位を返す（bond_skill > extended_unique）', () => {
    expect(selectPrimaryCategory(['extended_unique', 'bond_skill'])).toBe('bond_skill');
    expect(selectPrimaryCategory(['bond_skill', 'extended_unique'])).toBe('bond_skill');
  });

  it('複合カテゴリは PRIORITY 順序を厳格に適用（variety < extended_unique）', () => {
    expect(selectPrimaryCategory(['variety', 'extended_unique'])).toBe('extended_unique');
  });

  it('houserule_impl は最低優先度', () => {
    expect(selectPrimaryCategory(['houserule_impl', 'variety'])).toBe('variety');
    expect(selectPrimaryCategory(['houserule_impl', 'bond_skill'])).toBe('bond_skill');
  });

  it('PRIORITY 配列の順序は仕様書通り', () => {
    expect(PRIORITY).toEqual(['bond_skill', 'extended_unique', 'variety', 'houserule_impl']);
  });
});

describe('buildOrderedCategories（仕様書 §B-4）', () => {
  it('空配列は [] を返す', () => {
    expect(buildOrderedCategories([])).toEqual([]);
  });

  it('単一カテゴリはそのまま返す', () => {
    expect(buildOrderedCategories(['variety'])).toEqual(['variety']);
  });

  it('ユーザー入力順と無関係に PRIORITY 順序で並べ替える', () => {
    expect(buildOrderedCategories(['extended_unique', 'bond_skill'])).toEqual([
      'bond_skill',
      'extended_unique',
    ]);
    expect(buildOrderedCategories(['houserule_impl', 'variety', 'bond_skill'])).toEqual([
      'bond_skill',
      'variety',
      'houserule_impl',
    ]);
  });

  it('全カテゴリ選択時は PRIORITY 順そのもの', () => {
    expect(buildOrderedCategories([...PRIORITY].reverse())).toEqual(PRIORITY);
  });
});

describe('nextSerialFromFilenames（仕様書 §B-5 純関数版）', () => {
  it('空配列は 1 を返す', () => {
    expect(nextSerialFromFilenames([])).toBe(1);
  });

  it('race-001.md のみは 2 を返す', () => {
    expect(nextSerialFromFilenames(['race-001.md'])).toBe(2);
  });

  it('連続連番の最大 + 1 を返す', () => {
    expect(nextSerialFromFilenames(['race-001.md', 'race-002.md', 'race-003.md'])).toBe(4);
  });

  it('歯抜けでも最大値 + 1 を返す（連番穴埋めはしない）', () => {
    expect(nextSerialFromFilenames(['race-001.md', 'race-005.md'])).toBe(6);
  });

  it('race-NNN.md 形式以外は無視する（README / _TEMPLATE 等）', () => {
    expect(
      nextSerialFromFilenames(['README.md', '_TEMPLATE.md', 'race-001.md', 'race-foo.md']),
    ).toBe(2);
  });

  it('3 桁未満は無視する（race-1.md は対象外）', () => {
    expect(nextSerialFromFilenames(['race-1.md', 'race-002.md'])).toBe(3);
  });
});

describe('formatSerial（仕様書 §B-5）', () => {
  it('1 桁は 3 桁ゼロパディング', () => {
    expect(formatSerial(1)).toBe('race-001.md');
    expect(formatSerial(7)).toBe('race-007.md');
  });

  it('2 桁は 3 桁ゼロパディング', () => {
    expect(formatSerial(25)).toBe('race-025.md');
  });

  it('3 桁はそのまま', () => {
    expect(formatSerial(100)).toBe('race-100.md');
    expect(formatSerial(999)).toBe('race-999.md');
  });
});

describe('buildAllowedPhases（仕様書 §B-6、CR-SA-5 SA04）', () => {
  it('midPhaseCount=0 は Start / End のみ', () => {
    expect(buildAllowedPhases(0)).toEqual(['Start', 'End']);
  });

  it('midPhaseCount=1 は Start / Mid / End（Mid 単一、Mid1 ではない）', () => {
    expect(buildAllowedPhases(1)).toEqual(['Start', 'Mid', 'End']);
  });

  it('midPhaseCount=2 は Start / Mid1 / Mid2 / End', () => {
    expect(buildAllowedPhases(2)).toEqual(['Start', 'Mid1', 'Mid2', 'End']);
  });

  it('midPhaseCount=3 は Start / Mid1 / Mid2 / Mid3 / End', () => {
    expect(buildAllowedPhases(3)).toEqual(['Start', 'Mid1', 'Mid2', 'Mid3', 'End']);
  });

  it('midPhaseCount=4（仕様上の最大値）は Start / Mid1〜Mid4 / End', () => {
    expect(buildAllowedPhases(4)).toEqual(['Start', 'Mid1', 'Mid2', 'Mid3', 'Mid4', 'End']);
  });

  it('全 midPhaseCount で Pace を含まない（basic-rules.md §4 / scene1-setup.md §2 ペース除外）', () => {
    for (let n = 0; n <= 4; n++) {
      expect(buildAllowedPhases(n)).not.toContain('Pace');
    }
  });
});

describe('autoAppendExtendedUnique（仕様書 §C-6-2 / §C-6-3 / §E DoD 10、CR-SA-5 SA05）', () => {
  it('hasOtherInput=false → 入力配列をそのまま返す（不変）', () => {
    expect(autoAppendExtendedUnique([], false)).toEqual([]);
    expect(autoAppendExtendedUnique(['bond_skill'], false)).toEqual(['bond_skill']);
    expect(autoAppendExtendedUnique(['variety', 'houserule_impl'], false)).toEqual([
      'variety',
      'houserule_impl',
    ]);
  });

  it('hasOtherInput=true + extended_unique 未含 → extended_unique 追加 + PRIORITY 順並べ替え', () => {
    expect(autoAppendExtendedUnique([], true)).toEqual(['extended_unique']);
    expect(autoAppendExtendedUnique(['variety'], true)).toEqual(['extended_unique', 'variety']);
    expect(autoAppendExtendedUnique(['houserule_impl', 'bond_skill'], true)).toEqual([
      'bond_skill',
      'extended_unique',
      'houserule_impl',
    ]);
  });

  it('hasOtherInput=true + extended_unique 既含 → 入力配列をそのまま返す（冪等）', () => {
    expect(autoAppendExtendedUnique(['extended_unique'], true)).toEqual(['extended_unique']);
    expect(autoAppendExtendedUnique(['extended_unique', 'variety'], true)).toEqual([
      'extended_unique',
      'variety',
    ]);
  });

  it('hasOtherInput=true + [bond_skill, extended_unique] 既含 → 冪等（主カテゴリは bond_skill 維持）', () => {
    expect(autoAppendExtendedUnique(['bond_skill', 'extended_unique'], true)).toEqual([
      'bond_skill',
      'extended_unique',
    ]);
    expect(selectPrimaryCategory(autoAppendExtendedUnique(['bond_skill', 'extended_unique'], true))).toBe(
      'bond_skill',
    );
  });
});

describe('getNextSerial（仕様書 §B-5、fs 副作用あり）', () => {
  let tempDir;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('非存在ディレクトリは作成 + 1 を返す', () => {
    const base = mkdtempSync(join(tmpdir(), 'fixture-builder-test-'));
    tempDir = base;
    const target = join(base, 'newdir');
    expect(getNextSerial(target)).toBe(1);
  });

  it('空ディレクトリは 1 を返す', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'fixture-builder-test-'));
    expect(getNextSerial(tempDir)).toBe(1);
  });

  it('既存 race-NNN.md の最大値 + 1 を返す', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'fixture-builder-test-'));
    writeFileSync(join(tempDir, 'race-001.md'), '');
    writeFileSync(join(tempDir, 'race-003.md'), '');
    writeFileSync(join(tempDir, 'README.md'), '');
    expect(getNextSerial(tempDir)).toBe(4);
  });
});
