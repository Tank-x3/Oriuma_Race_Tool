import React, { useState } from 'react';
import { Flag, PlayCircle, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRaceEngine } from '../../hooks/useRaceEngine';
import { useRaceStore } from '../../store/useRaceStore';
import { Calculator } from '../../core/calculator';
import { RankingCalculator } from '../../core/logic/RankingCalculator';
import { PhaseOutput } from './race/PhaseOutput';
import { PhaseInput } from './race/PhaseInput';
import { RaceDashboard } from './race/RaceDashboard';
import { clsx } from 'clsx';
import { NotificationArea } from '../ui/NotificationArea';
// import { HouseRuleModal } from './HouseRuleModal'; // To be implemented later

export const RaceScene: React.FC = () => {
    const {
        currentPhaseId,
        getPhaseLabel,
        nextPhase,
        prevPhase,
        isLastPhase,
        isFirstPhase,
    } = useRaceEngine();

    const {
        paceResult,
        participants,
        strategies,
        updateParticipant,
        resetRace,
        moveToJudgment,
        moveToResult,
        moveToGate // Added
    } = useRaceStore();

    // const [showHouseRule, setShowHouseRule] = useState(false);

    // State for embedded error display
    const [phaseErrors, setPhaseErrors] = useState<string[]>([]);

    // Scroll to top on phase change
    React.useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentPhaseId]);

    // Scroll to top when errors occur (Auto-scroll to error message)
    React.useEffect(() => {
        if (phaseErrors.length > 0) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [phaseErrors]);

    // Navigation Handlers
    const handleNext = () => {
        // Validation: Cannot proceed from Pace if not determined
        if (currentPhaseId === 'Pace' && !paceResult.face) {
            setPhaseErrors(['ペース判定が完了していません。ダイス結果を貼り付けて解析してください。']);
            return;
        }

        // Validation: Cannot proceed from Race Phases (Start/Mid/End) if not analyzed
        if (currentPhaseId !== 'Pace') {
            // 1. Consistency Check (Config Changes vs History)
            const hasMismatch = participants.some(p => {
                const history = p.history[currentPhaseId];
                if (!history) return false; // Missing handled below

                // Base Dice Check
                const strategy = strategies.find(s => s.name === p.strategy);
                if (strategy) {
                    // Normalize: expected "-1d27" -> "1d27"
                    // History diceStr usually stores the "XdY" part (without sign)
                    let rawExp = '';
                    if (currentPhaseId === 'Start') rawExp = strategy.dice.start;
                    else if (currentPhaseId.startsWith('Mid')) rawExp = strategy.dice.mid;
                    else if (currentPhaseId === 'End') rawExp = strategy.dice.end;

                    if (rawExp) {
                        const expClean = rawExp.replace('-', '');
                        if (history.baseDice?.diceStr !== expClean) return true;
                    }
                }

                // Unique Dice Check
                const pPhases = p.uniqueSkill.phases;
                let shouldHave = false;
                if (pPhases.includes(currentPhaseId)) shouldHave = true;
                else if (pPhases.includes(getPhaseLabel(currentPhaseId))) shouldHave = true;
                else if (currentPhaseId.startsWith('Mid') && (pPhases.includes('Mid') || pPhases.includes('中盤'))) shouldHave = true;

                const hasUnique = !!history.uniqueDice;
                if (shouldHave !== hasUnique) return true;
                if (shouldHave && hasUnique) {
                    let expU = "";
                    if (p.uniqueSkill.type === 'Stability') expU = "1d10";
                    if (p.uniqueSkill.type === 'Gamble') expU = "1d20";
                    if (p.uniqueSkill.type === 'Persistent') expU = "1d10";
                    if (history.uniqueDice?.diceStr !== expU) return true;
                }

                return false;
            });

            if (hasMismatch) {
                setPhaseErrors(['設定変更によりダイス形式が不一致となっている参加者がいます。修正分のみ再出力して振り直してください。']);
                return;
            }

            // Check if at least one participant has history for this phase
            // (Assuming batch analysis updates everyone or most)
            const hasResult = participants.some(p => p.history[currentPhaseId]);
            if (!hasResult) {
                setPhaseErrors([`${getPhaseLabel(currentPhaseId)}の結果が集計されていません。ダイス結果を貼り付けて[解析実行]を押してください。`]);
                return;
            }
        }

        // Clear previous errors if proceeding
        setPhaseErrors([]);

        // Logic: Transitioning FROM Pace -> Next (Mid)
        // Recalculate all scores to include Pace Modifier
        if (currentPhaseId === 'Pace') {
            let updatedCount = 0;
            participants.forEach(p => {
                const totalScore = Calculator.calculateTotalScore(
                    p,
                    strategies,
                    paceResult.face
                );
                // Only update if changed (optimization)
                if (totalScore !== p.score) {
                    updateParticipant(p.id, { score: totalScore });
                    updatedCount++;
                }
            });
            console.log(`Pace transition: Updated ${updatedCount} participants.`);
        }

        if (isLastPhase) {
            // Check if judgment is needed
            const judgments = RankingCalculator.detectJudgmentNeeds(participants);
            if (judgments.length > 0) {
                moveToJudgment();
            } else {
                moveToResult();
            }
        } else {
            nextPhase();
        }
    };

    const handleBack = () => {
        if (isFirstPhase) {
            // Back to Gate Scene
            moveToGate();
        } else {
            prevPhase();
        }
    };

    const handleReset = () => {
        if (confirm('現在のレース結果を破棄して、新しいレースを始めますか？')) {
            resetRace();
            // window.location.reload(); // Removed fallback as resetRace is now available
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Header / Info Bar (Scene 1/2 Consistency) */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 transition-colors">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-1 px-3 py-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="前のフェーズ/シーンに戻って修正する"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-sm font-medium hidden sm:inline">内容修正へ</span>
                    </button>

                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Flag className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                            レース進行中
                        </h2>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <PlayCircle className="w-4 h-4" />
                            現在フェーズ:
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 rounded">
                                {getPhaseLabel(currentPhaseId)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleReset}
                        className="px-3 py-2 text-xs text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 transition-colors flex items-center gap-1 opacity-60 hover:opacity-100"
                        title="最初からやり直す"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">やり直す</span>
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-12 gap-6">
                {/* Left Column: Input & Output (Wireframe Section [1] & [2]) */}
                <div className="lg:col-span-5 space-y-6">
                    {/* [1] Output Dice */}
                    <PhaseOutput />

                    {/* [2] Paste Area */}
                    <PhaseInput onErrors={setPhaseErrors} />

                    {/* [Embed] Notification Area for Scene 3 */}
                    <NotificationArea
                        errors={phaseErrors}
                        defaultMessage="ダイス結果を貼り付けて「解析実行」を押してください。"
                    />
                </div>

                {/* Right Column: Dashboard (Wireframe Section [3]) */}
                <div className="lg:col-span-7 space-y-6">
                    {/* [3] Result Dashboard */}
                    <RaceDashboard />

                    {/* Navigation Footer for Phase */}
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleNext}
                            className={clsx(
                                "px-6 py-3 text-white font-bold rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2",
                                isLastPhase
                                    ? "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                                    : "bg-indigo-600 hover:bg-indigo-700"
                            )}
                        >
                            {isLastPhase ? '最終結果判定へ' : '次のフェーズへ'}
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals will go here */}
            {/* {showHouseRule && <HouseRuleModal onClose={() => setShowHouseRule(false)} />} */}
        </div>
    );
};
