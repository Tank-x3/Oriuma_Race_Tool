import { useState, useMemo, useEffect } from 'react';
import { useRaceStore } from '../../store/useRaceStore';
import { RankingCalculator } from '../../core/logic/RankingCalculator';
import { StandardParser } from '../../core/parser/standardParser';
import { Check, Copy, AlertCircle, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';

export const JudgmentScene = () => {
  const { participants, updateParticipant, moveToResult, setCurrentPhase } = useRaceStore();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedDice, setCopiedDice] = useState(false);
  const [copiedList, setCopiedList] = useState(false);

  // Detect what judgments are needed
  const judgmentRequests = useMemo(() => {
    return RankingCalculator.detectJudgmentNeeds(participants);
  }, [participants]);

  // If no judgments needed, auto-move to result
  useEffect(() => {
    if (judgmentRequests.length === 0) {
      moveToResult();
    }
  }, [judgmentRequests, moveToResult]);

  const sortedParticipants = useMemo(() =>
    RankingCalculator.sortParticipants(participants),
    [participants]);

  const generateDiceText = () => {
    let text = "";

    // Photo Judgment
    const photoReqs = judgmentRequests.filter(r => r.type === 'photo');
    if (photoReqs.length > 0) {
      text += "【写真判定】1d5で判定します。数値が大きい方が先着、同値は同着\n";
      photoReqs.forEach(req => {
        req.targetIds.forEach(id => {
          const p = participants.find(part => part.id === id);
          if (p) text += `${p.name} dice${req.diceType}=\n`;
        });
        text += "\n";
      });
    }

    // Margin Judgment
    const marginReqs = judgmentRequests.filter(r => r.type === 'margin');
    if (marginReqs.length > 0) {
      text += "【着差判定】1d2で判定します。1. アタマ 2. クビ\n";
      marginReqs.forEach(req => {
        // req.description is "【着差判定】NameA vs NameB"
        // We want output: "NameA vs NameB dice1d2="
        // Let's strip "【着差判定】" from description if present.
        const desc = req.description.replace('【着差判定】', '').trim();
        text += `${desc} dice${req.diceType}=\n`;
      });
    }

    return text;
  };

  const copyToClipboard = (text: string, setTrigger: (b: boolean) => void) => {
    navigator.clipboard.writeText(text).then(() => {
      setTrigger(true);
      setTimeout(() => setTrigger(false), 2000);
    });
  };

  const generateProvisionalList = () => {
    return sortedParticipants.map((p, i) => `${i + 1}. ${p.name} (${p.score})`).join('\n');
  };

  const handleParse = () => {
    setError(null);
    if (!inputValue.trim()) return;

    if (!inputValue.trim()) return;

    // const parser = new StandardParser(); // Static method used now
    const lines = inputValue.split('\n');
    const results: { id: string; type: 'photo' | 'margin'; value: number }[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      if (!line.includes('dice')) continue;

      // StandardParser parses "Name dice..."
      // But for Margin, we have "NameA vs NameB dice..."
      // StandardParser returns name="NameA vs NameB".
      // We need to check if this name matches any JudgmentRequest description.

      // Parse using StandardParser. Pass 'RACE' context explicitly.
      // StandardParser might fail validation if we pass `participants` and "NameA vs NameB" is not in list.
      // So we should NOT pass `participants` validation list if we want to extract raw name.
      // We can pass empty array or null if parser supports it.
      // Actually StandardParser.parse(line, participants) tries to match.
      // If we pass participants, and name is "A vs B", it won't find it.
      // But we can parse WITHOUT validation to get the Name string.
      // StandardParser.parse(line) - uses default no-validation?
      // Let's check `StandardParser`. It allows optional participants.

      // Use dedicated judgment parser which parses "Name... dice..." without strict validation
      const parseResult = StandardParser.parseJudgment(line);
      const parsed = parseResult.results[0];

      if (!parsed) {
        continue;
      }

      const diceStr = parsed.diceStr;
      const val = parsed.diceResult;

      // Identify Judgment Type
      if (diceStr.includes('d5')) {
        // Photo Judgment: Name should match a participant
        const p = participants.find(u => u.name === parsed.name.trim());
        if (!p) {
          // Fallback: Use standard parser with strict validation to fuzzy match or finding by ID if possible
          const resWithValidation = StandardParser.parse(line, participants, 'RACE');
          const validParsed = resWithValidation.results[0];
          if (validParsed && validParsed.participantId) {
            const pValid = participants.find(u => u.id === validParsed.participantId);
            if (pValid) {
              if (val < 1 || val > 5) {
                errors.push(`${pValid.name}のダイス値異常: ${val} (1-5の範囲外です)`);
              } else {
                results.push({ id: pValid.id, type: 'photo', value: val });
              }
              continue;
            }
          }
          errors.push(`参加者が見つかりません: ${parsed.name}`);
        } else {
          if (val < 1 || val > 5) {
            errors.push(`${p.name}のダイス値異常: ${val} (1-5の範囲外です)`);
          } else {
            results.push({ id: p.id, type: 'photo', value: val });
          }
        }

      } else if (diceStr.includes('d2')) {
        // Margin Judgment: Name is "NameA vs NameB"
        // We need to find which request matches this description.
        const desc = parsed.name.trim(); // "NameA vs NameB"

        // Find request where description (minus prefix) matches
        const matchReq = judgmentRequests.find(r => r.type === 'margin' && r.description.includes(desc));

        if (!matchReq) {
          // Maybe strict match failed?
          // Tried to match "A vs B" against "【着差判定】A vs B".
          // `includes` should work.
          errors.push(`該当する着差判定が見つかりません: ${desc}`);
        } else {
          if (val < 1 || val > 2) {
            errors.push(`着差判定のダイス値異常: ${val} (1-2の範囲外です)`);
          } else {
            // We found the request. We need to apply this result to the Representative.
            results.push({ id: matchReq.representativeId, type: 'margin', value: val });
          }
        }
      } else {
        errors.push(`不正なダイス種別です: ${diceStr} (予期: 1d5, 1d2)`);
      }
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }

    // Validate Completeness
    const currentUpdates = new Map<string, { photo?: number, margin?: number }>();
    results.forEach(res => {
      const current = currentUpdates.get(res.id) || { ...participants.find(p => p.id === res.id)?.judgment };
      if (res.type === 'photo') current.photo = res.value;
      if (res.type === 'margin') current.margin = res.value;
      currentUpdates.set(res.id, current);
    });

    const missing: string[] = [];
    judgmentRequests.forEach(req => {
      if (req.type === 'photo') {
        req.targetIds.forEach(targetId => {
          const data = currentUpdates.get(targetId) || participants.find(p => p.id === targetId)?.judgment;
          if (data?.photo === undefined) {
            const name = participants.find(p => p.id === targetId)?.name;
            missing.push(`${name} (写真判定 1d5)`);
          }
        });
      } else if (req.type === 'margin') {
        const repId = req.representativeId;
        const data = currentUpdates.get(repId) || participants.find(p => p.id === repId)?.judgment;
        if (data?.margin === undefined) {
          const name = participants.find(p => p.id === repId)?.name;
          missing.push(`${name} (着差判定 1d2)`);
        }
      }
    });

    if (missing.length > 0) {
      setError(`データが不足しています（または解析できませんでした）:\n${missing.join(', ')}\n\n入力形式が正しいか確認してください（例: 名前 dice1d5=3）`);
      return;
    }

    // Apply Updates
    currentUpdates.forEach((data, id) => {
      updateParticipant(id, { judgment: data });
    });

    moveToResult();
  };

  const handleBack = () => {
    setCurrentPhase('End');
    useRaceStore.setState(s => ({ uiState: { ...s.uiState, scene: 'race' } }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center pb-4 border-b">
        <button onClick={handleBack} className="text-gray-500 hover:text-gray-900 flex items-center gap-1 font-medium transition-colors">
          &lt; レース画面(最終フェーズ)に戻る
        </button>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-yellow-600" />
          最終結果判定
        </h2>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg shadow-sm">
        <p className="font-bold text-yellow-800 text-lg">⚠️ 判定が必要です</p>
        <p className="text-yellow-700 mt-1">
          スコア同点（写真判定）または 1点差（着差判定）が発生しました。<br />
          指示に従ってダイスを振り、結果を入力してください。
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* [1] Provisional Ranking */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold !text-slate-800 dark:!text-slate-200 flex items-center gap-2">
              <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">1</span>
              暫定順位リスト
            </h3>
            <button
              onClick={() => copyToClipboard(generateProvisionalList(), setCopiedList)}
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                copiedList ? "bg-green-100 text-green-700" : "bg-white border text-gray-600 hover:bg-gray-50"
              )}
            >
              {copiedList ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedList ? "コピー完了" : "リストをコピー"}
            </button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto max-h-60 bg-gray-50/50">
            <div className="space-y-1 text-sm font-mono text-gray-800">
              {sortedParticipants.map((p, i) => (
                <div key={p.id} className="flex gap-2 p-1 border-b border-gray-100 last:border-0">
                  <span className="w-6 text-right font-bold text-gray-400">{i + 1}.</span>
                  <span>{p.name} <span className="text-gray-500">({p.score})</span></span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-2 text-center text-xs text-gray-400 border-t bg-gray-50">
            掲示板に貼り付けて、判定対象者がいることを周知してください。
          </div>
        </div>

        {/* [2] Dice Output */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold !text-slate-800 dark:!text-slate-200 flex items-center gap-2">
              <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">2</span>
              判定用ダイス出力
            </h3>
            <button
              onClick={() => copyToClipboard(generateDiceText(), setCopiedDice)}
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                copiedDice ? "bg-green-100 text-green-700" : "bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100"
              )}
            >
              {copiedDice ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedDice ? "コピー完了" : "ダイス指示をコピー"}
            </button>
          </div>
          <textarea
            readOnly
            className="flex-1 w-full p-4 bg-gray-50 text-sm font-mono resize-none focus:outline-none"
            value={generateDiceText()}
          />
        </div>
      </div>

      {/* [3] Input Area */}
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-100">
          <h3 className="font-bold !text-slate-800 dark:!text-slate-200 flex items-center gap-2">
            <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">3</span>
            判定結果取り込み
          </h3>
          <p className="text-xs text-gray-500 mt-1 pl-8">掲示板のダイス結果レスをそのまま貼り付けてください。</p>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm whitespace-pre-wrap flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <textarea
            className="w-full h-32 p-4 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
            placeholder="例: &#13;&#10;ウマ娘A 🎲 dice1d5= 3 (2) &#13;&#10;ウマ娘B 🎲 dice1d5= 5 (4)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />

          <button
            onClick={handleParse}
            disabled={!inputValue.trim()}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-lg"
          >
            判定を適用して最終結果へ
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
