import { describe, expect, it } from 'vitest';
import { isOriginItemType, migrateLegacyOriginType, migrateLegacyOwnedOriginTypes, ORIGIN_ITEM_TYPES, originItemTypeForStep } from './origin-item-types.ts';

// eslint-disable-next-line no-restricted-syntax -- boundary: stands in for the untyped Foundry item source `migrateData` receives
type ItemSource = Record<string, unknown>;

describe('origin item types', () => {
    it('recognises exactly the three split types', () => {
        for (const type of ORIGIN_ITEM_TYPES) expect(isOriginItemType(type)).toBe(true);
        for (const type of ['originPath', 'weapon', 'talent', '', null, undefined]) expect(isOriginItemType(type)).toBe(false);
    });

    it('maps each step to its type', () => {
        expect(originItemTypeForStep('regiment')).toBe('regiment');
        expect(originItemTypeForStep('speciality')).toBe('speciality');
        expect(originItemTypeForStep('advancedSpeciality')).toBe('speciality');
        for (const step of ['homeWorld', 'regimentType', 'commandingOfficer', 'trainingDoctrine', 'equipmentDoctrine', 'regimentalDrawback', 'kitItem']) {
            expect(originItemTypeForStep(step)).toBe('regimentOption');
        }
    });

    it('falls back to regimentOption for an unknown or missing step', () => {
        expect(originItemTypeForStep('notAStep')).toBe('regimentOption');
        expect(originItemTypeForStep(undefined)).toBe('regimentOption');
    });
});

describe('migrateLegacyOriginType', () => {
    it('rewrites a legacy originPath item by its step', () => {
        const regiment: ItemSource = { type: 'originPath', system: { step: 'regiment' } };
        migrateLegacyOriginType(regiment);
        expect(regiment['type']).toBe('regiment');
        const advanced: ItemSource = { type: 'originPath', system: { step: 'advancedSpeciality' } };
        migrateLegacyOriginType(advanced);
        expect(advanced['type']).toBe('speciality');
        const noStep: ItemSource = { type: 'originPath' };
        migrateLegacyOriginType(noStep);
        expect(noStep['type']).toBe('regimentOption');
    });

    it('leaves every other type alone', () => {
        const weapon: ItemSource = { type: 'weapon', system: { step: 'regiment' } };
        migrateLegacyOriginType(weapon);
        expect(weapon['type']).toBe('weapon');
    });

    it('rewrites the embedded items of an actor source', () => {
        const actor: { items: ItemSource[] } = { items: [{ type: 'originPath', system: { step: 'speciality' } }, { type: 'talent' }] };
        migrateLegacyOwnedOriginTypes(actor);
        expect(actor.items.map((item) => item['type'])).toEqual(['speciality', 'talent']);
    });
});
