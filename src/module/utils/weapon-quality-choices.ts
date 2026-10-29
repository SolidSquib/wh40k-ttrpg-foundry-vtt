/**
 * @file weapon-quality-choices - the weapon-qualities compendium as a picker list.
 *
 * Item sheets that let an author attach qualities (weapons, ammunition) offer the compendium's own
 * qualities instead of free text, so an identifier can never be mistyped. The list is read from the
 * pack at runtime; no quality is named here.
 */

import { gameSystemPackPrefix } from './game-system-pack-prefix.ts';

/** A weapon-qualities index entry carrying the two indexed system fields the picker reads. */
export interface QualityIndexEntry {
    name?: string;
    system?: { identifier?: string; hasLevel?: boolean };
}

/** One entry of the weapon-qualities compendium, as a picker lists it. */
export interface QualityChoice {
    identifier: string;
    name: string;
    hasLevel: boolean;
}

/** The index fields a pack must be asked for to build {@link QualityChoice}s. */
const QUALITY_INDEX_FIELDS = ['system.identifier', 'system.hasLevel'];

/** Picker entries from index entries: those with an identifier, ordered by name. */
export function toQualityChoices(entries: Iterable<QualityIndexEntry>): QualityChoice[] {
    return Array.from(entries, (entry) => ({
        identifier: entry.system?.identifier ?? '',
        name: entry.name ?? '',
        hasLevel: entry.system?.hasLevel === true,
    }))
        .filter((choice) => choice.identifier !== '')
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** The weapon-qualities compendium of a game system (`<prefix>-core-items-weapon-qualities`), if installed. */
export function weaponQualityPack(gameSystem: string | undefined): ReturnType<typeof game.packs.find> {
    const packName = `${gameSystemPackPrefix(gameSystem)}-core-items-weapon-qualities`;
    return game.packs.find((p) => p.metadata.name === packName && p.documentName === 'Item');
}

/** Every quality the pack offers, for a picker; none when the pack is not installed. */
export async function loadQualityChoices(pack: ReturnType<typeof game.packs.find>): Promise<QualityChoice[]> {
    if (pack === undefined) return [];
    const index = await pack.getIndex({ fields: QUALITY_INDEX_FIELDS });
    return toQualityChoices(index as Iterable<QualityIndexEntry>);
}
