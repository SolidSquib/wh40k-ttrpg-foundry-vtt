import { describe, expect, it } from 'vitest';
import { type GearSource, gearPlansFor, mergeGearPlans } from './starting-gear';

const source = (overrides: Partial<GearSource['grants']> & { activeModifiers?: GearSource['activeModifiers'] } = {}): GearSource => ({
    grants: { equipment: overrides.equipment ?? [] },
    activeModifiers: overrides.activeModifiers ?? [],
});

describe('gearPlansFor', () => {
    it('plans an origin’s fixed equipment, defaulting the quantity to one and skipping entries with no UUID', () => {
        const plans = gearPlansFor(
            source({ equipment: [{ uuid: 'A', quantity: 3 }, { uuid: 'B' }, { uuid: '' }, { quantity: 2 }, { uuid: 'C', craftsmanship: 'good' }] }),
        );
        expect(plans).toEqual([
            { uuid: 'A', quantity: 3, craftsmanship: '' },
            { uuid: 'B', quantity: 1, craftsmanship: '' },
            { uuid: 'C', quantity: 1, craftsmanship: 'good' },
        ]);
    });

    it('plans the equipment a choice resolved to, with its quantity and craftsmanship', () => {
        const plans = gearPlansFor(
            source({
                activeModifiers: [
                    { type: 'equipment', itemUuid: 'G', value: 4, craftsmanship: 'good' },
                    { type: 'equipment', itemUuid: null, value: null },
                    { type: 'talent', itemUuid: 'T', value: null },
                ],
            }),
        );
        expect(plans).toEqual([{ uuid: 'G', quantity: 4, craftsmanship: 'good' }]);
    });
});

describe('mergeGearPlans', () => {
    it('adds up the same item at the same craftsmanship and keeps different craftsmanships apart', () => {
        const merged = mergeGearPlans([
            { uuid: 'A', quantity: 2, craftsmanship: '' },
            { uuid: 'B', quantity: 1, craftsmanship: '' },
            { uuid: 'A', quantity: 3, craftsmanship: '' },
            { uuid: 'A', quantity: 1, craftsmanship: 'best' },
        ]);
        expect(merged).toEqual([
            { uuid: 'A', quantity: 5, craftsmanship: '' },
            { uuid: 'B', quantity: 1, craftsmanship: '' },
            { uuid: 'A', quantity: 1, craftsmanship: 'best' },
        ]);
    });
});
