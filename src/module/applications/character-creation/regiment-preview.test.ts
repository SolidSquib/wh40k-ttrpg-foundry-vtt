import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type NormalizedOrigin, normalizeOrigin } from './normalized-origin';
import { openRegimentPicks, previewRegimentPresets, regimentPickBonuses, withoutRegimentPreview } from './regiment-preview';

interface PickMap {
    [label: string]: string[];
}

const option = (id: string, name: string, category: string, extra: Record<string, object> = {}): NormalizedOrigin =>
    normalizeOrigin({
        uuid: id,
        name,
        system: {
            step: category,
            regiment: { category, cost: 1, kit: [{ label: 'One flak vest', scope: 'character', mainWeapon: false, weapon: '' }] },
            ...extra,
        },
    });

const preset = (choices: Record<string, Record<string, string[]>> = {}, locked = false): NormalizedOrigin =>
    normalizeOrigin({
        uuid: 'preset',
        name: 'Crimson Guard',
        system: {
            step: 'regiment',
            description: { value: '<p>original</p>' },
            regimentPreset: {
                homeWorld: 'hw',
                commandingOfficer: '',
                regimentType: 'rt',
                trainingDoctrines: [],
                specialEquipmentDoctrines: [],
                drawbacks: [],
                kit: [],
                kitPicks: [],
                favouredWeapons: { basic: [], heavy: [] },
                choices,
                locked,
            },
        },
    });

const origins = (choices: Record<string, Record<string, string[]>> = {}, locked = false): NormalizedOrigin[] => [
    option('hw', 'Death World', 'homeWorld', {
        grants: {
            skills: [{ name: 'Survival', level: 'trained' }],
            choices: [
                {
                    type: 'talent',
                    label: 'Talent',
                    count: 1,
                    options: [
                        { name: 'Light Sleeper', uuid: 'T1' },
                        { name: 'Lightning Reflexes', uuid: 'T2' },
                    ],
                },
            ],
        },
    }),
    option('rt', 'Line Infantry', 'regimentType', { grants: { talents: [{ name: 'Weapon Training', specialization: 'Las', uuid: 'W1' }] } }),
    preset(choices, locked),
];

describe('regiment presets in the origin-path builder', () => {
    beforeEach(() => {
        vi.stubGlobal('game', { i18n: { localize: (key: string): string => key, format: (key: string): string => key } });
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const previewed = (choices: Record<string, Record<string, string[]>> = {}, locked = false): NormalizedOrigin => {
        const all = origins(choices, locked);
        previewRegimentPresets(all);
        const found = all.find((origin) => origin.id === 'preset');
        if (found === undefined) throw new Error('no preset');
        return found;
    };

    it('shows what the options a preset names grant, and the picks they leave open', () => {
        const shown = previewed();
        const grants = shown.system['grants'] as { skills: Array<{ name: string }>; talents: Array<{ name: string }>; choices: Array<{ label: string }> };
        expect(grants.skills.map((s) => s.name)).toEqual(['Survival']);
        expect(grants.talents.map((t) => t.name)).toEqual(['Weapon Training']);
        expect(grants.choices.map((c) => c.label)).toEqual(['Death World: Talent']);
        expect(shown.hasChoices).toBe(true);
    });

    it("the builder's own totals see the preview: its picks are choices on the origin, with their bonuses kept", () => {
        const stat = origins({}, false);
        stat[0] = option('hw', 'Death World', 'homeWorld', {
            grants: {
                choices: [
                    {
                        type: 'characteristic',
                        label: 'Characteristic Modifiers',
                        count: 1,
                        options: [{ name: 'Strength', grants: { characteristics: { strength: 3 } } }],
                    },
                ],
            },
        });
        previewRegimentPresets(stat);
        const shown = stat.find((origin) => origin.id === 'preset');
        const choice = shown?.grants.choices.at(0);
        expect(choice?.label).toBe('Death World: Characteristic Modifiers');
        expect(choice?.options.at(0)?.grants?.characteristics).toEqual({ strength: 3 });
    });

    it("a talent pick says it grants that talent, so the builder's totals count it", () => {
        const talent = previewed().grants.choices.at(0)?.options.at(0);
        expect(talent?.value).toBe('Light Sleeper');
        expect(talent?.grants?.['talents']).toEqual([{ name: 'Light Sleeper', uuid: 'T1' }]);
    });

    it('describes the regiment: its options and its Standard Kit', () => {
        const description = (previewed().system['description'] as { value: string }).value;
        expect(description).toContain('Death World');
        expect(description).toContain('Line Infantry');
        expect(description).toContain('One flak vest');
    });

    it('counts the picks still to make, and none once they are made', () => {
        expect(openRegimentPicks(previewed())).toBe(1);
        expect(openRegimentPicks(previewed({ hw: { Talent: ['Light Sleeper'] } }))).toBe(0);
    });

    it('a locked preset that is fully picked asks for nothing and still shows the picked talent', () => {
        const shown = previewed({ hw: { Talent: ['Light Sleeper'] } }, true);
        expect(shown.hasChoices).toBe(false);
        expect((shown.system['grants'] as { talents: Array<{ name: string }> }).talents.map((t) => t.name)).toContain('Light Sleeper');
    });

    it('sums the characteristic bonuses the player picked, for the builder to bake into the characteristics', () => {
        const all = origins();
        all[0] = option('hw', 'Death World', 'homeWorld', {
            grants: {
                choices: [
                    {
                        type: 'characteristic',
                        label: 'Characteristic Modifiers',
                        count: 2,
                        options: [
                            { name: 'Strength', grants: { characteristics: { strength: 3 } } },
                            { name: 'Perception', grants: { characteristics: { perception: 3 } } },
                            { name: 'Toughness', grants: { characteristics: { toughness: 3 } } },
                        ],
                    },
                ],
            },
        });
        previewRegimentPresets(all);
        const shown = all.find((origin) => origin.id === 'preset') as NormalizedOrigin;
        expect(regimentPickBonuses(shown)).toEqual({});
        const picks = shown.system['selectedChoices'] as PickMap;
        picks['Death World: Characteristic Modifiers'] = ['Strength', 'Toughness'];
        expect(regimentPickBonuses(shown)).toEqual({ strength: 3, toughness: 3 });
        expect(regimentPickBonuses(option('x', 'Plain', 'homeWorld'))).toEqual({});
    });

    it('leaves an ordinary origin alone', () => {
        const plain = option('x', 'Plain', 'homeWorld');
        previewRegimentPresets([plain]);
        expect(plain.system['regimentPreview']).toBeUndefined();
        expect(openRegimentPicks(plain)).toBe(0);
    });

    it("takes the preview off for commit, keeping the player's pick on the preset", () => {
        const shown = previewed();
        const picks = shown.system['selectedChoices'] as PickMap;
        picks['Death World: Talent'] = ['Lightning Reflexes'];
        const finished = withoutRegimentPreview(shown);
        expect(finished.grants.choices).toEqual([]);
        expect((finished.system['regimentPreset'] as { choices: Record<string, PickMap> }).choices).toEqual({ hw: { Talent: ['Lightning Reflexes'] } });
        expect(finished.system['regimentPreview']).toBeUndefined();
        expect((finished.system['description'] as { value: string }).value).toBe('<p>original</p>');
    });
});
