import { describe, expect, it } from 'vitest';
import { emptyRegimentSelection } from './ow-regiment-creation';
import { decodePicks, encodePicks, encodePickKey, presetFromState, stateFromPreset } from './ow-regiment-preset';

const HOME_WORLD = 'Compendium.wh40k-rpg.ow-core-origins-homeworlds.Item.8pohMk9sLDBO5aoP';

describe('pick keys', () => {
    it('keeps the option UUID out of the key’s dots, which Foundry would read as a path', () => {
        expect(encodePickKey(HOME_WORLD)).not.toContain('.');
        expect(Object.keys(encodePicks({ [HOME_WORLD]: { Talent: ['Light Sleeper'] } }))).toEqual([
            'Compendium~wh40k-rpg~ow-core-origins-homeworlds~Item~8pohMk9sLDBO5aoP',
        ]);
    });

    it('round-trips picks through the stored form', () => {
        const picks = { [HOME_WORLD]: { 'Characteristic Modifiers': ['Fellowship', 'Perception'], 'Talent': ['Light Sleeper'] } };
        expect(decodePicks(encodePicks(picks))).toEqual(picks);
    });

    it('drops anything that is not a list of picks instead of throwing on it', () => {
        // what Foundry left behind when it expanded a dotted key into nested objects
        const expanded = { Compendium: { 'wh40k-rpg': { 'ow-core-origins-homeworlds': { Item: { abc: { Talent: ['x'] } } } } } };
        expect(() => decodePicks(expanded)).not.toThrow();
        expect(decodePicks(expanded)).toEqual({ Compendium: {} });
    });

    it('builds a state from a preset whose picks are stored under dot-free keys', () => {
        const state = {
            selection: { ...emptyRegimentSelection(), homeWorld: HOME_WORLD, regimentType: 'rt' },
            picks: { [HOME_WORLD]: { Talent: ['Light Sleeper'] } },
            kitIds: [],
            kitPicks: [],
        };
        const preset = presetFromState(state, false);
        expect(Object.keys(preset.choices).every((key) => !key.includes('.'))).toBe(true);
        expect(stateFromPreset(preset).picks).toEqual(state.picks);
    });
});
