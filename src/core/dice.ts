import type { DiceResult, DiceConfig } from '../types';

export class Dice {
    /**
     * Parses a dice string like "3d6", "1d100", "-1d27".
     * Returns generic configuration.
     */
    static parse(diceStr: string): DiceConfig & { isNegative: boolean } {
        const isNegative = diceStr.startsWith('-');
        const cleanStr = isNegative ? diceStr.substring(1) : diceStr;
        const [countStr, faceStr] = cleanStr.toLowerCase().split('d');

        if (!countStr || !faceStr) {
            throw new Error(`Invalid dice string format: ${diceStr}`);
        }

        const count = parseInt(countStr, 10);
        const face = parseInt(faceStr, 10);

        if (isNaN(count) || isNaN(face)) {
            throw new Error(`Invalid dice values: ${diceStr}`);
        }

        return {
            count,
            face,
            modifier: 0,
            isNegative
        };
    }

    /**
     * Rolls dice based on string format.
     * Logic handles negative dice (e.g. "-1d27") by returning negative sum.
     */
    static roll(diceStr: string): DiceResult {
        const { count, face, isNegative } = Dice.parse(diceStr);
        const values: number[] = [];
        let sum = 0;

        for (let i = 0; i < count; i++) {
            // 1 to face
            const val = Math.floor(Math.random() * face) + 1;
            values.push(val);
            sum += val;
        }

        if (isNegative) {
            sum = -sum;
        }

        return {
            diceStr,
            values,
            sum,
            isNegative
        };
    }

    /**
     * Validates if a string is a valid dice format.
     */
    static isValid(diceStr: string): boolean {
        try {
            Dice.parse(diceStr);
            return true;
        } catch {
            return false;
        }
    }
}
