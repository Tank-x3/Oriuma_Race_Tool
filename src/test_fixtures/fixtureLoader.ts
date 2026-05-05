// CR-SA-3-E3 (ENG04 / 2026-05-04): 実データ層 Vitest ハーネスのローダーヘルパー。
// 仕様 SSoT: docs/specs/architecture/testing-strategy.md §B / §C
//            docs/test_fixtures/_raw/_TEMPLATE.md（YAML フィールド構造）
//            docs/specs/architecture/parser-system.md §A / §B（Parser 振り分け）

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

export interface ParsedParticipant {
  name: string;
  strategy: string;
  uniqueSkill: {
    type: string;
    phases: string[];
  };
  specialStrategy: string | null;
}

export interface ParsedFrontmatter {
  source: 'animan' | '88ch';
  dataType: 'live' | 'synthetic';
  raceLabel?: string;
  gmName?: string;
  midPhaseCount: 0 | 1 | 2 | 3 | 4;
  fullGateSize: number | null;
  pending_categories: string[];
  houseRules: {
    enableModifier: boolean;
    enableSpecialStrategy: boolean;
    enableCompositeUnique: boolean;
  };
  participants: ParsedParticipant[];
}

export type PhaseName =
  | 'Pace'
  | 'Start'
  | 'Mid'
  | 'Mid1'
  | 'Mid2'
  | 'Mid3'
  | 'Mid4'
  | 'End'
  | 'Gate'
  | 'Judgment';

export interface PhaseBlock {
  phaseName: PhaseName;
  codeBlock: string;
}

export interface LoadedFixture {
  frontmatter: ParsedFrontmatter;
  body: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// src/test_fixtures/ → リポジトリルート
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const RAW_DIR = join(PROJECT_ROOT, 'docs', 'test_fixtures', '_raw');

export function getRawDir(): string {
  return RAW_DIR;
}

export function loadFixture(filePath: string): LoadedFixture {
  const raw = readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data as Partial<ParsedFrontmatter>;
  // PM14 補完規定（dataType 欠落 → 'live' / pending_categories 欠落 → []）。
  // testing-strategy.md §B L200「単一カテゴリの場合 ... 省略可」+ _TEMPLATE.md `synthetic` 明示要件のみ規定。
  const frontmatter: ParsedFrontmatter = {
    ...(data as ParsedFrontmatter),
    dataType: (data.dataType ?? 'live') as ParsedFrontmatter['dataType'],
    pending_categories: data.pending_categories ?? [],
  };
  return { frontmatter, body: parsed.content };
}

// 順序が重要: Mid1〜Mid4 を Mid より先に判定して prefix 衝突を避ける。
const PHASE_RULES: Array<{ test: (header: string) => boolean; name: PhaseName }> = [
  { test: (h) => /^Phase:\s*PACE\b/i.test(h), name: 'Pace' },
  { test: (h) => /^Phase:\s*Start\b/i.test(h), name: 'Start' },
  { test: (h) => /^Phase:\s*Mid1\b/i.test(h), name: 'Mid1' },
  { test: (h) => /^Phase:\s*Mid2\b/i.test(h), name: 'Mid2' },
  { test: (h) => /^Phase:\s*Mid3\b/i.test(h), name: 'Mid3' },
  { test: (h) => /^Phase:\s*Mid4\b/i.test(h), name: 'Mid4' },
  { test: (h) => /^Phase:\s*Mid\b/i.test(h), name: 'Mid' },
  { test: (h) => /^Phase:\s*End\b/i.test(h), name: 'End' },
  { test: (h) => /^Scene\s+2\s+Gate\b/i.test(h), name: 'Gate' },
  { test: (h) => /^Judgment\b/i.test(h), name: 'Judgment' },
];

function matchPhaseName(headerText: string): PhaseName | null {
  if (/^特殊事例/.test(headerText)) return null;
  for (const rule of PHASE_RULES) {
    if (rule.test(headerText)) return rule.name;
  }
  return null;
}

export function extractPhases(body: string): PhaseBlock[] {
  const lines = body.split(/\r?\n/);
  const result: PhaseBlock[] = [];
  let currentPhase: PhaseName | null = null;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inCodeBlock && /^##\s+/.test(trimmed)) {
      const headerText = trimmed.replace(/^##\s+/, '').trim();
      currentPhase = matchPhaseName(headerText);
      continue;
    }

    if (/^```/.test(trimmed)) {
      if (!inCodeBlock) {
        if (currentPhase) {
          inCodeBlock = true;
          codeBuffer = [];
        }
      } else {
        if (currentPhase) {
          result.push({
            phaseName: currentPhase,
            codeBlock: codeBuffer.join('\n'),
          });
          codeBuffer = [];
        }
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock && currentPhase) {
      codeBuffer.push(line);
    }
  }

  return result;
}

// 実データ層 glob: _raw/{animan,88ch}/race-*.md（_pending_* は自然除外）
export function listRealDataFixtures(): string[] {
  const result: string[] = [];
  for (const source of ['animan', '88ch']) {
    const dir = join(RAW_DIR, source);
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir);
    for (const name of entries) {
      if (/^race-\d+\.md$/.test(name)) {
        result.push(join(dir, name));
      }
    }
  }
  return result.sort();
}

// 全件 glob: _raw/**/race-*.md（保留待機層含む、_TEMPLATE.md は名前パターンで自然除外）
export function listAllFixtures(): string[] {
  const result: string[] = [];

  function walk(dir: string): void {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir);
    for (const name of entries) {
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile() && /^race-\d+\.md$/.test(name)) {
        result.push(full);
      }
    }
  }

  walk(RAW_DIR);
  return result.sort();
}
