// Bundle-5 / P4-2, P4-3, CR-22 / 2026-05-10: 汎用補正の入力モーダル。
// scene3-race.md §3 (B) GM Dashboard / houserule-features.md §2 [v] 汎用補正 / CR-22 理由ラベル必須化。
// HouseRulesForm.tsx のカード型スタイルを踏襲、Tailwind primary パレット + ダークモード対応。
import React, { useEffect, useState } from 'react';
import { Edit3, X } from 'lucide-react';
import { useRaceStore } from '../../../store/useRaceStore';
import { useRaceEngine } from '../../../hooks/useRaceEngine';
import type { Umamusume } from '../../../types';
import { validateModifierInput } from './modifier.helpers';

interface ModifierModalProps {
    isOpen: boolean;
    participant: Umamusume | null;
    phaseId: string;
    onClose: () => void;
}

export const ModifierModal: React.FC<ModifierModalProps> = ({
    isOpen,
    participant,
    phaseId,
    onClose,
}) => {
    const { setManualModifier, clearManualModifier } = useRaceStore();
    const { getPhaseLabel } = useRaceEngine();

    const existing = participant?.history[phaseId]?.manualModifier;
    const isEditMode = existing !== undefined;

    // useState 初期値で既存補正値を直接読み取る（呼び出し側で `key={participant.id}` を付けて
    // モーダル開閉ごとに再マウントさせる方針 = useEffect 内 setState を回避し
    // react-hooks/set-state-in-effect 違反を発生させない）。
    const [valueInput, setValueInput] = useState<string>(
        existing ? String(existing.value) : ''
    );
    const [reasonInput, setReasonInput] = useState<string>(
        existing ? existing.reason : ''
    );
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Escape キーで閉じる（外部システム購読のみ、setState 呼び出しなし）
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    if (!isOpen || !participant) return null;

    const parseValue = (raw: string): number | '' => {
        if (raw === '' || raw === '-') return '';
        const parsed = parseInt(raw, 10);
        if (Number.isNaN(parsed)) return '';
        return parsed;
    };

    const handleSubmit = () => {
        const numValue = parseValue(valueInput);
        const result = validateModifierInput(numValue, reasonInput);
        if (!result.isValid || result.sanitized === null) {
            setErrorMessage(result.errorMessage);
            return;
        }
        setManualModifier(
            participant.id,
            phaseId,
            result.sanitized.value,
            result.sanitized.reason,
        );
        onClose();
    };

    const handleClear = () => {
        clearManualModifier(participant.id, phaseId);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modifier-modal-title"
        >
            <div
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <div className="flex items-center gap-2">
                        <Edit3 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        <h3
                            id="modifier-modal-title"
                            className="text-base font-display font-bold text-slate-900 dark:text-white"
                        >
                            [✎ 補正] 入力
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

                {/* Context */}
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    対象: <span className="font-bold text-slate-700 dark:text-slate-200">{participant.name}</span>
                    <span className="mx-2">/</span>
                    フェーズ: <span className="font-bold text-slate-700 dark:text-slate-200">{getPhaseLabel(phaseId)}</span>
                </div>

                {/* Value Input */}
                <div className="space-y-1">
                    <label
                        htmlFor="modifier-value-input"
                        className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                        補正値（整数、プラス・マイナス両対応）
                    </label>
                    <input
                        id="modifier-value-input"
                        type="number"
                        step="1"
                        value={valueInput}
                        onChange={(e) => {
                            setValueInput(e.target.value);
                            setErrorMessage(null);
                        }}
                        onWheel={(ev) => ev.currentTarget.blur()}
                        autoFocus
                        placeholder="例: 5 / -3"
                        className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-primary-500 transition-colors"
                    />
                </div>

                {/* Reason Input */}
                <div className="space-y-1">
                    <label
                        htmlFor="modifier-reason-input"
                        className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                        理由ラベル <span className="text-red-500">*</span>
                    </label>
                    <input
                        id="modifier-reason-input"
                        type="text"
                        value={reasonInput}
                        onChange={(e) => {
                            setReasonInput(e.target.value);
                            setErrorMessage(null);
                        }}
                        placeholder="例: 妨害 / ギミック発動 / ファンブル"
                        className="w-full h-10 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 transition-colors"
                    />
                </div>

                {/* Error Message */}
                {errorMessage && (
                    <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                        {errorMessage}
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={!isEditMode}
                        className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        クリア
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="px-4 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                        >
                            {isEditMode ? '更新' : '登録'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
