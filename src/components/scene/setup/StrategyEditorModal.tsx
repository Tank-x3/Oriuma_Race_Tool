// Bundle-10-T2 / CR-SA-12 / 2026-05-11: 脚質エディタモーダル (Strategy Editor)
// modal-houserule.md §2 + houserule-features.md §1 SSoT 準拠。
// メインモーダル (脚質一覧テーブル) + 編集 / 挿入サブモーダル + 削除確認ダイアログ (Pre-Race / Mid-Race 2 段階)。
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Layers, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useRaceStore } from '../../../store/useRaceStore';
import { isDefaultStrategy } from '../../../core/strategy.helpers';
import type { Strategy } from '../../../types';
import {
    PACE_ROLL_RANGE,
    createEditFormState,
    createInsertFormState,
    createDefaultResetFormState,
    formStateToStrategy,
    getInitialDeleteStep,
    progressDeleteStep,
    getDeleteConfirmMessage,
    type DeleteConfirmStep,
    type StrategyFormState,
} from './strategyEditor.helpers';

interface StrategyEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface EditingState {
    mode: 'edit' | 'insert';
    targetStrategy: Strategy; // edit: 編集対象, insert: 直前脚質
}

interface DeletingState {
    strategy: Strategy;
    step: DeleteConfirmStep;
}

export const StrategyEditorModal: React.FC<StrategyEditorModalProps> = ({ isOpen, onClose }) => {
    const { strategies, participants, addStrategy, updateStrategy, removeStrategy } = useRaceStore();
    const [editing, setEditing] = useState<EditingState | null>(null);
    const [deleting, setDeleting] = useState<DeletingState | null>(null);

    // Escape キーで最前面のレイヤーを閉じる (削除確認 > 編集サブモーダル > メインモーダル の優先順)。
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (deleting) {
                setDeleting(null);
            } else if (editing) {
                setEditing(null);
            } else {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, deleting, editing, onClose]);

    if (!isOpen) return null;

    const handleEditClick = (strategy: Strategy) => {
        setEditing({ mode: 'edit', targetStrategy: strategy });
    };

    const handleInsertClick = (prevStrategy: Strategy) => {
        setEditing({ mode: 'insert', targetStrategy: prevStrategy });
    };

    const handleDeleteClick = (strategy: Strategy) => {
        const step = getInitialDeleteStep(participants);
        setDeleting({ strategy, step });
    };

    const handleSubmitForm = (form: StrategyFormState) => {
        if (!editing) return;
        const newStrategy = formStateToStrategy(form);
        if (editing.mode === 'edit') {
            updateStrategy(editing.targetStrategy.name, newStrategy);
        } else {
            addStrategy(editing.targetStrategy.name, newStrategy);
        }
        setEditing(null);
    };

    const handleDeleteProgress = () => {
        if (!deleting) return;
        if (deleting.step === 'mid-race-warning') {
            setDeleting({ ...deleting, step: progressDeleteStep(deleting.step) });
            return;
        }
        // pre-race / mid-race-final → 削除実行
        removeStrategy(deleting.strategy.name);
        setDeleting(null);
    };

    // Bundle-10-T2 / CR-SA-12 / 2026-05-11: HouseRulesForm の `backdrop-blur-sm` (backdrop-filter) は
    // 子の `position: fixed` の containing block を HouseRulesForm に制限するため、createPortal で
    // document.body 直下に描画して回避する (CSS 仕様: backdrop-filter ありの祖先は fixed の containing block 化)。
    return createPortal(
        <div
            className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="strategy-editor-modal-title"
        >
            <div
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        <h3
                            id="strategy-editor-modal-title"
                            className="text-lg font-display font-bold text-slate-900 dark:text-white"
                        >
                            🎴 脚質・ダイステーブル設定 (Strategy Editor)
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

                {/* Strategies Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                <th className="text-left py-2 px-2">名前</th>
                                <th className="text-left py-2 px-2">固定値</th>
                                <th className="text-left py-2 px-2">序盤</th>
                                <th className="text-left py-2 px-2">中盤</th>
                                <th className="text-left py-2 px-2">終盤</th>
                                <th className="text-right py-2 px-2">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {strategies.map((s) => {
                                const isDefault = isDefaultStrategy(s.name);
                                return (
                                    <tr
                                        key={s.name}
                                        className="border-b border-slate-100 dark:border-slate-700/60 text-slate-900 dark:text-white"
                                    >
                                        <td className="py-2 px-2 font-medium">
                                            {s.name}
                                            {isDefault && (
                                                <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                                                    (Default)
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 font-mono">{s.fixValue}</td>
                                        <td className="py-2 px-2 font-mono">{s.dice.start}</td>
                                        <td className="py-2 px-2 font-mono">{s.dice.mid}</td>
                                        <td className="py-2 px-2 font-mono">{s.dice.end}</td>
                                        <td className="py-2 px-2">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditClick(s)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                                                    aria-label={`${s.name} を編集`}
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                    編集
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleInsertClick(s)}
                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                                                    aria-label={`${s.name} の直後にカスタム脚質を追加`}
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    ↓ここに追加
                                                </button>
                                                {!isDefault && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteClick(s)}
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                        aria-label={`${s.name} を削除`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        削除
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

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

            {/* 編集 / 挿入サブモーダル */}
            {editing && (
                <StrategyEditSubModal
                    mode={editing.mode}
                    targetStrategy={editing.targetStrategy}
                    onSubmit={handleSubmitForm}
                    onCancel={() => setEditing(null)}
                />
            )}

            {/* 削除確認ダイアログ */}
            {deleting && (
                <DeleteConfirmDialog
                    strategyName={deleting.strategy.name}
                    step={deleting.step}
                    onPrimary={handleDeleteProgress}
                    onCancel={() => setDeleting(null)}
                />
            )}
        </div>,
        document.body,
    );
};

// ===== Sub-Modal: 編集 / 挿入フォーム =====

interface StrategyEditSubModalProps {
    mode: 'edit' | 'insert';
    targetStrategy: Strategy;
    onSubmit: (form: StrategyFormState) => void;
    onCancel: () => void;
}

const StrategyEditSubModal: React.FC<StrategyEditSubModalProps> = ({
    mode,
    targetStrategy,
    onSubmit,
    onCancel,
}) => {
    const initialForm =
        mode === 'edit'
            ? createEditFormState(targetStrategy)
            : createInsertFormState(targetStrategy);
    const [form, setForm] = useState<StrategyFormState>(initialForm);
    const isDefault = isDefaultStrategy(targetStrategy.name);
    const nameReadOnly = mode === 'edit' && isDefault;

    const handlePaceChange = (roll: number, raw: string) => {
        setForm((prev) => ({
            ...prev,
            paceModifiers: { ...prev.paceModifiers, [roll]: raw },
        }));
    };

    const handleResetToDefault = () => {
        const resetForm = createDefaultResetFormState(targetStrategy.name);
        if (resetForm) setForm(resetForm);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (form.name.trim() === '') return;
        onSubmit(form);
    };

    const title =
        mode === 'edit'
            ? `脚質を編集: ${targetStrategy.name}`
            : `「${targetStrategy.name}」の直後に新規脚質を追加`;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="strategy-edit-submodal-title"
        >
            <form
                onSubmit={handleSubmit}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <h4
                        id="strategy-edit-submodal-title"
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

                {/* 名前 */}
                <div className="space-y-1">
                    <label
                        htmlFor="strategy-form-name"
                        className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                        脚質名 <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="strategy-form-name"
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        readOnly={nameReadOnly}
                        required
                        autoFocus={!nameReadOnly}
                        className={`w-full h-10 border rounded-lg px-3 font-mono focus:outline-none focus:border-primary-500 transition-colors ${
                            nameReadOnly
                                ? 'bg-slate-100 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                        }`}
                    />
                    {nameReadOnly && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            デフォルト 5 脚質の名前は変更できません。
                        </p>
                    )}
                </div>

                {/* fixValue */}
                <div className="space-y-1">
                    <label
                        htmlFor="strategy-form-fixvalue"
                        className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                        固定値 (fixValue)
                    </label>
                    <input
                        id="strategy-form-fixvalue"
                        type="number"
                        step="1"
                        value={form.fixValue}
                        onChange={(e) => setForm({ ...form, fixValue: e.target.value })}
                        onWheel={(ev) => ev.currentTarget.blur()}
                        className="w-32 h-10 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-primary-500 transition-colors"
                    />
                </div>

                {/* dice 3 フェーズ */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['Start', 'Mid', 'End'] as const).map((phase) => {
                        const label =
                            phase === 'Start' ? '序盤ダイス式' : phase === 'Mid' ? '中盤ダイス式' : '終盤ダイス式';
                        const id = `strategy-form-dice-${phase.toLowerCase()}`;
                        const value =
                            phase === 'Start'
                                ? form.diceStart
                                : phase === 'Mid'
                                  ? form.diceMid
                                  : form.diceEnd;
                        const setter = (next: string) => {
                            if (phase === 'Start') setForm({ ...form, diceStart: next });
                            else if (phase === 'Mid') setForm({ ...form, diceMid: next });
                            else setForm({ ...form, diceEnd: next });
                        };
                        return (
                            <div key={phase} className="space-y-1">
                                <label
                                    htmlFor={id}
                                    className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                                >
                                    {label}
                                </label>
                                <input
                                    id={id}
                                    type="text"
                                    placeholder="例: 3d6 / 1d10 / -1d20"
                                    value={value}
                                    onChange={(e) => setter(e.target.value)}
                                    className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-primary-500 transition-colors"
                                />
                            </div>
                        );
                    })}
                </div>

                {/* paceModifiers マトリクス */}
                <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        ペース補正マトリクス (出目 1〜9 → 補正値)
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
                        {PACE_ROLL_RANGE.map((roll) => {
                            const id = `strategy-form-pace-${roll}`;
                            return (
                                <div key={roll} className="space-y-1">
                                    <label
                                        htmlFor={id}
                                        className="text-xs text-slate-500 dark:text-slate-400 block text-center"
                                    >
                                        {roll}
                                    </label>
                                    <input
                                        id={id}
                                        type="number"
                                        step="1"
                                        value={form.paceModifiers[roll] ?? ''}
                                        onChange={(e) => handlePaceChange(roll, e.target.value)}
                                        onWheel={(ev) => ev.currentTarget.blur()}
                                        className="w-full h-9 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 text-center text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-primary-500 transition-colors"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div>
                        {mode === 'edit' && isDefault && (
                            <button
                                type="button"
                                onClick={handleResetToDefault}
                                className="px-3 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                            >
                                初期値に戻す
                            </button>
                        )}
                    </div>
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
                            className="px-4 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                        >
                            {mode === 'edit' ? '保存' : '追加'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

// ===== 削除確認ダイアログ =====

interface DeleteConfirmDialogProps {
    strategyName: string;
    step: DeleteConfirmStep;
    onPrimary: () => void;
    onCancel: () => void;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
    strategyName,
    step,
    onPrimary,
    onCancel,
}) => {
    const { participants } = useRaceStore();
    const msg = getDeleteConfirmMessage(step, strategyName, participants);

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
            onClick={onCancel}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="strategy-delete-dialog-title"
        >
            <div
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
                    <Trash2 className="w-5 h-5 text-red-500" />
                    <h4
                        id="strategy-delete-dialog-title"
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
