/**
 * @file npc-location-armour - an NPC's defence per hit location.
 *
 * A character stores armour per location as objects (`armour.head.value`, `.total`, `.toughnessBonus`); an NPC
 * keeps its derived armour *points* as plain numbers under `armour.locations` (`armour.locations.head`), and its
 * Toughness bonus on the Toughness characteristic. Anything that reads armour for both kinds of actor must read the
 * NPC shape too, or an NPC shows no armour and no Toughness bonus at all.
 */

/** The part of an actor's `system.armour` that holds an NPC's per-location numbers. */
export interface NpcArmourBag {
    locations?: Partial<Record<string, number>>;
}

/** The part of an NPC's system that its defence is read from. `armour` is whichever shape the actor's armour has. */
export interface NpcDefenceSystem {
    armour?: object | undefined;
    characteristics?: { toughness?: { bonus?: number | undefined; effectiveBonus?: number | undefined } | undefined } | undefined;
}

/** Whether an actor's armour is an NPC's (plain numbers under `locations`) rather than a character's per-location objects. */
export function isNpcArmour(armour: object | undefined): armour is NpcArmourBag {
    return armour !== undefined && 'locations' in armour;
}

/** An NPC's armour at one hit location; 0 when the actor has none recorded there (or is not an NPC). */
export function npcLocationArmour(armour: NpcArmourBag | undefined, locationKey: string): number {
    return armour?.locations?.[locationKey] ?? 0;
}

/** The armour points, Toughness bonus and their sum an NPC has at one hit location. */
export interface NpcLocationDefence {
    /** Armour points only (what the actor's items and traits give). */
    value: number;
    /** Armour points plus the Toughness bonus: what a character's armour total shows. */
    total: number;
    toughnessBonus: number;
}

/**
 * An NPC's defence at a hit location, or `undefined` when the system is not an NPC's (a character's armour has no
 * `locations` bag; read its per-location objects instead). The location may be written as the key (`leftArm`) or
 * as a label (`Left Arm`).
 */
export function npcLocationDefence(system: NpcDefenceSystem | undefined, location: string): NpcLocationDefence | undefined {
    const armour = system?.armour;
    const locations = isNpcArmour(armour) ? armour.locations : undefined;
    if (locations === undefined) return undefined;
    const wanted = location.replace(/\s/g, '').toUpperCase();
    const key = Object.keys(locations).find((name) => name.toUpperCase() === wanted);
    const value = key === undefined ? 0 : locations[key] ?? 0;
    const toughness = system?.characteristics?.toughness;
    const toughnessBonus = toughness?.effectiveBonus ?? toughness?.bonus ?? 0;
    return { value, total: value + toughnessBonus, toughnessBonus };
}
