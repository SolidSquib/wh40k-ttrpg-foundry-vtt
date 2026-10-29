import { describe, expect, it } from 'vitest';
import { npcLocationArmour } from './npc-location-armour.ts';

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
