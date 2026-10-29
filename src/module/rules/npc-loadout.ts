/**
 * @file npc-loadout - an NPC's weapon loadouts.
 *
 * Some stat blocks print weapon alternatives ("Slugga Boy", "Shoota Boy"; "slugga or shoota"). A loadout is one such
 * alternative, kept on the NPC that prints it: a name and the compendium items it brings. Exactly one loadout is active.
 * The items a loadout adds carry its id in `flags.wh40k-rpg.loadout`, so choosing another loadout removes precisely what
 * the last one added and nothing else (items the GM added by hand, or that every variant shares, have no marker).
 *
 * Pure: the Foundry-bound apply step is `managers/npc-loadout-manager.ts`.
 */

/** The flag (under the system scope) on an item that a loadout added; its value is that loadout's id. */
export const LOADOUT_FLAG = 'loadout';

/** One weapon loadout of an NPC. */
export interface NpcLoadout {
    id: string;
    name: string;
    /** UUIDs of the compendium items this loadout brings. */
    items: readonly string[];
}

/** An item the NPC owns, reduced to what a loadout swap needs. */
export interface OwnedItemMarker {
    id: string;
    /** The id of the loadout that added it, or `null` when no loadout did. */
    loadout: string | null;
}

/** What choosing a loadout changes. */
export interface LoadoutSwap {
    loadout: NpcLoadout;
    /** Ids of the owned items an earlier loadout added, to remove. */
    remove: string[];
    /** UUIDs of the items the chosen loadout adds. */
    add: string[];
}

/** The loadout that applies unless another is chosen: the first the NPC lists. */
export function defaultLoadout(loadouts: readonly NpcLoadout[]): NpcLoadout | undefined {
    return loadouts[0];
}

/**
 * The id of the loadout in force: the stored active id when it names one of the loadouts, otherwise the default. An NPC
 * with loadouts therefore always has one in force, even when its stored id is blank or names one that was removed.
 */
export function resolveActiveLoadout(loadouts: readonly NpcLoadout[], active: string): string | undefined {
    if (loadouts.some((loadout) => loadout.id === active)) return active;
    return defaultLoadout(loadouts)?.id;
}

/**
 * Plan choosing `loadoutId`: every item an earlier loadout added is removed, and the chosen loadout's items are added.
 * `undefined` when the NPC has no loadout with that id.
 */
export function planLoadoutSwap(loadouts: readonly NpcLoadout[], loadoutId: string, owned: readonly OwnedItemMarker[]): LoadoutSwap | undefined {
    const loadout = loadouts.find((candidate) => candidate.id === loadoutId);
    if (loadout === undefined) return undefined;
    return { loadout, remove: owned.filter((item) => item.loadout !== null).map((item) => item.id), add: [...loadout.items] };
}

/**
 * The loadout an owned item belongs to: the one that flagged it; else (for an NPC made before its loadouts existed) the
 * one that lists the compendium item it was copied from; else, for a copy that names no source, the one that lists an
 * item of the same name (`loadoutByName`, item name to loadout id). `null` for an item no loadout brings.
 */
export function loadoutOfOwnedItem(
    item: { flag: string | null; compendiumSource: string | null; name: string },
    loadouts: readonly NpcLoadout[],
    loadoutByName: ReadonlyMap<string, string>,
): string | null {
    if (item.flag !== null) return item.flag;
    if (item.compendiumSource !== null) return loadouts.find((loadout) => loadout.items.includes(item.compendiumSource ?? ''))?.id ?? null;
    return loadoutByName.get(item.name) ?? null;
}
