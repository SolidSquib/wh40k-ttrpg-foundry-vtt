import { describe, expect, it } from 'vitest';
import { itemNameIndex, itemsOfTier, kitItemChoices } from './ow-kit-items';

const entries = [
    { uuid: 'u:lamp', name: 'Lamp', type: 'gear', system: { availability: { ow: 'common' } } },
    { uuid: 'u:autogun', name: 'Autogun', type: 'weapon', system: { availability: 'average' } },
    { uuid: 'u:grapnel', name: 'Grapnel', type: 'gear', system: { availability: { ow: 'common' } } },
    { uuid: 'u:talent', name: 'Ambidextrous', type: 'talent' },
];

describe('kitItemChoices', () => {
    it('keeps items that have an availability, sorted by name, and skips the rest', () => {
        expect(kitItemChoices(entries).map((c) => c.name)).toEqual(['Autogun', 'Grapnel', 'Lamp']);
    });

    it('reads a per-line availability for Only War', () => {
        expect(kitItemChoices(entries).find((c) => c.name === 'Lamp')?.availability).toBe('common');
    });
});

describe('itemsOfTier', () => {
    it('lists only the items of exactly that tier', () => {
        const choices = kitItemChoices(entries);
        expect(itemsOfTier(choices, 'common').map((c) => c.name)).toEqual(['Grapnel', 'Lamp']);
        expect(itemsOfTier(choices, 'rare')).toEqual([]);
    });
});

describe('itemNameIndex', () => {
    it('maps a chosen item back to its name', () => {
        expect(itemNameIndex(kitItemChoices(entries)).get('u:grapnel')).toBe('Grapnel');
    });
});
