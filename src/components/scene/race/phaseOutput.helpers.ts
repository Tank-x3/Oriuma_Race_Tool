import type { RaceState, Strategy, Umamusume, UniqueSkillType, UniqueDiceConfig } from '../../../types';
import { isPhaseResultLoaded } from './specialStrategy.helpers';
// CR-SA-15-E2 / 2026-05-15: 固有ダイス 3 関数のフォールバック値（houserule-features.md §5.4）。
import { DEFAULT_UNIQUE_DICE_CONFIG } from '../../../core/strategies';

// Bundle-2 / D-1, D-14 / 2026-05-09: PhaseOutput 内で使用する固有スキル関連の純粋関数を分離。
// 純粋関数化により単体テストを容易にする（既存挙動は維持、houserule-features.md §2 [v] 拡張固有タイプ反映）。
// Bundle-4-Followup-special-strategy-timing-E1 / 2026-05-12 (SA21 案 A 採択):
// ダイス式 [基礎値] 算出 `getDiceFormulaBaseValue` を本ファイルに追加。
// 効果値反映前のスコア（当該 phase が発動 phase かつ結果取り込み済の場合のみ差し引く）を返す。

type HouseRulesForBaseValue = Pick<
    RaceState['config']['houseRules'],
    'effectValue' | 'enableSpecialStrategy'
>;

/**
 * Bundle-4-Followup-special-strategy-timing-E1 / 2026-05-12 (SA21 案 A 採択):
 * 当該フェーズの「投稿用ダイス出力」に表示するダイス式 [基礎値] を算出する純粋関数。
 *
 * 仕様根拠: scene3-race.md §2 特殊戦法併記 + houserule-features.md §3 Application Timing
 *
 * 算出ルール:
 *  - Start phase: `strategy.fixValue`（既存挙動と同等）
 *  - その他 phase で「当該 phase が発動 phase かつ結果取り込み済」の場合のみ
 *    `p.score - effectValue` (Makuri) / `p.score + effectValue` (Tame) を返す
 *    （score に既に反映されている当該 phase の specialStrategy 効果値を取り除く）
 *  - それ以外（事前操作 + 取り込み前 / 別 phase 発動 / End フェーズで反動先取り回避）
 *    = `p.score` をそのまま返す
 *
 * 重要: 終盤反動 / 解放は「End ダイス取り込み実行時」に score へ反映する設計（SA21 案 A）。
 * 本ヘルパーで「中盤発動済 + 終盤未取り込み」状態の End [基礎値] を `score - +N` のように
 * 算出すると終盤反動を先取り表示してしまうため、End フェーズで `history.End.specialStrategy` が
 * 未設定なら差し引きしない設計とする（仕様根拠: houserule-features.md §3 Resolve 2026-05-11 改訂分）。
 *
 * `strategies` 引数は Start phase の fixValue 参照用。
 */
export const getDiceFormulaBaseValue = (
    p: Umamusume,
    currentPhaseId: string,
    houseRules: HouseRulesForBaseValue,
    strategies: Strategy[]
): number => {
    // CR-SA-17-E4 / 2026-06-08（Review Gate 修正）: 序盤フェーズ（Start / Start1 / Start2 …）の
    // ダイス式 [基礎値] は脚質基礎値（fixValue）。calculator が序盤フェーズごとに fixValue を加算する
    //（序盤回数分）ため、各序盤の投稿用ダイスも fixValue 基準で出力し挙動と一貫させる。
    // 中盤・終盤は従来どおり累積スコア基準。
    if (currentPhaseId.startsWith('Start')) {
        const strategy = strategies.find((s) => s.name === p.strategy);
        return strategy?.fixValue ?? 0;
    }
    if (!houseRules.enableSpecialStrategy) return p.score;

    const entry = p.history[currentPhaseId];
    if (!entry) return p.score;

    const sp = entry.specialStrategy;
    if (sp !== 'Makuri' && sp !== 'Tame') return p.score;
    if (!isPhaseResultLoaded(p, currentPhaseId)) return p.score;

    // 当該 phase が「発動 phase かつ結果取り込み済」のとき
    // score に既に効果値が反映されているため、ダイス式 [基礎値] では差し引いて返す
    return sp === 'Makuri'
        ? p.score - houseRules.effectValue
        : p.score + houseRules.effectValue;
};

/**
 * CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11:
 * 当該フェーズが「序盤2回目以降（`Start2`〜`Start4`）」かを判定する。
 *
 * フェーズ構成変更（`houserule-features.md §7`）ON で序盤を 2 回以上にしたときのみ
 * 出現する。先頭序盤（`Start` / `Start1`）は false（従来どおり脚質固定値 Z 単独出力）。
 * 非序盤フェーズ（`Mid`〜 / `End`〜 / `Pace`）も false。
 *
 * 序盤2回目以降の投稿用ダイスは `[中間値 N]+[脚質固定値 Z]+dice` 形式（数値2つ）で出力し、
 * 貼り戻し解析時の許容プレフィックス数（`phaseInput.preprocessors.ts`）の基準にもなる。
 */
export const isSecondaryStartPhase = (phaseId: string): boolean => {
    if (!phaseId.startsWith('Start')) return false;
    const suffix = phaseId.slice('Start'.length); // '' | '1' | '2' | …
    const n = parseInt(suffix, 10);
    return !Number.isNaN(n) && n >= 2;
};

/**
 * CR-SA-17-Followup-multistart-NZ-output（ESC-1）/ 2026-06-11:
 * 投稿用ダイス式の「`dice` より前のプレフィックス文字列」を生成する純粋関数。
 *
 * 仕様根拠: `scene3-race.md §2`「値の構成ルール」
 *  - 序盤2回目以降（`Start2`〜）: `[中間値 N]+[脚質固定値 Z]`（数値2つ、畳まない）。
 *      - `N`（中間値）= 当該序盤フェーズ進入時点の累積スコア（= `p.score`、当該フェーズの
 *        ダイス未取り込み時点の値）。
 *      - `Z`（脚質固定値）= `strategy.fixValue`（先頭序盤の Z と同値）。
 *      - **Z=0（追込等）も `N+0` の2プレフィックスを維持**する（フェーズ別プレフィックス数の
 *        一貫性 = 序盤2以降は常に2個。preprocessor の「2個まで」許容・parser の末尾Z格納と整合）。
 *  - 上記以外（先頭序盤 / 中盤 / 終盤）: 従来どおり単一の基礎値（`getDiceFormulaBaseValue`）。
 *
 * **スコア無影響:** `N` / `Z` の並びはスコア計算に使われない（`calculator` は `baseDice.sum` +
 * `strategy.fixValue` で算出。`ParsedLine.fixValue` は `DiceResult` に伝播しない）。N+Z 形式は
 * 表示・貼り戻し体裁のための表記であり、二重加算は発生しない。
 *
 * 戻り値は `dice` の直前に置く文字列（演算子 `+` / `-` は呼び出し側で付与）。
 */
export const getDiceFormulaPrefix = (
    p: Umamusume,
    currentPhaseId: string,
    houseRules: HouseRulesForBaseValue,
    strategies: Strategy[]
): string => {
    if (isSecondaryStartPhase(currentPhaseId)) {
        const strategy = strategies.find((s) => s.name === p.strategy);
        const z = strategy?.fixValue ?? 0;
        // N = 当該序盤進入時点の累積スコア（ダイス未取り込みの p.score）
        return `${p.score}+${z}`;
    }
    return String(getDiceFormulaBaseValue(p, currentPhaseId, houseRules, strategies));
};

/**
 * 固有スキルタイプから「投稿用ダイス出力」用のダイス文字列を返す。
 * 該当タイプがなければ空文字を返す。
 *
 * CR-SA-15-E2 / 2026-05-15: 固有スキル設定参照化（houserule-features.md §5.3
 * 投稿用ダイス出力フォーマット生成ルール）。従来のハードコード文字列を
 * `uniqueDiceConfig` 参照へ切り替え。`uniqueDiceConfig` 省略時は
 * `DEFAULT_UNIQUE_DICE_CONFIG` フォールバック（= 従来のハードコード値と
 * 完全一致、既存挙動完全維持）。
 *
 * 符号別生成ルール（houserule-features.md §5.3）:
 *  - `fixValue > 0` → `${fixValue}+dice${diceStr}=`（例: 安定型 `5+dice1d10=`）
 *  - `fixValue < 0` → `${fixValue}+dice${diceStr}=`（負号は数値に含む、例: 超ギャンブル `-10+dice1d35=`）
 *  - `fixValue === 0` → `dice${diceStr}=`（例: ギャンブル型 `dice1d20=`）
 */
export const getUniqueDiceFormula = (
    type: UniqueSkillType,
    uniqueDiceConfig: UniqueDiceConfig = DEFAULT_UNIQUE_DICE_CONFIG,
): string => {
    const entry = uniqueDiceConfig[type];
    if (!entry) return '';
    const { fixValue, diceStr } = entry;
    if (fixValue === 0) return `dice${diceStr}=`;
    return `${fixValue}+dice${diceStr}=`;
};

/**
 * 固有スキルタイプから期待ダイス式（`getCorrectionStatus` 比較用）を返す。
 * 該当タイプがなければ空文字を返す。
 *
 * CR-SA-15-E2 / 2026-05-15: 固有スキル設定参照化（houserule-features.md §5.4）。
 * 従来のハードコード `'1d10'` 等を `uniqueDiceConfig[type].diceStr` 参照へ切り替え。
 * `uniqueDiceConfig` 省略時は `DEFAULT_UNIQUE_DICE_CONFIG` フォールバック。
 */
export const getExpectedUniqueDiceStr = (
    type: UniqueSkillType,
    uniqueDiceConfig: UniqueDiceConfig = DEFAULT_UNIQUE_DICE_CONFIG,
): string => {
    const entry = uniqueDiceConfig[type];
    if (!entry) return '';
    return entry.diceStr;
};

// CR-SA-13-E1 / 2026-05-12: 固有スキルタイプから期待 fix 値を返す純粋関数。
// `getExpectedUniqueDiceStr` と対称。ParsedLine.fixValue との完全一致判定（規則 R-3）に使用。
// CR-SA-15-E2 / 2026-05-15: 固有スキル設定参照化（houserule-features.md §5.4）。
// 従来のハードコード `5` 等を `uniqueDiceConfig[type].fixValue` 参照へ切り替え。
// `uniqueDiceConfig` 省略時は `DEFAULT_UNIQUE_DICE_CONFIG` フォールバック
// （= 従来のハードコード値と完全一致、既存挙動完全維持）。
export const getExpectedUniqueFixValue = (
    type: UniqueSkillType,
    uniqueDiceConfig: UniqueDiceConfig = DEFAULT_UNIQUE_DICE_CONFIG,
): number => {
    const entry = uniqueDiceConfig[type];
    if (!entry) return 0;
    return entry.fixValue;
};
