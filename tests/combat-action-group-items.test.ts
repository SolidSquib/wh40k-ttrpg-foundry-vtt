/**
 * Regression guard: `combat-action-group.hbs` iterates `items`. A call that omits it does not iterate nothing:
 * Handlebars resolves `items` from the surrounding context, which on an actor sheet is the actor's own item
 * collection, so every owned item rendered as a blank button in the Reactions group. Each call must pass
 * `items=` explicitly (`items=false` for a group of hand-authored buttons).
 */

import { describe, expect, it } from 'vitest';
import { readRepoFile } from './lib/repo-file.ts';

const PANEL = readRepoFile('src/templates/actor/panel/combat-actions-panel.hbs');

describe('combat action group calls', () => {
    it('always say explicitly what the group iterates', () => {
        const calls = [...PANEL.matchAll(/\{\{#?>\s*systems\/wh40k-rpg\/templates\/actor\/panel\/combat-action-group\.hbs([^}]*)\}\}/g)];
        expect(calls.length).toBeGreaterThan(0);
        for (const [, hash] of calls) expect(hash).toMatch(/\bitems=/);
    });
});
