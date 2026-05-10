// Bundle-9 / 2026-05-10: ハウスルール設定セクションの純粋関数群
// チェックボックスメタデータ（仕様書 modal-houserule.md §1 記載順）と
// 効果値（Effect Value）の妥当性検証を提供する。

import type { RaceState } from '../../../types';

type HouseRules = RaceState['config']['houseRules'];
type HouseRuleBooleanKey = Exclude<keyof HouseRules, 'effectValue'>;

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
    { key: 'enableExtendedUnique', label: '拡張固有タイプ(超ギャンブル/超安定)を使用', order: 4 },
    { key: 'enableBondSkill', label: '絆スキル(連続企画用 絆ギャンブル/絆安定)を使用', order: 5 },
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
