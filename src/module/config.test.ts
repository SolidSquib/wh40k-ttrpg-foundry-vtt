import { describe, expect, it } from 'vitest';
import { ALL_SYSTEM_IDS } from './config/game-systems/types.ts';
import { WH40K } from './config.ts';
import { buildQualityLabel, parseQualityLevel } from './utils/quality-id.ts';

/**
 * Guard for the #300 quality-level primitives extracted from the three sites
 * (specialQualities / qualityLookup Handlebars helpers + getQualityLabel) that
 * each re-derived this parse + label-suffix logic.
 */
describe('parseQualityLevel (#300)', () => {
    it('extracts a numeric level', () => {
        expect(parseQualityLevel('blast-3')).toEqual({ baseId: 'blast', level: 3, formula: null });
    });

    it('treats a -x suffix as a level-less placeholder (case-insensitive)', () => {
        expect(parseQualityLevel('flamer-x')).toEqual({ baseId: 'flamer', level: null, formula: null });
        expect(parseQualityLevel('FLAMER-X')).toEqual({ baseId: 'FLAMER', level: null, formula: null });
    });

    it('returns the bare identifier when there is no suffix', () => {
        expect(parseQualityLevel('tearing')).toEqual({ baseId: 'tearing', level: null, formula: null });
        expect(parseQualityLevel('razor-sharp')).toEqual({ baseId: 'razor-sharp', level: null, formula: null });
    });

    it('only strips the final -<n> segment, keeping hyphenated base ids', () => {
        expect(parseQualityLevel('proven-2')).toEqual({ baseId: 'proven', level: 2, formula: null });
        expect(parseQualityLevel('multi-part-5')).toEqual({ baseId: 'multi-part', level: 5, formula: null });
    });

    it('parses a dice-expression rating as a formula, not a level', () => {
        expect(parseQualityLevel('blast-10+1d10')).toEqual({ baseId: 'blast', level: null, formula: '10+1d10' });
        expect(parseQualityLevel('blast-1d10+10')).toEqual({ baseId: 'blast', level: null, formula: '1d10+10' });
        expect(parseQualityLevel('multi-part-2d10')).toEqual({ baseId: 'multi-part', level: null, formula: '2d10' });
    });
});

describe('buildQualityLabel (#300)', () => {
    it('returns the base unchanged when the quality has no level', () => {
        expect(buildQualityLabel('Tearing', false, null)).toBe('Tearing');
        expect(buildQualityLabel('Tearing', false, 3)).toBe('Tearing');
    });

    it('appends the level for a level-bearing quality', () => {
        expect(buildQualityLabel('Blast', true, 6)).toBe('Blast (6)');
    });

    it('appends (X) when the quality takes a level but none was supplied', () => {
        expect(buildQualityLabel('Blast', true, null)).toBe('Blast (X)');
    });

    it('appends a dice rating as printed', () => {
        expect(buildQualityLabel('Blast', true, null, '10+1d10')).toBe('Blast (10+1d10)');
    });
});

/**
 * Integrity guard for the acquisition-currency registry: every entry is wired to
 * a valid game line with a cost path and a wallet path, and exactly
 * one is the primary.
 */
describe('WH40K.currencies — acquisition currency registry', () => {
    const entries = Object.entries(WH40K.currencies);

    it('declares Only War logistics', () => {
        expect(entries.map(([key]) => key).sort()).toEqual(['logistics']);
    });

    it.each(entries)('%s is wired to a valid line, a line-scoped costPath, and a wallet path', (_key, currency) => {
        expect(currency.label).toBeTruthy();
        expect(currency.abbreviation).toBeTruthy();
        expect(ALL_SYSTEM_IDS).toContain(currency.line);
        // The cost path addresses this currency's own line's cost block.
        expect(currency.costPath.startsWith('system.cost.')).toBe(true);
        expect(currency.walletPath.startsWith('system.')).toBe(true);
    });

    it('marks exactly one currency as the primary', () => {
        const primaries = entries.filter(([, currency]) => currency.primary === true).map(([key]) => key);
        expect(primaries).toEqual(['logistics']);
    });
});
