import { describe, expect, it } from 'vitest';
import type { RegimentPresetData } from './ow-regiment-preset';
import {
    applyRegimentPreview,
    buildRegimentPreview,
    finishRegimentSelection,
    isPreviewablePreset,
    type PreviewableSystem,
    type PreviewOptionDoc,
    summaryHtml,
} from './ow-regiment-preview';

const doc = (id: string, name: string, system: PreviewOptionDoc['system']): PreviewOptionDoc => ({ id, name, system });

const docs = new Map<string, PreviewOptionDoc>(
    [
        doc('hw', 'Death World', {
            modifiers: { characteristics: { toughness: 2 } },
            grants: {
                skills: [{ name: 'Survival', level: 'trained' }],
                choices: [
                    {
                        type: 'characteristic',
                        label: 'Characteristic Modifiers',
                        count: 2,
                        options: [
                            { name: 'Perception', grants: { characteristics: { perception: 3 } } },
                            { name: 'Strength', grants: { characteristics: { strength: 3 } } },
                            { name: 'Toughness', grants: { characteristics: { toughness: 3 } } },
                        ],
                    },
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
        doc('co', 'Bilious', { grants: { skills: [{ name: 'Survival', level: 'trained' }], aptitudes: ['Toughness'] } }),
        doc('rt', 'Line Infantry', {
            grants: { talents: [{ name: 'Weapon Training', specialization: 'Las', uuid: 'W1' }], traits: [{ name: 'Machine', uuid: 'M1', level: 1 }] },
        }),
    ].map((entry) => [entry.id, entry]),
);

const preset = (overrides: Partial<RegimentPresetData> = {}): RegimentPresetData => ({
    homeWorld: 'hw',
    commandingOfficer: 'co',
    regimentType: 'rt',
    trainingDoctrines: [],
    specialEquipmentDoctrines: [],
    drawbacks: [],
    kit: [],
    kitPicks: [],
    favouredWeapons: { basic: [], heavy: [] },
    choices: {},
    locked: false,
    ...overrides,
});

describe('buildRegimentPreview', () => {
    it("folds each option's fixed grants together, once", () => {
        const { grants, characteristics } = buildRegimentPreview(preset(), docs);
        expect(grants.skills.map((s) => s.name)).toEqual(['Survival']);
        expect(grants.talents.map((t) => t.name)).toEqual(['Weapon Training']);
        expect(grants.traits.map((t) => t.name)).toEqual(['Machine']);
        expect(grants.aptitudes).toEqual(['Toughness']);
        expect(characteristics).toEqual({ toughness: 2 });
    });

    it('asks for each pick an option leaves open, under a label that names the option', () => {
        const { grants, keyMap } = buildRegimentPreview(preset(), docs);
        expect(grants.choices.map((c) => c.label)).toEqual(['Death World: Characteristic Modifiers', 'Death World: Talent']);
        expect(keyMap['Death World: Talent']).toEqual({ optionId: 'hw', choiceKey: 'Talent' });
    });

    it('seeds the picks the preset already holds', () => {
        const { selectedChoices } = buildRegimentPreview(preset({ choices: { hw: { Talent: ['Light Sleeper'] } } }), docs);
        expect(selectedChoices).toEqual({ 'Death World: Talent': ['Light Sleeper'] });
    });

    it('an unlocked preset keeps even filled picks open to change', () => {
        const { grants, characteristics } = buildRegimentPreview(preset({ choices: { hw: { Talent: ['Light Sleeper'] } } }), docs);
        expect(grants.choices).toHaveLength(2);
        expect(grants.talents.map((t) => t.name)).toEqual(['Weapon Training']);
        expect(characteristics).toEqual({ toughness: 2 });
    });

    it('a locked preset folds filled picks into the grants and asks only for the open ones', () => {
        const locked = preset({ locked: true, choices: { hw: { 'Talent': ['Light Sleeper'], 'Characteristic Modifiers': ['Strength', 'Perception'] } } });
        const { grants, characteristics } = buildRegimentPreview(locked, docs);
        expect(grants.choices).toEqual([]);
        expect(grants.talents.map((t) => t.name)).toEqual(['Light Sleeper', 'Weapon Training']);
        expect(characteristics).toEqual({ toughness: 2, strength: 3, perception: 3 });
        const open = buildRegimentPreview(preset({ locked: true, choices: { hw: { Talent: ['Light Sleeper'] } } }), docs);
        expect(open.grants.choices.map((c) => c.label)).toEqual(['Death World: Characteristic Modifiers']);
    });

    it('skips options the builder has not loaded', () => {
        expect(buildRegimentPreview(preset({ homeWorld: 'ghost' }), docs).grants.choices).toEqual([]);
    });
});

describe('applying and finishing a preview', () => {
    const baseSystem = (): PreviewableSystem & { step: string } => ({
        step: 'regiment',
        description: { value: '<p>original</p>' },
        grants: { skills: [], choices: [] },
        modifiers: { characteristics: {} },
        selectedChoices: {},
        regimentPreset: preset(),
    });

    it('recognises a preset that can be previewed', () => {
        expect(isPreviewablePreset(baseSystem())).toBe(true);
        expect(isPreviewablePreset({ ...baseSystem(), step: 'spec' })).toBe(false);
        expect(isPreviewablePreset({ step: 'regiment' })).toBe(false);
    });

    it('puts the preview on the system', () => {
        const system = baseSystem();
        applyRegimentPreview(system, buildRegimentPreview(preset(), docs), '<p>summary</p>');
        expect(system.description).toEqual({ value: '<p>summary</p>' });
        expect(system.grants?.['choices']).toHaveLength(2);
        expect(system.modifiers?.['characteristics']).toEqual({ toughness: 2 });
    });

    it("takes the preview off and writes the player's picks into the preset", () => {
        const system = baseSystem();
        applyRegimentPreview(system, buildRegimentPreview(preset(), docs), '<p>summary</p>');
        system.selectedChoices = { 'Death World: Talent': ['Lightning Reflexes'] };
        const done = finishRegimentSelection(system);
        expect(done.regimentPreset?.choices).toEqual({ hw: { Talent: ['Lightning Reflexes'] } });
        expect(done.grants).toEqual({ skills: [], choices: [] });
        expect(done.description).toEqual({ value: '<p>original</p>' });
        expect(done.selectedChoices).toEqual({});
        expect(done.regimentPreview).toBeUndefined();
    });

    it('leaves a system with no preview alone', () => {
        const system = baseSystem();
        expect(finishRegimentSelection(system)).toBe(system);
    });
});

describe('summaryHtml', () => {
    it('writes one item as a paragraph and several as a list, escaping text', () => {
        expect(
            summaryHtml([
                { label: 'Home World', items: ['Death <World>'] },
                { label: 'Kit', items: ['A', 'B'] },
                { label: 'Empty', items: [] },
            ]),
        ).toBe('<p><strong>Home World:</strong> Death &lt;World&gt;</p><p><strong>Kit</strong></p><ul><li>A</li><li>B</li></ul>');
    });
});
