// Bundle-8-T4 / CR-SA-4 / 2026-05-10: 絆スキル PhaseOutput 用 helpers（scene3-race.md §2）。
// Scene 1 で事前申告した絆スキル種別を、終盤フェーズの「投稿用ダイス出力」末尾に
// 【絆スキル】セクションとして自動生成するための純粋関数群。
// Bundle-8-T6 / CR-SA-4 / 2026-05-10: 絆スキルの最終加算（basic-rules.md §5 末尾 +
// houserule-features.md §2 [v] §計算仕様）を担う純粋関数を本ファイルに追加配置する。
// calculator.ts は不変厳守エリアのため、Bundle-4 の `calculateScoreWithSpecialStrategy`
// と同パターンで「Calculator 戻り値に上乗せする」運用を踏襲する。
import type { RaceState, Strategy, Umamusume } from '../../../types';
import { calculateScoreWithSpecialStrategy } from './specialStrategy.helpers';

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
    lastEndPhaseId: string = 'End',
): string => {
    if (!houseRules.enableBondSkill) return '';
    // CR-SA-17-E4 / 2026-06-08: 可変終盤対応。絆スキルセクションは「最後の終盤フェーズ」でのみ出力する
    // （省略時 'End' = 終盤 1 回 / OFF で従来同一、終盤 ≥2 では End{n}）。
    if (currentPhaseId !== lastEndPhaseId) return '';

    const targets = participants
        .filter((p) => !!p.bondSkill?.type && p.gate !== null)
        .slice()
        .sort((a, b) => (a.gate ?? 0) - (b.gate ?? 0));

    if (targets.length === 0) return '';

    const lines = targets.map(formatBondSkillLine).filter((s) => s.length > 0);
    if (lines.length === 0) return '';

    return `【絆スキル】\n${lines.join('\n')}`;
};

// Bundle-8-T6 / CR-SA-4 / 2026-05-10: 絆スキルの最終加算ロジック。
// 仕様根拠: basic-rules.md §5 累積加算方式 末尾「絆スキルの最終加算」+
//          houserule-features.md §2 [v] §計算仕様 SSoT。
//
// Parser 仕様（src/core/parser/bondTypes.ts L19-23）により、`history.End.bondDice.sum` には
// 既に「絆スキルとして加算すべき値（fix value 込みの total）」が格納されている:
//   - 絆ギャンブル `dice1d15=12` → bondDice.sum = 12
//   - 絆安定 `5+dice1d5=` 出目 3 → bondDice.sum = 5 + 3 = 8
// したがって本 helper は種別分岐せず単純に sum を返すだけで、仕様 §計算仕様 SSoT
// （絆ギャンブル: `+ 出目` / 絆安定: `+ (出目 + 5)`）と完全一致する。

/**
 * 当該参加者の score に最終加算すべき絆スキル分の delta を返す純粋関数。
 *
 * 抑制条件 (OR、いずれか成立で delta = 0):
 *  - houseRules.enableBondSkill === false（HR フラグ OFF）
 *  - participant.bondSkill?.type が `null` / `undefined`（種別未指定）
 *  - participant.history.End?.bondDice 不在（Parser 未解析、終盤未到達含む）
 *
 * 上記いずれにも該当しない場合 → `participant.history.End.bondDice.sum` を返す。
 * Parser 側で fix value 込みの total が格納されているため、種別による式分岐は不要。
 */
export const calculateBondSkillDelta = (
    p: Umamusume,
    houseRules: Pick<HouseRules, 'enableBondSkill'>,
    lastEndPhaseId: string = 'End',
): number => {
    if (!houseRules.enableBondSkill) return 0;
    const type = p.bondSkill?.type;
    if (!type) return 0;
    // CR-SA-17-E4 / 2026-06-08: 可変終盤対応。絆ダイスは最後の終盤フェーズで取り込まれるため
    // history[lastEndPhaseId]（省略時 'End'）を参照する。
    const bondDice = p.history[lastEndPhaseId]?.bondDice;
    if (!bondDice) return 0;
    return bondDice.sum;
};

/**
 * 特殊戦法 delta + 絆スキル delta を含めた完全 score を返す。
 * 既存 `calculateScoreWithSpecialStrategy`（Bundle-4 ENG28 確立、解析未実行 phase 除外 +
 * specialStrategy delta 一元化）の戻り値に `calculateBondSkillDelta` を加算する。
 *
 * useRaceStore の score 再計算経路すべて（setMidPhaseCount / updateHouseRules /
 * setSpecialStrategy / setManualModifier / clearManualModifier / updateParticipant /
 * setBondSkill）で本関数を呼ぶことで、絆スキル統合後の score 計算ロジックを一元化する。
 *
 * CR-SA-15-E2 / 2026-05-15: 固有スキル設定参照化（houserule-features.md §5.4）。
 * `houseRules` の Pick 型に `'uniqueDiceConfig'` を追加し、`calculateScoreWithSpecialStrategy`
 * へ伝播する。**引数の個数・並びは不変**（useRaceStore.ts の 13 呼び出しは `houseRules`
 * オブジェクト全体を渡しているため、Pick 型拡張のみで無改修となる設計）。
 */
export const calculateScoreWithBondSkill = (
    p: Umamusume,
    strategies: Strategy[],
    paceFace: number | null,
    activePhaseIds: readonly string[],
    // CR-SA-20-E4 / 2026-06-11: 'enableFormationDice' を optional 交差で追加（隊列補正の ON/OFF ゲート）。
    // useRaceStore の呼び出しは houseRules オブジェクト全体を渡しているため透過的に有効化される。
    // optional にする理由 = 既存テスト・呼び出しの部分オブジェクト（旧 Pick 4 キー）を無改修で通す
    //（省略 = undefined = OFF 扱いで従来挙動と完全同一）。
    houseRules: Pick<HouseRules, 'effectValue' | 'enableSpecialStrategy' | 'enableBondSkill' | 'uniqueDiceConfig'> & { enableFormationDice?: boolean },
    // CR-SA-20-E4 / 2026-06-11: 確定済み隊列出目（store の formationResult.face）。省略時 null =
    // 既存呼び出し・テストは従来挙動。enableFormationDice OFF なら値が残っていても反映しない
    //（OFF 透過、scene1-setup.md L211 の既存 enableXxxx 群と同方針）。
    formationFace: number | null = null,
): number => {
    const effectiveFormationFace = houseRules.enableFormationDice ? formationFace : null;
    const baseScore = calculateScoreWithSpecialStrategy(
        p,
        strategies,
        paceFace,
        activePhaseIds,
        houseRules.effectValue,
        houseRules.enableSpecialStrategy,
        houseRules.uniqueDiceConfig,
        effectiveFormationFace,
    );
    // CR-SA-17-E4 / 2026-06-08: 最後の終盤フェーズ ID を非ペース列（activePhaseIds）の末尾から導出し、
    // 絆スキル最終加算へ伝播する（OFF / 終盤 1 = 'End'、終盤 ≥2 = 'End{n}'）。
    const lastEndPhaseId = activePhaseIds.length > 0 ? activePhaseIds[activePhaseIds.length - 1] : 'End';
    return baseScore + calculateBondSkillDelta(p, houseRules, lastEndPhaseId);
};
