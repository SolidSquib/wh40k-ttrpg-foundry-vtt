import { describe, expect, it } from 'vitest';
import { resolveActiveModifiers } from './origin-active-modifiers';

const WT = 'Compendium.wh40k-rpg.ow-core-items-talents.Item.49ucw4fdBg7LeSV5';

describe('resolveActiveModifiers', () => {
    it('splits a composite talent pick into the talent and its specialisation', () => {
        const choices = [{ type: 'talent', label: 'Weapon Training', count: 1, options: [{ name: 'Weapon Training (Las)', uuid: WT }] }];
        expect(resolveActiveModifiers(choices, { 'Weapon Training': ['Weapon Training (Las)'] })).toEqual([
            { source: 'Weapon Training', type: 'talent', key: 'Weapon Training', value: null, itemUuid: WT, specialization: 'Las' },
        ]);
    });

    it('carries an equipment option’s quantity and craftsmanship', () => {
        const choices = [
            { type: 'equipment', label: 'Specialist Equipment', count: 1, options: [{ name: 'Good Flamer', uuid: 'F', quantity: 2, craftsmanship: 'good' }] },
        ];
        expect(resolveActiveModifiers(choices, { 'Specialist Equipment': ['Good Flamer'] })).toMatchObject([
            { type: 'equipment', itemUuid: 'F', value: 2, craftsmanship: 'good' },
        ]);
    });

    it('resolves nothing for a choice the player has not made', () => {
        expect(resolveActiveModifiers([{ type: 'talent', label: 'Talent', count: 1, options: [{ name: 'Ambush' }] }], {})).toEqual([]);
    });
});
