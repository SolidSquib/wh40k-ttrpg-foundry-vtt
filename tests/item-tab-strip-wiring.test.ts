/**
 * Regression guard: item sheets wire their tab buttons by finding the nav through a selector
 * (`BaseItemSheet` DEFAULT_OPTIONS `tabs[].navSelector`). The shared tab-strip partial dropped the
 * matching class when it replaced the hand-rolled navs (#354), after which no tab button on any item
 * sheet using it switched tabs. The partial must keep carrying whatever class the sheet looks for.
 */

import { describe, expect, it } from 'vitest';
import { readRepoFile } from './lib/repo-file.ts';

const PARTIAL = readRepoFile('src/templates/item/partial/item-tab-strip.hbs');
const BASE_SHEET = readRepoFile('src/module/applications/item/base-item-sheet.ts');

describe('item tab strip wiring', () => {
    it('carries the class the base item sheet selects its tab nav by', () => {
        const selector = /navSelector:\s*'\.([\w-]+)'/.exec(BASE_SHEET)?.[1];
        expect(selector).toBeDefined();
        expect(PARTIAL).toMatch(new RegExp(`<nav[^>]*class="[^"]*\\b${selector}\\b`));
    });

    it('declares the tab group its buttons belong to', () => {
        expect(PARTIAL).toMatch(/<nav[^>]*data-group="primary"/);
    });
});
