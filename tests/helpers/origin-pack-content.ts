/**
 * Test helper: read origin-path compendium content straight from `_source` JSON.
 *
 * The origin-path builder groups options by each compendium item's `type`,
 * `system.step` and (for regiment-creation options) `system.regiment.category`,
 * so the wiring tests need the raw values per pack to assert that every stage of
 * Only War character creation resolves to content.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PACKS_ROOT = resolve(__dirname, '../../src/packs-private');

/** The slice of an origin-path compendium document the wiring tests read. */
export interface OriginPackDoc {
    name: string;
    type: string;
    system: {
        step: string;
        regiment?: { category?: string };
        regimentPreset?: object;
    };
}

/** Locate a pack's `_source` directory under any game-line group dir. */
function packSourceDir(packName: string): string | null {
    for (const group of readdirSync(PACKS_ROOT, { withFileTypes: true })) {
        if (!group.isDirectory()) continue;
        const candidate = resolve(PACKS_ROOT, group.name, packName, '_source');
        try {
            readdirSync(candidate);
            return candidate;
        } catch {
            // not this group dir
        }
    }
    return null;
}

/** Every origin-path document of a pack's `_source` JSON; empty when the pack is not on disk. */
export function originDocsInPack(packName: string): OriginPackDoc[] {
    const dir = packSourceDir(packName);
    if (dir === null) return [];
    return readdirSync(dir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => JSON.parse(readFileSync(resolve(dir, file), 'utf8')) as OriginPackDoc);
}
