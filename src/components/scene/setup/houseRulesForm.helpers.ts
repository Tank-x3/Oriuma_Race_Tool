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
export const getHouseRuleCheckboxes = (): HouseRuleCheckboxMeta[] => [
    { key: 'enableModifier', label: '汎用補正(Modifier)ボタンを表示', order: 1 },
    { key: 'enableSpecialStrategy', label: '特殊戦法(ステータス変化: 捲り/溜め)を使用', order: 2 },
    { key: 'enableCompositeUnique', label: '複合固有スキル(発動位置複数選択)を許可', order: 3 },
    // CR-SA-19 / 2026-06-06: ギャンブル型Ⅱ / 安定型Ⅱ 追加に伴い、ラベル括弧内に 4 タイプを明示（観察事項 A 解消、ユーザー承認済）。
    { key: 'enableExtendedUnique', label: '拡張固有タイプ(超ギャンブル/超安定/ギャンブル型Ⅱ/安定型Ⅱ)を使用', order: 4 },
    { key: 'enableBondSkill', label: '絆スキル(連続企画用 絆ギャンブル/絆安定)を使用', order: 5 },
    // CR-SA-20-E3 / 2026-06-11: 隊列〔バ群〕ダイストグル（6 つ目）。並び順は scene1-setup.md
    // ワイヤーフレーム L36（フェーズ構成変更の前）SSoT。ON 時の隊列フェーズ挿入は E4 スコープで、
    // E3 時点ではペース位置候補の制限 + 隊列 ON × ペースなしの確定ブロックのみ有効化される
    // （modal-houserule.md §1 L149-153 / houserule-features.md §6.9）。
    { key: 'enableFormationDice', label: '隊列(バ群)ダイスを使用', order: 6 },
    // CR-SA-17-E3 / 2026-06-07: フェーズ構成変更トグル。ON 時のみレース設定に
    // 序盤・終盤回数 / ペース位置の設定 UI を開放する（scene1-setup.md §2 / modal-houserule.md §1 / houserule-features.md §7）。
    // ラベル文言は scene1-setup.md ワイヤーフレーム / modal-houserule.md §1 と完全一致。
    { key: 'enablePhaseConfig', label: 'フェーズ構成(序盤・終盤の回数/ペース位置)を変更する', order: 7 },
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
