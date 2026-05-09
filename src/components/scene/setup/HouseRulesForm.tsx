// Bundle-9 / 2026-05-10: ハウスルール設定セクション（modal-houserule.md §1 基本オプション）
// Scene 1 上部に配置し、4 チェックボックス + 特殊戦法 ON 時のみ効果値入力欄を表示する。
import React, { Fragment, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useRaceStore } from '../../../store/useRaceStore';
import {
    getHouseRuleCheckboxes,
    validateEffectValue,
    EFFECT_VALUE_MIN,
    EFFECT_VALUE_MAX,
} from './houseRulesForm.helpers';

export const HouseRulesForm: React.FC = () => {
    const { config, updateHouseRules } = useRaceStore();
    const houseRules = config.houseRules;
    const checkboxes = getHouseRuleCheckboxes();

    const [effectValueInput, setEffectValueInput] = useState<string>(
        String(houseRules.effectValue)
    );
    const [effectValueIsValid, setEffectValueIsValid] = useState<boolean>(true);

    const handleCheckboxChange = (key: ReturnType<typeof getHouseRuleCheckboxes>[number]['key']) =>
        (e: React.ChangeEvent<HTMLInputElement>) => {
            updateHouseRules({ [key]: e.target.checked });
        };

    const handleEffectValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setEffectValueInput(raw);
        if (raw === '') {
            setEffectValueIsValid(false);
            return;
        }
        const parsed = parseInt(raw, 10);
        const result = validateEffectValue(parsed);
        setEffectValueIsValid(result.isValid);
        if (result.isValid && result.sanitized !== null) {
            updateHouseRules({ effectValue: result.sanitized });
        }
    };

    return (
        <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl p-6 shadow-xl space-y-6 transition-colors">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/50 pb-4">
                <SlidersHorizontal className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                    ハウスルール設定 (House Rules)
                </h2>
            </div>

            <div className="space-y-3">
                {checkboxes.map((cb) => {
                    const checkboxId = `house-rule-${cb.key}`;
                    return (
                        <Fragment key={cb.key}>
                            <label
                                htmlFor={checkboxId}
                                className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-200 select-none"
                            >
                                <input
                                    id={checkboxId}
                                    type="checkbox"
                                    checked={houseRules[cb.key]}
                                    onChange={handleCheckboxChange(cb.key)}
                                    className="w-4 h-4 accent-primary-500 rounded cursor-pointer"
                                />
                                <span>{cb.label}</span>
                            </label>

                            {cb.key === 'enableSpecialStrategy' && houseRules.enableSpecialStrategy && (
                                <div className="ml-6 pl-2 border-l-2 border-slate-200 dark:border-slate-700/50 space-y-2">
                                    <label
                                        htmlFor="house-rule-effect-value"
                                        className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                                    >
                                        効果値 (Effect Value)
                                        <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">
                                            ({EFFECT_VALUE_MIN}〜{EFFECT_VALUE_MAX}、デフォルト 15)
                                        </span>
                                    </label>
                                    <input
                                        id="house-rule-effect-value"
                                        type="number"
                                        min={EFFECT_VALUE_MIN}
                                        max={EFFECT_VALUE_MAX}
                                        step="1"
                                        value={effectValueInput}
                                        onChange={handleEffectValueChange}
                                        onWheel={(ev) => ev.currentTarget.blur()}
                                        className={`w-24 h-9 bg-slate-50 dark:bg-slate-900 border rounded-lg px-3 text-center font-mono focus:outline-none focus:border-primary-500 transition-colors ${
                                            effectValueIsValid
                                                ? 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                                                : 'border-red-500 text-red-500'
                                        }`}
                                    />
                                </div>
                            )}
                        </Fragment>
                    );
                })}
            </div>
        </div>
    );
};
