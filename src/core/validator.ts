import { Dice } from './dice';
import { isPhaseConfigValid } from './paceAnchor';
import { getNonPacePhaseIds } from './phaseSequence';
import type { PacePosition, Umamusume } from '../types';

// Bundle-3 / D-4 / 2026-05-09: 持続型「連続 2 フェーズ」検証 SA 確定仕様
// （architecture/validation-responsibilities.md §4 SSoT 準拠）
// 既存 Validator クラス 3 関数は CR-6 別管理のため本タスクスコープ外、削除しない。

/**
 * `EntryForm.tsx` の `availablePhases` と完全整合するフェーズ ID 列挙生成。
 * validation-responsibilities.md §4 availablePhases 列挙表参照。
 *
 * CR-SA-17-E2 / 2026-06-07: 非ペース列生成を統一ヘルパー `getNonPacePhaseIds` に集約
 * （houserule-features.md §7.3 / §7.7、Bundle-3 dedup 解消）。序盤・終盤回数を
 * 受け取れるよう一般化。省略時 1（= OFF 時の固定値）で現行と完全同一の列を返す。
 *
 * - midPhaseCount === 0: [Start, End]
 * - midPhaseCount === 1: [Start, Mid, End]
 * - midPhaseCount >= 2: [Start, Mid1, ..., MidN, End]
 */
const getAvailablePhaseIds = (
    midPhaseCount: number,
    startPhaseCount = 1,
    endPhaseCount = 1,
): string[] => getNonPacePhaseIds(startPhaseCount, midPhaseCount, endPhaseCount);

/**
 * Bundle-3 / D-4: 持続型固有スキルの発動位置検証（Layer 2、validation-responsibilities.md §4）。
 *
 * 検証ロジック:
 * 1. phases.length === 0 はスキップ（Layer 1「発動位置が未選択です」で補足）
 * 2. phases.length !== 2 → エラー（選択数違反）
 * 3. availablePhases 列挙でのインデックス位置を取得し
 *    Math.abs(idx_a - idx_b) === 1 でない場合 → エラー（非連続）
 *
 * エラー文言は行番号 prefix なし版を返し、呼び出し元（EntryForm.tsx）で `[#行番号] ` を付与する。
 */
export const validatePersistentSkillPhases = (
    phases: string[],
    midPhaseCount: number,
    startPhaseCount = 1,
    endPhaseCount = 1,
): string[] => {
    // Layer 1 委譲: 空配列は「発動位置が未選択です」で補足されるため本検証スキップ
    if (phases.length === 0) return [];

    const errorMsg = '持続型の発動位置は連続する 2 フェーズを選択してください';

    // 選択数チェック
    if (phases.length !== 2) return [errorMsg];

    // 連続性チェック
    // CR-SA-17-E3 / 2026-06-07: 序盤・終盤回数連動に一般化（houserule-features.md §7.7）。
    // 省略時 1（= OFF 時の固定値）で従来挙動と完全一致。序盤 ≥2 / 終盤 ≥2 の連続性も正しく判定する。
    const availableIds = getAvailablePhaseIds(midPhaseCount, startPhaseCount, endPhaseCount);
    const idxA = availableIds.indexOf(phases[0]);
    const idxB = availableIds.indexOf(phases[1]);

    // 列挙にないフェーズが含まれる場合（自動修復前の中盤回数縮小直後等）も非連続扱い
    if (idxA === -1 || idxB === -1) return [errorMsg];
    if (Math.abs(idxA - idxB) !== 1) return [errorMsg];

    return [];
};

// Bundle-8-T2 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 絆スキル + 特殊戦法 Scene 1 事前申告バリデーション
// （scene1-setup.md §2 + houserule-features.md §2 [v] 絆スキル + §3 §捲り 前 cross-reference SSoT）。
// 既存 validatePersistentSkillPhases と同パターン（Layer 2 純粋関数、行番号 prefix なし、呼び出し側で付与）。

/**
 * 絆スキル種別の値域検証（houserule-features.md §2 [v] 絆スキル SSoT）。
 * 値域: `'BondGamble' | 'BondStable' | null`。`enableBondSkill === true` 時のみ呼び出される想定。
 *
 * @returns 妥当なら `[]`、エラーなら 1 件のエラーメッセージ配列。
 */
export const validateBondSkillType = (
    type: 'BondGamble' | 'BondStable' | null | undefined,
): string[] => {
    if (type === null || type === undefined) return [];
    if (type === 'BondGamble' || type === 'BondStable') return [];
    return ['絆スキル種別の値が不正です'];
};

/**
 * 特殊戦法発動位置の値域検証（houserule-features.md §3 §捲り 前 cross-reference SSoT、終盤除外）。
 * 値域 = 序盤ブロック + 中盤ブロック（終盤 `End` / `End1`〜 は除外）。
 * `enableSpecialStrategy === true` 時のみ呼び出される想定。
 *
 * CR-SA-17-E3 / 2026-06-07: 序盤・終盤回数連動に一般化（houserule-features.md §7.7）。
 * `startPhaseCount` / `endPhaseCount` 省略時は 1（= OFF 時の固定値）で従来挙動と完全一致。
 * 有効集合は `getNonPacePhaseIds` の非ペース列から終盤フェーズを除外して生成する。
 *
 * @returns 妥当なら `[]`、エラーなら 1 件のエラーメッセージ配列。
 */
export const validateSpecialStrategyPhase = (
    phaseId: string | null | undefined,
    midPhaseCount: number,
    startPhaseCount = 1,
    endPhaseCount = 1,
): string[] => {
    if (phaseId === null || phaseId === undefined) return [];

    const validPhaseIds = new Set<string>(
        getNonPacePhaseIds(startPhaseCount, midPhaseCount, endPhaseCount).filter(
            id => !id.startsWith('End'),
        ),
    );

    if (validPhaseIds.has(phaseId)) return [];
    return ['特殊戦法の発動位置が不正です（終盤・現在の中盤回数外は選択不可）'];
};

/**
 * 特殊戦法 種別 + 発動位置のセット必須性検証
 * （scene1-setup.md §2 + houserule-features.md §3 §捲り 前 cross-reference SSoT）。
 *
 * - 種別 `'Makuri' | 'Tame'` + 発動位置 phaseId（任意の値）→ ok
 * - 種別 `null` + 発動位置 `null` → ok
 * - 種別 `'Makuri' | 'Tame'` + 発動位置 `null` → エラー
 * - 種別 `null` + 発動位置 phaseId → エラー
 */
export const validateSpecialStrategyTypeAndPhase = (
    type: 'Makuri' | 'Tame' | null | undefined,
    phaseId: string | null | undefined,
): string[] => {
    const hasType = type === 'Makuri' || type === 'Tame';
    const hasPhase = phaseId !== null && phaseId !== undefined;

    if (hasType && !hasPhase) {
        return ['特殊戦法を選択した場合、発動位置の指定が必須です'];
    }
    if (!hasType && hasPhase) {
        return ['発動位置を選択した場合、特殊戦法種別の指定が必須です'];
    }
    return [];
};

// CR-SA-17-Followup-reset-houserules-phaseconfig-error / 2026-07-06: 禁止フェーズ構成の
// データブロック検証（scene1-setup.md §Error Handling L302-304 + houserule-features.md §7.8
// 「OFF 時の透過」+ modal-houserule.md §5 L289-290「初期化しない」SSoT）。
// EntryForm.tsx の configErrors から純粋関数化（CR-SA-17-E3 由来の呼び出し側 OFF ゲート漏れ修正）。

/**
 * 禁止フェーズ構成の検証（`enablePhaseConfig` OFF 透過付き）。
 *
 * `enablePhaseConfig = false` のときは常に空配列を返す。`config` 側に残る `pacePosition` /
 * `startPhaseCount` 等の残存値は SSoT `modal-houserule.md §5 L289-290`「初期化しない」+
 * `houserule-features.md §7.8`「OFF 時の透過」に従い、既定構成扱い（序盤 1 / 中盤 X / 終盤 1 /
 * ペース序盤直後）で動作するため、残存値をここで評価するとエラー誤検出になる。
 *
 * `enablePhaseConfig = true` のときは従来通り `isPhaseConfigValid` で禁止構成を検出する。
 * 隊列 ON 時の「ペースは隊列より前」ルール（§7.6）は `enableFormationDice && enablePhaseConfig`
 * を `isPhaseConfigValid` に伝えることで従来通り評価される。
 * エラー文言は `scene1-setup.md §Error Handling L302-304` SSoT で固定（変更不可）。
 *
 * @returns 妥当なら `[]`、エラーなら 1 件のエラーメッセージ配列。
 */
export const validatePhaseConfigStructure = (
    enablePhaseConfig: boolean,
    enableFormationDice: boolean,
    startPhaseCount: number,
    midPhaseCount: number,
    endPhaseCount: number,
    pacePosition: PacePosition,
): string[] => {
    if (!enablePhaseConfig) return [];
    if (
        isPhaseConfigValid(
            startPhaseCount,
            midPhaseCount,
            endPhaseCount,
            pacePosition,
            enableFormationDice && enablePhaseConfig,
        )
    ) {
        return [];
    }
    return [
        '・フェーズ構成が不正です（ペースの位置または序盤・終盤の回数が許可範囲外です）。設定を見直してください',
    ];
};

// CR-SA-20-E3 / 2026-06-11: 隊列〔バ群〕ダイス × ペースなし のエントリー確定ブロック
// （houserule-features.md §7.6 + scene1-setup.md Error Handling L297-301 SSoT）。
// 既存 Layer 2 純粋関数群と同パターン（エラー文言配列を返し、呼び出し側でブロック判定に使う）。

/**
 * 隊列 ON × ペースなし（ペース 0 回）の禁止構成検証。
 *
 * 隊列効果は超縦長 / 超団子でペース結果を参照する（§6.3）ため、`enableFormationDice = true`
 * かつ `pacePosition = null` の構成はクリティカルエラーとしてエントリー確定をブロックする。
 *
 * `enablePhaseConfig = false` のときはペースが序盤直後固定（pacePosition の内部値は実効しない）で
 * 矛盾が構造上発生しないため、両ハウスルールが ON のときのみ検証する（L297 条件 / OFF 透過）。
 * UI 操作だけでなく JSON プリセット取り込み・state 復元由来の混入も本関数で捕捉される
 * （エントリー確定時に毎回評価されるため）。エラー文言は L301 固定（変更不可）。
 *
 * @returns 妥当なら `[]`、エラーなら 1 件のエラーメッセージ配列。
 */
export const validateFormationPacePosition = (
    enableFormationDice: boolean,
    enablePhaseConfig: boolean,
    pacePosition: string | null,
): string[] => {
    if (!enableFormationDice || !enablePhaseConfig) return [];
    if (pacePosition !== null) return [];
    return ['・隊列(バ群)ダイスを使用する場合はペースが必要です。ペース位置を「なし」以外にするか、隊列ダイスをオフにしてください'];
};

// CR-SA-22 / CR-SA-21+22-E2 / 2026-07-06: 「固有スキルなしの出走者を許可」OFF ×「なし」選択者の
// データブロック（scene1-setup.md §Error Handling L312-315 + houserule-features.md §2 [v] Validation SSoT）。
// UI 経由の OFF 切替は store 副作用（updateHouseRules）で先に強制リセットされるため、本検証は
// state 復元・プリセット差し替え等の非 UI 経路で「なし」出走者が混入した場合の最終防衛線として働く。
// エラー文言は L315 SSoT で固定（変更不可）。

/**
 * `enableNoUniqueSkill = false` かつ `type === 'None'` の出走者が存在する場合にクリティカルエラー。
 *
 * `enableNoUniqueSkill = true` のとき、または participants がいない場合は空配列を返す。
 * 例示名は最初に見つかった当該出走者の `name`（scene1-setup.md L315 の「（例: ウマ娘A）」に合わせる）。
 */
export const validateNoUniqueSkillPresence = (
    enableNoUniqueSkill: boolean,
    participants: Umamusume[],
): string[] => {
    if (enableNoUniqueSkill) return [];
    const offender = participants.find((p) => p.uniqueSkill.type === 'None');
    if (!offender) return [];
    return [
        `・固有スキルなしが許可されていない設定で「なし」の出走者がいます（例: ${offender.name || '無名の出走者'}）。ハウスルールを見直すか、固有タイプを設定してください`,
    ];
};

// CR-SA-23-E1 / 2026-07-07: 枠順手動配置の Layer 2 検証
// （houserule-features.md §9.10 バリデーション + validation-responsibilities.md L29「Layer 2 純粋関数集約」SSoT）。
// 既存 Layer 2 純粋関数群（validatePhaseConfigStructure / validateNoUniqueSkillPresence / validateFormationPacePosition）
// と同構造（enableManualGate OFF ゲート内蔵、エラー配列返却）。
// UI プルダウン（Scene 2 [2a]、E2 スコープ）が既指定枠を構造的に除外するため通常発生しないが、
// **Import / state 復元由来の混入時**（JSON プリセット Import 経路や旧データ復元経路）に重複・範囲外を検出する
// 最終防衛線として働く。E1 時点で Scene 2 UI は未配線のため、実質「未来の Import 混入」への防御が中心。

/**
 * 手動指定枠 (`participants[*].manualGate`) の重複・範囲外を検出する（`enableManualGate` OFF 透過付き）。
 *
 * `enableManualGate = false` のときは常に空配列を返す（OFF 時に `manualGate` 値が残っていても
 * Scene 2 は現行同一挙動 = 抽選対象は全員のため、エラー扱いしない）。
 *
 * `enableManualGate = true` のときは以下を検出する（`houserule-features.md §9.10` SSoT）:
 * - **重複検出:** 複数の出走者が同じ枠番を指す場合、SA29 SSoT 文言で 1 メッセージ返却
 *   （複数枠が重複していても最初に発見した重複枠のみ報告 = 実運用では 1 件表示で修正誘導に十分）。
 * - **範囲外検出:** `manualGate` が `1..participants.length` の範囲外（< 1 または > N）の場合、
 *   TASK_INSTRUCTION §1.1 必須編集 E の推奨文言（Engineer 裁量、SA29 SSoT §9.10「必須項目の欠落」既存扱いに委譲）。
 *   最初に発見した範囲外エントリーのみ報告。
 *
 * `null` / `undefined` の `manualGate` は「未指定 = 抽選対象」を意味し、エラー対象外。
 *
 * @returns 妥当なら `[]`、エラーなら 1〜2 件のエラーメッセージ配列（重複と範囲外は独立に検出）。
 */
export const validateManualGateAssignments = (
    participants: readonly Umamusume[],
    enableManualGate: boolean,
): string[] => {
    if (!enableManualGate) return [];

    const errs: string[] = [];
    const N = participants.length;

    // 範囲外検出（1..N の外側 = < 1 または > N。null / undefined は対象外）
    const outOfRange = participants.find(
        (p) =>
            typeof p.manualGate === 'number' &&
            (p.manualGate < 1 || p.manualGate > N),
    );
    if (outOfRange && typeof outOfRange.manualGate === 'number') {
        errs.push(
            `・枠順の手動指定に範囲外の値があります: 「${outOfRange.name || '無名の出走者'}」に ${outOfRange.manualGate} 枠が指定されていますが、出走者数は ${N} 名です。「枠順抽選」画面で修正してください`,
        );
    }

    // 重複検出（同じ枠番が複数指定 = null / undefined と outOfRange は集計対象外）
    const gateCounts = new Map<number, number>();
    participants.forEach((p) => {
        if (typeof p.manualGate !== 'number') return;
        // 範囲外は既に別エラーで報告済のため二重報告を避ける（重複判定からも除外）
        if (p.manualGate < 1 || p.manualGate > N) return;
        gateCounts.set(p.manualGate, (gateCounts.get(p.manualGate) ?? 0) + 1);
    });
    const duplicatedGate = Array.from(gateCounts.entries()).find(([, c]) => c >= 2);
    if (duplicatedGate) {
        errs.push(
            `・枠順の手動指定に重複があります: ${duplicatedGate[0]} 枠が複数の出走者に指定されています。「枠順抽選」画面で修正してください`,
        );
    }

    return errs;
};

// Bundle-10-T3 / CR-SA-12 / 2026-05-11: 脚質エディタ Validation 統合
// (modal-houserule.md §Critical Errors + houserule-features.md §1 Validation SSoT)
// 既存 Layer 2 純粋関数群 (validatePersistentSkillPhases / validateBondSkillType /
// validateSpecialStrategyPhase / validateSpecialStrategyTypeAndPhase) と同パターン。

/**
 * 脚質名の重複・空欄検証 (modal-houserule.md §Critical Errors SSoT)。
 *
 * - 空文字 / 空白のみ trim 後空 → エラー（脚質名未入力）
 * - 編集モード時 `editingName === name`（名前未変更）→ 重複扱いしない
 * - `existingNames` 内に同名がある場合 → エラー（脚質名重複）
 *
 * @param name 入力された脚質名（trim 前）
 * @param existingNames 既存脚質名の配列（state.strategies から抽出した name の集合）
 * @param editingName 編集モード時の元の脚質名（新規追加時は undefined）
 * @returns 妥当なら `[]`、エラーなら 1 件のエラーメッセージ配列。
 */
export const validateStrategyName = (
    name: string,
    existingNames: string[],
    editingName?: string,
): string[] => {
    const trimmed = name.trim();
    if (trimmed === '') {
        return ['脚質名を入力してください。'];
    }
    if (editingName !== undefined && editingName === name) {
        return [];
    }
    if (existingNames.includes(name)) {
        return [`脚質名 '${name}' は既に使用されています。別の名前を指定してください。`];
    }
    return [];
};

/**
 * ダイス式 `XdY` 形式の検証 (modal-houserule.md §Critical Errors SSoT)。
 *
 * 仕様 houserule-features.md §1 Validation は「`XdY` 形式以外を拒否」と規定。
 * ただし既存 DEFAULT_STRATEGIES「大逃げ」`dice.end: '-1d27'` 等の負号付き値と
 * 整合性を取るため `-?\d+d\d+` の正規表現で負号付きも許容する
 * （Engineer 裁量範囲、SA20 §5.3 推奨形 (b)）。
 *
 * @returns 妥当なら `[]`、エラーなら 1 件のエラーメッセージ配列。
 */
export const validateDiceFormat = (diceStr: string): string[] => {
    if (/^-?\d+d\d+$/.test(diceStr.trim())) {
        return [];
    }
    return [`ダイス式は '3d6' の形式で入力してください`];
};

export class Validator {
    /**
     * Validates if the line count matches the expected number of participants.
     */
    static validateLineCount(text: string, expectedCount: number): { valid: boolean; actual: number } {
        // Filter empty lines? Usually standard paste might have empty lines.
        // We assume valid dice lines.
        // This is simple line counting, more complex logic might be in Parser.
        const lines = text.split('\n').filter(line => line.trim() !== '');
        return {
            valid: lines.length === expectedCount,
            actual: lines.length
        };
    }

    /**
     * Validates a dice equation string from a post.
     * Expected format: "diceXdY=Total" or similar, but often users paste:
     * "name 10+dice3d6=25 (25)"
     * This validator checks if the equality holds.
     * 
     * @param equationPart The part containing the numbers e.g. "10+15=25" or parsed values.
     */
    static validateChecksum(calculated: number, statedTotal: number): boolean {
        return calculated === statedTotal;
    }

    /**
     * Checks if dice format is valid (e.g. 3d6, not 3d0 or 0d6)
     */
    static validateDiceFormat(diceStr: string): boolean {
        try {
            const config = Dice.parse(diceStr);
            return config.count > 0 && config.face > 0;
        } catch {
            return false;
        }
    }
}
