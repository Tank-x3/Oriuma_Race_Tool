// Bundle-8-T4 / CR-SA-4 / 2026-05-10: 絆スキル PhaseOutput 用 helpers（scene3-race.md §2）。
// Scene 1 で事前申告した絆スキル種別を、終盤フェーズの「投稿用ダイス出力」末尾に
// 【絆スキル】セクションとして自動生成するための純粋関数群。
import type { RaceState, Umamusume } from '../../../types';

type HouseRules = RaceState['config']['houseRules'];

/**
 * 絆スキル種別から日本語ラベルを返す。
 * - `'BondGamble'` → `'絆ギャンブル'`
 * - `'BondStable'` → `'絆安定'`
 * - `null` / `undefined` → 空文字列
 *
 * Scene 1 プルダウン表示・Scene 2 確認リスト併記と完全一致（scene3-race.md §2 SSoT）。
 */
export const getBondSkillTypeLabel = (
    type: 'BondGamble' | 'BondStable' | null | undefined,
): string => {
    if (type === 'BondGamble') return '絆ギャンブル';
    if (type === 'BondStable') return '絆安定';
    return '';
};

/**
 * 種別に対応するダイス式を返す。
 * - 絆ギャンブル → `dice1d15=`
 * - 絆安定 → `5+dice1d5=`（固有スキル安定型と同形式）
 */
const getBondSkillDiceFormula = (
    type: 'BondGamble' | 'BondStable',
): string => {
    if (type === 'BondGamble') return 'dice1d15=';
    return '5+dice1d5=';
};

/**
 * 枠番を丸囲み数字 ①〜⑳ に変換する（21 以上は `(N)` フォールバック）。
 * Scene 3 の通常ダイス・固有ダイス出力（`PhaseOutput.tsx#getGateSymbol`）と
 * 同パターン。出力セクション間の枠番表記統一のために本 helpers 内で同等実装を保持する。
 */
const getGateSymbol = (gate: number): string => {
    const symbols = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
    if (gate >= 1 && gate <= 20) return symbols[gate - 1];
    return `(${gate})`;
};

/**
 * 当該参加者の絆スキル 1 行分文字列を返す。
 *
 * 形式: `[枠番丸数字] [名前]　[種別ラベル]　[ダイス式]`
 *  - 枠番は丸囲み数字（①②③...）。Scene 3 の通常ダイス・固有ダイスと統一表記。
 *  - 区切り: 名前/ラベル/ダイス式間は全角スペース U+3000、枠番/名前間のみ半角スペース
 *  - 種別 / 枠番のいずれかが未設定の場合は空文字列
 *
 * 仕様根拠: scene3-race.md §2「絆スキル出力セクション」フォーマット SSoT
 * （`[枠番]` プレースホルダの具体表記は仕様書未規定、既存 Scene 3 出力との統一を採用）。
 */
export const formatBondSkillLine = (p: Umamusume): string => {
    const type = p.bondSkill?.type;
    if (!type) return '';
    if (p.gate === null) return '';
    const typeLabel = getBondSkillTypeLabel(type);
    const formula = getBondSkillDiceFormula(type);
    const gateSym = getGateSymbol(p.gate);
    return `${gateSym} ${p.name}　${typeLabel}　${formula}`;
};

/**
 * 終盤フェーズの「投稿用ダイス出力」末尾に追加する【絆スキル】セクション文字列を返す。
 *
 * 出力条件 (AND):
 *  - houseRules.enableBondSkill === true
 *  - currentPhaseId === 'End'
 *  - 1 名以上の participant で bondSkill?.type !== null/undefined かつ gate !== null
 *
 * いずれか不成立なら空文字列。
 *
 * 並び順 = 枠順ソート（通常ダイス・固有ダイスと同順、scene3-race.md §2 SSoT）。
 *
 * 出力例:
 *   【絆スキル】
 *   1 ウィトゲンクリア　絆ギャンブル　dice1d15=
 *   3 ウマ娘C　絆安定　5+dice1d5=
 *
 * 特殊戦法併記との独立性: 本セクションには `【捲り】±N` / `【溜め】±N` 等の併記を付与しない
 * （仕様 §2 SSoT、終盤後の絆スキル出力には影響しない）。
 */
export const getBondSkillSection = (
    participants: Umamusume[],
    currentPhaseId: string,
    houseRules: Pick<HouseRules, 'enableBondSkill'>,
): string => {
    if (!houseRules.enableBondSkill) return '';
    if (currentPhaseId !== 'End') return '';

    const targets = participants
        .filter((p) => !!p.bondSkill?.type && p.gate !== null)
        .slice()
        .sort((a, b) => (a.gate ?? 0) - (b.gate ?? 0));

    if (targets.length === 0) return '';

    const lines = targets.map(formatBondSkillLine).filter((s) => s.length > 0);
    if (lines.length === 0) return '';

    return `【絆スキル】\n${lines.join('\n')}`;
};
