import { describe, expect, it } from 'vitest';
import npcTabSrc from '../src/templates/actor/npc/tab-npc.hbs?raw';
import headerSrc from '../src/templates/actor/player/header-dh.hbs?raw';
import biographyTabSrc from '../src/templates/actor/player/tab-biography.hbs?raw';
import skillsTabSrc from '../src/templates/actor/player/tab-skills.hbs?raw';
import tabsSrc from '../src/templates/actor/player/tabs.hbs?raw';
import { mockNpcSheetContext, mockPlayerSheetContext } from '../stories/mocks/sheet-contexts';
import { renderSheet, renderSheetParts } from '../stories/test-helpers';

// Compose templates through the shared renderSheet / renderSheetParts helpers (#269)
// instead of hand-rolled Hbs.compile + innerHTML mounts. Single-template tests use
// renderSheet; multi-template composites use renderSheetParts (one slot per partial).

function playerContext(): ReturnType<typeof mockPlayerSheetContext> {
    return mockPlayerSheetContext({
        actorOverrides: {
            system: {
                bio: {
                    age: '31',
                    gender: 'Non-binary',
                    build: 'Lean',
                    complexion: 'Pale',
                    hair: 'Black',
                    eyes: 'Grey',
                    quirks: 'Meticulous note-taker.',
                    superstition: 'Whispers litanies before every firefight.',
                    mementos: 'An old signet ring.',
                },
            },
            items: [],
        },
    });
}

function npcContext(): ReturnType<typeof mockNpcSheetContext> {
    return mockNpcSheetContext();
}

describe('character sheet template composition', () => {
    it('renders the sidebar header and biography tab together', () => {
        const context = playerContext();
        const element = renderSheetParts([{ template: headerSrc }, { template: tabsSrc }, { template: biographyTabSrc }], context);

        expect(element.textContent).toContain('Character Journal');
        expect(element.textContent).toContain('Interrogation Log');
    });

    it('renders the Only War sidebar header fields in the shared layout', () => {
        const context = playerContext();
        const element = renderSheet(headerSrc, context);

        expect(element.querySelector('input[name="system.originPath.homeWorld"]')?.getAttribute('value')).toBe('Hive World');
        expect(element.querySelector('input[name="system.originPath.motivation"]')).not.toBeNull();
    });

    it('renders the NPC tab with sheet chrome and controls', () => {
        const context = npcContext();
        const element = renderSheetParts([{ template: headerSrc }, { template: tabsSrc }, { template: npcTabSrc }], context);

        expect(element.textContent).toContain('GM Tools');
        expect(element.textContent).toContain('Scale to Threat');
        expect(element.querySelector('[data-action="toggleHordeMode"]')).not.toBeNull();
        expect(element.querySelector('input[name="system.threatLevel"]')).not.toBeNull();
    });

    it('renders a direct characteristic roll overlay on the statistics page', () => {
        const context = {
            ...playerContext(),
            tab: { id: 'skills', group: 'primary', cssClass: 'tab-skills', active: true },
        };
        const element = renderSheet(skillsTabSrc, context);

        const overlay = element.querySelector<HTMLElement>('.wh40k-char-hud-circle [data-roll-type="characteristic"]');
        expect(overlay).not.toBeNull();
        expect(overlay?.querySelector('.fa-dice-d20')).not.toBeNull();
        expect(overlay?.dataset.rollTarget).toBeTruthy();
    });
});
