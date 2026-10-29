/**
 * @file npc-location-armour - an NPC's armour per hit location.
 *
 * A character stores armour per location as objects (`armour.head.total`); an NPC keeps its derived armour
 * as plain numbers under `armour.locations` (`armour.locations.head`). Anything that renders armour for both
 * kinds of actor must read the NPC shape too, or an NPC shows no armour at all.
 */

/** The part of an actor's `system.armour` that holds an NPC's per-location numbers. */
export interface NpcArmourBag {
    locations?: Partial<Record<string, number>>;
}

/** An NPC's armour at one hit location; 0 when the actor has none recorded there (or is not an NPC). */
export function npcLocationArmour(armour: NpcArmourBag | undefined, locationKey: string): number {
    return armour?.locations?.[locationKey] ?? 0;
}
