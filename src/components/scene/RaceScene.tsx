import React, { useState } from 'react';
import { Flag, PlayCircle, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRaceEngine } from '../../hooks/useRaceEngine';
import { useRaceStore } from '../../store/useRaceStore';
import { Calculator, getActivePhaseIdsForConfig } from '../../core/calculator';
import { RankingCalculator } from '../../core/logic/RankingCalculator';
import { PhaseOutput } from './race/PhaseOutput';
import { PhaseInput } from './race/PhaseInput';
import { RaceDashboard } from './race/RaceDashboard';
import { NotificationArea } from '../ui/NotificationArea';
// Bundle-2 / D-1, D-14 / 2026-05-09: 拡張固有タイプ含む 5 種すべての期待ダイス式を helpers から取得
import { getExpectedUniqueDiceStr } from './race/phaseOutput.helpers';
// import { HouseRuleModal } from './HouseRuleModal'; // To be implemented later

export const RaceScene: React.FC = () => {
    const {
        currentPhaseId,
        getPhaseLabel,
        nextPhase,
        prevPhase,
        isLastPhase,
        isFirstPhase,
        // CR-SA-20-E4 / 2026-06-11: 遷移先フェーズの事前判定（隊列フェーズ到達前の禁止構成検出）に使用
        phaseSequence,
        currentIndex,
    } = useRaceEngine();

    const {
        paceResult,
        // CR-SA-20-E4 / 2026-06-11: 隊列確定結果（未確定ブロック + 遷移時の補正反映に使用）
        formationResult,
        participants,
        strategies,
        config,
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

        // CR-SA-20-E4 / 2026-06-11: 隊列フェーズの未確定ブロック（ペース判定と同型）。
        if (currentPhaseId === 'Formation' && !formationResult.face) {
            setPhaseErrors(['隊列判定が完了していません。ダイス結果を貼り付けて解析してください。']);
            return;
        }

        // CR-SA-20-E4 / 2026-06-11: Scene 3 側の禁止構成検出（houserule-features.md §7.6
        // 「フェーズ進行時（隊列フェーズ到達前）」= 最終防衛線）。隊列 ON × ペースなし等で
        // 「次のフェーズが隊列なのにペース未確定」となる構成は、Scene 1 確定ブロック（E3）を
        // すり抜けた Import / state 復元由来でのみ発生しうる。隊列効果はペース結果を参照する
        // （§6.3）ため、ここでクリティカルエラーとして進行をブロックする（文言 = L301 流用）。
        const upcomingPhaseId =
            !isLastPhase && currentIndex >= 0 ? phaseSequence[currentIndex + 1] : null;
        if (upcomingPhaseId === 'Formation' && paceResult.face === null) {
            setPhaseErrors(['・隊列(バ群)ダイスを使用する場合はペースが必要です。ペース位置を「なし」以外にするか、隊列ダイスをオフにしてください']);
            return;
        }

        // Validation: Cannot proceed from Race Phases (Start/Mid/End) if not analyzed
        // CR-SA-20-E4 / 2026-06-11: 隊列フェーズも GM ダイス専用（participants の history を持たない）
        // ため、ペースと同様に整合チェック・取り込み済みチェックの対象外とする。
        if (currentPhaseId !== 'Pace' && currentPhaseId !== 'Formation') {
            // 1. Consistency Check (Config Changes vs History)
            const hasMismatch = participants.some(p => {
                const history = p.history[currentPhaseId];
                if (!history) return false; // Missing handled below

                // Base Dice Check
                const strategy = strategies.find(s => s.name === p.strategy);
                if (strategy) {
                    // Normalize: expected "-1d27" -> "1d27"
                    // History diceStr usually stores the "XdY" part (without sign)
                    // CR-SA-17-E4 / 2026-06-08: 可変序盤・終盤（Start1/End1…）対応。
                    let rawExp = '';
                    if (currentPhaseId.startsWith('Start')) rawExp = strategy.dice.start;
                    else if (currentPhaseId.startsWith('Mid')) rawExp = strategy.dice.mid;
                    else if (currentPhaseId.startsWith('End')) rawExp = strategy.dice.end;

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
                    // Bundle-2 / D-1, D-14 / 2026-05-09: 拡張固有タイプ含む 5 種を helpers 経由で取得
                    // CR-SA-15-E2 / 2026-05-15: 固有期待ダイス式を houseRules.uniqueDiceConfig 参照化
                    const expU = getExpectedUniqueDiceStr(p.uniqueSkill.type, config.houseRules.uniqueDiceConfig);
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
        // CR-SA-20-E4 / 2026-06-11: 隊列フェーズからの遷移時も同方式で再計算する（§6.5「隊列直後
        // フェーズへ遷移する瞬間に 1 回加算」）。計算は履歴全再構築のため二重加算は発生せず、
        // 中盤 0/1 回構成（ペース → 隊列が連続）では Pace 遷移時にペース補正、Formation 遷移時に
        // 隊列補正が順に反映され、両補正が当該フェーズ基礎値に合算される（§6.5 ペース補正との累積）。
        if (currentPhaseId === 'Pace' || currentPhaseId === 'Formation') {
            let updatedCount = 0;
            // CR-SA-20-E4 / 2026-06-11: 隊列補正は「隊列フェーズから出る遷移」でのみ反映する
            //（§6.5「隊列直後フェーズへ遷移する瞬間に 1 回加算」）。Pace から出る遷移の先は
            // 「ペースは隊列より前」の不変ルールにより常に隊列フェーズ以前のため、Pace 遷移では
            // 隊列補正を乗せない（戻る操作後の再進行〔出目確定済み × ペース → 隊列〕で隊列フェーズ
            // 自体に補正が先乗りするのを防ぐ）。OFF 時は値が残っていても渡さない（OFF 透過）。
            const formationFace =
                config.houseRules.enableFormationDice && currentPhaseId === 'Formation'
                    ? formationResult.face
                    : null;
            participants.forEach(p => {
                // CR-SA-15-E2 / 2026-05-15: 固有固定値を houseRules.uniqueDiceConfig 参照化
                const totalScore = Calculator.calculateTotalScore(
                    p,
                    strategies,
                    paceResult.face,
                    getActivePhaseIdsForConfig(config),
                    config.houseRules.uniqueDiceConfig,
                    formationFace
                );
                // Only update if changed (optimization)
                if (totalScore !== p.score) {
                    updateParticipant(p.id, { score: totalScore });
                    updatedCount++;
                }
            });
            console.log(`${currentPhaseId} transition: Updated ${updatedCount} participants.`);
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
                            className="px-6 py-3 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
