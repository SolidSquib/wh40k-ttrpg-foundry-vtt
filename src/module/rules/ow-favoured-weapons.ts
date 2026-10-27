/**
 * Only War · Favoured Weapons.
 *
 * Each regiment names a Basic and a Heavy weapon it favours (core rulebook, "Favoured Weapons"); the weapon
 * must be Very Rare or more available. This module turns weapon documents (read from the armoury packs'
 * index) into the lists the Regiment Builder offers. Pure — the pack walk lives in `utils/favoured-weapons.ts`.
 */

import type { FavouredClass } from './ow-regiment-creation.ts';

/** Availability words from most to least common. A Favoured Weapon may be Very Rare or anything more common. */
const AVAILABILITY_ORDER = [
    'ubiquitous',
    'abundant',
    'plentiful',
    'common',
    'average',
    'scarce',
    'rare',
    'very-rare',
    'extremely-rare',
    'near-unique',
    'unique',
] as const;
const RAREST_FAVOURABLE = 'very-rare';

/** True when a weapon of this availability may be a Favoured Weapon. */
export function isFavouredEligible(availability: string): boolean {
    const rank = AVAILABILITY_ORDER.findIndex((word) => word === availability);
    return rank >= 0 && rank <= AVAILABILITY_ORDER.findIndex((word) => word === RAREST_FAVOURABLE);
}

/** A field that may carry per-line variants (`{ ow: 'basic' }`) or be a plain value. */
export type LineText = string | Readonly<Record<string, string>> | undefined;

/** The Only War value of a possibly per-line field. */
export function lineText(value: LineText, line = 'ow'): string {
    if (typeof value === 'string') return value;
    if (value === undefined) return '';
    return new Map(Object.entries(value)).get(line) ?? '';
}

/** The slice of a weapon's pack-index entry this module reads. */
export interface WeaponIndexEntry {
    readonly uuid: string;
    readonly name: string;
    readonly system?: { readonly class?: LineText; readonly availability?: LineText };
}

/** A weapon the Builder offers as a Favoured Weapon. */
export interface WeaponChoice {
    readonly id: string;
    readonly name: string;
    readonly availability: string;
}

/** The eligible weapons of each class, sorted by name. Weapons of other classes are left out. */
export function favouredChoices(entries: ReadonlyArray<WeaponIndexEntry>): Record<FavouredClass, WeaponChoice[]> {
    const choices: Record<FavouredClass, WeaponChoice[]> = { basic: [], heavy: [] };
    for (const entry of entries) {
        const weaponClass = lineText(entry.system?.class);
        const availability = lineText(entry.system?.availability);
        if ((weaponClass !== 'basic' && weaponClass !== 'heavy') || !isFavouredEligible(availability)) continue;
        choices[weaponClass].push({ id: entry.uuid, name: entry.name, availability });
    }
    for (const list of Object.values(choices)) list.sort((a, b) => a.name.localeCompare(b.name));
    return choices;
}

/** A chosen Favoured Weapon, for the summary list. */
export interface FavouredRow {
    readonly weaponClass: FavouredClass;
    readonly id: string;
    readonly name: string;
}

/** The Favoured Weapons actually chosen, by class (empty slots and weapons no longer offered are skipped). */
export function favouredRows(
    chosen: Readonly<Record<FavouredClass, ReadonlyArray<string>>>,
    offered: Readonly<Record<FavouredClass, ReadonlyArray<WeaponChoice>>>,
): FavouredRow[] {
    const rows: FavouredRow[] = [];
    for (const weaponClass of ['basic', 'heavy'] as const) {
        for (const id of chosen[weaponClass]) {
            const weapon = offered[weaponClass].find((candidate) => candidate.id === id);
            if (weapon !== undefined) rows.push({ weaponClass, id, name: weapon.name });
        }
    }
    return rows;
}

/** Trim a class's picks to the slots it has, and drop empty ones past the end — a removed kit purchase takes its slot away. */
export function fitToSlots(picks: ReadonlyArray<string>, slots: number): string[] {
    return picks.slice(0, slots);
}
