/**
 * Only War · Regiment Creation catalog loader.
 *
 * Walks the OW origin packs for `originPath` documents that carry a
 * `system.regiment` block and maps them through
 * {@link regimentEntryFromDoc}. The result is cached for the session: the
 * packs are static, and the index read is the only I/O.
 */

import { SystemConfigRegistry } from '../config/game-systems/index.ts';
import {
    presetEntryFromDoc,
    type RegimentCatalogEntry,
    type RegimentDocLike,
    type RegimentPresetEntry,
    regimentEntryFromDoc,
} from '../rules/ow-regiment-catalog.ts';
import { resolvePack } from './compendium-query.ts';

const REGIMENT_INDEX_FIELDS = ['system.regiment', 'system.grants.choices'];

let pending: Promise<ReadonlyArray<RegimentCatalogEntry>> | undefined;
let loaded: ReadonlyArray<RegimentCatalogEntry> | undefined;

async function readCatalog(): Promise<ReadonlyArray<RegimentCatalogEntry>> {
    const entries: RegimentCatalogEntry[] = [];
    for (const packName of SystemConfigRegistry.get('ow').getOriginStepConfig().packs) {
        const pack = resolvePack(packName);
        if (pack === undefined) continue;
        // eslint-disable-next-line no-await-in-loop -- sequential: packs are walked in config order so duplicate names resolve predictably
        const index = await pack.getIndex({ fields: REGIMENT_INDEX_FIELDS });
        for (const raw of index) {
            // eslint-disable-next-line no-restricted-syntax -- boundary: Foundry getIndex() yields minimally-typed index entries; RegimentDocLike is the narrowed surface the catalog reads
            const doc = raw as unknown as RegimentDocLike & { _id: string; uuid?: string };
            const entry = regimentEntryFromDoc(doc.uuid ?? `Compendium.${pack.metadata.id}.Item.${doc._id}`, doc);
            if (entry !== undefined) entries.push(entry);
        }
    }
    loaded = entries;
    return entries;
}

/** Load (once) every regiment-creation option in the Only War packs. */
export async function loadRegimentCatalog(): Promise<ReadonlyArray<RegimentCatalogEntry>> {
    if (pending !== undefined) return pending;
    const started = readCatalog();
    pending = started;
    return started;
}

/** The catalog if it has finished loading, else an empty list. Starts the load as a side effect. */
export function loadedRegimentCatalog(): ReadonlyArray<RegimentCatalogEntry> {
    if (loaded === undefined) void loadRegimentCatalog();
    return loaded ?? [];
}

const PRESET_INDEX_FIELDS = ['system.regimentPreset'];

/**
 * Every saved regiment: the presets in the Only War packs and in the world's own items. Not cached — a
 * GM saves new ones while the game is running.
 */
export async function loadRegimentPresets(): Promise<RegimentPresetEntry[]> {
    const presets: RegimentPresetEntry[] = [];
    for (const packName of SystemConfigRegistry.get('ow').getOriginStepConfig().packs) {
        const pack = resolvePack(packName);
        if (pack === undefined) continue;
        // eslint-disable-next-line no-await-in-loop -- sequential: packs are walked in config order so duplicate names resolve predictably
        const index = await pack.getIndex({ fields: PRESET_INDEX_FIELDS });
        for (const raw of index) {
            // eslint-disable-next-line no-restricted-syntax -- boundary: Foundry getIndex() yields minimally-typed index entries; RegimentDocLike is the narrowed surface the preset reads
            const doc = raw as unknown as RegimentDocLike & { _id: string; uuid?: string };
            const entry = presetEntryFromDoc(doc.uuid ?? `Compendium.${pack.metadata.id}.Item.${doc._id}`, doc);
            if (entry !== undefined) presets.push(entry);
        }
    }
    for (const item of game.items) {
        // eslint-disable-next-line no-restricted-syntax -- boundary: a world Item's system is an untyped DataModel union; RegimentDocLike is the narrowed surface the preset reads
        const entry = item.type === 'regiment' ? presetEntryFromDoc(item.uuid, item as unknown as RegimentDocLike) : undefined;
        if (entry !== undefined) presets.push(entry);
    }
    return presets.sort((a, b) => a.label.localeCompare(b.label));
}
