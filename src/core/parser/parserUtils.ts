import type { Umamusume } from '../../types';
import type { ParsedLine } from './interface';

// CR-14: パース結果に含まれない登録参加者の名前一覧を返す。
// GateScene の人数不一致エラー文言に追記するために使用する。
// 仕様根拠: BOARD.md `CR-14` 未検出出走者の名前リストアップ。
export function getUndetectedParticipantNames(
    participants: Umamusume[],
    results: ParsedLine[]
): string[] {
    const detectedIds = new Set(results.map(r => r.participantId));
    return participants
        .filter(p => !detectedIds.has(p.id))
        .map(p => p.name);
}

// CR-14 ENG21 ユーザーフィードバック反映:
// PhaseInput（Scene 3 Race フェーズ）の未検出判定を「現フェーズで必要なダイス種別」単位に拡張する。
//   - パターンA: フェーズダイスと固有ダイスのうち片方だけ取り込まれた場合を検出する
//   - パターンB: 既に history に登録済みの参加者は missing 扱いしない（部分追加パースの誤検出防止）
export interface UndetectedDiceDetail {
    name: string;
    missingBase: boolean;
    missingUnique: boolean;
}

// 現フェーズで「必要なダイス」が history に揃っていない参加者の詳細を返す。
//   - すべての参加者は baseDice（フェーズダイス）が必須
//   - uniqueSkill.phases に現フェーズが含まれる参加者は uniqueDice（固有ダイス）も必須
// 引数 participants は「今回のパース結果を反映済み」の状態を渡すこと。
// uniqueSkill.phases の判定は RaceScene.tsx の handleNext と同等のロジックに揃える。
export function getUndetectedDiceDetails(
    participants: Umamusume[],
    currentPhaseId: string,
    getPhaseLabel: (id: string) => string
): UndetectedDiceDetail[] {
    const details: UndetectedDiceDetail[] = [];

    for (const p of participants) {
        const phaseHistory = p.history[currentPhaseId];
        const hasBase = !!phaseHistory?.baseDice;

        const phases = p.uniqueSkill?.phases ?? [];
        const phaseLabel = getPhaseLabel(currentPhaseId);
        const shouldHaveUnique = phases.includes(currentPhaseId)
            || phases.includes(phaseLabel)
            || (currentPhaseId.startsWith('Mid') && (phases.includes('Mid') || phases.includes('中盤')));
        const hasUnique = !!phaseHistory?.uniqueDice;

        const missingBase = !hasBase;
        const missingUnique = shouldHaveUnique && !hasUnique;

        if (missingBase || missingUnique) {
            details.push({ name: p.name, missingBase, missingUnique });
        }
    }

    return details;
}

// UndetectedDiceDetail を通知用のラベル文字列に整形する。
export function formatUndetectedDiceDetail(detail: UndetectedDiceDetail): string {
    if (detail.missingBase && detail.missingUnique) {
        return `${detail.name}（フェーズダイス・固有ダイス両方）`;
    }
    if (detail.missingBase) {
        return `${detail.name}（フェーズダイス）`;
    }
    return `${detail.name}（固有ダイス）`;
}
