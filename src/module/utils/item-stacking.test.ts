import { describe, expect, it } from 'vitest';
import { planStackMerges, type StackableItem, stackSignature } from './item-stacking.ts';

/** Build a stackable item whose stored data is `system` (quantity included). */
function item(
    id: string,
    name: string,
    system: { quantity: number } & Record<string, string | number | boolean | null>,
    type = 'weapon',
    // eslint-disable-next-line no-restricted-syntax -- boundary: stands in for an untyped Foundry flag bag
    scopeFlags: Record<string, unknown> = {},
): StackableItem {
    return { id, name, type, system: { quantity: system.quantity }, _source: { system }, scopeFlags };
}

describe('stackSignature', () => {
    it('ignores quantity and key order', () => {
        const a = item('a', 'Krak Grenade', { quantity: 4, craftsmanship: 'common', identifier: 'krak' });
        const b = item('b', 'Krak Grenade', { identifier: 'krak', craftsmanship: 'common', quantity: 2 });
        expect(stackSignature(a)).toBe(stackSignature(b));
    });

    it('separates different names, types and stored data', () => {
        const base = item('a', 'Krak Grenade', { quantity: 1, craftsmanship: 'common' });
        expect(stackSignature(base)).not.toBe(stackSignature(item('b', 'Frag Grenade', { quantity: 1, craftsmanship: 'common' })));
        expect(stackSignature(base)).not.toBe(stackSignature(item('c', 'Krak Grenade', { quantity: 1, craftsmanship: 'good' })));
        expect(stackSignature(base)).not.toBe(stackSignature(item('d', 'Krak Grenade', { quantity: 1, craftsmanship: 'common' }, 'ammunition')));
    });

    it('is null for an item with no numeric quantity or no stored data', () => {
        expect(stackSignature({ id: 'x', name: 'Skill', type: 'skill', system: {}, _source: { system: {} } })).toBeNull();
        expect(stackSignature({ id: 'y', name: 'Rope', type: 'gear', system: { quantity: 1 } })).toBeNull();
    });
});

describe('planStackMerges', () => {
    it('merges identical stacks into the first, summing quantity', () => {
        const plans = planStackMerges([
            item('a', 'Krak Grenade', { quantity: 4, craftsmanship: 'common' }),
            item('b', 'Flamer', { quantity: 1, craftsmanship: 'common' }),
            item('c', 'Krak Grenade', { quantity: 2, craftsmanship: 'common' }),
        ]);
        expect(plans).toEqual([{ keepId: 'a', name: 'Krak Grenade', quantity: 6, removeIds: ['c'], scopeFlags: {} }]);
    });

    it('merges three or more stacks into one plan', () => {
        const plans = planStackMerges([item('a', 'Ration', { quantity: 1 }), item('b', 'Ration', { quantity: 2 }), item('c', 'Ration', { quantity: 3 })]);
        expect(plans).toEqual([{ keepId: 'a', name: 'Ration', quantity: 6, removeIds: ['b', 'c'], scopeFlags: {} }]);
    });

    it('keeps every provenance flag any merged stack carried', () => {
        const plans = planStackMerges([
            item('a', 'Krak Grenade', { quantity: 4 }, 'weapon', { originPathGranted: true }),
            item('b', 'Krak Grenade', { quantity: 2 }, 'weapon', { regimentKitGear: true }),
        ]);
        expect(plans[0]?.scopeFlags).toEqual({ originPathGranted: true, regimentKitGear: true });
    });

    it('leaves differing items alone (craftsmanship, equipped state, clip)', () => {
        expect(
            planStackMerges([
                item('a', 'Lasgun', { quantity: 1, craftsmanship: 'common', equipped: false }),
                item('b', 'Lasgun', { quantity: 1, craftsmanship: 'good', equipped: false }),
                item('c', 'Lasgun', { quantity: 1, craftsmanship: 'common', equipped: true }),
            ]),
        ).toEqual([]);
    });

    it('does nothing when there is nothing to merge, and skips unstackable items', () => {
        expect(planStackMerges([])).toEqual([]);
        expect(planStackMerges([item('a', 'Flamer', { quantity: 1 })])).toEqual([]);
        const noId: StackableItem = { id: null, name: 'Ghost', type: 'gear', system: { quantity: 1 }, _source: { system: { quantity: 1 } } };
        expect(planStackMerges([noId, noId])).toEqual([]);
    });
});
