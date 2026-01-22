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
        moveToResult
    } = useRaceStore();

    // const [showHouseRule, setShowHouseRule] = useState(false);

    // State for embedded error display
    const [phaseErrors, setPhaseErrors] = useState<string[]>([]);

    // Navigation Handlers
    const handleNext = () => {
        // Validation: Cannot proceed from Pace if not determined
        if (currentPhaseId === 'Pace' && !paceResult.face) {
            setPhaseErrors(['ペース判定が完了していません。ダイス結果を貼り付けて解析してください。']);
            return;
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
        // Warning if data might be lost? Or logic handles restore.
        prevPhase();
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
                        disabled={isFirstPhase}
                        className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="戻る"
                    >
                        <ChevronLeft className="w-6 h-6" />
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
                        className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        やり直す
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
