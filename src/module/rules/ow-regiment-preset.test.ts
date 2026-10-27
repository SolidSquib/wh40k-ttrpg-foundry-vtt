import { describe, expect, it } from 'vitest';
import { type RegimentCatalogEntry, type RegimentDocLike, regimentEntryFromDoc } from './ow-regiment-catalog';
import { emptyRegimentSelection } from './ow-regiment-creation';
import {
    canEditChoice,
    canEditOptions,
    isRegimentPreset,
    isSoundPreset,
    presetFromState,
    type RegimentPresetData,
    reportState,
    selectedOptionIds,
    stateFromPreset,
} from './ow-regiment-preset';

const doc = (
    name: string,
    category: string,
    cost: number,
    choices?: NonNullable<NonNullable<RegimentDocLike['system']>['grants']>['choices'],
): RegimentDocLike => ({
    name,
    system: { regiment: { category, cost }, ...(choices === undefined ? {} : { grants: { choices } }) },
});
const catalog = [
    ['hw', doc('Home', 'homeWorld', 3, [{ label: 'Characteristic Modifiers', count: 2, options: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }])],
    ['co', doc('Officer', 'commandingOfficer', 2)],
    ['rt', doc('Type', 'regimentType', 2)],
    ['td', doc('Drill', 'trainingDoctrine', 3)],
    ['kit', doc('Knife', 'kitItem', 2)],
].map(([id, d]) => regimentEntryFromDoc(id as string, d as RegimentDocLike)) as RegimentCatalogEntry[];

const preset: RegimentPresetData = {
    homeWorld: 'hw',
    commandingOfficer: 'co',
    regimentType: 'rt',
    trainingDoctrines: ['td'],
    specialEquipmentDoctrines: [],
    drawbacks: [],
    kit: ['kit'],
    kitPicks: [''],
    favouredWeapons: { basic: ['w1'], heavy: [] },
    choices: { hw: { 'Characteristic Modifiers': ['A'] } },
    locked: true,
};

describe('preset ↔ builder state', () => {
    it('round-trips', () => {
        expect(presetFromState(stateFromPreset(preset), true)).toEqual(preset);
    });

    it('keeps what was chosen for each kit purchase, lined up with the purchase', () => {
        const withPick = { ...preset, kit: ['kit', 'kit'], kitPicks: ['', 'One knife'] };
        expect(stateFromPreset(withPick).kitPicks).toEqual(['', 'One knife']);
        expect(presetFromState(stateFromPreset(withPick), true).kitPicks).toEqual(['', 'One knife']);
        // a preset saved before picks existed reads as all blank
        expect(stateFromPreset({ ...withPick, kitPicks: [] }).kitPicks).toEqual(['', '']);
    });

    it('does not share arrays with the stored preset', () => {
        const state = stateFromPreset(preset);
        expect(state.selection.trainingDoctrines).not.toBe(preset.trainingDoctrines);
        expect(state.kitIds).not.toBe(preset.kit);
    });

    it('keeps only the picks of options the preset holds', () => {
        const state = { ...stateFromPreset(preset), picks: { hw: { x: ['1'] }, gone: { y: ['2'] } } };
        expect(presetFromState(state, false).choices).toEqual({ hw: { x: ['1'] } });
    });

    it('lists the selected options in category order', () => {
        expect(selectedOptionIds(stateFromPreset(preset).selection)).toEqual(['hw', 'co', 'rt', 'td']);
    });
});

describe('isRegimentPreset', () => {
    it('is true only for a block that names a Regiment Type', () => {
        expect(isRegimentPreset(preset)).toBe(true);
        expect(isRegimentPreset({ regimentType: '' })).toBe(false);
        expect(isRegimentPreset(undefined)).toBe(false);
    });
});

describe('reportState', () => {
    it('a complete regiment within budget is sound, even with a choice still open', () => {
        const report = reportState(stateFromPreset(preset), catalog);
        expect(report.issues).toEqual([]);
        expect(report.openChoices).toEqual(['hw']); // 1 of 2 characteristic picks
        expect(isSoundPreset(report)).toBe(true);
    });

    it('flags an option the catalog no longer holds', () => {
        const report = reportState({ ...stateFromPreset(preset), kitIds: ['ghost'] }, catalog);
        expect(report.unknownIds).toEqual(['ghost']);
        expect(isSoundPreset(report)).toBe(false);
    });

    it('flags a regiment that breaks the budget', () => {
        const over = {
            ...stateFromPreset(preset),
            selection: {
                ...emptyRegimentSelection(),
                homeWorld: 'hw',
                commandingOfficer: 'co',
                regimentType: 'rt',
                trainingDoctrines: ['td', 'td', 'td', 'td'],
            },
        };
        expect(reportState(over, catalog).issues).toContain('overBudget');
    });

    it('counts the kit against the allowance', () => {
        expect(reportState({ ...stateFromPreset(preset), kitIds: Array.from({ length: 40 }, () => 'kit') }, catalog).kitValid).toBe(false);
    });
});

describe('who may edit a locked preset', () => {
    it('the GM and anyone on an unlocked preset may change options', () => {
        expect(canEditOptions(false, false)).toBe(true);
        expect(canEditOptions(true, true)).toBe(true);
        expect(canEditOptions(true, false)).toBe(false);
    });

    it('a player on a locked preset may only fill in a pick it left open', () => {
        const open = { key: 'Characteristic Modifiers', count: 2, optionCount: 3 };
        expect(canEditChoice(preset, false, 'hw', open)).toBe(true); // 1 of 2 made
        expect(canEditChoice({ ...preset, choices: { hw: { 'Characteristic Modifiers': ['A', 'B'] } } }, false, 'hw', open)).toBe(false);
        expect(canEditChoice(preset, false, 'co', { key: 'x', count: 1, optionCount: 2 })).toBe(true); // nothing made yet
    });

    it('the GM, or no preset at all, leaves every pick editable', () => {
        const made = { ...preset, choices: { hw: { 'Characteristic Modifiers': ['A', 'B'] } } };
        const choice = { key: 'Characteristic Modifiers', count: 2, optionCount: 3 };
        expect(canEditChoice(made, true, 'hw', choice)).toBe(true);
        expect(canEditChoice(null, false, 'hw', choice)).toBe(true);
    });
});
