import { describe, expect, it } from 'vitest';
import { npcLocationArmour, npcLocationDefence } from './npc-location-armour.ts';

describe('npcLocationDefence', () => {
    const system = {
        armour: { locations: { head: 0, body: 2, leftArm: 1 } },
        characteristics: { toughness: { bonus: 4, effectiveBonus: 6 } },
    };

    it('gives the armour points, the Toughness bonus and their sum at a location', () => {
        expect(npcLocationDefence(system, 'body')).toEqual({ value: 2, total: 8, toughnessBonus: 6 });
    });

    it('matches a location written as a label, whatever its case or spacing', () => {
        expect(npcLocationDefence(system, 'Left Arm')?.value).toBe(1);
        expect(npcLocationDefence(system, 'LEFTARM')?.value).toBe(1);
    });

    it('is the bare Toughness bonus at a location with no armour recorded', () => {
        expect(npcLocationDefence(system, 'rightLeg')).toEqual({ value: 0, total: 6, toughnessBonus: 6 });
    });

    it('falls back to the plain bonus when there is no effective bonus', () => {
        expect(npcLocationDefence({ armour: { locations: { body: 1 } }, characteristics: { toughness: { bonus: 3 } } }, 'body')).toEqual({
            value: 1,
            total: 4,
            toughnessBonus: 3,
        });
    });

    it('is undefined for a character, whose armour has no locations bag', () => {
        expect(npcLocationDefence({ armour: {}, characteristics: { toughness: { bonus: 4 } } }, 'body')).toBeUndefined();
        expect(npcLocationDefence(undefined, 'body')).toBeUndefined();
    });
});

describe('npcLocationArmour', () => {
    it('reads the number an NPC keeps for a hit location', () => {
        expect(npcLocationArmour({ locations: { head: 2, leftLeg: 5 } }, 'leftLeg')).toBe(5);
    });

    it('is 0 for a location with nothing recorded', () => {
        expect(npcLocationArmour({ locations: { head: 2 } }, 'body')).toBe(0);
    });

    it('is 0 for a character, whose armour has no locations bag, or for no armour at all', () => {
        expect(npcLocationArmour({}, 'head')).toBe(0);
        expect(npcLocationArmour(undefined, 'head')).toBe(0);
    });
});
