import React, { useState, useMemo } from 'react';
import { useRaceStore } from '../../store/useRaceStore';
import { Dices, ClipboardCopy, ArrowRight, CheckCircle2 } from 'lucide-react';
import { StandardParser } from '../../core/parser/standardParser';
import { NotificationArea } from '../ui/NotificationArea';

// Helper for Circle Numbers (①, ②...)
const getCircleNumber = (num: number): string => {
    if (num >= 1 && num <= 20) {
        return String.fromCodePoint(0x2460 + num - 1);
    }
    return `(${num})`;
};

export const GateScene: React.FC = () => {
    const { participants, applyGateAssignments, startRace } = useRaceStore();
    const [inputText, setInputText] = useState('');
    const [parseErrors, setParseErrors] = useState<string[]>([]);
    const [assignments, setAssignments] = useState<{ id: string; name: string; roll: number; gate: number }[] | null>(null);
    const [copiedSection, setCopiedSection] = useState<string | null>(null);

    // [1] Entry Confirmation List
    const entryListText = useMemo(() => {
        const typeMap: Record<string, string> = {
            'Stability': '安定',
            'Gamble': 'ギャンブル',
            'Persistent': '持続'
        };
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
            const typeLabel = typeMap[p.uniqueSkill.type] || p.uniqueSkill.type;
            const phaseStr = p.uniqueSkill.phases.map(getPhaseLabel).join(',') || '---';
            return `${index}. ${p.name} (${p.strategy} / ${typeLabel} / ${phaseStr})`;
        }).join('\n');
    }, [participants]);

    // [2] Main Dice Output Template
    const diceOutputTemplate = useMemo(() => {
        // Updated to use Full-width space (U+3000) as separator
        return participants.map(p => `${p.name}\u3000dice1d100=`).join('\n');
    }, [participants]);

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
        const { results, errors } = StandardParser.parse(inputText, participants);
        const newErrors: string[] = [...errors];

        // Critical Validations
        // 1. Participant Count Match
        // Logic refinement: If input non-empty line count equals participants count, 
        // suppress "count mismatch" error because likely it's a "name mismatch" case (handled by StandardParser).
        const inputLineCount = inputText.split('\n').filter(l => l.trim().length > 0).length;

        if (results.length !== participants.length) {
            // Only show count mismatch if input lines explicitly do not match participants
            if (inputLineCount !== participants.length) {
                newErrors.push(`人数が一致しません (登録: ${participants.length}人 / 検出: ${results.length}人)。コピー漏れがないか確認してください`);
            }
        }

        // 2. Name Match is handled by StandardParser (it returns error if name not found)

        // 3. Checksum Match is handled by StandardParser

        if (newErrors.length > 0) {
            setParseErrors(newErrors);
            setAssignments(null);
            return;
        }

        // 4. Sort Logic
        // Rule: Dice Value ASC -> Entry Index ASC
        const sorted = [...results].sort((a, b) => {
            if (a.diceResult !== b.diceResult) {
                return a.diceResult - b.diceResult; // ASC (Smaller is Inner Gate 1)
            }
            // Tie-breaker: Entry Index
            const pA = participants.find(p => p.id === a.participantId);
            const pB = participants.find(p => p.id === b.participantId);
            const idxA = pA?.entryIndex ?? 0;
            const idxB = pB?.entryIndex ?? 0;
            return idxA - idxB; // ASC
        });

        // Assign Gates
        const finalAssignments = sorted.map((res, index) => ({
            id: res.participantId,
            name: res.name,
            roll: res.diceResult,
            gate: index + 1
        }));

        setParseErrors([]);
        setAssignments(finalAssignments);
    };

    // [4] Confirm & Navigate
    const handleConfirm = () => {
        if (!assignments) return;
        applyGateAssignments(assignments.map(a => ({ id: a.id, gate: a.gate })));
        startRace();
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">

            {/* Header / Nav */}
            <div className="flex items-center justify-between">
                <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-full px-4 py-2 shadow-sm">
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400">現在フェーズ: </span>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 ml-2">【 枠順抽選 】</span>
                </div>
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

            {/* [2] Output Dice */}
            <section className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">2</span>
                        枠順抽選ダイス出力 (Output Dice)
                    </h3>
                </div>
                <div className="p-5 space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        確認完了後、枠順を決めるためのダイスを出力します。
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

            {/* [3] Result Paste */}
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
                        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-indigo-500/20 border-b-4 border-indigo-700 hover:border-indigo-600 active:border-b-0 active:translate-y-1"
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

            {/* [4] Result List - Only visible after parsing */}
            {assignments && (
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
                                    {assignments.map((a) => (
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
                                                {a.roll}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    const text = assignments.map(a => `${getCircleNumber(a.gate)} ${a.name} (出目: ${a.roll})`).join('\n');
                                    handleCopy(text, 'result');
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 border rounded-lg font-bold transition-colors ${copiedSection === 'result'
                                    ? 'bg-green-50 border-green-200 text-green-600'
                                    : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                                    }`}
                            >
                                {copiedSection === 'result' ? <CheckCircle2 className="w-5 h-5" /> : <ClipboardCopy className="w-5 h-5" />}
                                {copiedSection === 'result' ? 'コピーしました' : '確定リストをコピー'}
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-[2] flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-green-500/20 border-b-4 border-green-700 hover:border-green-600 active:border-b-0 active:translate-y-1"
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


