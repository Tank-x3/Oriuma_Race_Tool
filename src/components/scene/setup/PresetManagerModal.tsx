// Bundle-11-T1 / CR-SA-12 / 2026-05-11: 設定プリセット管理モーダル (Preset Manager)
// modal-houserule.md §3 + houserule-features.md §4 SSoT 準拠。
// メインモーダル (設定名入力 + 保存ボタン + 一覧 [読込/削除]) + 上書き確認 + 読込時の初期化警告ダイアログ。
// Bundle-10-T2 確立済 StrategyEditorModal の createPortal + z-index 階層パターン踏襲。
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FolderOpen, Save, Trash2, Upload, X } from 'lucide-react';
import { useRaceStore } from '../../../store/useRaceStore';
// Bundle-11-T2 / CR-SA-12 / 2026-05-11: ファイル I/O 機能
// (modal-houserule.md §3 設定プリセット管理 ファイル入出力 + §⚠️ Import Validation)
import { useNotificationStore } from '../../../store/useNotificationStore';
import {
    serializeHouseRulesConfig,
    deserializeAndValidate,
    buildExportFilename,
} from './presetManager.helpers';

interface PresetManagerModalProps {
    // 親側 `HouseRulesForm` で `{isOpen && <PresetManagerModal ... />}` の条件描画とするため、
    // 本コンポーネントは常時マウント時 = open 状態 として扱う（isOpen prop は廃止）。
    onClose: () => void;
}

interface ConfirmDialogState {
    title: string;
    body: string;
    primaryLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
}

export const PresetManagerModal: React.FC<PresetManagerModalProps> = ({ onClose }) => {
    const { savePreset, loadPreset, deletePreset, listPresetNames, importHouseRulesConfig } =
        useRaceStore();
    // lazy initial pattern: mount 時に一度だけ listPresetNames() を実行。
    // 親側で `{isOpen && <PresetManagerModal ... />}` の条件描画により、open/close ごとに
    // mount/unmount される（state も自動リセット）= useEffect 経由の setState を回避する設計
    // (react-hooks/set-state-in-effect ルール準拠、ThemeToggle.tsx 既存違反とは別軸の最適解)。
    const [presetName, setPresetName] = useState<string>('');
    const [presetNames, setPresetNames] = useState<string[]>(() => listPresetNames());
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
    // Bundle-11-T2: 非表示 <input type="file"> をプログラム的にトリガーするための ref
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Escape キーで最前面のレイヤーを閉じる (確認ダイアログ > メインモーダル の優先順)。
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (confirmDialog) {
                setConfirmDialog(null);
            } else {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [confirmDialog, onClose]);

    const trimmedName = presetName.trim();
    const nameEmpty = trimmedName === '';
    // modal-houserule.md §Critical Errors 完全一致
    const nameError = nameEmpty ? '設定名を入力してください。' : null;

    const refreshList = () => {
        setPresetNames(listPresetNames());
    };

    const handleSaveClick = () => {
        if (nameEmpty) return;
        // 上書き確認: 同名プリセットが既存の場合は確認ダイアログ表示
        if (presetNames.includes(trimmedName)) {
            setConfirmDialog({
                title: 'プリセット上書き確認',
                body: `同名のプリセット '${trimmedName}' を上書きしますか？`,
                primaryLabel: '上書きする',
                cancelLabel: 'キャンセル',
                onConfirm: () => {
                    savePreset(trimmedName);
                    refreshList();
                    setPresetName('');
                    setConfirmDialog(null);
                },
            });
            return;
        }
        savePreset(trimmedName);
        refreshList();
        setPresetName('');
    };

    // 簡易判定: 常に確認ダイアログを表示 (modal-houserule.md §Confirmations SSoT)。
    // 厳密「変更中」判定 (lastLoadedPresetName 差分検知) は Bundle-11-T2 完遂後の Followup 候補。
    const handleLoadClick = (name: string) => {
        setConfirmDialog({
            title: '読込確認',
            body: '現在の変更内容は失われます。読み込みますか？',
            primaryLabel: '読み込む',
            cancelLabel: 'キャンセル',
            onConfirm: () => {
                loadPreset(name);
                setConfirmDialog(null);
                onClose();
            },
        });
    };

    // 削除確認ダイアログ: 誤削除リスク (特にカスタム脚質を含むプリセット、Bundle-11-T2 ファイル I/O
    // 未実装段階では LocalStorage 内のみが唯一の永続化先のため、誤削除復元手段が無い) を考慮し、
    // 削除前に必ず確認を要求する。
    const handleDeleteClick = (name: string) => {
        setConfirmDialog({
            title: 'プリセット削除確認',
            body: `プリセット '${name}' を削除しますか？この操作は取り消せません。`,
            primaryLabel: '削除する',
            cancelLabel: 'キャンセル',
            onConfirm: () => {
                deletePreset(name);
                refreshList();
                setConfirmDialog(null);
            },
        });
    };

    const handleKeyDownOnInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !nameEmpty) {
            e.preventDefault();
            handleSaveClick();
        }
    };

    // Bundle-11-T2 / CR-SA-12 / 2026-05-11: ファイル入出力ハンドラ
    // Export: 現 state の houseRules + strategies を JSON 化 → Blob ダウンロード
    // Import: 選択ファイル → FileReader → JSON.parse + zod 検証 → 確認ダイアログ → state 上書き
    // (modal-houserule.md §3 ファイル入出力 + §⚠️ Import Validation + §ℹ️ Confirmations)

    const handleExportClick = () => {
        const state = useRaceStore.getState();
        const json = serializeHouseRulesConfig(state.config.houseRules, state.strategies);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = buildExportFilename(new Date());
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };

    const handleImportButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // 同名ファイルを再選択しても onChange 発火させるため input value をリセット
        e.target.value = '';
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = typeof reader.result === 'string' ? reader.result : '';
            const result = deserializeAndValidate(text);
            if (!result.success) {
                useNotificationStore.getState().addNotification('error', result.error);
                return;
            }
            setConfirmDialog({
                title: 'ファイルから読込確認',
                body: '現在の変更内容は失われます。読み込みますか？',
                primaryLabel: '読み込む',
                cancelLabel: 'キャンセル',
                onConfirm: () => {
                    importHouseRulesConfig(result.data);
                    setConfirmDialog(null);
                    onClose();
                },
            });
        };
        reader.onerror = () => {
            useNotificationStore
                .getState()
                .addNotification(
                    'error',
                    'ファイル形式が正しくありません。オリウマツール用の設定ファイルを選択してください',
                );
        };
        reader.readAsText(file);
    };

    return createPortal(
        <div
            className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="preset-manager-modal-title"
        >
            <div
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                    <div className="flex items-center gap-2">
                        <Save className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        <h3
                            id="preset-manager-modal-title"
                            className="text-lg font-display font-bold text-slate-900 dark:text-white"
                        >
                            💾 設定プリセット管理 (Preset Management)
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

                {/* 保存セクション */}
                <div className="space-y-2">
                    <label
                        htmlFor="preset-manager-name-input"
                        className="text-xs font-medium text-slate-600 dark:text-slate-300 block"
                    >
                        設定名 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-stretch gap-2">
                        <input
                            id="preset-manager-name-input"
                            type="text"
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            onKeyDown={handleKeyDownOnInput}
                            placeholder="例: My House Rule A"
                            autoFocus
                            className="flex-1 h-10 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-primary-500 transition-colors"
                        />
                        <button
                            type="button"
                            onClick={handleSaveClick}
                            disabled={nameEmpty}
                            className="inline-flex items-center gap-1 px-4 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed disabled:hover:bg-slate-300 dark:disabled:hover:bg-slate-600"
                        >
                            <Save className="w-4 h-4" />
                            保存
                        </button>
                    </div>
                    {nameError && presetName !== '' && (
                        <p className="text-xs text-red-500 dark:text-red-400" role="alert">
                            {nameError}
                        </p>
                    )}
                </div>

                {/* 保存済プリセット一覧 */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        保存済みプリセット
                    </p>
                    {presetNames.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 italic py-2">
                            保存済みのプリセットはありません
                        </p>
                    ) : (
                        <ul className="space-y-1">
                            {presetNames.map((name) => (
                                <li
                                    key={name}
                                    className="flex items-center justify-between gap-2 py-2 px-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg"
                                >
                                    <span className="text-sm text-slate-900 dark:text-white font-medium truncate">
                                        {name}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleLoadClick(name)}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                                            aria-label={`${name} を読み込む`}
                                        >
                                            <FolderOpen className="w-3.5 h-3.5" />
                                            読込
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteClick(name)}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                            aria-label={`${name} を削除`}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            削除
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Bundle-11-T2 / CR-SA-12 / 2026-05-11: ファイル入出力セクション
                    (modal-houserule.md §3 設定プリセット管理 ファイル入出力 ワイヤーフレーム下段) */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        ファイル入出力
                    </p>
                    <div className="flex flex-wrap items-stretch gap-2">
                        <button
                            type="button"
                            onClick={handleExportClick}
                            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 border border-primary-200 dark:border-primary-800 rounded-lg transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            📤 ファイルへ保存(.json)
                        </button>
                        <button
                            type="button"
                            onClick={handleImportButtonClick}
                            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 border border-primary-200 dark:border-primary-800 rounded-lg transition-colors"
                        >
                            <Upload className="w-4 h-4" />
                            📥 ファイルから読込(.json)
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/json,.json"
                            onChange={handleFileSelected}
                            className="hidden"
                            aria-hidden="true"
                            data-testid="preset-manager-file-input"
                        />
                    </div>
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

            {/* 確認ダイアログ (上書き確認 / 読込時の初期化警告 を汎用化) */}
            {confirmDialog && (
                <ConfirmDialog
                    title={confirmDialog.title}
                    body={confirmDialog.body}
                    primaryLabel={confirmDialog.primaryLabel}
                    cancelLabel={confirmDialog.cancelLabel}
                    onPrimary={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}
        </div>,
        document.body,
    );
};

// ===== 確認ダイアログ (上書き確認 / 初期化警告共通) =====

interface ConfirmDialogProps {
    title: string;
    body: string;
    primaryLabel: string;
    cancelLabel: string;
    onPrimary: () => void;
    onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    title,
    body,
    primaryLabel,
    cancelLabel,
    onPrimary,
    onCancel,
}) => {
    return (
        <div
            className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
            onClick={onCancel}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="preset-confirm-dialog-title"
        >
            <div
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
                    <h4
                        id="preset-confirm-dialog-title"
                        className="text-base font-display font-bold text-slate-900 dark:text-white"
                    >
                        {title}
                    </h4>
                </div>

                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{body}</p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onPrimary}
                        autoFocus
                        className="px-4 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                    >
                        {primaryLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
