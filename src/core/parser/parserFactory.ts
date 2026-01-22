import { StandardParser } from './standardParser';
import { EmojiParser } from './emojiParser';
import type { ParserStrategy } from './interface';

export class ParserFactory {
    /**
     * Automatically selects the appropriate parser based on input text features.
     * Rule: If text contains '🎲', use EmojiParser (88-ch). Otherwise, use StandardParser.
     */
    static getParser(text: string): ParserStrategy {
        if (text.includes('🎲')) {
            return new EmojiParser();
        }
        return new StandardParser();
    }
}
