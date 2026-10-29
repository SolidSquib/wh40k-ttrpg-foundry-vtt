/**
 * Unit tests for the Set/string → array `_cleanData` normalizers.
 *
 * These are pure functions over plain objects (no Foundry runtime needed).
 * They guard the real bug described in the module: Sets serialize to `{}` and
 * fail SetField validation, dropping the item on `Item.create`.
 */
import { describe, expect, it } from 'vitest';
import { normalizeNestedToArray, normalizeToArray, normalizeToArrayOrEmpty } from './normalize-to-array.ts';
import type { RawSource } from './raw-source.ts';

describe('normalizeToArray', () => {
    it('converts a Set value to an array', () => {
        const source: RawSource = { special: new Set(['a', 'b']) };
        normalizeToArray(source, 'special');
        expect(source['special']).toEqual(['a', 'b']);
    });

    it('leaves an existing array untouched', () => {
        const arr = ['x', 'y'];
        const source: RawSource = { special: arr };
        normalizeToArray(source, 'special');
        expect(source['special']).toBe(arr);
    });

    it('is a no-op when the key is absent', () => {
        const source: RawSource = {};
        normalizeToArray(source, 'special');
        expect('special' in source).toBe(false);
    });

    it('is a no-op when source is undefined', () => {
        expect(() => normalizeToArray(undefined, 'special')).not.toThrow();
    });

    it('leaves null/undefined values untouched', () => {
        const source: RawSource = { a: null, b: undefined };
        normalizeToArray(source, 'a');
        normalizeToArray(source, 'b');
        expect(source['a']).toBeNull();
        expect(source['b']).toBeUndefined();
    });

    describe('stringMode', () => {
        it('default ("none") leaves a string untouched', () => {
            const source: RawSource = { special: 'reliable,tearing' };
            normalizeToArray(source, 'special');
            expect(source['special']).toBe('reliable,tearing');
        });

        it('"wrap" turns a string into a single-element array', () => {
            const source: RawSource = { hullType: 'cruiser' };
            normalizeToArray(source, 'hullType', { stringMode: 'wrap' });
            expect(source['hullType']).toEqual(['cruiser']);
        });

        it('"split" comma-splits and trims a string', () => {
            const source: RawSource = { special: 'reliable, tearing , proven' };
            normalizeToArray(source, 'special', { stringMode: 'split' });
            expect(source['special']).toEqual(['reliable', 'tearing', 'proven']);
        });

        it('still converts a Set regardless of stringMode', () => {
            const source: RawSource = { hullType: new Set(['raider']) };
            normalizeToArray(source, 'hullType', { stringMode: 'split' });
            expect(source['hullType']).toEqual(['raider']);
        });
    });
});

describe('normalizeNestedToArray', () => {
    it('converts a nested Set value to an array', () => {
        const source: RawSource = { restrictions: { armourTypes: new Set(['flak', 'mesh']) } };
        normalizeNestedToArray(source, 'restrictions', 'armourTypes');
        expect((source['restrictions'] as RawSource)['armourTypes']).toEqual(['flak', 'mesh']);
    });

    it('leaves other nested keys untouched', () => {
        const source: RawSource = { restrictions: { armourTypes: new Set(['flak']), other: 5 } };
        normalizeNestedToArray(source, 'restrictions', 'armourTypes');
        expect((source['restrictions'] as RawSource)['other']).toBe(5);
    });

    it('is a no-op when the parent is missing', () => {
        const source: RawSource = {};
        expect(() => normalizeNestedToArray(source, 'restrictions', 'armourTypes')).not.toThrow();
        expect('restrictions' in source).toBe(false);
    });

    it('is a no-op when the parent is not an object', () => {
        const source: RawSource = { restrictions: 'nope' };
        normalizeNestedToArray(source, 'restrictions', 'armourTypes');
        expect(source['restrictions']).toBe('nope');
    });

    it('is a no-op when the child key is absent', () => {
        const source: RawSource = { restrictions: {} };
        normalizeNestedToArray(source, 'restrictions', 'armourTypes');
        expect('armourTypes' in (source['restrictions'] as RawSource)).toBe(false);
    });

    it('is a no-op when source is undefined', () => {
        expect(() => normalizeNestedToArray(undefined, 'restrictions', 'armourTypes')).not.toThrow();
    });
});

describe('normalizeToArrayOrEmpty', () => {
    it('leaves an absent key absent, so an update diff that omits it cannot wipe the stored value', () => {
        const source: RawSource = { name: 'diff only' };
        normalizeToArrayOrEmpty(source, 'special');
        expect('special' in source).toBe(false);
    });

    it('keeps an array and converts a Set to an array', () => {
        const kept: RawSource = { special: ['blast-3', 'reliable'] };
        normalizeToArrayOrEmpty(kept, 'special');
        expect(kept['special']).toEqual(['blast-3', 'reliable']);
        const converted: RawSource = { special: new Set(['tearing']) };
        normalizeToArrayOrEmpty(converted, 'special');
        expect(converted['special']).toEqual(['tearing']);
    });

    it('replaces a present but unusable value with an empty array', () => {
        for (const junk of [42, null, {}, 'razor-sharp']) {
            const source: RawSource = { special: junk };
            normalizeToArrayOrEmpty(source, 'special');
            expect(source['special']).toEqual([]);
        }
    });

    it('is a no-op when source is undefined', () => {
        expect(() => normalizeToArrayOrEmpty(undefined, 'special')).not.toThrow();
    });
});
