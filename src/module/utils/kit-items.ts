/**
 * Only War · the items a regiment may add to its Standard Kit, read from the armoury packs.
 *
 * Every Only War item pack (`ow-*-items-*`) is indexed for each item's availability; {@link kitItemChoices}
 * keeps those that have one. The packs are static, so the result is cached for the session.
 */

import { type KitItemChoice, type KitItemIndexEntry, kitItemChoices } from '../rules/ow-kit-items.ts';

const ITEM_PACK = /^ow-.*-items-/;
const INDEX_FIELDS = ['system.availability'];

let pending: Promise<KitItemChoice[]> | undefined;

async function readChoices(): Promise<KitItemChoice[]> {
    const entries: KitItemIndexEntry[] = [];
    for (const pack of game.packs.filter((candidate) => candidate.metadata.system === 'wh40k-rpg' && ITEM_PACK.test(candidate.metadata.name))) {
        // eslint-disable-next-line no-await-in-loop -- sequential: packs are walked in registry order so a duplicate name resolves predictably
        const index = await pack.getIndex({ fields: INDEX_FIELDS });
        for (const raw of index) {
            // eslint-disable-next-line no-restricted-syntax -- boundary: Foundry getIndex() yields minimally-typed index entries; KitItemIndexEntry is the narrowed surface the item list reads
            const entry = raw as unknown as Omit<KitItemIndexEntry, 'uuid'> & { _id: string; uuid?: string };
            entries.push({ ...entry, uuid: entry.uuid ?? `Compendium.${pack.metadata.id}.Item.${entry._id}` });
        }
    }
    return kitItemChoices(entries);
}

/** Every Only War item with an availability, for the additional-item purchases. */
export async function loadKitItemChoices(): Promise<KitItemChoice[]> {
    if (pending !== undefined) return pending;
    const started = readChoices();
    pending = started;
    return started;
}
