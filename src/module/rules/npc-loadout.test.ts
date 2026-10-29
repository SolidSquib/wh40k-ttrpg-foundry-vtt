import { describe, expect, it } from 'vitest';
import { defaultLoadout, loadoutOfOwnedItem, type NpcLoadout, planLoadoutSwap, resolveActiveLoadout } from './npc-loadout.ts';

const SLUGGA: NpcLoadout = { id: 'slugga', name: 'Slugga Boy', items: ['Compendium.x.Item.slugga', 'Compendium.x.Item.choppa'] };
const SHOOTA: NpcLoadout = { id: 'shoota', name: 'Shoota Boy', items: ['Compendium.x.Item.shoota'] };
const LOADOUTS = [SLUGGA, SHOOTA];

describe('defaultLoadout / resolveActiveLoadout', () => {
    it('makes the first listed loadout the default', () => {
        expect(defaultLoadout(LOADOUTS)).toBe(SLUGGA);
        expect(defaultLoadout([])).toBeUndefined();
    });

    it('keeps a stored id that names a loadout', () => {
        expect(resolveActiveLoadout(LOADOUTS, 'shoota')).toBe('shoota');
    });

    it('falls back to the default when the stored id is blank or names nothing', () => {
        expect(resolveActiveLoadout(LOADOUTS, '')).toBe('slugga');
        expect(resolveActiveLoadout(LOADOUTS, 'gone')).toBe('slugga');
    });

    it('has none when the NPC has no loadouts', () => {
        expect(resolveActiveLoadout([], '')).toBeUndefined();
    });
});

describe('planLoadoutSwap', () => {
    it("removes what an earlier loadout added and adds the chosen loadout's items", () => {
        const owned = [
            { id: 'a', loadout: 'slugga' },
            { id: 'b', loadout: 'slugga' },
            { id: 'c', loadout: null },
        ];
        expect(planLoadoutSwap(LOADOUTS, 'shoota', owned)).toEqual({ loadout: SHOOTA, remove: ['a', 'b'], add: ['Compendium.x.Item.shoota'] });
    });

    it('leaves items no loadout added (shared gear, items added by hand) alone', () => {
        const swap = planLoadoutSwap(LOADOUTS, 'slugga', [{ id: 'fixed', loadout: null }]);
        expect(swap?.remove).toEqual([]);
        expect(swap?.add).toEqual(SLUGGA.items);
    });

    it('re-choosing the active loadout replaces its items rather than doubling them', () => {
        const swap = planLoadoutSwap(LOADOUTS, 'slugga', [
            { id: 'a', loadout: 'slugga' },
            { id: 'b', loadout: 'slugga' },
        ]);
        expect(swap?.remove).toEqual(['a', 'b']);
        expect(swap?.add).toHaveLength(2);
    });

    it('is undefined for an id the NPC does not have', () => {
        expect(planLoadoutSwap(LOADOUTS, 'nope', [])).toBeUndefined();
    });
});

describe('loadoutOfOwnedItem', () => {
    const byName = new Map([['Slugga', 'slugga']]);
    const item = (flag: string | null, compendiumSource: string | null, name = 'Thing'): Parameters<typeof loadoutOfOwnedItem>[0] => ({
        flag,
        compendiumSource,
        name,
    });

    it('trusts the flag a loadout set', () => {
        expect(loadoutOfOwnedItem(item('shoota', null), LOADOUTS, byName)).toBe('shoota');
    });

    it('recognises an unflagged copy of an item a loadout lists, for NPCs made before loadouts existed', () => {
        expect(loadoutOfOwnedItem(item(null, 'Compendium.x.Item.shoota'), LOADOUTS, byName)).toBe('shoota');
    });

    it('recognises a copy that names no source by its name', () => {
        expect(loadoutOfOwnedItem(item(null, null, 'Slugga'), LOADOUTS, byName)).toBe('slugga');
    });

    it('leaves items no loadout lists alone', () => {
        expect(loadoutOfOwnedItem(item(null, 'Compendium.x.Item.other'), LOADOUTS, byName)).toBeNull();
        expect(loadoutOfOwnedItem(item(null, null, 'Choppa (Nob)'), LOADOUTS, byName)).toBeNull();
    });
});
