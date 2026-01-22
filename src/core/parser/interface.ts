import type { Umamusume } from '../../types';
// import type { ParseResult } from './standardParser'; // Removed to avoid circular dependency
// For now, I will import from standardParser since it defined them. 
// Or better, move types here?
// I'll move ParseResult and ParsedLine to here or types.ts?
// To avoid circular dependency, I'll define them here and update StandardParser to import them.

export interface ParsedLine {
    originalText: string;
    participantId: string;
    name: string;
    diceStr: string; // "3d8"
    diceResult: number; // The value rolled
    total: number; // The total value (e.g. 45)
    fixValue: number; // The extracted fix value (e.g. 30)
    validChecksum: boolean;
}

export interface ParseResult {
    results: ParsedLine[];
    errors: string[];
}

export interface ParserStrategy {
    parse(text: string, participants: Umamusume[], context: 'RACE' | 'PACE'): ParseResult;
}
