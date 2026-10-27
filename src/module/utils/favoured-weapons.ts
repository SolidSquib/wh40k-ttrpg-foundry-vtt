/**
 * Only War · the weapons a regiment may favour, read from the armoury packs.
 *
 * Every Only War weapon pack (`ow-*-items-weapons`) is indexed for each weapon's class and availability;
 * {@link favouredChoices} keeps the Basic and Heavy weapons that are Very Rare or more available. The packs
 * are static, so the result is cached for the session.
 */

import { type WeaponChoice, type WeaponIndexEntry, favouredChoices } from '../rules/ow-favoured-weapons.ts';
import type { FavouredClass } from '../rules/ow-regiment-creation.ts';

const WEAPON_PACK = /^ow-.*-items-weapons$/;
const INDEX_FIELDS = ['system.class', 'system.availability'];

let pending: Promise<Record<FavouredClass, WeaponChoice[]>> | undefined;

async function readChoices(): Promise<Record<FavouredClass, WeaponChoice[]>> {
    const entries: WeaponIndexEntry[] = [];
    for (const pack of game.packs.filter((candidate) => candidate.metadata.system === 'wh40k-rpg' && WEAPON_PACK.test(candidate.metadata.name))) {
        // eslint-disable-next-line no-await-in-loop -- sequential: packs are walked in registry order so a duplicate name resolves predictably
        const index = await pack.getIndex({ fields: INDEX_FIELDS });
        for (const raw of index) {
            // eslint-disable-next-line no-restricted-syntax -- boundary: Foundry getIndex() yields minimally-typed index entries; WeaponIndexEntry is the narrowed surface the weapon list reads
            const entry = raw as unknown as Omit<WeaponIndexEntry, 'uuid'> & { _id: string; uuid?: string };
            entries.push({ ...entry, uuid: entry.uuid ?? `Compendium.${pack.metadata.id}.Item.${entry._id}` });
        }
    }
    return favouredChoices(entries);
}

/** The Basic and Heavy weapons a regiment may name as Favoured Weapons. */
export async function loadFavouredWeaponChoices(): Promise<Record<FavouredClass, WeaponChoice[]>> {
    if (pending !== undefined) return pending;
    const started = readChoices();
    pending = started;
    return started;
}
