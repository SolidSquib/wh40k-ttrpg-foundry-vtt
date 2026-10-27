import { describe, expect, it } from 'vitest';
import { dedupeTalentPlans, dedupeTraitPlans, talentPlansFor, traitPlansFor } from './ow-regiment-talents';

describe('talentPlansFor', () => {
    it('collects fixed talents that have a uuid', () => {
        const plans = talentPlansFor({
            grants: {
                talents: [
                    { uuid: 'u1', specialization: 'Orks' },
                    { uuid: '', specialization: '' },
                ],
                traits: [],
            },
            activeModifiers: [],
        });
        expect(plans).toEqual([{ uuid: 'u1', specialization: 'Orks' }]);
    });

    it('collects choice-resolved talents from activeModifiers and ignores other modifier types', () => {
        const plans = talentPlansFor({
            grants: { talents: [], traits: [] },
            activeModifiers: [
                { type: 'talent', itemUuid: 'u2', specialization: 'Las' },
                { type: 'skill', itemUuid: 'u3' },
                { type: 'talent', itemUuid: null },
            ],
        });
        expect(plans).toEqual([{ uuid: 'u2', specialization: 'Las' }]);
    });
});

describe('dedupeTalentPlans', () => {
    it('keeps the first of each talent + specialisation, case-insensitively', () => {
        expect(
            dedupeTalentPlans([
                { uuid: 'u1', specialization: 'Las' },
                { uuid: 'u1', specialization: ' las ' },
                { uuid: 'u1', specialization: 'Solid' },
                { uuid: 'u2', specialization: '' },
            ]),
        ).toEqual([
            { uuid: 'u1', specialization: 'Las' },
            { uuid: 'u1', specialization: 'Solid' },
            { uuid: 'u2', specialization: '' },
        ]);
    });
});

describe('traitPlansFor', () => {
    it('collects granted traits that have a generated trait, with their printed level', () => {
        const plans = traitPlansFor({
            grants: {
                talents: [],
                traits: [
                    { name: 'Size', uuid: 't1', level: 5 },
                    { name: 'Clumsy', uuid: '', level: null },
                    { name: 'Sturdy', uuid: 't2', level: null },
                ],
            },
            activeModifiers: [],
        });
        expect(plans).toEqual([
            { name: 'Size', uuid: 't1', level: 5 },
            { name: 'Sturdy', uuid: 't2', level: null },
        ]);
    });
});

describe('dedupeTraitPlans', () => {
    it('keeps the first of each trait under a name, but lets two names share one generated trait', () => {
        expect(
            dedupeTraitPlans([
                { name: 'Unnatural Strength', uuid: 'u', level: 2 },
                { name: 'Unnatural Toughness', uuid: 'u', level: 2 },
                { name: 'unnatural strength', uuid: 'u', level: 4 },
            ]),
        ).toEqual([
            { name: 'Unnatural Strength', uuid: 'u', level: 2 },
            { name: 'Unnatural Toughness', uuid: 'u', level: 2 },
        ]);
    });
});
