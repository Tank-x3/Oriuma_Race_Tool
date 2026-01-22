import { Dice } from './dice';

export class Validator {
    /**
     * Validates if the line count matches the expected number of participants.
     */
    static validateLineCount(text: string, expectedCount: number): { valid: boolean; actual: number } {
        // Filter empty lines? Usually standard paste might have empty lines.
        // We assume valid dice lines.
        // This is simple line counting, more complex logic might be in Parser.
        const lines = text.split('\n').filter(line => line.trim() !== '');
        return {
            valid: lines.length === expectedCount,
            actual: lines.length
        };
    }

    /**
     * Validates a dice equation string from a post.
     * Expected format: "diceXdY=Total" or similar, but often users paste:
     * "name 10+dice3d6=25 (25)"
     * This validator checks if the equality holds.
     * 
     * @param equationPart The part containing the numbers e.g. "10+15=25" or parsed values.
     */
    static validateChecksum(calculated: number, statedTotal: number): boolean {
        return calculated === statedTotal;
    }

    /**
     * Checks if dice format is valid (e.g. 3d6, not 3d0 or 0d6)
     */
    static validateDiceFormat(diceStr: string): boolean {
        try {
            const config = Dice.parse(diceStr);
            return config.count > 0 && config.face > 0;
        } catch {
            return false;
        }
    }
}
