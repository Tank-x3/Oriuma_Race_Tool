// Bundle-9 / 2026-05-10: ハウスルール設定セクション（modal-houserule.md §1 基本オプション）
// Scene 1 上部に配置し、4 チェックボックス + 特殊戦法 ON 時のみ効果値入力欄を表示する。
// Bundle-10-T2 / CR-SA-12 / 2026-05-11: 「🎴 脚質エディタを開く」ボタン追加（採用案 a 例外、modal-houserule.md §2）。
// Bundle-11-T1 / CR-SA-12 / 2026-05-11: 「💾 設定の保存・読込」ボタン追加（modal-houserule.md §3 ワイヤーフレーム）。
// CR-SA-15-E3 / 2026-05-15: 「🎲 固有スキル設定」ボタン追加（modal-houserule.md §4 ワイヤーフレーム）。
// CR-SA-16-E2 / 2026-05-15: ヘッダー右側に適用中プリセット名表示を追加（scene1-setup.md §0-2 状態 4 種）。
// CR-SA-16-E3 / 2026-05-15: ヘッダー左側を折りたたみトグルボタン化（scene1-setup.md §0-1、初期 = 折りたたみ）。
import React, { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Dices, Layers, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
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
    const { config, updateHouseRules, resetHouseRules, strategies, appliedPresetName, isPresetDirty } = useRaceStore();
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
    // CR-SA-16-E3 / 2026-05-15: ハウスルール設定セクションの折りたたみ state
    // scene1-setup.md §0-1「折りたたみ動作」SSoT、初期 = 折りたたみ（Progressive Disclosure 原則）
    // 永続化対象外（コンポーネントローカル state、リロードで初期状態 = 折りたたみに戻る）
    const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
    // CR-SA-16-Followup-reset-houserules / 2026-06-06: ハウスルール設定初期化の確認ダイアログ開閉状態
    // （modal-houserule.md §5、破壊的アクションのため確認ダイアログ必須）。
    const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);

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
                {/* CR-SA-16-E3 / 2026-05-15: ヘッダー左側を折りたたみトグルボタン化。
                    chevron + SlidersHorizontal + 見出しを一体のボタンとして配置（クリック領域広め）。
                    scene1-setup.md §0-1「ヘッダー左端に折りたたみトグル」SSoT、aria-expanded 必須。 */}
                <button
                    type="button"
                    onClick={() => setIsCollapsed((prev) => !prev)}
                    aria-expanded={!isCollapsed}
                    aria-controls="house-rules-body"
                    className="flex items-center gap-2 min-w-0 cursor-pointer rounded-md px-1 -mx-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                >
                    {isCollapsed ? (
                        <ChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400 shrink-0" />
                    )}
                    <SlidersHorizontal className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0" />
                    <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                        ハウスルール設定 (House Rules)
                    </h2>
                </button>
                <span
                    className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[50%]"
                    title={appliedPresetStatus.label}
                    data-testid="applied-preset-status"
                >
                    {appliedPresetStatus.label}
                </span>
            </div>

            {/* CR-SA-16-E3 / 2026-05-15: 折りたたみ中は基本オプション 5 ボックス + 効果値入力欄 +
                3 ボタン領域を DOM 除外（scene1-setup.md §0-1「折りたたみ中の表示制御」SSoT）。
                Modal 系は条件分岐外 = state false 維持で透過（既存パターン）。 */}
            {!isCollapsed && (
                <>
            <div className="space-y-3" id="house-rules-body">
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
                {/* CR-SA-16-Followup-reset-houserules / 2026-06-06: ハウスルール設定のみをデフォルトへ初期化する
                    4 つ目の導線（modal-houserule.md §5 / §1 ワイヤーフレーム L42-52）。破壊的アクションのため
                    確認ダイアログ必須 + 控えめな warning 系（amber）配色で他 3 ボタンと視覚的に区別する。 */}
                <button
                    type="button"
                    onClick={() => setResetConfirmOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={resetConfirmOpen}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors"
                >
                    <RotateCcw className="w-4 h-4" />
                    ♻️ 設定をデフォルトに戻す
                </button>
            </div>
                </>
            )}

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
            {/* CR-SA-16-Followup-reset-houserules / 2026-06-06: 初期化確認ダイアログ（採用案 b 局所配置）。
                折りたたみ body の外側に置き、承認時のみ resetHouseRules を実行する。 */}
            {resetConfirmOpen && (
                <HouseRulesResetConfirmDialog
                    onConfirm={() => {
                        resetHouseRules();
                        setResetConfirmOpen(false);
                    }}
                    onCancel={() => setResetConfirmOpen(false)}
                />
            )}
        </div>
    );
};

// ===== 確認ダイアログ（ハウスルール設定初期化） =====
// CR-SA-16-Followup-reset-houserules / 2026-06-06: 採用案 b（局所複製）。
// 既存の PresetManagerModal 内 ConfirmDialog / StrategyEditorModal と同じく「各 UI が自前の確認ダイアログを
// 保持する」既存慣例に揃える（PresetManagerModal を不変に保ち、その既存テストへの影響をゼロにする選択）。
// createPortal + role="alertdialog" + aria-modal で modal-houserule.md ℹ️ Confirmations の
// 「プリセット読込時の既存確認ダイアログと同パターン」要件（アプリ内モーダル・ダーク対応）を満たす。
// 文言「現在のハウスルール設定が失われます。デフォルトに戻しますか？」は modal-houserule.md ℹ️ Confirmations SSoT。
interface HouseRulesResetConfirmDialogProps {
    onConfirm: () => void;
    onCancel: () => void;
}

const HouseRulesResetConfirmDialog: React.FC<HouseRulesResetConfirmDialogProps> = ({
    onConfirm,
    onCancel,
}) => {
    // Escape キーでキャンセル（PresetManagerModal の確認ダイアログ Escape 挙動に揃える）。
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onCancel]);

    return createPortal(
        <div
            className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
            onClick={onCancel}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="house-rules-reset-confirm-title"
        >
            <div
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
                    <h4
                        id="house-rules-reset-confirm-title"
                        className="text-base font-display font-bold text-slate-900 dark:text-white"
                    >
                        設定の初期化
                    </h4>
                </div>

                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    現在のハウスルール設定が失われます。デフォルトに戻しますか？
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        autoFocus
                        className="px-4 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                    >
                        デフォルトに戻す
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};
