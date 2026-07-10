import React, { useState, useMemo } from 'react';
import { useRaceStore } from '../../store/useRaceStore';
import { Dices, ClipboardCopy, ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react';
import { ParserFactory } from '../../core/parser/parserFactory';
import { getUndetectedParticipantNames } from '../../core/parser/parserUtils';
import { NotificationArea } from '../ui/NotificationArea';
// Bundle-8-T3 / CR-SA-4 / 2026-05-10: HR 連動事前申告併記（scene2-gate.md §2）
// CR-SA-21+22-E3 / 2026-07-06: 固有スキル表示ラベル解決を helpers へ抽出（Custom/None 対応、テスト容易化）
// CR-SA-23-E2 / 2026-07-08: 枠順手動配置 Scene 2 配線用純粋関数 4 個を追加取り込み
import {
    getEntryListAnnotations,
    getEntryListUniqueTypeLabel,
    getEntryListManualGateLabel,
    getManualGateOptions,
    getRaffleTargets,
    assignGatesWithManualHold,
} from './gateScene.helpers';

// Helper for Circle Numbers (①, ②...)
const getCircleNumber = (num: number): string => {
    if (num >= 1 && num <= 20) {
        return String.fromCodePoint(0x2460 + num - 1);
    }
    return `(${num})`;
};

export const GateScene: React.FC = () => {
    const {
        participants,
        applyGateAssignments,
        startRace,
        moveToSetup,
        gateAssignments,
        setGateAssignments,
        updateParticipant,
        config,
    } = useRaceStore();
    // Bundle-8-T3 / CR-SA-4 / 2026-05-10: HR 連動併記用（enableSpecialStrategy / enableBondSkill）
    const houseRules = config.houseRules;
    // CR-SA-23-E2 / 2026-07-08: 枠順手動配置ハウスルールトグル（Scene 2 分岐配線の中核）
    const enableManualGate = houseRules.enableManualGate;
    const [inputText, setInputText] = useState('');
    const [parseErrors, setParseErrors] = useState<string[]>([]);
    const [copiedSection, setCopiedSection] = useState<string | null>(null);

    // CR-SA-23-E2 / 2026-07-08: 抽選対象者（HR OFF = 全員、HR ON = manualGate === null のみ）
    // ・[2b] ダイス出力対象 / [3] バリデーション人数基準 / [6] 全員指定時分岐 の共通入力源。
    const raffleTargets = useMemo(
        () => getRaffleTargets(participants, enableManualGate),
        [participants, enableManualGate],
    );
    // CR-SA-23-E2 / 2026-07-08: 全員指定時（抽選対象 0 名 かつ HR ON）判定。
    // [2b][3] セクション非表示 + [4] 即時充当 + 「レース開始」直接活性化のトリガー。
    const allManuallyAssigned = enableManualGate && raffleTargets.length === 0 && participants.length > 0;

    // CR-5a-2: 表示用 assignments の構築（scene2-gate.md §3 復元優先順位 3 段階）。
    //   (1) gateAssignments != null            → ストア中間状態から表示用に name を join（SA07 新挙動）
    //   (2) gateAssignments == null かつ
    //       participants[].gate != null       → 既存 participants から再構築
    //                                           （Scene 3 以降からの戻り経路 / 旧データ復元、roll は失われており 0 で dummy）
    //   (3) 両方 null                          → null（未解析、[4] セクション非表示）
    // CR-SA-23-E2 / 2026-07-08: (4) 全員手動指定時は解析実行を経由せず manualGate から即時充当。
    //     assignGatesWithManualHold(participants, [], true) が手動指定者のみの GateAssignment 配列を返す。
    const displayAssignments = useMemo<{ id: string; name: string; roll: number | null; gate: number }[] | null>(() => {
        // CR-SA-23-E2 / 2026-07-08: 全員手動指定時 = 解析ステップ省略で [4] 即時再構築（houserule-features.md §9.7）。
        // gateAssignments に前回の解析結果が残っていても、manualGate 変更に追従して最新状態を表示するため、
        // このケースは gateAssignments の復元経路より優先する。
        if (allManuallyAssigned) {
            const nameMap = new Map(participants.map(p => [p.id, p.name]));
            return assignGatesWithManualHold(participants, [], true)
                .map(a => ({
                    id: a.id,
                    name: nameMap.get(a.id) ?? '',
                    roll: a.roll,
                    gate: a.gate,
                }))
                .sort((a, b) => a.gate - b.gate);
        }
        if (gateAssignments) {
            const nameMap = new Map(participants.map(p => [p.id, p.name]));
            return gateAssignments
                .map(a => ({
                    id: a.id,
                    name: nameMap.get(a.id) ?? '',
                    roll: a.roll,
                    gate: a.gate,
                }))
                .sort((a, b) => a.gate - b.gate);
        }
        const hasGate = participants.some(p => p.gate !== null);
        if (hasGate) {
            return participants
                .filter(p => p.gate !== null)
                .map(p => ({
                    id: p.id,
                    name: p.name,
                    roll: 0,
                    gate: p.gate!,
                }))
                .sort((a, b) => a.gate - b.gate);
        }
        return null;
    }, [gateAssignments, participants, allManuallyAssigned]);

    // [1] Entry Confirmation List
    const entryListText = useMemo(() => {
        const phaseMap: Record<string, string> = {
            'Start': '序盤',
            'Mid': '中盤',
            'End': '終盤'
        };
        // Helper for Mid1, Mid2...
        const getPhaseLabel = (pId: string) => {
            if (phaseMap[pId]) return phaseMap[pId];
            if (pId.startsWith('Mid')) return pId.replace('Mid', '中盤');
            return pId;
        };

        return participants.map((p, i) => {
            const index = i + 1;
            // CR-SA-21+22-E3 / 2026-07-06: 固有スキル表示ラベル解決を helpers へ移譲（Custom/None 対応）。
            const typeLabel = getEntryListUniqueTypeLabel(
                p.uniqueSkill.type,
                p.uniqueSkill.customUniqueSkillId,
                houseRules.customUniqueSkills,
            );
            const phaseStr = p.uniqueSkill.phases.map(getPhaseLabel).join(',') || '---';
            // CR-SA-23-E2 / 2026-07-08: `[固定枠: N]` 併記（HR OFF 時は空文字 = 現行同一、scene2-gate.md §2 L166 SSoT）
            const manualGateLabel = getEntryListManualGateLabel(p, enableManualGate);
            // Bundle-8-T3 / CR-SA-4 / 2026-05-10: HR 連動事前申告併記（scene2-gate.md §2）
            // 並び順（scene2-gate.md §2 L166 SSoT）: 基本情報 → [固定枠: N] → 特殊戦法 → 絆スキル
            const annotations = getEntryListAnnotations(p, houseRules, getPhaseLabel);
            return `${index}. ${p.name} (${p.strategy} / ${typeLabel} / ${phaseStr})${manualGateLabel}${annotations}`;
        }).join('\n');
    }, [participants, houseRules, enableManualGate]);

    // [2] Main Dice Output Template
    // CR-SA-23-E2 / 2026-07-08: HR ON \u6642\u306f\u62bd\u9078\u5bfe\u8c61\u8005\uff08\u672a\u6307\u5b9a\u8005\uff09\u306e\u307f\u3092\u51fa\u529b\uff08houserule-features.md \u00a79.4\uff09\u3002
    // HR OFF \u6642\u306f raffleTargets = \u5168\u53c2\u52a0\u8005\u306e\u305f\u3081\u73fe\u884c\u5b8c\u5168\u540c\u4e00\u3002
    const diceOutputTemplate = useMemo(() => {
        // Updated to use Full-width space (U+3000) as separator
        return raffleTargets.map(p => `${p.name}\u3000dice1d100=`).join('\n');
    }, [raffleTargets]);

    // Copy Handlers with Feedback
    const handleCopy = (text: string, sectionId: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedSection(sectionId);
            setTimeout(() => setCopiedSection(null), 2000);
        }).catch(() => {
            // Fallback or ignore
        });
    };

    const CopyButton: React.FC<{ text: string; sectionId: string; label: string }> = ({ text, sectionId, label }) => {
        const isCopied = copiedSection === sectionId;
        return (
            <button
                onClick={() => handleCopy(text, sectionId)}
                className={`absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 border rounded shadow-sm text-xs font-medium transition-all ${isCopied
                    ? 'bg-green-50 border-green-200 text-green-600'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 opacity-80 group-hover:opacity-100'
                    }`}
            >
                {isCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                {isCopied ? 'コピーしました' : label}
            </button>
        );
    };

    // [3] Parse & Analyze
    const handleParse = () => {
        // CR-SA-3-E2-Followup-A: ParserFactory 経由で 88ch 形式 (🎲) を EmojiParser へ振り分け
        // 仕様根拠: parser-system.md §A 概要「Scene 別コンテキストマッピング」(L33-43)
        // CR-SA-23-E2 / 2026-07-08: HR ON 時は解析対象を「抽選対象者のみ」に絞る（scene2-gate.md Error Handling
        // + houserule-features.md §9.5）。Parser には全 participants を渡し（名前一致判定用）、以降のカウント
        // 判定・空き枠充当のみ raffleTargets を基準にする。
        const { results, errors } = ParserFactory.getParser(inputText).parse(inputText, participants, 'RACE');
        // CR-SA-23-E2 / 2026-07-08: 手動指定者のダイス行が誤って混入した場合、抽選対象者以外の
        // parse 結果は無視する（scene2-gate.md §3「余剰は無視」方針 + houserule-features.md §9.5）。
        const raffleTargetIds = new Set(raffleTargets.map(p => p.id));
        const filteredResults = enableManualGate
            ? results.filter(r => raffleTargetIds.has(r.participantId))
            : results;
        const newErrors: string[] = [...errors];

        // Critical Validations
        // 1. Participant Count Match
        // Logic refinement: If input non-empty line count equals participants count,
        // suppress "count mismatch" error because likely it's a "name mismatch" case (handled by StandardParser).
        const inputLineCount = inputText.split('\n').filter(l => l.trim().length > 0).length;
        // CR-SA-23-E2 / 2026-07-08: HR ON 時は「抽選対象人数」を基準に判定文言も差し替え。
        const expectedCount = raffleTargets.length;

        if (filteredResults.length !== expectedCount) {
            // Only show count mismatch if input lines explicitly do not match expected count
            if (inputLineCount !== expectedCount) {
                // CR-14: 未検出者の名前一覧をエラーメッセージに追記する。
                // CR-SA-23-E2 / 2026-07-08: HR ON 時は抽選対象者のみを対象に未検出判定（scene2-gate.md L228）。
                const undetectedNames = getUndetectedParticipantNames(
                    enableManualGate ? raffleTargets : participants,
                    filteredResults,
                );
                const undetectedSuffix = undetectedNames.length > 0
                    ? ` 未検出: ${undetectedNames.join(', ')}`
                    : '';
                if (enableManualGate) {
                    // scene2-gate.md Error Handling L214 SSoT
                    newErrors.push(`・ダイス結果が不足しています（抽選対象: ${expectedCount}人 / 検出: ${filteredResults.length}人）。コピー漏れがないか確認してください${undetectedSuffix}`);
                } else {
                    newErrors.push(`人数が一致しません (登録: ${expectedCount}人 / 検出: ${filteredResults.length}人)。コピー漏れがないか確認してください${undetectedSuffix}`);
                }
            }
        }

        // 2. Name Match is handled by StandardParser (it returns error if name not found)

        // 3. Checksum Match is handled by StandardParser

        if (newErrors.length > 0) {
            setParseErrors(newErrors);
            // CR-5a-2: 解析失敗時は前回成功結果を残さない（最新結果と誤認するリスク回避、scene2-gate.md §3）
            setGateAssignments(null);
            return;
        }

        // CR-SA-23-E2 / 2026-07-08: 空き枠充当ロジック（scene2-gate.md §2 L184-186 + houserule-features.md §9.6）。
        // HR OFF 時は既存全員抽選ロジックと同一動作（tie-breaker: エントリー順昇順）。
        // HR ON 時は手動指定枠を先に確保し、残り枠を出目昇順で抽選者に充当する。
        const rolls = filteredResults.map(res => ({
            id: res.participantId,
            roll: res.diceResult,
        }));
        const finalAssignments = assignGatesWithManualHold(
            participants,
            rolls,
            enableManualGate,
        );

        setParseErrors([]);
        setGateAssignments(finalAssignments);
    };

    // CR-SA-23-E2 / 2026-07-08: [2a] プルダウン変更ハンドラ（既存 updateParticipant 経由、Engineer 裁量）
    const handleManualGateChange = (participantId: string, value: number | null) => {
        updateParticipant(participantId, { manualGate: value });
    };

    // [4] Confirm & Navigate
    const handleConfirm = () => {
        if (!displayAssignments) return;
        applyGateAssignments(displayAssignments.map(a => ({ id: a.id, gate: a.gate })));
        startRace();
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">

            {/* Header / Nav */}
            <div className="flex items-center justify-between">
                <button
                    onClick={moveToSetup}
                    className="p-2 -ml-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center gap-1"
                    title="設定画面に戻る"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span className="text-sm font-medium">戻る</span>
                </button>

                <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-full px-4 py-2 shadow-sm">
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">現在フェーズ: </span>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 ml-2">【 枠順抽選 】</span>
                </div>
                <div className="w-16"></div> {/* Spacer for center alignment */}
            </div>

            {/* [1] Confirm Entry */}
            <section className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">1</span>
                        エントリー内容確認 (Confirm Entry)
                    </h3>
                </div>
                <div className="p-5 space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        以下のリストを掲示板に投稿し、参加者に登録内容の確認を促します。
                    </p>
                    <div className="relative group">
                        <textarea
                            readOnly
                            value={entryListText}
                            className="w-full h-32 p-3 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 resize-none focus:outline-none"
                            onClick={(e) => e.currentTarget.select()}
                        />
                        <CopyButton text={entryListText} sectionId="entry" label="確認用リストをコピー" />
                    </div>
                </div>
            </section>

            {/* [2a] Manual Gate Assignment (HR ON のみ表示、CR-SA-23-E2 / scene2-gate.md §1.2) */}
            {enableManualGate && (
                <section className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 w-8 h-6 rounded-full flex items-center justify-center text-xs font-mono">2a</span>
                            枠番手動指定 (Manual Gate Assignment)
                        </h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            タッグ確定済の出走者に固定枠を指定します。未指定の出走者のみが下のダイスで抽選されます。
                        </p>
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400">
                                    <tr>
                                        <th className="px-4 py-2 text-center w-16">No</th>
                                        <th className="px-4 py-2">名前</th>
                                        <th className="px-4 py-2 text-right w-40">固定枠</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                    {participants.map((p, i) => {
                                        const options = getManualGateOptions(participants, p.id, participants.length);
                                        const currentValue = typeof p.manualGate === 'number' ? p.manualGate : '';
                                        return (
                                            <tr key={p.id}>
                                                <td className="px-4 py-2 text-center font-mono text-slate-500 dark:text-slate-400">{i + 1}</td>
                                                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{p.name}</td>
                                                <td className="px-4 py-2 text-right">
                                                    <select
                                                        aria-label={`${p.name} の固定枠`}
                                                        value={currentValue === '' ? '' : String(currentValue)}
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            handleManualGateChange(p.id, raw === '' ? null : Number(raw));
                                                        }}
                                                        className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                    >
                                                        {options.map((g) => (
                                                            <option key={g === null ? 'none' : g} value={g === null ? '' : String(g)}>
                                                                {g === null ? '---' : `${g} 枠`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            )}

            {/* [2b] Output Dice — HR ON × 全員手動指定時は非表示（CR-SA-23-E2 / houserule-features.md §9.7） */}
            {!allManuallyAssigned && (
                <section className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 w-8 h-6 rounded-full flex items-center justify-center text-xs font-mono">{enableManualGate ? '2b' : '2'}</span>
                            枠順抽選ダイス出力 (Output Dice)
                        </h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {enableManualGate
                                ? '未指定の出走者のダイスを出力します。'
                                : '確認完了後、枠順を決めるためのダイスを出力します。'}
                        </p>
                        <div className="relative group">
                            <textarea
                                readOnly
                                value={diceOutputTemplate}
                                className="w-full h-32 p-3 text-sm font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 resize-none focus:outline-none"
                                onClick={(e) => e.currentTarget.select()}
                            />
                            <CopyButton text={diceOutputTemplate} sectionId="dice" label="ダイスリストをコピー" />
                        </div>
                    </div>
                </section>
            )}

            {/* [3] Result Paste — HR ON × 全員手動指定時は非表示 */}
            {!allManuallyAssigned && (
                <section className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">3</span>
                            結果取り込み (Paste Area)
                        </h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="ここに掲示板のレスを丸ごと貼り付けてください..."
                            className="w-full h-40 p-3 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-400"
                        />

                        <button
                            onClick={handleParse}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold rounded-lg transition-colors shadow-lg shadow-indigo-500/20 border-b-4 border-indigo-700 hover:border-indigo-600 dark:border-indigo-700 active:border-b-0 active:translate-y-1"
                        >
                            <Dices className="w-5 h-5" />
                            解析実行
                        </button>

                        <NotificationArea
                            errors={parseErrors}
                            defaultMessage="ℹ️ ダイス結果を貼り付けて「解析実行」を押してください。"
                            className="mt-4"
                        />
                    </div>
                </section>
            )}

            {/* 全員手動指定時の情報表示（scene2-gate.md §2 L118-121 SSoT） */}
            {allManuallyAssigned && (
                <div className="rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/60 dark:bg-indigo-900/20 px-4 py-3 text-sm text-indigo-800 dark:text-indigo-200">
                    ℹ️ 全員に固定枠を指定したため、そのままレース開始できます。
                </div>
            )}

            {/* [4] Result List - Only visible after parsing */}
            {displayAssignments && (
                <section className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-2 border-indigo-500/30 dark:border-indigo-400/30 rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4">
                    <div className="p-4 border-b border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/20 flex justify-between items-center">
                        <h3 className="font-bold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                            <span className="bg-indigo-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">4</span>
                            枠順確定リスト (Result List)
                        </h3>
                    </div>
                    <div className="p-5 space-y-6">
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400">
                                    <tr>
                                        <th className="px-4 py-2 text-center w-16">No</th>
                                        <th className="px-4 py-2">名前</th>
                                        <th className="px-4 py-2 text-right">出目</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900">
                                    {displayAssignments.map((a) => (
                                        <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-2 text-center">
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-sm font-mono border border-indigo-200 dark:border-indigo-700/50">
                                                    {a.gate}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">
                                                {a.name}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-slate-500 dark:text-slate-500">
                                                {/* CR-SA-23-E2 / 2026-07-08: 手動指定者 = null → '指定枠' / 抽選 = 出目 / legacy = '---' */}
                                                {a.roll === null ? '指定枠' : a.roll === 0 ? '---' : a.roll}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    // CR-SA-23-E2 / 2026-07-08: 手動指定者 = `(指定枠)` / 抽選者 = `(出目: N)` /
                                    // legacy 復元経路（roll=0） = `(出目: ---)`（scene2-gate.md §2 L184-186 SSoT）
                                    const text = displayAssignments.map(a => {
                                        const rollLabel =
                                            a.roll === null
                                                ? '(指定枠)'
                                                : a.roll === 0
                                                    ? '(出目: ---)'
                                                    : `(出目: ${a.roll})`;
                                        return `${getCircleNumber(a.gate)} ${a.name} ${rollLabel}`;
                                    }).join('\n');
                                    handleCopy(text, 'result');
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-colors ${copiedSection === 'result'
                                    ? 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white'
                                    : 'bg-slate-600 hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-600 text-white'
                                    }`}
                            >
                                {copiedSection === 'result' ? <CheckCircle2 className="w-5 h-5" /> : <ClipboardCopy className="w-5 h-5" />}
                                {copiedSection === 'result' ? 'コピーしました' : '確定リストをコピー'}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-[2] flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-bold rounded-lg transition-colors shadow-lg shadow-indigo-500/20 border-b-4 border-indigo-700 hover:border-indigo-600 dark:border-indigo-700 active:border-b-0 active:translate-y-1"
                            >
                                <span>枠順を確定してレース開始</span>
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
};


