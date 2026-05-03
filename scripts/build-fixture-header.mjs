#!/usr/bin/env node
// scripts/build-fixture-header.mjs
//
// テストデータヘッダー作成支援 CLI ツール（DEV-TOOL-1）
// 仕様根拠: docs/specs/architecture/fixture-header-builder.md §A〜§F
//          docs/specs/architecture/testing-strategy.md §B（保留待機 + 複合差異）
//          docs/test_fixtures/_raw/_TEMPLATE.md（YAML 構造 SSoT、§D-3 で動的流用）

import { createInterface } from 'node:readline/promises';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  renameSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const FIXTURES_ROOT = join(REPO_ROOT, 'docs', 'test_fixtures');
const TEMPLATE_PATH = join(FIXTURES_ROOT, '_raw', '_TEMPLATE.md');

// ─────────────────────────────────────────────
// 定数（仕様書 §B-1, §B-4）
// ─────────────────────────────────────────────
export const SOURCES = ['animan', '88ch'];
export const DATA_TYPES = ['live', 'synthetic'];
export const STRATEGIES = ['大逃げ', '逃げ', '先行', '差し', '追込'];
export const UNIQUE_TYPES_BUILTIN = ['Stability', 'Gamble', 'Persistent'];
export const SPECIAL_STRATEGIES = ['Makuri', 'Tame'];
export const PENDING_CATEGORIES = ['extended_unique', 'bond_skill', 'variety', 'houserule_impl'];

// 主カテゴリ優先度（昇格最遠順、仕様書 §B-4 / testing-strategy.md §B 複合差異処理ルール）
export const PRIORITY = ['bond_skill', 'extended_unique', 'variety', 'houserule_impl'];

// ─────────────────────────────────────────────
// 純関数（テスト対象、仕様書 §B-4 / §B-5）
// ─────────────────────────────────────────────

// 仕様書 §B-4: PRIORITY 順序の最上位を主カテゴリとする
export function selectPrimaryCategory(selectedCategories) {
  for (const candidate of PRIORITY) {
    if (selectedCategories.includes(candidate)) return candidate;
  }
  return null;
}

// 仕様書 §B-4: PRIORITY 順序で並べ替え
export function buildOrderedCategories(selectedCategories) {
  return PRIORITY.filter((c) => selectedCategories.includes(c));
}

// 仕様書 §B-5: race-NNN 形式の連番採番（純関数版、ファイル名配列から計算）
export function nextSerialFromFilenames(filenames) {
  const nums = filenames
    .map((f) => f.match(/^race-(\d{3})\.md$/))
    .filter((m) => m !== null)
    .map((m) => parseInt(m[1], 10));
  if (nums.length === 0) return 1;
  return Math.max(...nums) + 1;
}

// 仕様書 §B-5: ゼロパディング 3 桁
export function formatSerial(n) {
  return `race-${String(n).padStart(3, '0')}.md`;
}

// 仕様書 §B-5: ディレクトリ走査して連番取得（副作用あり）
export function getNextSerial(targetDir) {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
    return 1;
  }
  const files = readdirSync(targetDir);
  return nextSerialFromFilenames(files);
}

// 仕様書 §B-1 Step 3 確認表示 / testing-strategy.md §B 配置先規則
export function resolveTargetDir(source, primaryCategory) {
  if (primaryCategory === null) {
    return join(FIXTURES_ROOT, '_raw', source);
  }
  return join(FIXTURES_ROOT, '_raw', `_pending_${primaryCategory}`, source);
}

// CR-SA-5 SA05: 「その他」自由入力連動 pending_categories 自動付与
// 仕様書 §C-6-2 / §C-6-3 / §C-6-6 / §E DoD 10
// hasOtherInput=true なら extended_unique を追加（既存含む場合は冪等）し
// PRIORITY 順序で並べ替えた配列を返す純関数。
export function autoAppendExtendedUnique(pendingCategories, hasOtherInput) {
  if (!hasOtherInput) return [...pendingCategories];
  if (pendingCategories.includes('extended_unique')) return [...pendingCategories];
  return buildOrderedCategories([...pendingCategories, 'extended_unique']);
}

// ─────────────────────────────────────────────
// 入力ヘルパー
// ─────────────────────────────────────────────

async function ask(rl, message) {
  const answer = await rl.question(message);
  return answer.trim();
}

async function askFreeform(rl, label, allowEmpty = true) {
  while (true) {
    const v = await ask(rl, `${label}: `);
    if (v === '' && !allowEmpty) {
      console.log('  → 空入力は不可です。再入力してください。');
      continue;
    }
    return v;
  }
}

// CR-SA-5 SA05: 識別子プロンプト用の番号選択入力 + 「その他」自由入力分岐
// 仕様書 §C-6-1 / §C-6-2 / §C-6-4 / §C-6-6
// 戻り値: { value: string, isOther: boolean }
//   - isOther=false: 選択肢配列の値そのもの
//   - isOther=true: 自由入力文字列（呼び出し側で extended_unique 自動付与の集約に使用）
async function askChoice(rl, label, choices, { allowDefault = null, allowOther = false } = {}) {
  const displayChoices = allowOther ? [...choices, 'その他'] : choices;
  const display = displayChoices
    .map((c, i) => `${i + 1}) ${c}${c === allowDefault ? ' (既定)' : ''}`)
    .join(' / ');
  const defaultHint = allowDefault !== null ? '（空入力で既定）' : '';
  while (true) {
    const v = await ask(rl, `${label} ${display}${defaultHint}: `);
    if (v === '' && allowDefault !== null) return { value: allowDefault, isOther: false };
    const n = parseInt(v, 10);
    if (Number.isInteger(n) && String(n) === v && n >= 1 && n <= displayChoices.length) {
      const picked = displayChoices[n - 1];
      if (allowOther && picked === 'その他') {
        const free = await askFreeInput(rl, '  自由入力');
        return { value: free, isOther: true };
      }
      return { value: picked, isOther: false };
    }
    console.log(`  → 不正な入力です。1〜${displayChoices.length} の番号で入力してください。`);
  }
}

// CR-SA-5 SA05: 数値プロンプト用の値直接入力ヘルパー
// 仕様書 §C-6-1 / §C-6-4 / §C-6-6
async function askValueDirect(rl, label, choices) {
  const display = choices.join(' / ');
  while (true) {
    const v = await ask(rl, `${label} ${display}: `);
    if (choices.includes(v)) return v;
    console.log(`  → 不正な入力です。選択肢: ${display}`);
  }
}

// CR-SA-5 SA05: 「その他」自由入力プロンプト用ヘルパー
// 仕様書 §C-6-2 / §C-6-4 / §C-6-6
// 既存 askFreeform(rl, label, false) の薄いラッパー（呼び出し意図を明示）
async function askFreeInput(rl, label) {
  return askFreeform(rl, label, false);
}

// CR-SA-5 SA04: 参加者操作プロンプト等の単文字メニュー
// (仕様書 §C-6 派生 / TASK_INSTRUCTION §5.3 推奨方針)
async function askMenu(rl, label, options) {
  const display = options.map((o) => `${o.key}=${o.label}`).join(' / ');
  const keys = options.map((o) => o.key).join(' / ');
  while (true) {
    const v = (await ask(rl, `${label} (${display}): `)).toLowerCase();
    const matched = options.find((o) => o.key === v);
    if (matched) return matched.key;
    console.log(`  → ${keys} のいずれかを入力してください。`);
  }
}

async function askYesNo(rl, label, { defaultYes = false } = {}) {
  const hint = defaultYes ? '(Y/n)' : '(y/N)';
  while (true) {
    const v = (await ask(rl, `${label} ${hint}: `)).toLowerCase();
    if (v === '' ) return defaultYes;
    if (v === 'y' || v === 'yes') return true;
    if (v === 'n' || v === 'no') return false;
    console.log('  → y / n のいずれかで入力してください。');
  }
}

async function askIntOrEmpty(rl, label) {
  while (true) {
    const v = await ask(rl, `${label}（整数または空）: `);
    if (v === '') return null;
    const n = parseInt(v, 10);
    if (Number.isInteger(n) && String(n) === v) return n;
    console.log('  → 整数または空入力で答えてください。');
  }
}

// CR-SA-5 SA05: 番号カンマ区切り入力 + 「その他」自由入力併記
// 仕様書 §C-6-1 / §C-6-2 / §C-6-4 / §C-6-6
// 「その他」を含む選択時はカンマ区切り入力受領後に自由入力プロンプトを 1 回提示。
// 戻り値: 選択肢値の配列（「その他」自由入力が含まれる場合は配列末尾に追加）
async function askMultiSelect(rl, label, choices, { minCount = 1, allowOther = false } = {}) {
  const displayChoices = allowOther ? [...choices, 'その他'] : choices;
  const display = displayChoices.map((c, i) => `${i + 1}) ${c}`).join(' / ');
  const exampleHint =
    displayChoices.length >= 2 ? `（カンマ区切り、例: 1, 2）` : '（カンマ区切り）';
  while (true) {
    const v = await ask(rl, `${label} ${display}${exampleHint}: `);
    const tokens = v.split(',').map((s) => s.trim()).filter((s) => s !== '');
    const nums = [];
    let hasInvalid = false;
    const invalidRaw = [];
    for (const t of tokens) {
      const n = parseInt(t, 10);
      if (!Number.isInteger(n) || String(n) !== t || n < 1 || n > displayChoices.length) {
        hasInvalid = true;
        invalidRaw.push(t);
        continue;
      }
      nums.push(n);
    }
    if (hasInvalid) {
      console.log(`  → 不正な入力があります: ${invalidRaw.join(', ')}`);
      console.log(`     1〜${displayChoices.length} の番号で入力してください。`);
      continue;
    }
    const uniqNums = [...new Set(nums)];
    if (uniqNums.length !== nums.length) {
      console.log('  → 同じ番号が重複しています。再入力してください。');
      continue;
    }
    if (uniqNums.length < minCount) {
      console.log(`  → 最低 ${minCount} 件選択してください。`);
      continue;
    }
    const picked = uniqNums.map((n) => displayChoices[n - 1]);
    const otherIdx = picked.indexOf('その他');
    if (allowOther && otherIdx >= 0) {
      const free = await askFreeInput(rl, '  その他カテゴリ名');
      const result = picked.filter((c) => c !== 'その他');
      result.push(free);
      return result;
    }
    return picked;
  }
}

// ─────────────────────────────────────────────
// 対話ステップ（仕様書 §B-1）
// ─────────────────────────────────────────────

async function collectMetadata(rl) {
  console.log('\n━━━ Step 1. メタデータ入力 ━━━');
  // CR-SA-5 SA05: 識別子プロンプトは番号選択（「その他」適用外、§C-6-2 表）
  const source = (await askChoice(rl, '掲示板ソース?', SOURCES)).value;
  const dataType = (await askChoice(rl, 'データ種別?', DATA_TYPES, { allowDefault: 'live' })).value;
  const raceLabel = await askFreeform(rl, 'レースラベル（任意、空 OK）');
  const gmName = await askFreeform(rl, 'GM 名（任意、空 OK）');
  // CR-SA-5 SA05: 数値プロンプトは値直接入力（§C-6-1）
  // midPhaseCount 仕様上限 4（basic-rules.md §2 補足 / scene1-setup.md §2）
  const midPhaseCountStr = await askValueDirect(rl, '中盤フェーズ数?', ['0', '1', '2', '3', '4']);
  const midPhaseCount = parseInt(midPhaseCountStr, 10);
  const fullGateSize = await askIntOrEmpty(rl, '全枠数上限');
  return { source, dataType, raceLabel, gmName, midPhaseCount, fullGateSize };
}

async function collectHouseRules(rl) {
  console.log('\n━━━ Step 2. houseRules フラグ ━━━');
  const enableModifier = await askYesNo(rl, '修正ボタン (enableModifier)?');
  const enableSpecialStrategy = await askYesNo(rl, '特殊戦法 (enableSpecialStrategy)?');
  const enableCompositeUnique = await askYesNo(rl, '複合固有スキル (enableCompositeUnique)?');
  return { enableModifier, enableSpecialStrategy, enableCompositeUnique };
}

async function collectPendingCategories(rl) {
  console.log('\n━━━ Step 3. 保留待機カテゴリ判定 ━━━');
  const isPending = await askYesNo(rl, 'このレースは保留待機カテゴリに該当しますか?');
  if (!isPending) {
    return { selected: [], primary: null, ordered: [] };
  }
  // CR-SA-5 SA05: 番号カンマ区切り + 「その他」補助対応（§C-6-2 表「補助対応」行）
  // 「その他」自由入力値は配列末尾に追加要素として保存（拡張カテゴリ枠）
  const selected = await askMultiSelect(rl, '該当カテゴリ（複数選択可）', PENDING_CATEGORIES, {
    minCount: 1,
    allowOther: true,
  });
  const primary = selectPrimaryCategory(selected);
  const ordered = buildOrderedCategories(selected);
  // 「その他」自由入力値は buildOrderedCategories の PRIORITY フィルタで弾かれるため
  // selected 中の標準 4 カテゴリ以外（自由入力値）を ordered 末尾に再付与する
  for (const c of selected) {
    if (!PENDING_CATEGORIES.includes(c)) ordered.push(c);
  }
  console.log(`  → 主カテゴリ: ${primary}`);
  console.log(`  → 物理配置先: _raw/_pending_${primary}/<source>/`);
  console.log(`  → pending_categories: [${ordered.join(', ')}]`);
  return { selected, primary, ordered };
}

// CR-SA-5 SA04: 仕様書 §B-6 擬似コード準拠
// - midPhaseCount=0: Start / End
// - midPhaseCount=1: Start / Mid / End （Mid 単一、Mid1 ではない）
// - midPhaseCount>=2: Start / Mid1 / ... / Mid<N> / End
// - Pace は常に除外（参加者の固有スキル発動タイミング外、basic-rules.md §4 / scene1-setup.md §2）
// 既存 src/components/scene/setup/EntryForm.tsx availablePhases (L127-142) と完全整合
export function buildAllowedPhases(midPhaseCount) {
  const phases = ['Start'];
  if (midPhaseCount === 1) {
    phases.push('Mid');
  } else if (midPhaseCount > 1) {
    for (let i = 1; i <= midPhaseCount; i++) phases.push(`Mid${i}`);
  }
  phases.push('End');
  return phases;
}

async function collectOneParticipant(rl, existingNames, ctx) {
  // 名前
  let name;
  while (true) {
    name = await askFreeform(rl, '  名前', false);
    if (existingNames.includes(name)) {
      console.log(`  → 参加者名「${name}」は既にこのレース内で使用されています。再入力してください。`);
      continue;
    }
    break;
  }
  // CR-SA-5 SA05: 脚質 / 固有スキルタイプ / 特殊戦法は「その他」適用識別子プロンプト
  // 仕様書 §C-6-2 表 / §C-6-3。「その他」入力時は自由入力文字列を直接保存し
  // _hasOtherInput フラグを参加者ループ完了時に集約する
  let hasOtherInput = false;
  // 脚質
  const strategyResult = await askChoice(rl, '  脚質?', STRATEGIES, { allowOther: true });
  const strategy = strategyResult.value;
  if (strategyResult.isOther) hasOtherInput = true;
  // 固有スキルタイプ
  const typeResult = await askChoice(rl, '  固有スキルタイプ?', UNIQUE_TYPES_BUILTIN, {
    allowOther: true,
  });
  const uniqueType = typeResult.value;
  if (typeResult.isOther) hasOtherInput = true;
  // 発動フェーズ（midPhaseCount で制限、§B-6）— 固定値域のため allowOther 適用外
  const allowedPhases = buildAllowedPhases(ctx.midPhaseCount);
  const phases = await askMultiSelect(rl, '  発動フェーズ?', allowedPhases, { minCount: 1 });
  // 特殊戦法（§B-1 Step 4: enableSpecialStrategy=false なら自動 null）
  let specialStrategy = null;
  if (ctx.enableSpecialStrategy) {
    const ssResult = await askChoice(rl, '  特殊戦法?', [...SPECIAL_STRATEGIES, 'null'], {
      allowOther: true,
    });
    if (ssResult.isOther) hasOtherInput = true;
    specialStrategy = ssResult.value === 'null' ? null : ssResult.value;
  }
  return {
    name,
    strategy,
    uniqueSkill: { type: uniqueType, phases },
    specialStrategy,
    _hasOtherInput: hasOtherInput,
  };
}

async function collectParticipants(rl, ctx) {
  console.log('\n━━━ Step 4. 参加者ループ ━━━');
  const participants = [];
  // CR-SA-5 SA04: 値直接入力一律方式（仕様書 §C-6 派生 / TASK_INSTRUCTION §5.3 推奨）
  // y/n/q/p の単文字を直接入力させる方式に統一
  while (true) {
    const action = await askMenu(
      rl,
      `参加者を追加しますか?（現在 ${participants.length} 名）`,
      [
        { key: 'y', label: '追加' },
        { key: 'n', label: '完了' },
        { key: 'q', label: '打ち切り' },
        { key: 'p', label: '前の参加者を修正' },
      ],
    );
    if (action === 'y') {
      console.log(`\n--- 参加者 ${participants.length + 1} ---`);
      const p = await collectOneParticipant(rl, participants.map((x) => x.name), ctx);
      participants.push(p);
      continue;
    }
    if (action === 'n' || action === 'q') {
      if (participants.length === 0) {
        console.log('  → 最低 1 名必要です。参加者を追加してください。');
        continue;
      }
      return participants;
    }
    if (action === 'p') {
      if (participants.length === 0) {
        console.log('  → 修正対象の参加者がいません。');
        continue;
      }
      const idx = participants.length - 1;
      console.log(`  → 直前の参加者「${participants[idx].name}」を再入力します。`);
      participants.pop();
      const namesNow = participants.map((x) => x.name);
      const replaced = await collectOneParticipant(rl, namesNow, ctx);
      participants.push(replaced);
      continue;
    }
  }
}

// ─────────────────────────────────────────────
// YAML 構築（仕様書 §B-2, §C-2 文字列テンプレート）
// ─────────────────────────────────────────────

function quoteYamlString(s) {
  // 仕様書 §C-2: ダブルクォートで囲み、内部の " のみ \" にエスケープ
  return `"${String(s).replace(/"/g, '\\"')}"`;
}

export function buildYaml(meta, houseRules, pendingOrdered, participants) {
  const lines = [];
  lines.push('---');
  lines.push(`source: ${meta.source}`);
  lines.push(`dataType: ${meta.dataType}`);
  lines.push(`raceLabel: ${quoteYamlString(meta.raceLabel)}`);
  lines.push(`gmName: ${quoteYamlString(meta.gmName)}`);
  lines.push(`midPhaseCount: ${meta.midPhaseCount}`);
  lines.push(`fullGateSize: ${meta.fullGateSize === null ? 'null' : meta.fullGateSize}`);
  lines.push(`pending_categories: [${pendingOrdered.join(', ')}]`);
  lines.push('houseRules:');
  lines.push(`  enableModifier: ${houseRules.enableModifier}`);
  lines.push(`  enableSpecialStrategy: ${houseRules.enableSpecialStrategy}`);
  lines.push(`  enableCompositeUnique: ${houseRules.enableCompositeUnique}`);
  lines.push('participants:');
  for (const p of participants) {
    lines.push(`  - name: ${quoteYamlString(p.name)}`);
    lines.push(`    strategy: ${quoteYamlString(p.strategy)}`);
    lines.push('    uniqueSkill:');
    lines.push(`      type: ${quoteYamlString(p.uniqueSkill.type)}`);
    const phasesYaml = p.uniqueSkill.phases.map((ph) => quoteYamlString(ph)).join(', ');
    lines.push(`      phases: [${phasesYaml}]`);
    const ss = p.specialStrategy === null ? 'null' : quoteYamlString(p.specialStrategy);
    lines.push(`    specialStrategy: ${ss}`);
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}

// ─────────────────────────────────────────────
// テンプレート流用（仕様書 §D-3）
// ─────────────────────────────────────────────

export function extractPhaseTemplate(templatePath) {
  const content = readFileSync(templatePath, 'utf8');
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error('_TEMPLATE.md の YAML フロントマターを抽出できませんでした');
  }
  return match[1];
}

// ─────────────────────────────────────────────
// 連番確認 / ファイル書き込み
// ─────────────────────────────────────────────

async function confirmSerial(rl, targetDir) {
  const auto = getNextSerial(targetDir);
  while (true) {
    const v = await ask(
      rl,
      `次の連番は ${formatSerial(auto)} です。OK? (Y/n、別連番手入力可、例: 7): `,
    );
    if (v === '' || v.toLowerCase() === 'y' || v.toLowerCase() === 'yes') return auto;
    if (v.toLowerCase() === 'n' || v.toLowerCase() === 'no') {
      const m = await ask(rl, '  別連番（整数）: ');
      const n = parseInt(m, 10);
      if (!Number.isInteger(n) || n < 1) {
        console.log('  → 不正な番号です。再入力してください。');
        continue;
      }
      return n;
    }
    const n = parseInt(v, 10);
    if (Number.isInteger(n) && n >= 1) return n;
    console.log('  → Y / n または整数で入力してください。');
  }
}

async function confirmWriteAndCollision(rl, targetPath, serial, finalContent) {
  console.log('\n━━━ Step 6. 確認 ━━━');
  console.log(`出力先: ${targetPath}`);
  console.log(`連番:   ${formatSerial(serial)}`);
  console.log('---- ファイル内容（先頭部分） ----');
  const preview = finalContent.split('\n').slice(0, 40).join('\n');
  console.log(preview);
  console.log('（残りは省略表示）');
  console.log('-----------------------------------');
  const ok = await askYesNo(rl, 'このまま書き込みますか?', { defaultYes: true });
  if (!ok) return false;
  if (existsSync(targetPath)) {
    const overwrite = await askYesNo(
      rl,
      `${formatSerial(serial)} は既存です。上書きしますか?`,
      { defaultYes: false },
    );
    if (!overwrite) return false;
  }
  return true;
}

export function atomicWrite(targetPath, content) {
  // 仕様書 §B-3 原子的書き込み: .tmp に書いてから rename
  const tempPath = `${targetPath}.tmp`;
  writeFileSync(tempPath, content, 'utf8');
  renameSync(tempPath, targetPath);
}

// ─────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('=== Fixture Header Builder (DEV-TOOL-1) ===');
    console.log('対話形式で YAML フロントマター + Phase 雛形を生成し、');
    console.log('docs/test_fixtures/_raw/.../race-NNN.md として書き出します。\n');

    const meta = await collectMetadata(rl);
    const houseRules = await collectHouseRules(rl);
    const pending = await collectPendingCategories(rl);
    const participants = await collectParticipants(rl, {
      midPhaseCount: meta.midPhaseCount,
      enableSpecialStrategy: houseRules.enableSpecialStrategy,
      pendingSelected: pending.selected,
    });

    // CR-SA-5 SA05: 「その他」入力集約 → pending_categories 自動更新
    // 仕様書 §C-6-2 / §C-6-3 / §C-6-6
    // 標準 4 カテゴリ部分のみを autoAppendExtendedUnique で更新し、
    // 「その他」自由入力で追加された pending カテゴリ拡張枠（§C-6-2 表「補助対応」行）は末尾保持
    const hasAnyOther = participants.some((p) => p._hasOtherInput);
    const standardCats = pending.ordered.filter((c) => PENDING_CATEGORIES.includes(c));
    const extras = pending.ordered.filter((c) => !PENDING_CATEGORIES.includes(c));
    const updatedStandard = autoAppendExtendedUnique(standardCats, hasAnyOther);
    const updatedOrdered = [...updatedStandard, ...extras];
    const updatedPrimary = selectPrimaryCategory(updatedOrdered);
    if (hasAnyOther && !standardCats.includes('extended_unique')) {
      console.log(
        '\n  ⓘ 「その他」自由入力検出 → pending_categories に extended_unique を自動付与しました',
      );
      if (updatedPrimary !== pending.primary) {
        console.log(`     主カテゴリ更新: ${pending.primary} → ${updatedPrimary}`);
      }
      console.log(`     pending_categories: [${updatedOrdered.join(', ')}]`);
    }

    const targetDir = resolveTargetDir(meta.source, updatedPrimary);
    const serial = await confirmSerial(rl, targetDir);
    const targetPath = join(targetDir, formatSerial(serial));

    // CR-SA-5 SA05: _hasOtherInput は内部用フラグのため YAML 出力前に除外
    const yamlParticipants = participants.map(({ _hasOtherInput, ...rest }) => rest);
    const yamlContent = buildYaml(meta, houseRules, updatedOrdered, yamlParticipants);
    const phaseTemplate = extractPhaseTemplate(TEMPLATE_PATH);
    const finalContent = yamlContent + phaseTemplate;

    const proceed = await confirmWriteAndCollision(rl, targetPath, serial, finalContent);
    if (!proceed) {
      console.log('キャンセルしました。書き込みは行いません。');
      return;
    }
    atomicWrite(targetPath, finalContent);
    console.log(`\n✓ 書き込み完了: ${targetPath}`);
    console.log('  以降は Phase コードブロック内に GM ログを手動で貼り付けてください。');
  } finally {
    rl.close();
  }
}

// メインスクリプトとして起動された場合のみ main() 実行（import 時は未実行）
const invokedAsMain = (() => {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (invokedAsMain) {
  main().catch((err) => {
    console.error('エラー:', err.message);
    process.exit(1);
  });
}
