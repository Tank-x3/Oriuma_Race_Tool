// Bundle-9 / 2026-05-10: ハウスルール設定セクションの純粋関数群
// チェックボックスメタデータ（仕様書 modal-houserule.md §1 記載順）と
// 効果値（Effect Value）の妥当性検証を提供する。

import type { RaceState } from '../../../types';

type HouseRules = RaceState['config']['houseRules'];
// CR-SA-15-E1 / 2026-05-14: houseRules に非 boolean フィールド uniqueDiceConfig が追加されたため、
// チェックボックス用キー型から effectValue に加えて uniqueDiceConfig も除外する（型のみの追従、
// getHouseRuleCheckboxes の返却内容・実行時挙動は完全不変）。
// CR-SA-21+22-E1 / 2026-07-06: 非 boolean フィールド customUniqueSkills（カスタム固有スキル一覧）
// を追加除外（型のみの追従、実行時挙動は完全不変）。
type HouseRuleBooleanKey = Exclude<
    keyof HouseRules,
    'effectValue' | 'uniqueDiceConfig' | 'customUniqueSkills'
>;

export interface HouseRuleCheckboxMeta {
    key: HouseRuleBooleanKey;
    label: string;
    order: number;
}

// modal-houserule.md §1 基本オプションの記載順かつ文言（変更不可）
// Bundle-8-T2 / CR-SA-4 / 2026-05-10: 5 つ目「絆スキル」を追加（scene1-setup.md §2 ワイヤーフレーム L28 SSoT、
// houserule-features.md §2 [v] 絆スキル）。
// CR-SA-21+22-E2 / 2026-07-06: 「固有スキルなしの出走者を許可」を拡張固有直後（order 5）に追加。
// 並び順は modal-houserule.md §1 ワイヤーフレーム L33-41 SSoT（拡張固有 → 固有スキルなし → 絆 → 隊列 → フェーズ構成）。
// 既存 order 5〜7 を 6〜8 へ機械的に繰り下げる（8 チェックボックス化）。
// CR-SA-23-E1 / 2026-07-07: 「枠順を手動で配置(タッグレース用)」を末尾（order 9）に追加（9 チェックボックス化）。
// 並び順は modal-houserule.md §1 ワイヤーフレーム L39 SSoT + houserule-features.md §9.1 準拠。
// ラベル文字列「枠順を手動で配置(タッグレース用)」は固定（SA29 ユーザー確認済、半角丸括弧、末尾ピリオドなし）。
// E1 時点では ON/OFF 保存 + JSON I/O 反映のみ、Scene 2 実挙動は現行完全同一（未配線保証、E2 で配線予定）。
export const getHouseRuleCheckboxes = (): HouseRuleCheckboxMeta[] => [
    { key: 'enableModifier', label: '汎用補正(Modifier)ボタンを表示', order: 1 },
    { key: 'enableSpecialStrategy', label: '特殊戦法(ステータス変化: 捲り/溜め)を使用', order: 2 },
    { key: 'enableCompositeUnique', label: '複合固有スキル(発動位置複数選択)を許可', order: 3 },
    // CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ / 安定型Ⅱ 追加に伴い、ラベル括弧内に 4 タイプを明示（観察事項 A 解消、ユーザー承認済）。
    { key: 'enableExtendedUnique', label: '拡張固有タイプ(超ギャンブル/超安定/ギャンブル型Ⅱ/安定型Ⅱ)を使用', order: 4 },
    // CR-SA-22 / CR-SA-21+22-E2 / 2026-07-06: 「固有スキルなしの出走者を許可」トグル。
    // ON 時のみ Scene 1 の固有タイプ選択肢の先頭（`---` の直後）に「なし」が現れる
    // （modal-houserule.md §1 L38 + scene1-setup.md §2 L182 + houserule-features.md §2 [v] 固有スキルなし出走者 SSoT）。
    { key: 'enableNoUniqueSkill', label: '固有スキルなしの出走者を許可', order: 5 },
    { key: 'enableBondSkill', label: '絆スキル(連続企画用 絆ギャンブル/絆安定)を使用', order: 6 },
    // CR-SA-20-E3 / 2026-06-11: 隊列〔バ群〕ダイストグル（7 つ目）。並び順は modal-houserule.md §1 ワイヤーフレーム
    // L40 SSoT（絆スキル → 隊列 → フェーズ構成）。ON 時の隊列フェーズ挿入は E4 スコープで、
    // E3 時点ではペース位置候補の制限 + 隊列 ON × ペースなしの確定ブロックのみ有効化される
    // （modal-houserule.md §1 L149-153 / houserule-features.md §6.9）。
    { key: 'enableFormationDice', label: '隊列(バ群)ダイスを使用', order: 7 },
    // CR-SA-17-E3 / 2026-06-07: フェーズ構成変更トグル。ON 時のみレース設定に
    // 序盤・終盤回数 / ペース位置の設定 UI を開放する（scene1-setup.md §2 / modal-houserule.md §1 / houserule-features.md §7）。
    // ラベル文言は scene1-setup.md ワイヤーフレーム / modal-houserule.md §1 と完全一致。
    { key: 'enablePhaseConfig', label: 'フェーズ構成(序盤・終盤の回数/ペース位置)を変更する', order: 8 },
    // CR-SA-23-E1 / 2026-07-07: 枠順手動配置トグル（9 個目）。ラベル文字列は SA29 ユーザー確認済 SSoT で固定
    // （modal-houserule.md §1 ワイヤーフレーム L39 + scene1-setup.md §2 L237 + houserule-features.md §9.1）。
    // E1 時点では Scene 2 未配線 = ON にしても Scene 2 は現行完全同一挙動、E2 で [2a] 手動指定 UI + 進行統合を配線予定。
    { key: 'enableManualGate', label: '枠順を手動で配置(タッグレース用)', order: 9 },
];

export const EFFECT_VALUE_MIN = 1;
export const EFFECT_VALUE_MAX = 999;

export interface EffectValueValidationResult {
    isValid: boolean;
    sanitized: number | null;
}

// 効果値の妥当性検証。整数 + 範囲 [EFFECT_VALUE_MIN, EFFECT_VALUE_MAX] のみ通過。
// 無効値は sanitized=null を返し、呼び出し側で前回値維持の判断に使う。
export const validateEffectValue = (value: number): EffectValueValidationResult => {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
        return { isValid: false, sanitized: null };
    }
    if (value < EFFECT_VALUE_MIN || value > EFFECT_VALUE_MAX) {
        return { isValid: false, sanitized: null };
    }
    return { isValid: true, sanitized: value };
};
