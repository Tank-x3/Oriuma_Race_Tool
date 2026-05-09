import React, { useMemo } from 'react';
import { useRaceStore } from '../../../store/useRaceStore';
import { Trash2, AlertCircle, PlayCircle } from 'lucide-react';
import type { StrategyName, UniqueSkillType } from '../../../types';
import { NotificationArea } from '../../ui/NotificationArea';
import { getUniqueSkillTypeOptions } from './entryForm.helpers';

const STRATEGY_OPTIONS: StrategyName[] = ['大逃げ', '逃げ', '先行', '差し', '追込'];
// Bundle-2 / D-1, D-14 / 2026-05-09: 静的配列を廃止し、`enableExtendedUnique` 連動で
// useMemo にて動的計算するよう変更（コンポーネント内で getUniqueSkillTypeOptions() を呼ぶ）。
// 'Persistent' は Bundle-3（複合固有スキル `enableCompositeUnique` 連動）で別途扱う。

export const EntryForm: React.FC = () => {
    const {
        participants,
        config,
        updateParticipant,
        moveToGate, // Updated action
        resetRace
    } = useRaceStore();

    // UI State for validation
    const [isSubmitted, setIsSubmitted] = React.useState(false);

    // Bundle-2 / D-1, D-14 / 2026-05-09: 固有タイプ選択肢を `enableExtendedUnique` 連動で動的生成
    const uniqueSkillTypes = useMemo(
        () => getUniqueSkillTypeOptions(config.houseRules.enableExtendedUnique),
        [config.houseRules.enableExtendedUnique]
    );

    // --- Validation Logic ---
    // #1-3a-5: 名前入力済み行のうち、trim 後に重複している名前の集合。
    const duplicatedNames = useMemo(() => {
        const counts = new Map<string, number>();
        participants.forEach(p => {
            const trimmed = p.name.trim();
            if (!trimmed) return;
            counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
        });
        const dup = new Set<string>();
        counts.forEach((count, name) => {
            if (count > 1) dup.add(name);
        });
        return dup;
    }, [participants]);

    const invalidEntries = useMemo(() => {
        return participants.map((p, idx) => {
            const errors: string[] = [];
            // Use p.entryIndex (1-based from store) if available, otherwise fallback to idx+1
            const rowNum = p.entryIndex ?? (idx + 1);
            const trimmedName = p.name.trim();

            // #1-3a-3: 名前空欄行はバリデーション対象外（他項目の未入力エラーを抑制）。
            if (!trimmedName) return { id: p.id, errors: [] };

            // Name Check（空欄は対象外になったので、ここでは禁止文字と重複のみ）
            if (/[+=]/.test(p.name)) errors.push(`・名前に計算記号(+, =)は使用できません`);
            if (duplicatedNames.has(trimmedName)) errors.push(`・名前 '${trimmedName}' が重複しています`);

            // Strategy Check
            if (!p.strategy) errors.push(`[#${rowNum}] 脚質が未選択です`);

            // Unique Skill Check
            if (!p.uniqueSkill.type) errors.push(`[#${rowNum}] 固有タイプが未選択です`);
            if (!p.uniqueSkill.phases || p.uniqueSkill.phases.length === 0) errors.push(`[#${rowNum}] 発動位置が未選択です`);

            return { id: p.id, errors };
        }).filter(r => r.errors.length > 0);
    }, [participants, duplicatedNames]);

    // #1-3a-3: 名前入力済みの行のみを有効エントリとして扱う。
    const activeParticipants = useMemo(
        () => participants.filter(p => p.name.trim() !== ''),
        [participants]
    );

    const allErrors = useMemo(() => {
        const errs: string[] = [];
        if (config.fullGateSize === null) errs.push('フルゲート人数を設定してください');
        if (activeParticipants.length === 0) errs.push('参加者が登録されていません');

        // 重複名エラーは名前ごとに1件だけ表示する（重複ペア両方から errors に入ると同一メッセージが複数出てしまうため、
        // ここで一括管理する）。
        const dupMessages: string[] = [];
        duplicatedNames.forEach(name => {
            dupMessages.push(`・名前 '${name}' が重複しています`);
        });
        errs.push(...dupMessages);

        // 残りの行単位エラー（重複メッセージは invalidEntries 側から除く）
        invalidEntries.forEach(e => {
            e.errors.forEach(msg => {
                if (msg.startsWith("・名前 '") && msg.endsWith("' が重複しています")) return;
                errs.push(msg);
            });
        });
        return errs;
    }, [invalidEntries, config.fullGateSize, activeParticipants.length, duplicatedNames]);

    const isValid = activeParticipants.length > 0 && invalidEntries.length === 0;

    const handleConfirm = () => {
        setIsSubmitted(true);
        if (!isValid) return;
        moveToGate();
    };

    const handleReset = () => {
        if (confirm('エントリー内容を全て消去しますか？')) {
            setIsSubmitted(false);
            resetRace();
        }
    };

    // Helper to check if a specific field is invalid for a row
    const isFieldInvalid = (id: string, fieldType: 'name' | 'strategy' | 'uniqueType' | 'uniquePhase') => {
        if (!isSubmitted) return false; // Only show errors after submit attempt

        const entry = invalidEntries.find(e => e.id === id);
        if (!entry) return false;

        switch (fieldType) {
            case 'name': return entry.errors.some(e => e.includes('名前'));
            case 'strategy': return entry.errors.some(e => e.includes('脚質'));
            case 'uniqueType': return entry.errors.some(e => e.includes('固有タイプ'));
            case 'uniquePhase': return entry.errors.some(e => e.includes('発動位置'));
        }
    };


    const availablePhases = useMemo(() => {
        const phases = [{ id: 'Start', label: '序盤' }];

        if (config.midPhaseCount === 0) {
            // No mid phase
        } else if (config.midPhaseCount === 1) {
            phases.push({ id: 'Mid', label: '中盤' });
        } else {
            for (let i = 1; i <= config.midPhaseCount; i++) {
                phases.push({ id: `Mid${i}`, label: `中盤${i}` });
            }
        }

        phases.push({ id: 'End', label: '終盤' });
        return phases;
    }, [config.midPhaseCount]);

    // Force reset phase if selected phase becomes invalid (e.g. reducing mid count)
    React.useEffect(() => {
        const availableIds = new Set(availablePhases.map(p => p.id));
        
        participants.forEach(p => {
            if (p.uniqueSkill.phases && p.uniqueSkill.phases.length > 0) {
                 const hasInvalid = p.uniqueSkill.phases.some(ph => !availableIds.has(ph));
                 if (hasInvalid) {
                     updateParticipant(p.id, { 
                         uniqueSkill: { ...p.uniqueSkill, phases: [] } 
                     });
                 }
            }
        });
    }, [availablePhases, participants, updateParticipant]);

    return (
        <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl p-6 shadow-xl space-y-6 transition-colors">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">1. 出走者登録 (Entry List)</h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                        {participants.length}名
                    </span>
                </div>
            </div>

            {participants.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-4 bg-slate-50/50 dark:bg-slate-800/20">
                    <AlertCircle className="w-8 h-8 opacity-50" />
                    <p>上の「レース設定」で人数を入力し、エントリー枠を生成してください。</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 max-h-[600px] overflow-y-auto">
                    <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300 relative">
                        <thead className="bg-slate-100/90 dark:bg-slate-700/90 text-xs uppercase font-mono text-slate-500 dark:text-slate-400 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                <th scope="col" className="px-4 py-3 w-16 text-center">#</th>
                                <th scope="col" className="px-4 py-3 min-w-[160px]">名前 (Name)</th>
                                <th scope="col" className="px-4 py-3 w-32">脚質 (Strategy)</th>
                                <th scope="col" className="px-4 py-3 w-52">固有タイプ (Type)</th>
                                <th scope="col" className="px-4 py-3 w-32">発動位置 (Phase)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white/50 dark:bg-slate-800/20">
                            {participants.map((p, idx) => {
                                const invalidName = isFieldInvalid(p.id, 'name');
                                const invalidStrat = isFieldInvalid(p.id, 'strategy');
                                const invalidType = isFieldInvalid(p.id, 'uniqueType');
                                const invalidPhase = isFieldInvalid(p.id, 'uniquePhase');
                                const displayedIndex = p.entryIndex ?? (idx + 1);

                                return (
                                    <tr key={p.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-500">
                                            {displayedIndex}
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={p.name}
                                                onChange={(e) => updateParticipant(p.id, { name: e.target.value })}
                                                className={`w-full h-8 bg-slate-50 dark:bg-slate-900 border rounded px-2 text-sm focus:outline-none focus:ring-1 transition-all ${invalidName
                                                    ? 'border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/10'
                                                    : 'border-slate-300 dark:border-slate-700 focus:border-primary-500 focus:ring-primary-500 text-slate-900 dark:text-white'
                                                    }`}
                                                placeholder="名前を入力..."
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={p.strategy || ''}
                                                onChange={(e) => updateParticipant(p.id, { strategy: e.target.value })}
                                                className={`w-full h-8 bg-slate-50 dark:bg-slate-900 border rounded px-2 text-sm focus:outline-none focus:ring-1 transition-colors ${invalidStrat
                                                    ? 'border-red-500 focus:ring-red-500'
                                                    : 'border-slate-300 dark:border-slate-700 focus:border-primary-500 focus:ring-primary-500 text-slate-900 dark:text-white'
                                                    }`}
                                            >
                                                <option value="" disabled>---</option>
                                                {STRATEGY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={p.uniqueSkill.type || ''}
                                                onChange={(e) => updateParticipant(p.id, { uniqueSkill: { ...p.uniqueSkill, type: e.target.value as UniqueSkillType } })}
                                                className={`w-full h-8 bg-slate-50 dark:bg-slate-900 border rounded px-2 text-sm focus:outline-none focus:ring-1 transition-colors ${invalidType
                                                    ? 'border-red-500 focus:ring-red-500'
                                                    : 'border-slate-300 dark:border-slate-700 focus:border-primary-500 focus:ring-primary-500 text-slate-900 dark:text-white'
                                                    }`}
                                            >
                                                <option value="" disabled>---</option>
                                                {uniqueSkillTypes.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={p.uniqueSkill.phases?.[0] || ''}
                                                onChange={(e) => updateParticipant(p.id, { uniqueSkill: { ...p.uniqueSkill, phases: [e.target.value] } })}
                                                className={`w-full h-8 bg-slate-50 dark:bg-slate-900 border rounded px-2 text-sm focus:outline-none focus:ring-1 transition-colors ${invalidPhase
                                                    ? 'border-red-500 focus:ring-red-500'
                                                    : 'border-slate-300 dark:border-slate-700 focus:border-primary-500 focus:ring-primary-500 text-slate-900 dark:text-white'
                                                    }`}
                                            >
                                                <option value="" disabled>---</option>
                                                {availablePhases.map(ph => <option key={ph.id} value={ph.id}>{ph.label}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Notification Area */}
            {/* Show only default message if not submitted, or errors if submitted */}
            <NotificationArea errors={isSubmitted ? allErrors : []} />

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700/50">
                <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded-lg transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                    <span>Reset</span>
                </button>

                <button
                    onClick={handleConfirm}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-lg shadow-indigo-500/20 disabled:shadow-none"
                >
                    <span>エントリー確定</span>
                    <PlayCircle className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
