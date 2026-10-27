import { describe, expect, it } from 'vitest';
import {
    choicesComplete,
    drawbackDescriptorFor,
    presetEntryFromDoc,
    entriesInCategory,
    type RegimentBlockLike,
    type RegimentCatalogEntry,
    type RegimentChoiceDocLike,
    type RegimentDocLike,
    regimentEntryFromDoc,
    togglePick,
} from './ow-regiment-catalog';

const doc = (name: string, regiment: RegimentBlockLike, choices?: ReadonlyArray<RegimentChoiceDocLike>): RegimentDocLike => ({
    name,
    system: { regiment, ...(choices === undefined ? {} : { grants: { choices } }) },
});

describe('regimentEntryFromDoc', () => {
    it('ignores a document with no regiment block or an empty category', () => {
        expect(regimentEntryFromDoc('u1', { name: 'Plain origin' })).toBeUndefined();
        expect(regimentEntryFromDoc('u2', doc('Blank', { category: '', cost: 3 }))).toBeUndefined();
        expect(regimentEntryFromDoc('u3', doc('Unknown', { category: 'nonsense', cost: 3 }))).toBeUndefined();
    });

    it('maps cost, label and the kit effects the engine aggregates', () => {
        const entry = regimentEntryFromDoc('u1', doc('Alpha', { category: 'homeWorld', cost: 3, logistics: 10, kitBase: 15, kitModifier: -5 }));
        expect(entry).toMatchObject({ id: 'u1', category: 'homeWorld', cost: 3, label: 'Alpha', grants: { logistics: 10, kitBase: 15, kitModifier: -5 } });
    });

    it('omits zero effects and a null kitBase', () => {
        const entry = regimentEntryFromDoc('u1', doc('Beta', { category: 'commandingOfficer', cost: 1, logistics: 0, kitModifier: 0, kitBase: null }));
        expect(entry?.grants).toEqual({});
    });

    it('carries maxCount only for kit items', () => {
        expect(regimentEntryFromDoc('k', doc('Kit', { category: 'kitItem', cost: 5, maxCount: 2 }))?.maxCount).toBe(2);
        expect(regimentEntryFromDoc('h', doc('Home', { category: 'homeWorld', cost: 3, maxCount: 2 }))?.maxCount).toBeUndefined();
    });

    it('surfaces the document’s choices with their persisted keys', () => {
        const entry = regimentEntryFromDoc(
            'u1',
            doc('Gamma', { category: 'homeWorld', cost: 3 }, [
                { label: 'Characteristics', count: 2, options: [{ name: 'Strength' }, { name: 'Toughness' }, { value: 'per', label: 'Perception' }] },
                { label: 'Talent', options: [{ name: 'Sprint' }] },
            ]),
        );
        expect(entry?.choices).toEqual([
            {
                key: 'Characteristics',
                label: 'Characteristics',
                count: 2,
                options: [
                    { value: 'Strength', label: 'Strength' },
                    { value: 'Toughness', label: 'Toughness' },
                    { value: 'per', label: 'Perception' },
                ],
            },
            { key: 'Talent', label: 'Talent', count: 1, options: [{ value: 'Sprint', label: 'Sprint' }] },
        ]);
    });

    it('disambiguates choices that share a label the way the origin pipeline does', () => {
        const entry = regimentEntryFromDoc(
            'u1',
            doc('Delta', { category: 'regimentType', cost: 2 }, [
                { label: 'Skill', options: [{ name: 'A' }] },
                { label: 'Skill', options: [{ name: 'B' }] },
            ]),
        );
        expect(entry?.choices.map((c) => c.key)).toEqual(['Skill', 'Skill (2)']);
    });
});

describe('entriesInCategory', () => {
    const entries = ['c:2', 'a:1', 'b:2'].map((token) => {
        const [label = '', cost = '0'] = token.split(':');
        return regimentEntryFromDoc(label, doc(label, { category: 'trainingDoctrine', cost: Number(cost) })) as RegimentCatalogEntry;
    });

    it('filters to the category and lists cheaper options first, then by name', () => {
        const other = regimentEntryFromDoc('z', doc('z', { category: 'drawback', cost: 1 })) as RegimentCatalogEntry;
        expect(entriesInCategory([...entries, other], 'trainingDoctrine').map((e) => e.label)).toEqual(['a', 'b', 'c']);
    });
});

describe('choice picks', () => {
    const entry = {
        choices: [
            {
                key: 'Characteristics',
                label: 'Characteristics',
                count: 2,
                options: [
                    { value: 'a', label: 'A' },
                    { value: 'b', label: 'B' },
                    { value: 'c', label: 'C' },
                ],
            },
        ],
    };

    it('is complete only when each choice holds exactly its count', () => {
        expect(choicesComplete(entry, undefined)).toBe(false);
        expect(choicesComplete(entry, { Characteristics: ['a'] })).toBe(false);
        expect(choicesComplete(entry, { Characteristics: ['a', 'b'] })).toBe(true);
    });

    it('asks for no more picks than there are options', () => {
        expect(choicesComplete({ choices: [{ key: 'K', label: 'K', count: 3, options: [{ value: 'a', label: 'A' }] }] }, { K: ['a'] })).toBe(true);
    });

    it('an entry with no choices is always complete', () => {
        expect(choicesComplete({ choices: [] }, undefined)).toBe(true);
    });

    it('togglePick adds, removes, and slides the window past count', () => {
        expect(togglePick([], 'a', 2)).toEqual(['a']);
        expect(togglePick(['a'], 'b', 2)).toEqual(['a', 'b']);
        expect(togglePick(['a', 'b'], 'c', 2)).toEqual(['b', 'c']);
        expect(togglePick(['a', 'b'], 'a', 2)).toEqual(['b']);
    });
});

describe('drawbackDescriptorFor', () => {
    const catalog = ['Alpha', 'Beta'].map((label, i) =>
        regimentEntryFromDoc(`u${i}`, doc(label, { category: i === 0 ? 'drawback' : 'homeWorld', cost: 3 })),
    ) as RegimentCatalogEntry[];

    it('describes a drawback by its name and refund', () => {
        expect(drawbackDescriptorFor(catalog, 'u0')).toEqual({ id: 'u0', description: 'Alpha', refund: 3, penalty: {} });
    });

    it('does not describe an option of another category, or an unknown id', () => {
        expect(drawbackDescriptorFor(catalog, 'u1')).toBeUndefined();
        expect(drawbackDescriptorFor(catalog, 'ghost')).toBeUndefined();
    });
});

describe('presetEntryFromDoc', () => {
    const data = {
        homeWorld: 'h',
        commandingOfficer: 'c',
        regimentType: 'r',
        trainingDoctrines: [],
        specialEquipmentDoctrines: [],
        drawbacks: [],
        kit: [],
        kitPicks: [],
        favouredWeapons: { basic: [], heavy: [] },
        choices: {},
        locked: true,
    };

    it('describes a document that holds a regiment', () => {
        expect(presetEntryFromDoc('u1', { name: 'Crimson Guard', system: { regimentPreset: data } })).toEqual({ id: 'u1', label: 'Crimson Guard', data });
    });

    it('ignores an ordinary origin and an empty preset block', () => {
        expect(presetEntryFromDoc('u1', { name: 'Plain' })).toBeUndefined();
        expect(presetEntryFromDoc('u1', { name: 'Blank', system: { regimentPreset: { ...data, regimentType: '' } } })).toBeUndefined();
    });
});
