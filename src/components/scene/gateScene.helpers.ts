// Bundle-8-T3 / CR-SA-4 / 2026-05-10: GateScene 確認リスト併記 helpers（scene2-gate.md §2）。
// Scene 1 で事前申告した「特殊戦法 (発動位置 + 種別)」「絆スキル種別」を
// 確認用リストの基本形式末尾に併記するための純粋関数群。
// CR-SA-21+22-E3 / 2026-07-06: エントリー確認リストの固有スキル表示ラベル解決
// （scene2-gate.md §2 L82-83 SSoT、houserule-features.md §8.8）を helpers へ抽出。
// CR-SA-23-E2 / 2026-07-08: 枠順手動配置ハウスルール（houserule-features.md §9 +
// scene2-gate.md §1.2 / §2）の Scene 2 配線用純粋関数 4 個を追加
// （getEntryListManualGateLabel / getManualGateOptions / getRaffleTargets /
// assignGatesWithManualHold）。HR OFF 時は既存全員一律抽選と同一動作。
import type { RaceState, Umamusume, UniqueSkillType, CustomUniqueSkill, GateAssignment } from '../../types';

type HouseRules = RaceState['config']['houseRules'];

/**
 * CR-SA-21+22-E3 / 2026-07-06: エントリー確認リストの固有スキル表示ラベルを解決する。
 *
 * SSoT: scene2-gate.md §2 L82-83（「なし」= `(脚質 / なし / ---)` / カスタム = ユーザー命名そのまま）
 * + houserule-features.md §8.8「Scene 2 / Scene 4 への反映」。
 *
 * 判定:
 *  - 組み込み 7 タイプ: 日本語ラベル（'安定' / 'ギャンブル' / 'ギャンブルⅡ' 等）
 *  - 'None': 'なし'（§2 [v] 固有スキルなし出走者、phases=[] 経由で phaseStr='---' も自然出力）
 *  - 'Custom': `customUniqueSkills` から id 経由で `name` を lookup
 *  - Custom 参照切れ（当該 id 不在）: 現行フォールバック `'Custom'` 文字列（Scene 1 の
 *    自動リセット useEffect で本来防ぐが、防御的に視認性を優先）
 */
export const getEntryListUniqueTypeLabel = (
    type: UniqueSkillType,
    customUniqueSkillId: string | undefined,
    customUniqueSkills: readonly CustomUniqueSkill[],
): string => {
    const typeMap: Record<string, string> = {
        'Stability': '安定',
        'Gamble': 'ギャンブル',
        'Persistent': '持続',
        'SuperGamble': '超ギャンブル',
        'SuperStability': '超安定',
        'GambleII': 'ギャンブルⅡ',
        'StabilityII': '安定Ⅱ',
        'None': 'なし',
    };
    if (type === 'Custom') {
        const custom = customUniqueSkillId
            ? customUniqueSkills.find(c => c.id === customUniqueSkillId)
            : undefined;
        return custom?.name || type;
    }
    return typeMap[type] || type;
};

/**
 * 特殊戦法併記文字列を返す。
 *
 * 形式: ` [発動位置]【種別】`（先頭に半角スペース 1 個、種別は `【捲り】` / `【溜め】` 固定）。
 * 種別 / 発動位置のいずれかが null/undefined の場合は空文字列（セット入力必須、scene2-gate.md §2）。
 */
export const getSpecialStrategyAnnotation = (
    specialStrategyType: 'Makuri' | 'Tame' | null | undefined,
    specialStrategyPhase: string | null | undefined,
    getPhaseLabel: (pId: string) => string,
): string => {
    if (!specialStrategyType || !specialStrategyPhase) return '';
    const typeLabel = specialStrategyType === 'Makuri' ? '捲り' : '溜め';
    const phaseLabel = getPhaseLabel(specialStrategyPhase);
    return ` ${phaseLabel}【${typeLabel}】`;
};

/**
 * 絆スキル併記文字列を返す。
 *
 * 形式: ` 【種別】`（先頭に半角スペース 1 個、`【絆ギャンブル】` / `【絆安定】` 固定）。
 * 種別が null/undefined の場合は空文字列（未獲得 = 併記なし、scene2-gate.md §2）。
 * 発動位置は終盤後一括固定のため記載しない（仕様 §2 SSoT）。
 */
export const getBondSkillAnnotation = (
    bondSkillType: 'BondGamble' | 'BondStable' | null | undefined,
): string => {
    if (!bondSkillType) return '';
    const typeLabel = bondSkillType === 'BondGamble' ? '絆ギャンブル' : '絆安定';
    return ` 【${typeLabel}】`;
};

/**
 * エントリー確認リスト基本形式末尾の HR 連動併記文字列を返す。
 *
 * 並び順 = 特殊戦法 → 絆スキル（scene2-gate.md §2 SSoT、レース進行順整合）。
 * HR フラグ OFF 時は当該機能の併記を完全抑制（Scene 1 入力値が残っていてもフラグ OFF 優先）。
 * 両機能 OFF または両未申告の場合は空文字列を返す。
 */
export const getEntryListAnnotations = (
    participant: Umamusume,
    houseRules: Pick<HouseRules, 'enableBondSkill' | 'enableSpecialStrategy'>,
    getPhaseLabel: (pId: string) => string,
): string => {
    let result = '';
    if (houseRules.enableSpecialStrategy) {
        result += getSpecialStrategyAnnotation(
            participant.specialStrategyType ?? null,
            participant.specialStrategyPhase ?? null,
            getPhaseLabel,
        );
    }
    if (houseRules.enableBondSkill) {
        result += getBondSkillAnnotation(participant.bondSkill?.type ?? null);
    }
    return result;
};

/**
 * CR-SA-23-E2 / 2026-07-08: エントリー確認リスト末尾の `[固定枠: N]` 併記文字列を返す。
 *
 * SSoT: scene2-gate.md §2 L79-84 + houserule-features.md §9.3。
 * - HR ON かつ `manualGate` に有効な数値（`1..N`）が入っている場合のみ ` [固定枠: N]` を返す
 * - HR OFF または `manualGate` が `null`/`undefined` の場合は空文字
 * - 先頭に半角スペース 1 個（既存 `getSpecialStrategyAnnotation` と同方式）
 * - 並び順: 基本情報 → [固定枠: N] → 特殊戦法 → 絆スキル（scene2-gate.md §2 L166 SSoT）
 */
export const getEntryListManualGateLabel = (
    participant: Umamusume,
    enableManualGate: boolean,
): string => {
    if (!enableManualGate) return '';
    const mg = participant.manualGate;
    if (typeof mg !== 'number') return '';
    return ` [固定枠: ${mg}]`;
};

/**
 * CR-SA-23-E2 / 2026-07-08: Scene 2 [2a] 手動指定プルダウンの選択肢を返す。
 *
 * SSoT: scene2-gate.md §1.2 拡張形 L86-94 + houserule-features.md §9.2。
 * - 選択肢先頭 = `null`（`---` = 未指定 = 抽選対象）
 * - 続いて `1..N` のうち **他の出走者が既指定している枠は除外**、対象自身の現在値は候補に含む
 * - N = participants.length（出走者数）
 * - 呼び出し側（UI）は `null` を `---` ラベルとしてレンダリングする
 */
export const getManualGateOptions = (
    participants: readonly Umamusume[],
    targetParticipantId: string,
    N: number,
): (number | null)[] => {
    const occupied = new Set<number>();
    for (const p of participants) {
        if (p.id === targetParticipantId) continue;
        if (typeof p.manualGate === 'number') occupied.add(p.manualGate);
    }
    const gates: (number | null)[] = [null];
    for (let g = 1; g <= N; g++) {
        if (!occupied.has(g)) gates.push(g);
    }
    return gates;
};

/**
 * CR-SA-23-E2 / 2026-07-08: 抽選対象者（未指定者）のリストを返す。
 *
 * SSoT: scene2-gate.md §2 L98-101 + houserule-features.md §9.4。
 * - HR OFF: 全参加者を Scene 1 エントリー順のまま返す（現行挙動）
 * - HR ON: `manualGate === null`（or `undefined`）の参加者のみを Scene 1 エントリー順のまま返す
 * - 用途: [2b] ダイス出力対象 + [3] バリデーション人数基準
 */
export const getRaffleTargets = (
    participants: readonly Umamusume[],
    enableManualGate: boolean,
): Umamusume[] => {
    if (!enableManualGate) return [...participants];
    return participants.filter((p) => typeof p.manualGate !== 'number');
};

/**
 * CR-SA-23-E2 / 2026-07-08: 空き枠充当ロジック。手動指定者と抽選者の混合確定リストを返す。
 *
 * SSoT: scene2-gate.md §2 L184-186 + houserule-features.md §9.6。
 * - HR OFF: 既存全員抽選ロジックと同一（`rolls` を昇順 + tie-breaker エントリー順で `1..N` 充当）
 * - HR ON: 手動指定者は `gate = manualGate` / `roll = null`、抽選者は
 *   `[1..N] \ 手動指定枠集合` を昇順ソートし、出目昇順（+ tie-breaker エントリー順）で充当
 * - 全員手動指定（`rolls = []`）時も HR ON 経路で正常動作（`raffleAssigned = []`）
 * - 返却は gate 昇順にソート（既存 GateScene 表示ロジックと整合）
 */
export const assignGatesWithManualHold = (
    participants: readonly Umamusume[],
    rolls: readonly { id: string; roll: number }[],
    enableManualGate: boolean,
): GateAssignment[] => {
    const N = participants.length;
    const entryIndexMap = new Map<string, number>();
    participants.forEach((p, i) => {
        entryIndexMap.set(p.id, p.entryIndex ?? i);
    });

    if (!enableManualGate) {
        const sorted = [...rolls].sort((a, b) => {
            if (a.roll !== b.roll) return a.roll - b.roll;
            const iA = entryIndexMap.get(a.id) ?? 0;
            const iB = entryIndexMap.get(b.id) ?? 0;
            return iA - iB;
        });
        return sorted.map((r, i) => ({
            id: r.id,
            roll: r.roll,
            gate: i + 1,
        }));
    }

    const manuallyAssigned: GateAssignment[] = participants
        .filter((p) => typeof p.manualGate === 'number')
        .map((p) => ({
            id: p.id,
            roll: null,
            gate: p.manualGate as number,
        }));

    const occupiedGates = new Set(manuallyAssigned.map((a) => a.gate));
    const availableGates: number[] = [];
    for (let g = 1; g <= N; g++) {
        if (!occupiedGates.has(g)) availableGates.push(g);
    }

    const raffleParticipantIds = new Set(
        participants
            .filter((p) => typeof p.manualGate !== 'number')
            .map((p) => p.id),
    );
    const raffleRolls = rolls.filter((r) => raffleParticipantIds.has(r.id));
    const sortedRolls = [...raffleRolls].sort((a, b) => {
        if (a.roll !== b.roll) return a.roll - b.roll;
        const iA = entryIndexMap.get(a.id) ?? 0;
        const iB = entryIndexMap.get(b.id) ?? 0;
        return iA - iB;
    });

    const raffleAssigned: GateAssignment[] = sortedRolls.map((r, i) => ({
        id: r.id,
        roll: r.roll,
        gate: availableGates[i],
    }));

    return [...manuallyAssigned, ...raffleAssigned].sort(
        (a, b) => a.gate - b.gate,
    );
};
