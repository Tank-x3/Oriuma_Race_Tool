import React, { Fragment, useMemo } from 'react';
import { useRaceStore } from '../../../store/useRaceStore';
import { getNonPacePhaseSequence } from '../../../core/phaseSequence';
import { Trash2, AlertCircle, PlayCircle } from 'lucide-react';
import type { StrategyName, UniqueSkillType } from '../../../types';
import { NotificationArea } from '../../ui/NotificationArea';
import {
    getUniqueSkillTypeOptions,
    shouldUseTwoRowLayout,
    getSecondRowFields,
    getSpecialStrategyPhaseOptions,
    getBondSkillTypeOptions,
    getSpecialStrategyTypeOptions,
} from './entryForm.helpers';
import {
    validatePersistentSkillPhases,
    validateBondSkillType,
    validateSpecialStrategyPhase,
    validateSpecialStrategyTypeAndPhase,
} from '../../../core/validator';

// Bundle-2 / D-1, D-14 / 2026-05-09: 静的配列を廃止し、`enableExtendedUnique` 連動で
// useMemo にて動的計算するよう変更（コンポーネント内で getUniqueSkillTypeOptions() を呼ぶ）。
// 'Persistent' は Bundle-3（複合固有スキル `enableCompositeUnique` 連動）で別途扱う。
// Bundle-10-T2 / CR-SA-12 / 2026-05-11: 脚質選択肢を `state.strategies` から動的取得に変更
// （カスタム脚質をプルダウンに反映するため、採用案 a 例外拡大、Bundle-9 ENG27 STRATEGY_OPTIONS ハードコード解消）。

export const EntryForm: React.FC = () => {
    const {
        participants,
        config,
        strategies,
        updateParticipant,
        // Bundle-8-T2 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: Scene 1 事前申告 actions
        setBondSkill,
        setSpecialStrategyType,
        setSpecialStrategyPhase,
        moveToGate, // Updated action
        resetRace
    } = useRaceStore();

    // Bundle-10-T2 / CR-SA-12 / 2026-05-11: ストアの脚質配列から選択肢を動的取得
    // （`addStrategy` で追加されたカスタム脚質も含むため、エディタ操作と Scene 1 プルダウンが整合する）。
    const strategyOptions: StrategyName[] = useMemo(
        () => strategies.map((s) => s.name),
        [strategies],
    );

    const houseRules = config.houseRules;
    // Bundle-8-T2 / CR-SA-4 / 2026-05-10: 2 行レイアウト切替 + 2 行目フィールド構成 (scene1-setup.md §2)
    // React Compiler との整合のため、useMemo の deps と helper への引数フィールドを一致させる。
    const useTwoRow = useMemo(
        () =>
            shouldUseTwoRowLayout({
                enableBondSkill: houseRules.enableBondSkill,
                enableSpecialStrategy: houseRules.enableSpecialStrategy,
            }),
        [houseRules.enableBondSkill, houseRules.enableSpecialStrategy],
    );
    const secondRowFields = useMemo(
        () =>
            getSecondRowFields({
                enableBondSkill: houseRules.enableBondSkill,
                enableSpecialStrategy: houseRules.enableSpecialStrategy,
            }),
        [houseRules.enableBondSkill, houseRules.enableSpecialStrategy],
    );
    const specialStrategyPhaseOptions = useMemo(
        () => getSpecialStrategyPhaseOptions(config.midPhaseCount),
        [config.midPhaseCount],
    );
    const bondSkillOptions = useMemo(() => getBondSkillTypeOptions(), []);
    const specialStrategyTypeOptions = useMemo(() => getSpecialStrategyTypeOptions(), []);

    // UI State for validation
    const [isSubmitted, setIsSubmitted] = React.useState(false);

    // Bundle-2 / D-1, D-14 / 2026-05-09: 固有タイプ選択肢を `enableExtendedUnique` 連動で動的生成
    // Bundle-3 / D-2 / 2026-05-09: `enableCompositeUnique` 連動で `Persistent` 動的追加対応
    // CR-SA-15-E3 Round 2 / 2026-05-15: ラベルを `uniqueDiceConfig` 連動の動的生成に切替
    // （ユーザーフィードバック「プルダウンテキストが固有スキル設定と連動しない」対応）。
    const uniqueSkillTypes = useMemo(
        () => getUniqueSkillTypeOptions(
            config.houseRules.enableExtendedUnique,
            config.houseRules.enableCompositeUnique,
            config.houseRules.uniqueDiceConfig,
        ),
        [
            config.houseRules.enableExtendedUnique,
            config.houseRules.enableCompositeUnique,
            config.houseRules.uniqueDiceConfig,
        ]
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

            // Bundle-3 / D-4 / 2026-05-09: 持続型「連続 2 フェーズ」検証（Layer 2、
            // validation-responsibilities.md §4 準拠）。
            // phases.length === 0 は Layer 1「発動位置が未選択です」で補足されるため
            // ここでは phases.length >= 1 のときのみ呼び出す（二重発火回避）。
            if (
                p.uniqueSkill.type === 'Persistent' &&
                p.uniqueSkill.phases &&
                p.uniqueSkill.phases.length > 0
            ) {
                const layer2Errors = validatePersistentSkillPhases(
                    p.uniqueSkill.phases,
                    config.midPhaseCount,
                );
                layer2Errors.forEach(msg => errors.push(`[#${rowNum}] ${msg}`));
            }

            // Bundle-8-T2 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 絆スキル + 特殊戦法 Scene 1 事前申告 (scene1-setup.md §2)
            if (houseRules.enableBondSkill) {
                const bondErrors = validateBondSkillType(p.bondSkill?.type);
                bondErrors.forEach((msg) => errors.push(`[#${rowNum}] ${msg}`));
            }
            if (houseRules.enableSpecialStrategy) {
                const phaseErrors = validateSpecialStrategyPhase(
                    p.specialStrategyPhase,
                    config.midPhaseCount,
                );
                phaseErrors.forEach((msg) => errors.push(`[#${rowNum}] ${msg}`));
                const setErrors = validateSpecialStrategyTypeAndPhase(
                    p.specialStrategyType,
                    p.specialStrategyPhase,
                );
                setErrors.forEach((msg) => errors.push(`[#${rowNum}] ${msg}`));
            }

            return { id: p.id, errors };
        }).filter(r => r.errors.length > 0);
    }, [
        participants,
        duplicatedNames,
        config.midPhaseCount,
        houseRules.enableBondSkill,
        houseRules.enableSpecialStrategy,
    ]);

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
    // Bundle-8-T2 / 2026-05-10: 'bondSkill' / 'specialStrategyType' / 'specialStrategyPhase' を追加。
    type FieldType =
        | 'name'
        | 'strategy'
        | 'uniqueType'
        | 'uniquePhase'
        | 'bondSkill'
        | 'specialStrategyType'
        | 'specialStrategyPhase';
    const isFieldInvalid = (id: string, fieldType: FieldType) => {
        if (!isSubmitted) return false; // Only show errors after submit attempt

        const entry = invalidEntries.find(e => e.id === id);
        if (!entry) return false;

        switch (fieldType) {
            case 'name': return entry.errors.some(e => e.includes('名前'));
            case 'strategy': return entry.errors.some(e => e.includes('脚質'));
            case 'uniqueType': return entry.errors.some(e => e.includes('固有タイプ'));
            case 'uniquePhase':
                // 「発動位置」を含むが「特殊戦法」を含まない = 固有スキル発動位置エラー
                return entry.errors.some(e => e.includes('発動位置') && !e.includes('特殊戦法'));
            case 'bondSkill':
                return entry.errors.some(e => e.includes('絆スキル'));
            case 'specialStrategyType':
                return entry.errors.some(e => e.includes('特殊戦法を選択した場合') || e.includes('特殊戦法種別'));
            case 'specialStrategyPhase':
                return entry.errors.some(
                    e =>
                        e.includes('特殊戦法の発動位置') ||
                        e.includes('発動位置を選択した場合') ||
                        e.includes('特殊戦法を選択した場合'),
                );
        }
    };


    // CR-SA-17-E2 / 2026-06-07: 非ペース列生成を統一ヘルパー `getNonPacePhaseSequence` に集約
    // （houserule-features.md §7.3 / §7.7、Bundle-3 dedup 解消）。序盤・終盤回数も依存に追加。
    // OFF 時は startPhaseCount = endPhaseCount = 1 のため現行と完全同一の選択肢を返す。
    const availablePhases = useMemo(
        () =>
            getNonPacePhaseSequence(
                config.startPhaseCount,
                config.midPhaseCount,
                config.endPhaseCount,
            ),
        [config.startPhaseCount, config.midPhaseCount, config.endPhaseCount],
    );

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

    // Bundle-8-T2 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10: 中盤回数縮小時の特殊戦法発動位置整合性強制
    // (scene1-setup.md §2「発動位置プルダウンの動的連動」SSoT、既存 uniqueSkill.phases リセットと同方針)
    React.useEffect(() => {
        if (!houseRules.enableSpecialStrategy) return;
        const validIds = new Set(specialStrategyPhaseOptions.map(o => o.id));
        participants.forEach(p => {
            if (p.specialStrategyPhase && !validIds.has(p.specialStrategyPhase)) {
                setSpecialStrategyPhase(p.id, null);
            }
        });
    }, [
        specialStrategyPhaseOptions,
        participants,
        setSpecialStrategyPhase,
        houseRules.enableSpecialStrategy,
    ]);

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
                        {/* Bundle-8-T2 / CR-SA-4 (CR-SA-11 Sub-A 連動) / 2026-05-10:
                            2 行レイアウト + 絆スキル列 + 特殊戦法 2 列（scene1-setup.md §2）。
                            1 出走者 = 1 tbody（role="group" + aria-labelledby）でアクセシビリティ要件を満たす。 */}
                        {participants.map((p, idx) => {
                            const invalidName = isFieldInvalid(p.id, 'name');
                            const invalidStrat = isFieldInvalid(p.id, 'strategy');
                            const invalidType = isFieldInvalid(p.id, 'uniqueType');
                            const invalidPhase = isFieldInvalid(p.id, 'uniquePhase');
                            const invalidBond = isFieldInvalid(p.id, 'bondSkill');
                            const invalidStratType = isFieldInvalid(p.id, 'specialStrategyType');
                            const invalidStratPhase = isFieldInvalid(p.id, 'specialStrategyPhase');
                            const displayedIndex = p.entryIndex ?? (idx + 1);
                            const nameInputId = `participant-${p.id}-name`;

                            return (
                                <tbody
                                    key={p.id}
                                    role="group"
                                    aria-labelledby={nameInputId}
                                    className="bg-white/50 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-700 last:border-b-0"
                                >
                                    <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors">
                                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-500">
                                            {displayedIndex}
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                id={nameInputId}
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
                                                {strategyOptions.map(s => <option key={s} value={s}>{s}</option>)}
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
                                            {/* Bundle-3 / D-3 / 2026-05-09: 持続型のみチェックボックス UI に切替
                                                （houserule-features.md §2 [v] 複合固有スキル準拠、複数連続フェーズ選択用） */}
                                            {p.uniqueSkill.type === 'Persistent' ? (
                                                <div
                                                    className={`flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900 border rounded px-2 py-1 ${invalidPhase
                                                        ? 'border-red-500'
                                                        : 'border-slate-300 dark:border-slate-700'
                                                        }`}
                                                >
                                                    {availablePhases.map(ph => {
                                                        const currentPhases = p.uniqueSkill.phases ?? [];
                                                        const checked = currentPhases.includes(ph.id);
                                                        return (
                                                            <label
                                                                key={ph.id}
                                                                className="flex items-center gap-1 text-xs cursor-pointer text-slate-700 dark:text-slate-200"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={(e) => {
                                                                        const next = e.target.checked
                                                                            ? [...currentPhases, ph.id]
                                                                            : currentPhases.filter(x => x !== ph.id);
                                                                        // availablePhases の順に整列（D-4 連続性検証との整合）
                                                                        const sortedNext = availablePhases
                                                                            .filter(ap => next.includes(ap.id))
                                                                            .map(ap => ap.id);
                                                                        updateParticipant(p.id, {
                                                                            uniqueSkill: { ...p.uniqueSkill, phases: sortedNext },
                                                                        });
                                                                    }}
                                                                    className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                                                                />
                                                                <span>{ph.label}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
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
                                            )}
                                        </td>
                                    </tr>
                                    {useTwoRow && secondRowFields.length > 0 && (
                                        <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-4 pb-3"></td>
                                            <td colSpan={4} className="px-4 pb-3">
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
                                                    {secondRowFields.includes('specialStrategyType') && (
                                                        <Fragment>
                                                            <label className="flex items-center gap-1.5">
                                                                <span className="font-medium whitespace-nowrap">特殊戦法種別:</span>
                                                                <select
                                                                    value={p.specialStrategyType ?? ''}
                                                                    onChange={(e) => {
                                                                        const v = e.target.value;
                                                                        setSpecialStrategyType(p.id, v === '' ? null : (v as 'Makuri' | 'Tame'));
                                                                    }}
                                                                    className={`h-7 bg-slate-50 dark:bg-slate-900 border rounded px-2 focus:outline-none focus:ring-1 transition-colors ${invalidStratType
                                                                        ? 'border-red-500 focus:ring-red-500'
                                                                        : 'border-slate-300 dark:border-slate-700 focus:border-primary-500 focus:ring-primary-500 text-slate-900 dark:text-white'
                                                                        }`}
                                                                >
                                                                    <option value="">---</option>
                                                                    {specialStrategyTypeOptions.map(o => (
                                                                        <option key={o.type} value={o.type}>{o.label}</option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                            <label className="flex items-center gap-1.5">
                                                                <span className="font-medium whitespace-nowrap">発動位置:</span>
                                                                <select
                                                                    value={p.specialStrategyPhase ?? ''}
                                                                    onChange={(e) => {
                                                                        const v = e.target.value;
                                                                        setSpecialStrategyPhase(p.id, v === '' ? null : v);
                                                                    }}
                                                                    className={`h-7 bg-slate-50 dark:bg-slate-900 border rounded px-2 focus:outline-none focus:ring-1 transition-colors ${invalidStratPhase
                                                                        ? 'border-red-500 focus:ring-red-500'
                                                                        : 'border-slate-300 dark:border-slate-700 focus:border-primary-500 focus:ring-primary-500 text-slate-900 dark:text-white'
                                                                        }`}
                                                                >
                                                                    <option value="">---</option>
                                                                    {specialStrategyPhaseOptions.map(o => (
                                                                        <option key={o.id} value={o.id}>{o.label}</option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                        </Fragment>
                                                    )}
                                                    {secondRowFields.includes('bondSkill') && (
                                                        <label className="flex items-center gap-1.5">
                                                            <span className="font-medium whitespace-nowrap">絆スキル:</span>
                                                            <select
                                                                value={p.bondSkill?.type ?? ''}
                                                                onChange={(e) => {
                                                                    const v = e.target.value;
                                                                    setBondSkill(p.id, v === '' ? null : (v as 'BondGamble' | 'BondStable'));
                                                                }}
                                                                className={`h-7 bg-slate-50 dark:bg-slate-900 border rounded px-2 focus:outline-none focus:ring-1 transition-colors ${invalidBond
                                                                    ? 'border-red-500 focus:ring-red-500'
                                                                    : 'border-slate-300 dark:border-slate-700 focus:border-primary-500 focus:ring-primary-500 text-slate-900 dark:text-white'
                                                                    }`}
                                                            >
                                                                <option value="">---</option>
                                                                {bondSkillOptions.map(o => (
                                                                    <option key={o.type} value={o.type}>{o.label}</option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            );
                        })}
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
