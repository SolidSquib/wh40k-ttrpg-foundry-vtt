import { describe, expect, it } from 'vitest';
import { type RegimentCatalogEntry, regimentEntryFromDoc } from './ow-regiment-catalog';
import { emptyRegimentSelection } from './ow-regiment-creation';
import { kitGearPlans, resolveKit } from './ow-regiment-kit';

const entry = (id: string, regiment: object): RegimentCatalogEntry => {
    const found = regimentEntryFromDoc(id, { name: id, system: { regiment } });
    if (found === undefined) throw new Error(`${id} is not a regiment option`);
    return found;
};

const LASGUN = { uuid: 'LAS', quantity: 1 };
const PACKS = { uuid: 'PACK', quantity: 4 };

const catalog = [
    entry('universal', {
        category: 'universalKit',
        kit: [
            { label: 'One flak vest', scope: 'character', mainWeapon: false, weapon: '', items: [{ uuid: 'VEST', quantity: 1 }] },
            { label: 'One Chimera', scope: 'squad', mainWeapon: false, weapon: '', items: [{ uuid: 'CHIMERA', quantity: 1 }] },
        ],
    }),
    entry('type', {
        category: 'regimentType',
        kit: [{ label: 'One lasgun and four charge packs (Main Weapon)', scope: 'character', mainWeapon: true, weapon: 'lasgun', items: [LASGUN, PACKS] }],
    }),
    entry('grenades', { category: 'kitItem', cost: 1, maxCount: 3, items: [{ uuid: 'FRAG', quantity: 2 }] }),
    entry('good', { category: 'kitItem', cost: 2, craftsmanship: 'good' }),
    entry('extra', { category: 'kitItem', cost: 3, additionalItem: 'rare' }),
];

const selection = { ...emptyRegimentSelection(), regimentType: 'type' };

describe('kitGearPlans', () => {
    it('issues the items of every character-scope line and leaves the squad’s vehicles out', () => {
        const plans = kitGearPlans(resolveKit(selection, [], catalog));
        expect(plans.map((plan) => plan.uuid)).toEqual(['VEST', 'LAS', 'PACK']);
        expect(plans.find((plan) => plan.uuid === 'PACK')?.quantity).toBe(4);
    });

    it('multiplies a purchase’s items by the number of copies bought', () => {
        const plans = kitGearPlans(resolveKit(selection, ['grenades', 'grenades'], catalog));
        expect(plans.find((plan) => plan.uuid === 'FRAG')?.quantity).toBe(4);
    });

    it('issues an improved line at the craftsmanship the upgrade raised it to', () => {
        const kit = resolveKit(selection, ['good'], catalog, { picks: ['One flak vest'] });
        expect(kitGearPlans(kit).find((plan) => plan.uuid === 'VEST')?.craftsmanship).toBe('good');
        expect(kitGearPlans(kit).find((plan) => plan.uuid === 'LAS')?.craftsmanship).toBe('');
    });

    it('issues the item the player picked for an additional-item purchase', () => {
        const plans = kitGearPlans(resolveKit(selection, ['extra'], catalog, { picks: ['MELTAGUN'] }));
        expect(plans.map((plan) => plan.uuid)).toContain('MELTAGUN');
    });

    it('issues nothing for an additional-item purchase with no pick yet', () => {
        const plans = kitGearPlans(resolveKit(selection, ['extra'], catalog, { picks: [''] }));
        expect(plans.map((plan) => plan.uuid)).toEqual(['VEST', 'LAS', 'PACK']);
    });
});
