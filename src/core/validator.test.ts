import { describe, it, expect } from 'vitest';
import { Validator } from './validator';

describe('Validator', () => {
    describe('validateLineCount', () => {
        it('returns valid true when counts match', () => {
            const text = 'line1\nline2\nline3';
            const result = Validator.validateLineCount(text, 3);
            expect(result.valid).toBe(true);
            expect(result.actual).toBe(3);
        });

        it('ignores empty lines', () => {
            const text = 'line1\n\nline2';
            const result = Validator.validateLineCount(text, 2);
            expect(result.valid).toBe(true);
        });

        it('returns valid false when counts mismatch', () => {
            const text = 'line1';
            const result = Validator.validateLineCount(text, 2);
            expect(result.valid).toBe(false);
            expect(result.actual).toBe(1);
        });
    });

    describe('validateChecksum', () => {
        it('returns true if equal', () => {
            expect(Validator.validateChecksum(10, 10)).toBe(true);
        });

        it('returns false if unequal', () => {
            expect(Validator.validateChecksum(10, 11)).toBe(false);
        });
    });

    describe('validateDiceFormat', () => {
        it('validates correct dice', () => {
            expect(Validator.validateDiceFormat('3d6')).toBe(true);
        });

        it('invalidates broken dice', () => {
            expect(Validator.validateDiceFormat('0d6')).toBe(false); // Dice count > 0 check
            expect(Validator.validateDiceFormat('3d0')).toBe(false);
            expect(Validator.validateDiceFormat('invalid')).toBe(false);
        });
    });
});
