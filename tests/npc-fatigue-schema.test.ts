/**
 * Regression guard: damage assignment reads and writes `actor.system.fatigue.{value,max}` for whatever actor takes
 * the hit. The NPC data model is its own schema (not the shared creature template) and did not define `fatigue`, so
 * `AssignDamageData.performActionAndSendToChat` threw on `undefined.value` and Apply Damage did nothing at all for
 * an NPC target. The NPC schema must carry the field the damage code needs.
 *
 * Source scan: the data models pull Foundry globals at load, so they cannot be imported under happy-dom.
 */

import { describe, expect, it } from 'vitest';
import { readRepoFile } from './lib/repo-file.ts';

const NPC = readRepoFile('src/module/data/actor/npc.ts');
const ASSIGN = readRepoFile('src/module/rolls/assign-damage-data.ts');

describe('NPC fatigue', () => {
    it('is part of the NPC schema, with the value and max the damage code reads', () => {
        expect(ASSIGN).toContain('system.fatigue.value');
        expect(NPC).toMatch(/fatigue: new SchemaField\(\{\s*max: [^\n]*\n\s*value: /);
        expect(NPC).toMatch(/declare fatigue:\s*\{\s*value: number;\s*max: number\s*\}/);
    });
});
