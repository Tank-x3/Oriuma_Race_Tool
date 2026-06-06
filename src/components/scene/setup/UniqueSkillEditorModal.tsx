// CR-SA-15-E3 / 2026-05-15: 固有スキル設定モーダル（modal-houserule.md §4）
// メインモーダル（固有スキル 5 タイプ一覧テーブル）+ 編集サブモーダル（固定値・ダイス式入力）
// の 2 段階構成。脚質エディタ StrategyEditorModal.tsx の構造（createPortal 描画 /
// Escape キー処理 / ダークモード className）を手本とする。
// 固有スキル設定は脚質エディタより単純（5 タイプ固定 = 追加・削除・並び替えなし /
// ペース補正マトリクスなし）のため、手本の複雑な部分は持ち込まない。
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dices, Pencil, X } from 'lucide-react';
import { useRaceStore } from '../../../store/useRaceStore';
// CR-SA-15-E3 / 2026-05-15: ダイス式バリデーションは脚質エディタと共用（validateDiceFormat 再利用）。
import { validateDiceFormat } from '../../../core/validator';
// CR-SA-15-E3 / 2026-05-15: 出力プレビューは E2 成果物 getUniqueDiceFormula を再利用（§5.3 再実装禁止）。
import { getUniqueDiceFormula } from '../race/phaseOutput.helpers';
import type { UniqueSkillType } from '../../../types';
import {
    UNIQUE_SKILL_TYPE_LABELS,
    getVisibleUniqueSkillTypes,
    createEditFormState,
    createDefaultResetFormState,
    formStateToEntry,
    validateUniqueDiceFixValue,
    buildUpdatedUniqueDiceConfig,
    getUniqueDicePreview,
    type UniqueDiceFormState,
} from './uniqueSkillEditor.helpers';

interface UniqueSkillEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UniqueSkillEditorModal: React.FC<UniqueSkillEditorModalProps> = ({
    isOpen,
    onClose,
}) => {
    const { config, updateHouseRules } = useRaceStore();
    // Round 2 修正 (2026-05-15 ユーザーフィードバック): 持続型は enableCompositeUnique 連動。
    // entryForm.helpers.ts getUniqueSkillTypeOptions の挙動と整合させる。
    const { uniqueDiceConfig, enableExtendedUnique, enableCompositeUnique } = config.houseRules;
    const [editingType, setEditingType] = useState<UniqueSkillType | null>(null);

    // Escape キーで最前面のレイヤーを閉じる（編集サブモーダル > メインモーダル の優先順）。
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (editingType) {
                setEditingType(null);
            } else {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, editingType, onClose]);

    if (!isOpen) return null;

    const visibleTypes = getVisibleUniqueSkillTypes(enableExtendedUnique, enableCompositeUnique);

    const handleSubmitForm = (type: UniqueSkillType, form: UniqueDiceFormState) => {
        const entry = formStateToEntry(form);
        // buildUpdatedUniqueDiceConfig は必ず新しいオブジェクトを返す。
        // updateHouseRules は uniqueDiceConfig の変更を参照比較で検知するため
        // （CR-SA-15-E1 で確立）、新オブジェクトを渡すことで E2 で配線済の
        // score 再計算トリガーが正しく発火する。
        const next = buildUpdatedUniqueDiceConfig(uniqueDiceConfig, type, entry);
        updateHouseRules({ uniqueDiceConfig: next });
        setEditingType(null);
    };

    // CR-SA-15-E3 / 2026-05-15: HouseRulesForm の `backdrop-blur-sm` (backdrop-filter) は
    // 子の `position: fixed` の containing block を HouseRulesForm に制限するため、createPortal で
    // document.body 直下に描画して回避する（StrategyEditorModal.tsx と同経緯）。
    return createPortal(
        <div
            className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="unique-skill-editor-modal-title"
        >
            <div
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <div className="flex items-center gap-2">
                        <Dices className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        <h3
                            id="unique-skill-editor-modal-title"
                            className="text-lg font-display font-bold text-slate-900 dark:text-white"
                        >
                            🎲 固有スキル設定 (Unique Skill Dice Editor)
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="閉じる"
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Unique Skill Dice Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                <th className="text-left py-2 px-2">固有タイプ</th>
                                <th className="text-left py-2 px-2">固定値</th>
                                <th className="text-left py-2 px-2">ダイス式</th>
                                <th className="text-left py-2 px-2">出力プレビュー</th>
                                <th className="text-right py-2 px-2">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleTypes.map((type) => {
                                const entry = uniqueDiceConfig[type];
                                return (
                                    <tr
                                        key={type}
                                        className="border-b border-slate-100 dark:border-slate-700/60 text-slate-900 dark:text-white"
                                    >
                                        <td className="py-2 px-2 font-medium">
                                            {UNIQUE_SKILL_TYPE_LABELS[type]}
                                        </td>
                                        <td className="py-2 px-2 font-mono">{entry.fixValue}</td>
                                        <td className="py-2 px-2 font-mono">{entry.diceStr}</td>
                                        <td className="py-2 px-2 font-mono">
                                            {getUniqueDiceFormula(type, uniqueDiceConfig)}
                                        </td>
                                        <td className="py-2 px-2">
                                            <div className="flex items-center justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingType(type)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                                                    aria-label={`${UNIQUE_SKILL_TYPE_LABELS[type]} を編集`}
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                    編集
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* 表示条件の注記（modal-houserule.md §4 ワイヤーフレーム L99 + Round 2 修正で持続型条件を追加） */}
                {(!enableExtendedUnique || !enableCompositeUnique) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {!enableCompositeUnique && (
                            <>※ 持続型の行は「複合固有スキル(発動位置複数選択)を許可」ON 時のみ表示されます。<br /></>
                        )}
                        {!enableExtendedUnique && (
                            <>※ 超ギャンブル / 超安定 / ギャンブル型Ⅱ / 安定型Ⅱ の行は「拡張固有タイプを使用」ON 時のみ表示されます。</>
                        )}
                    </p>
                )}

                {/* Footer */}
                <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>

            {/* 編集サブモーダル */}
            {editingType && (
                <UniqueDiceEditSubModal
                    type={editingType}
                    initialForm={createEditFormState(uniqueDiceConfig[editingType])}
                    onSubmit={(form) => handleSubmitForm(editingType, form)}
                    onCancel={() => setEditingType(null)}
                />
            )}
        </div>,
        document.body,
    );
};

// ===== Sub-Modal: 編集フォーム =====

interface UniqueDiceEditSubModalProps {
    type: UniqueSkillType;
    initialForm: UniqueDiceFormState;
    onSubmit: (form: UniqueDiceFormState) => void;
    onCancel: () => void;
}

const UniqueDiceEditSubModal: React.FC<UniqueDiceEditSubModalProps> = ({
    type,
    initialForm,
    onSubmit,
    onCancel,
}) => {
    const [form, setForm] = useState<UniqueDiceFormState>(initialForm);

    // CR-SA-15-E3 / 2026-05-15: validation onChange リアルタイム（StrategyEditSubModal 同パターン）。
    const fixValueErrors = validateUniqueDiceFixValue(form.fixValue);
    const diceStrErrors = validateDiceFormat(form.diceStr);
    const hasErrors = fixValueErrors.length + diceStrErrors.length > 0;

    // 出力プレビュー: 入力値が妥当なときのみ生成する。
    // 不正値（空欄 / 小数 / 不正ダイス式）のときは formStateToEntry の 0 フォールバックや
    // 不正ダイス文字列がそのままプレビューに混入し誤解を招くため、プレースホルダ表示にする。
    const preview = hasErrors ? '—' : getUniqueDicePreview(type, formStateToEntry(form));

    const handleResetToDefault = () => {
        setForm(createDefaultResetFormState(type));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (hasErrors) return;
        onSubmit(form);
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="unique-dice-edit-submodal-title"
        >
            <form
                onSubmit={handleSubmit}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <h4
                        id="unique-dice-edit-submodal-title"
                        className="text-base font-display font-bold text-slate-900 dark:text-white"
                    >
                        ✎ {UNIQUE_SKILL_TYPE_LABELS[type]} の編集
                    </h4>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label="閉じる"
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 固定値 */}
                <div className="space-y-1">
                    <label
                        htmlFor="unique-dice-form-fixvalue"
                        className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                        固定値 <span className="text-slate-400 dark:text-slate-500">(整数、負の値も可)</span>
                    </label>
                    <input
                        id="unique-dice-form-fixvalue"
                        type="number"
                        step="1"
                        value={form.fixValue}
                        onChange={(e) => setForm({ ...form, fixValue: e.target.value })}
                        onWheel={(ev) => ev.currentTarget.blur()}
                        autoFocus
                        className="w-32 h-10 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-primary-500 transition-colors"
                    />
                    {fixValueErrors.length > 0 && (
                        <p className="text-xs text-red-500 dark:text-red-400" role="alert">
                            {fixValueErrors[0]}
                        </p>
                    )}
                </div>

                {/* ダイス式 */}
                <div className="space-y-1">
                    <label
                        htmlFor="unique-dice-form-dicestr"
                        className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                        ダイス式 <span className="text-slate-400 dark:text-slate-500">(XdY 形式)</span>
                    </label>
                    <input
                        id="unique-dice-form-dicestr"
                        type="text"
                        placeholder="例: 1d10 / 1d11"
                        value={form.diceStr}
                        onChange={(e) => setForm({ ...form, diceStr: e.target.value })}
                        className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-primary-500 transition-colors"
                    />
                    {diceStrErrors.length > 0 && (
                        <p className="text-xs text-red-500 dark:text-red-400" role="alert">
                            {diceStrErrors[0]}
                        </p>
                    )}
                </div>

                {/* 出力プレビュー */}
                <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        出力プレビュー
                    </p>
                    <p className="font-mono text-sm text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                        {preview}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={handleResetToDefault}
                        className="px-3 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                    >
                        デフォルトに戻す
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={hasErrors}
                            className="px-4 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-slate-300 dark:disabled:hover:bg-slate-600"
                        >
                            保存
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};
