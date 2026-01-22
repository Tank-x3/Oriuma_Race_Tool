import { describe, it, expect } from 'vitest';
import { Dice } from './dice';

describe('Dice Module', () => {
    describe('parse', () => {
        it('parses standard dice notation "3d6"', () => {
            const result = Dice.parse('3d6');
            expect(result).toEqual({ count: 3, face: 6, modifier: 0, isNegative: false });
        });

        it('parses single dice "1d100"', () => {
            const result = Dice.parse('1d100');
            expect(result).toEqual({ count: 1, face: 100, modifier: 0, isNegative: false });
        });

        it('parses negative dice "-1d27"', () => {
            const result = Dice.parse('-1d27');
            expect(result).toEqual({ count: 1, face: 27, modifier: 0, isNegative: true });
        });

        it('throws error for invalid format "3d"', () => {
            expect(() => Dice.parse('3d')).toThrow();
        });

        it('throws error for non-numeric "ad6"', () => {
            expect(() => Dice.parse('ad6')).toThrow();
        });
    });

    describe('roll', () => {
        it('generates values within range for "1d6"', () => {
            for (let i = 0; i < 20; i++) {
                const result = Dice.roll('1d6');
                expect(result.sum).toBeGreaterThanOrEqual(1);
                expect(result.sum).toBeLessThanOrEqual(6);
                expect(result.values).toHaveLength(1);
            }
        });

        it('generates correct count of values for "3d6"', () => {
            const result = Dice.roll('3d6');
            expect(result.values).toHaveLength(3);
            expect(result.sum).toBe(result.values.reduce((a, b) => a + b, 0));
        });

        it('returns negative sum for "-1d10"', () => {
            for (let i = 0; i < 20; i++) {
                const result = Dice.roll('-1d10');
                expect(result.sum).toBeLessThan(0);
                expect(result.sum).toBeGreaterThanOrEqual(-10);
                expect(result.isNegative).toBe(true);
            }
        });
    });
});
