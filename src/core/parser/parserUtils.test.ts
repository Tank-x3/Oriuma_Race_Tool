import { describe, it, expect } from 'vitest';
import {
    getUndetectedParticipantNames,
    getUndetectedDiceDetails,
    formatUndetectedDiceDetail,
} from './parserUtils';
import type { Umamusume, DiceResult } from '../../types';
import type { ParsedLine } from './interface';

describe('getUndetectedParticipantNames - CR-14', () => {
    const baseParticipant = {
        strategy: '逃げ',
        uniqueSkill: { type: 'Stability' as const, phases: [] },
        gate: 1,
        score: 0,
        history: {},
    };

    const participants: Umamusume[] = [
        { id: '1', name: 'ウマ娘A', entryIndex: 1, ...baseParticipant } as Umamusume,
        { id: '2', name: 'ウマ娘B', entryIndex: 2, ...baseParticipant } as Umamusume,
        { id: '3', name: 'ウマ娘C', entryIndex: 3, ...baseParticipant } as Umamusume,
    ];

    const makeResult = (participantId: string, name: string): ParsedLine => ({
        originalText: '',
        participantId,
        name,
        diceStr: '1d100',
        diceResult: 50,
        total: 50,
        fixValue: 0,
        validChecksum: true,
    });

    it('returns empty array when all participants are detected', () => {
        const results = [
            makeResult('1', 'ウマ娘A'),
            makeResult('2', 'ウマ娘B'),
            makeResult('3', 'ウマ娘C'),
        ];
        expect(getUndetectedParticipantNames(participants, results)).toEqual([]);
    });

    it('returns names of participants not present in results', () => {
        const results = [makeResult('1', 'ウマ娘A')];
        expect(getUndetectedParticipantNames(participants, results)).toEqual(['ウマ娘B', 'ウマ娘C']);
    });

    it('returns all names when no participants are detected', () => {
        expect(getUndetectedParticipantNames(participants, [])).toEqual(['ウマ娘A', 'ウマ娘B', 'ウマ娘C']);
    });

    it('treats duplicated participantId in results as single detection (Base + Unique)', () => {
        // PhaseInput の handleParse は Base dice と Unique dice の両方が同じ id で来るケースを許容する。
        // 重複 id があっても未検出名抽出に影響しないこと。
        const results = [
            makeResult('1', 'ウマ娘A'),
            makeResult('1', 'ウマ娘A'),
        ];
        expect(getUndetectedParticipantNames(participants, results)).toEqual(['ウマ娘B', 'ウマ娘C']);
    });

    it('preserves participants order regardless of results order', () => {
        const results = [
            makeResult('3', 'ウマ娘C'),
            makeResult('1', 'ウマ娘A'),
        ];
        expect(getUndetectedParticipantNames(participants, results)).toEqual(['ウマ娘B']);
    });
});

describe('getUndetectedDiceDetails - CR-14 ENG21 ユーザーフィードバック対応', () => {
    const baseDice: DiceResult = { diceStr: '3d6', values: [], sum: 12 };
    const uniqueDice: DiceResult = { diceStr: '1d10', values: [], sum: 5 };

    const getPhaseLabel = (id: string): string => {
        if (id === 'Start') return '序盤';
        if (id === 'Mid') return '中盤';
        if (id.startsWith('Mid')) return id.replace('Mid', '中盤');
        if (id === 'End') return '終盤';
        return id;
    };

    const makeParticipant = (
        id: string,
        name: string,
        uniquePhases: string[],
        history: Umamusume['history']
    ): Umamusume => ({
        id,
        entryIndex: parseInt(id, 10),
        name,
        strategy: '差し',
        uniqueSkill: { type: 'Stability', phases: uniquePhases },
        gate: 1,
        score: 0,
        history,
    });

    it('returns empty array when all required dice are present', () => {
        // ウマ娘A: unique 不要（phases=[]）+ baseDice 取り込み済み
        // ウマ娘B: unique 必要（phases=['Start']）+ base+unique 両方取り込み済み
        const participants = [
            makeParticipant('1', 'ウマ娘A', [], { Start: { baseDice, computedScore: 0 } }),
            makeParticipant('2', 'ウマ娘B', ['Start'], { Start: { baseDice, uniqueDice, computedScore: 0 } }),
        ];
        expect(getUndetectedDiceDetails(participants, 'Start', getPhaseLabel)).toEqual([]);
    });

    it('detects missing base dice for participants without unique requirement', () => {
        const participants = [
            makeParticipant('1', 'ウマ娘A', [], {}),
        ];
        expect(getUndetectedDiceDetails(participants, 'Start', getPhaseLabel)).toEqual([
            { name: 'ウマ娘A', missingBase: true, missingUnique: false },
        ]);
    });

    it('detects only missing unique dice when base is already present', () => {
        // パターンA: 通常ダイスは取り込み済みだが固有ダイスのみ欠落
        const participants = [
            makeParticipant('1', 'ウマ娘A', ['Start'], { Start: { baseDice, computedScore: 0 } }),
        ];
        expect(getUndetectedDiceDetails(participants, 'Start', getPhaseLabel)).toEqual([
            { name: 'ウマ娘A', missingBase: false, missingUnique: true },
        ]);
    });

    it('detects both missing when unique is required and nothing is present', () => {
        const participants = [
            makeParticipant('1', 'ウマ娘A', ['Start'], {}),
        ];
        expect(getUndetectedDiceDetails(participants, 'Start', getPhaseLabel)).toEqual([
            { name: 'ウマ娘A', missingBase: true, missingUnique: true },
        ]);
    });

    it('does not flag participants whose phase data already exists (CR-14 パターンB)', () => {
        // パターンB: 既に Phase 1 history に登録済みの参加者は再パース時に missing 扱いされない
        const participants = [
            makeParticipant('1', 'ウマ娘A', [], { Start: { baseDice, computedScore: 0 } }),
            makeParticipant('2', 'ウマ娘B', [], { Start: { baseDice, computedScore: 0 } }),
            makeParticipant('3', 'ウマ娘C', [], {}), // 未登録
        ];
        const result = getUndetectedDiceDetails(participants, 'Start', getPhaseLabel);
        expect(result).toEqual([
            { name: 'ウマ娘C', missingBase: true, missingUnique: false },
        ]);
    });

    it('treats Mid1 phase as requiring unique when uniqueSkill.phases includes "Mid" or "中盤"', () => {
        // RaceScene.tsx handleNext と同等のロジック網羅: Mid プレフィックス + Mid/中盤 マッチング
        const participants = [
            makeParticipant('1', 'ウマ娘A', ['Mid'], { Mid1: { baseDice, computedScore: 0 } }),
            makeParticipant('2', 'ウマ娘B', ['中盤'], { Mid1: { baseDice, computedScore: 0 } }),
            makeParticipant('3', 'ウマ娘C', ['Mid1'], { Mid1: { baseDice, computedScore: 0 } }),
        ];
        const result = getUndetectedDiceDetails(participants, 'Mid1', getPhaseLabel);
        // 全 3 名とも unique 必要だが unique 未取り込み
        expect(result).toEqual([
            { name: 'ウマ娘A', missingBase: false, missingUnique: true },
            { name: 'ウマ娘B', missingBase: false, missingUnique: true },
            { name: 'ウマ娘C', missingBase: false, missingUnique: true },
        ]);
    });

    it('does not flag missing unique when participant does not require unique in current phase', () => {
        const participants = [
            // 固有スキルが End フェーズ発動だが現在 Start フェーズ → unique 不要
            makeParticipant('1', 'ウマ娘A', ['End'], { Start: { baseDice, computedScore: 0 } }),
        ];
        expect(getUndetectedDiceDetails(participants, 'Start', getPhaseLabel)).toEqual([]);
    });
});

describe('formatUndetectedDiceDetail', () => {
    it('formats both-missing as both-label', () => {
        expect(formatUndetectedDiceDetail({ name: 'A', missingBase: true, missingUnique: true }))
            .toBe('A（フェーズダイス・固有ダイス両方）');
    });

    it('formats base-only-missing as base-label', () => {
        expect(formatUndetectedDiceDetail({ name: 'A', missingBase: true, missingUnique: false }))
            .toBe('A（フェーズダイス）');
    });

    it('formats unique-only-missing as unique-label', () => {
        expect(formatUndetectedDiceDetail({ name: 'A', missingBase: false, missingUnique: true }))
            .toBe('A（固有ダイス）');
    });
});
