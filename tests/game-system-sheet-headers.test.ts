/**
 * Regression guard: per-line sheet variants keep the right sidebar header.
 *
 * History: `makeSystemVariant` overwrote the `header` part with the line's PLAYER
 * header (header-dh.hbs) for every sheet family it built —
 * including craft. A live DOM probe showed the vehicle sidebar
 * rendering the character header (origin-builder overlay, no hull fields), and
 * vehicles losing their locomotion + quick stats. Craft now keep their
 * own header; only PC/NPC families take the line's player header.
 *
 * Source-text idiom (the sheet classes cannot load under happy-dom).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../src/module/applications/actor/game-system-sheets.ts'), 'utf8');
const variants = Array.from(src.matchAll(/makeSystemVariant\((\w+), '(\w+)', \w+, '([\w-]+)'\)/g)).map((m) => ({
    base: m[1],
    name: m[2],
    header: m[3],
}));

describe('per-line sheet header routing', () => {
    it('builds every variant with an explicit header source', () => {
        expect(variants).toHaveLength((src.match(/= makeSystemVariant\(/g) ?? []).length);
    });

    it('gives PC and NPC sheets the line player header', () => {
        const pcNpc = variants.filter((v) => v.base === 'CharacterSheet' || v.base === 'NPCSheet');
        expect(pcNpc).toHaveLength(2);
        expect(pcNpc.every((v) => v.header === 'line-player-header')).toBe(true);
    });

    it('keeps the craft sheet on their own header', () => {
        const craft = variants.filter((v) => v.base === 'CraftActorSheet');
        expect(craft).toHaveLength(1);
        expect(craft.every((v) => v.header === 'own-header')).toBe(true);
    });
});
