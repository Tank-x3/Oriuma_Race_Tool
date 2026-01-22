import { describe, it, expect } from 'vitest';
import { ParserFactory } from './parserFactory';
import { StandardParser } from './standardParser';
import { EmojiParser } from './emojiParser';

describe('ParserFactory', () => {
    it('returns StandardParser for normal text', () => {
        const parser = ParserFactory.getParser('Normal text dice1d100=50');
        expect(parser).toBeInstanceOf(StandardParser);
    });

    it('returns EmojiParser for text with 🎲', () => {
        const text = 'Name 🎲 dice1d100=50';
        const parser = ParserFactory.getParser(text);
        expect(parser).toBeInstanceOf(EmojiParser);
    });

    it('detects 88-ch user string correctly', () => {
        const text = 'タンクタンクタンク　🎲 dice1d100= 77';
        const parser = ParserFactory.getParser(text);
        expect(parser).toBeInstanceOf(EmojiParser);
    });
});
