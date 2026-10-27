/**
 * Only War · items a regiment may add to its Standard Kit by availability.
 *
 * The kit table sells "an additional item of Rare availability" and so on. This module turns item documents
 * (read from the Only War armoury packs' index) into the list the Regiment Builder offers for each tier.
 * Pure — the pack walk lives in `utils/kit-items.ts`.
 */

import { type LineText, lineText } from './ow-favoured-weapons.ts';

/** The slice of an item's pack-index entry this module reads. */
export interface KitItemIndexEntry {
    readonly uuid: string;
    readonly name: string;
    readonly type?: string;
    readonly system?: { readonly availability?: LineText };
}

/** An item the Builder offers for an additional-item purchase. */
export interface KitItemChoice {
    readonly id: string;
    readonly name: string;
    readonly availability: string;
}

/** Every indexed item that has an availability, sorted by name. Talents, traits and the like have none and are left out. */
export function kitItemChoices(entries: ReadonlyArray<KitItemIndexEntry>): KitItemChoice[] {
    return entries
        .flatMap((entry) => {
            const availability = lineText(entry.system?.availability);
            return availability === '' ? [] : [{ id: entry.uuid, name: entry.name, availability }];
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** The items of exactly one availability tier. */
export function itemsOfTier(choices: ReadonlyArray<KitItemChoice>, tier: string): KitItemChoice[] {
    return choices.filter((choice) => choice.availability === tier);
}

/** Item UUID → name, for listing a chosen item. */
export function itemNameIndex(choices: ReadonlyArray<KitItemChoice>): Map<string, string> {
    return new Map(choices.map((choice) => [choice.id, choice.name]));
}
