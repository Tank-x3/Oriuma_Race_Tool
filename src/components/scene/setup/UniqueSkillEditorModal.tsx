// CR-SA-15-E3 / 2026-05-15: 固有スキル設定モーダル（modal-houserule.md §4）
// メインモーダル（固有スキル 5 タイプ一覧テーブル）+ 編集サブモーダル（固定値・ダイス式入力）
// の 2 段階構成。脚質エディタ StrategyEditorModal.tsx の構造（createPortal 描画 /
// Escape キー処理 / ダークモード className）を手本とする。
// 固有スキル設定は脚質エディタより単純（5 タイプ固定 = 追加・削除・並び替えなし /
// ペース補正マトリクスなし）のため、手本の複雑な部分は持ち込まない。
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dices, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useRaceStore } from '../../../store/useRaceStore';
// CR-SA-15-E3 / 2026-05-15: ダイス式バリデーションは脚質エディタと共用（validateDiceFormat 再利用）。
import { validateDiceFormat } from '../../../core/validator';
// CR-SA-15-E3 / 2026-05-15: 出力プレビューは E2 成果物 getUniqueDiceFormula を再利用（§5.3 再実装禁止）。
import { getUniqueDiceFormula } from '../race/phaseOutput.helpers';
// CR-SA-21+22-E1 / 2026-07-06: 本モーダルは組み込み 7 タイプ + カスタム対応（'None' は §5 対象外）。
import type { BuiltInUniqueSkillType, CustomUniqueSkill } from '../../../types';
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
    // CR-SA-21+22-E2 / 2026-07-06: カスタム固有スキル helpers
    createNewCustomFormState,
    createEditCustomFormState,
    formStateToCustomSkill,
    validateCustomUniqueSkillName,
    getCustomUniqueDicePreview,
    getCustomInitialDeleteStep,
    progressCustomDeleteStep,
    getCustomDeleteConfirmMessage,
    type CustomUniqueFormState,
    type CustomDeleteConfirmStep,
} from './uniqueSkillEditor.helpers';

interface UniqueSkillEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// CR-SA-21+22-E2 / 2026-07-06: カスタム編集サブモーダル用の state 表現。
// mode='new' = 新規追加 / mode='edit' = 既存編集（skill を持つ）。
type CustomEditingState =
    | { mode: 'new' }
    | { mode: 'edit'; skill: CustomUniqueSkill };

// CR-SA-21+22-E2 / 2026-07-06: カスタム削除確認ダイアログの state。
interface CustomDeletingState {
    skill: CustomUniqueSkill;
    step: CustomDeleteConfirmStep;
}

export const UniqueSkillEditorModal: React.FC<UniqueSkillEditorModalProps> = ({
    isOpen,
    onClose,
}) => {
    // CR-SA-21+22-E2 / 2026-07-06: カスタム系操作で participants / addCustomUniqueSkill 等を購読。
    const {
        config,
        updateHouseRules,
        participants,
        addCustomUniqueSkill,
        updateCustomUniqueSkill,
        removeCustomUniqueSkill,
    } = useRaceStore();
    // Round 2 修正 (2026-05-15 ユーザーフィードバック): 持続型は enableCompositeUnique 連動。
    // entryForm.helpers.ts getBuiltInUniqueSkillTypeOptions の挙動と整合させる。
    const { uniqueDiceConfig, enableExtendedUnique, enableCompositeUnique, customUniqueSkills } = config.houseRules;
    const [editingType, setEditingType] = useState<BuiltInUniqueSkillType | null>(null);
    // CR-SA-21+22-E2 / 2026-07-06: カスタム編集・追加サブモーダル / 削除確認の state。
    const [customEditing, setCustomEditing] = useState<CustomEditingState | null>(null);
    const [customDeleting, setCustomDeleting] = useState<CustomDeletingState | null>(null);

    // Escape キーで最前面のレイヤーを閉じる（削除確認 > 編集/追加サブモーダル > メインモーダル の優先順）。
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (customDeleting) {
                setCustomDeleting(null);
            } else if (customEditing) {
                setCustomEditing(null);
            } else if (editingType) {
                setEditingType(null);
            } else {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, editingType, customEditing, customDeleting, onClose]);

    if (!isOpen) return null;

    const visibleTypes = getVisibleUniqueSkillTypes(enableExtendedUnique, enableCompositeUnique);

    const handleSubmitForm = (type: BuiltInUniqueSkillType, form: UniqueDiceFormState) => {
        const entry = formStateToEntry(form);
        // buildUpdatedUniqueDiceConfig は必ず新しいオブジェクトを返す。
        // updateHouseRules は uniqueDiceConfig の変更を参照比較で検知するため
        // （CR-SA-15-E1 で確立）、新オブジェクトを渡すことで E2 で配線済の
        // score 再計算トリガーが正しく発火する。
        const next = buildUpdatedUniqueDiceConfig(uniqueDiceConfig, type, entry);
        updateHouseRules({ uniqueDiceConfig: next });
        setEditingType(null);
    };

    // CR-SA-21+22-E2 / 2026-07-06: カスタム追加・編集フォーム送信。
    // 追加 = crypto.randomUUID() で新 id 採番。編集 = 既存 id を保持したまま更新。
    const handleSubmitCustomForm = (form: CustomUniqueFormState) => {
        if (!customEditing) return;
        if (customEditing.mode === 'new') {
            const newId = crypto.randomUUID();
            const skill = formStateToCustomSkill(form, newId);
            addCustomUniqueSkill(skill);
        } else {
            const updated = formStateToCustomSkill(form, customEditing.skill.id);
            updateCustomUniqueSkill(customEditing.skill.id, {
                name: updated.name,
                fixValue: updated.fixValue,
                diceStr: updated.diceStr,
            });
        }
        setCustomEditing(null);
    };

    const handleCustomDeleteClick = (skill: CustomUniqueSkill) => {
        const step = getCustomInitialDeleteStep(participants);
        // Case A + 使用者ゼロ = 確認なしで即削除（ユーザー承認済 Engineer 裁量）。
        if (step === 'pre-race' && !participants.some((p) => p.uniqueSkill.customUniqueSkillId === skill.id)) {
            removeCustomUniqueSkill(skill.id);
            return;
        }
        setCustomDeleting({ skill, step });
    };

    const handleCustomDeleteProgress = () => {
        if (!customDeleting) return;
        if (customDeleting.step === 'mid-race-warning') {
            setCustomDeleting({ ...customDeleting, step: progressCustomDeleteStep(customDeleting.step) });
            return;
        }
        // pre-race / mid-race-final → 削除実行
        removeCustomUniqueSkill(customDeleting.skill.id);
        setCustomDeleting(null);
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
                            {/* CR-SA-21+22-E2 / 2026-07-06: カスタム固有スキル行（modal-houserule.md §4 L108-113 ワイヤーフレーム）。
                                登録がある場合のみ組み込み 7 行の下に登録順で表示（HR 非依存、§8.1 完全独立）。 */}
                            {customUniqueSkills.map((skill) => (
                                <tr
                                    key={skill.id}
                                    className="border-b border-slate-100 dark:border-slate-700/60 text-slate-900 dark:text-white"
                                    data-testid={`custom-unique-row-${skill.id}`}
                                >
                                    <td className="py-2 px-2 font-medium">
                                        {skill.name}
                                        <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                                            (Custom)
                                        </span>
                                    </td>
                                    <td className="py-2 px-2 font-mono">{skill.fixValue}</td>
                                    <td className="py-2 px-2 font-mono">{skill.diceStr}</td>
                                    <td className="py-2 px-2 font-mono">
                                        {getCustomUniqueDicePreview({ fixValue: skill.fixValue, diceStr: skill.diceStr })}
                                    </td>
                                    <td className="py-2 px-2">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setCustomEditing({ mode: 'edit', skill })}
                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                                                aria-label={`${skill.name} を編集`}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                                編集
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleCustomDeleteClick(skill)}
                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                aria-label={`${skill.name} を削除`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                削除
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* CR-SA-21+22-E2 / 2026-07-06: カスタム固有追加ボタン（modal-houserule.md §4 L108 SSoT）。
                    テーブル下部に配置し、常時表示（HR 非依存）。 */}
                <div>
                    <button
                        type="button"
                        onClick={() => setCustomEditing({ mode: 'new' })}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 border border-primary-200 dark:border-primary-800 rounded-lg transition-colors"
                        aria-haspopup="dialog"
                    >
                        <Plus className="w-4 h-4" />
                        ＋ カスタム固有を追加
                    </button>
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

            {/* CR-SA-21+22-E2 / 2026-07-06: カスタム固有 追加・編集サブモーダル */}
            {customEditing && (
                <CustomUniqueEditSubModal
                    mode={customEditing.mode}
                    initialForm={
                        customEditing.mode === 'edit'
                            ? createEditCustomFormState(customEditing.skill)
                            : createNewCustomFormState()
                    }
                    editingId={customEditing.mode === 'edit' ? customEditing.skill.id : undefined}
                    existingCustoms={customUniqueSkills}
                    onSubmit={handleSubmitCustomForm}
                    onCancel={() => setCustomEditing(null)}
                />
            )}

            {/* CR-SA-21+22-E2 / 2026-07-06: カスタム固有 削除確認ダイアログ */}
            {customDeleting && (
                <CustomDeleteConfirmDialog
                    skill={customDeleting.skill}
                    step={customDeleting.step}
                    onPrimary={handleCustomDeleteProgress}
                    onCancel={() => setCustomDeleting(null)}
                />
            )}
        </div>,
        document.body,
    );
};

// ===== Sub-Modal: 編集フォーム =====

interface UniqueDiceEditSubModalProps {
    type: BuiltInUniqueSkillType;
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

// ===== CR-SA-21+22-E2 / 2026-07-06: カスタム固有 追加・編集サブモーダル =====
// modal-houserule.md §4 L125-132 SSoT。組み込み UniqueDiceEditSubModal と同じ「固定値 + ダイス式」
// レイアウトを維持しつつ、先頭に「名称」入力欄を追加。カスタム編集モーダルは「デフォルトに戻す」を
// 表示しない（組み込み限定機能、L264）。バリデーションは 3 種（名称・固定値・ダイス式）ともリアルタイム。

interface CustomUniqueEditSubModalProps {
    mode: 'new' | 'edit';
    initialForm: CustomUniqueFormState;
    editingId?: string;
    existingCustoms: CustomUniqueSkill[];
    onSubmit: (form: CustomUniqueFormState) => void;
    onCancel: () => void;
}

const CustomUniqueEditSubModal: React.FC<CustomUniqueEditSubModalProps> = ({
    mode,
    initialForm,
    editingId,
    existingCustoms,
    onSubmit,
    onCancel,
}) => {
    const [form, setForm] = useState<CustomUniqueFormState>(initialForm);

    const nameErrors = validateCustomUniqueSkillName(form.name, existingCustoms, editingId);
    const fixValueErrors = validateUniqueDiceFixValue(form.fixValue);
    const diceStrErrors = validateDiceFormat(form.diceStr);
    const hasErrors =
        nameErrors.length + fixValueErrors.length + diceStrErrors.length > 0;

    // 出力プレビューは入力値が全部妥当なときのみ生成する（不正値混入回避）。
    const preview = hasErrors
        ? '—'
        : getCustomUniqueDicePreview({
              fixValue: parseInt(form.fixValue, 10),
              diceStr: form.diceStr.trim(),
          });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (hasErrors) return;
        onSubmit(form);
    };

    const title = mode === 'edit' ? `✎ カスタム固有スキルの編集` : `✎ カスタム固有スキルの追加`;
    const submitLabel = mode === 'edit' ? '保存' : '追加';

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="custom-unique-edit-submodal-title"
        >
            <form
                onSubmit={handleSubmit}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <h4
                        id="custom-unique-edit-submodal-title"
                        className="text-base font-display font-bold text-slate-900 dark:text-white"
                    >
                        {title}
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

                {/* 名称 */}
                <div className="space-y-1">
                    <label
                        htmlFor="custom-unique-form-name"
                        className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                        名称 <span className="text-red-500">*</span>
                        <span className="text-slate-400 dark:text-slate-500 ml-1">(20 文字以内)</span>
                    </label>
                    <input
                        id="custom-unique-form-name"
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        autoFocus
                        className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 transition-colors"
                    />
                    {nameErrors.length > 0 && (
                        <p className="text-xs text-red-500 dark:text-red-400" role="alert">
                            {nameErrors[0]}
                        </p>
                    )}
                </div>

                {/* 固定値 */}
                <div className="space-y-1">
                    <label
                        htmlFor="custom-unique-form-fixvalue"
                        className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                        固定値 <span className="text-slate-400 dark:text-slate-500">(整数、負の値も可)</span>
                    </label>
                    <input
                        id="custom-unique-form-fixvalue"
                        type="number"
                        step="1"
                        value={form.fixValue}
                        onChange={(e) => setForm({ ...form, fixValue: e.target.value })}
                        onWheel={(ev) => ev.currentTarget.blur()}
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
                        htmlFor="custom-unique-form-dicestr"
                        className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                        ダイス式 <span className="text-slate-400 dark:text-slate-500">(XdY 形式)</span>
                    </label>
                    <input
                        id="custom-unique-form-dicestr"
                        type="text"
                        placeholder="例: 1d25 / 1d30"
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
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
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
                        {submitLabel}
                    </button>
                </div>
            </form>
        </div>
    );
};

// ===== CR-SA-21+22-E2 / 2026-07-06: カスタム固有 削除確認ダイアログ =====
// modal-houserule.md §4 削除 SSoT + 脚質エディタ DeleteConfirmDialog と同構造。
// Case A（pre-race）= 1 段階（使用者ありのみ、使用者ゼロは呼び出し側で確認省略）/
// Case B（mid-race）= 2 段階（warning → final）。

interface CustomDeleteConfirmDialogProps {
    skill: CustomUniqueSkill;
    step: CustomDeleteConfirmStep;
    onPrimary: () => void;
    onCancel: () => void;
}

const CustomDeleteConfirmDialog: React.FC<CustomDeleteConfirmDialogProps> = ({
    skill,
    step,
    onPrimary,
    onCancel,
}) => {
    const { participants } = useRaceStore();
    const msg = getCustomDeleteConfirmMessage(step, skill.name, skill.id, participants);

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
            onClick={onCancel}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="custom-unique-delete-dialog-title"
        >
            <div
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
                    <Trash2 className="w-5 h-5 text-red-500" />
                    <h4
                        id="custom-unique-delete-dialog-title"
                        className="text-base font-display font-bold text-slate-900 dark:text-white"
                    >
                        {msg.title}
                    </h4>
                </div>

                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    {msg.body}
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        {msg.cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onPrimary}
                        autoFocus
                        className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                        {msg.primaryLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
