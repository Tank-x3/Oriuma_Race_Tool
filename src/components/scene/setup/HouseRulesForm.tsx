// Bundle-9 / 2026-05-10: ハウスルール設定セクション（modal-houserule.md §1 基本オプション）
// Scene 1 上部に配置し、4 チェックボックス + 特殊戦法 ON 時のみ効果値入力欄を表示する。
// Bundle-10-T2 / CR-SA-12 / 2026-05-11: 「🎴 脚質エディタを開く」ボタン追加（採用案 a 例外、modal-houserule.md §2）。
// Bundle-11-T1 / CR-SA-12 / 2026-05-11: 「💾 設定の保存・読込」ボタン追加（modal-houserule.md §3 ワイヤーフレーム）。
// CR-SA-15-E3 / 2026-05-15: 「🎲 固有スキル設定」ボタン追加（modal-houserule.md §4 ワイヤーフレーム）。
// CR-SA-16-E2 / 2026-05-15: ヘッダー右側に適用中プリセット名表示を追加（scene1-setup.md §0-2 状態 4 種）。
import React, { Fragment, useState } from 'react';
import { Dices, Layers, Save, SlidersHorizontal } from 'lucide-react';
import { useRaceStore } from '../../../store/useRaceStore';
import {
    getHouseRuleCheckboxes,
    validateEffectValue,
    EFFECT_VALUE_MIN,
    EFFECT_VALUE_MAX,
} from './houseRulesForm.helpers';
import { StrategyEditorModal } from './StrategyEditorModal';
import { PresetManagerModal } from './PresetManagerModal';
import { UniqueSkillEditorModal } from './UniqueSkillEditorModal';
// CR-SA-16-E2 / 2026-05-15: 適用中プリセット名表示の派生状態判定（scene1-setup.md §0-2 / §0-3）。
import { getAppliedPresetStatus } from './appliedPresetStatus.helpers';

export const HouseRulesForm: React.FC = () => {
    const { config, updateHouseRules, strategies, appliedPresetName, isPresetDirty } = useRaceStore();
    const houseRules = config.houseRules;
    const checkboxes = getHouseRuleCheckboxes();
    // CR-SA-16-E2 / 2026-05-15: 4 状態判定（scene1-setup.md §0-2）。
    // useRaceStore subscription により houseRules / strategies / appliedPresetName / isPresetDirty
    // のいずれかが変化すると本コンポーネントが再レンダリングされ、ヘッダー右側表示も自動追従する。
    const appliedPresetStatus = getAppliedPresetStatus(
        houseRules,
        strategies,
        appliedPresetName,
        isPresetDirty,
    );

    const [effectValueInput, setEffectValueInput] = useState<string>(
        String(houseRules.effectValue)
    );
    const [effectValueIsValid, setEffectValueIsValid] = useState<boolean>(true);
    // Bundle-10-T2 / CR-SA-12 / 2026-05-11: 脚質エディタモーダル開閉状態
    const [strategyEditorOpen, setStrategyEditorOpen] = useState<boolean>(false);
    // Bundle-11-T1 / CR-SA-12 / 2026-05-11: 設定プリセット管理モーダル開閉状態
    const [presetManagerOpen, setPresetManagerOpen] = useState<boolean>(false);
    // CR-SA-15-E3 / 2026-05-15: 固有スキル設定モーダル開閉状態
    const [uniqueSkillEditorOpen, setUniqueSkillEditorOpen] = useState<boolean>(false);

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
            {/* CR-SA-16-E2 / 2026-05-15: ヘッダー行を flex justify-between 化、
                左側 = アイコン + 見出し、右側 = 適用中プリセット名表示（scene1-setup.md §0-2）。
                強調なし（text-slate-600 / dark:text-slate-300）、長文プリセット名は truncate +
                title 属性でホバー時全文確認可、max-w-[50%] で表示幅制限。 */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/50 pb-4">
                <div className="flex items-center gap-2 min-w-0">
                    <SlidersHorizontal className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0" />
                    <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                        ハウスルール設定 (House Rules)
                    </h2>
                </div>
                <span
                    className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[50%]"
                    title={appliedPresetStatus.label}
                    data-testid="applied-preset-status"
                >
                    {appliedPresetStatus.label}
                </span>
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

            {/* Bundle-10-T2 / CR-SA-12 / 2026-05-11: 脚質エディタモーダルへのアクセス導線 */}
            {/* Bundle-11-T1 / CR-SA-12 / 2026-05-11: 設定プリセット管理モーダルへのアクセス導線を並列追加 */}
            {/* CR-SA-15-E3 / 2026-05-15: 固有スキル設定モーダルへのアクセス導線を脚質エディタと設定の保存・読込の間に追加 */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                <button
                    type="button"
                    onClick={() => setStrategyEditorOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={strategyEditorOpen}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-primary-200 dark:border-primary-800 rounded-lg transition-colors"
                >
                    <Layers className="w-4 h-4" />
                    🎴 脚質エディタを開く
                </button>
                <button
                    type="button"
                    onClick={() => setUniqueSkillEditorOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={uniqueSkillEditorOpen}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-primary-200 dark:border-primary-800 rounded-lg transition-colors"
                >
                    <Dices className="w-4 h-4" />
                    🎲 固有スキル設定
                </button>
                <button
                    type="button"
                    onClick={() => setPresetManagerOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={presetManagerOpen}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-primary-200 dark:border-primary-800 rounded-lg transition-colors"
                >
                    <Save className="w-4 h-4" />
                    💾 設定の保存・読込
                </button>
            </div>

            <StrategyEditorModal
                isOpen={strategyEditorOpen}
                onClose={() => setStrategyEditorOpen(false)}
            />
            {/* CR-SA-15-E3 / 2026-05-15: 固有スキル設定モーダル（isOpen props 制御、StrategyEditorModal と同パターン）*/}
            <UniqueSkillEditorModal
                isOpen={uniqueSkillEditorOpen}
                onClose={() => setUniqueSkillEditorOpen(false)}
            />
            {/* Bundle-11-T1 / CR-SA-12 / 2026-05-11: 条件描画で mount/unmount を制御する */}
            {/* （PresetManagerModal は内部で lazy initial pattern を使い useEffect 経由 setState を回避）*/}
            {presetManagerOpen && (
                <PresetManagerModal onClose={() => setPresetManagerOpen(false)} />
            )}
        </div>
    );
};
