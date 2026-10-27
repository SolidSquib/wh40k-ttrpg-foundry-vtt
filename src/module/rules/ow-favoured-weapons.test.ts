import { describe, expect, it } from 'vitest';
import { favouredChoices, favouredRows, fitToSlots, isFavouredEligible, lineText, type WeaponIndexEntry } from './ow-favoured-weapons';

const weapon = (name: string, weaponClass: string, availability: string, perLine = true): WeaponIndexEntry => ({
    uuid: `u:${name}`,
    name,
    system: perLine ? { class: { ow: weaponClass }, availability: { ow: availability } } : { class: weaponClass, availability },
});

describe('isFavouredEligible', () => {
    it('allows Very Rare and anything more available', () => {
        for (const word of ['ubiquitous', 'common', 'scarce', 'rare', 'very-rare']) expect([word, isFavouredEligible(word)]).toEqual([word, true]);
    });

    it('refuses the rarer ones and unknown words', () => {
        for (const word of ['extremely-rare', 'near-unique', 'unique', '', 'mythic']) expect([word, isFavouredEligible(word)]).toEqual([word, false]);
    });
});

describe('lineText', () => {
    it('reads a plain value, an Only War variant, or nothing', () => {
        expect(lineText('basic')).toBe('basic');
        expect(lineText({ ow: 'heavy', rt: 'basic' })).toBe('heavy');
        expect(lineText({ rt: 'basic' })).toBe('');
        expect(lineText(undefined)).toBe('');
    });
});

describe('favouredChoices', () => {
    const entries = [
        weapon('M36 Lasgun', 'basic', 'common'),
        weapon('Bolter', 'basic', 'very-rare'),
        weapon('Rare Bolt Rifle', 'basic', 'extremely-rare'),
        weapon('Heavy Stubber', 'heavy', 'average'),
        weapon('Lascannon', 'heavy', 'near-unique'),
        weapon('Laspistol', 'pistol', 'common'),
        weapon('Chainsword', 'melee', 'common'),
        weapon('Plain Value Autogun', 'basic', 'plentiful', false),
    ];

    it('lists the eligible Basic and Heavy weapons, sorted by name', () => {
        const choices = favouredChoices(entries);
        expect(choices.basic.map((w) => w.name)).toEqual(['Bolter', 'M36 Lasgun', 'Plain Value Autogun']);
        expect(choices.heavy.map((w) => w.name)).toEqual(['Heavy Stubber']);
    });

    it('carries the weapon uuid as its id', () => {
        expect(favouredChoices(entries).heavy[0]).toEqual({ id: 'u:Heavy Stubber', name: 'Heavy Stubber', availability: 'average' });
    });
});

describe('favouredRows', () => {
    const offered = favouredChoices([weapon('M36 Lasgun', 'basic', 'common'), weapon('Heavy Stubber', 'heavy', 'average')]);

    it('names the chosen weapons by class and skips empty slots and weapons no longer offered', () => {
        expect(favouredRows({ basic: ['u:M36 Lasgun', ''], heavy: ['u:Heavy Stubber', 'u:Gone'] }, offered)).toEqual([
            { weaponClass: 'basic', id: 'u:M36 Lasgun', name: 'M36 Lasgun' },
            { weaponClass: 'heavy', id: 'u:Heavy Stubber', name: 'Heavy Stubber' },
        ]);
    });
});

describe('fitToSlots', () => {
    it('drops picks past the slots a class has', () => {
        expect(fitToSlots(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
        expect(fitToSlots(['a'], 2)).toEqual(['a']);
    });
});
