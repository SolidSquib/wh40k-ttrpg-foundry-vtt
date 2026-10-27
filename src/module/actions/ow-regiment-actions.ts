/**
 * @file Only War — Regiment panel action handlers (#151).
 *
 * Wired into `CharacterSheet.DEFAULT_OPTIONS.actions`. The
 * `data-action="owRegimentEdit"` button on the regiment panel routes through
 * `owRegimentEdit`, which opens the RegimentBuilderDialog against the owning
 * actor. The option catalog is read from the OW compendium packs
 * (`utils/regiment-catalog.ts`, Direction #7).
 */

import RegimentBuilderDialog from '../applications/prompts/regiment-builder-dialog.ts';
import type { WH40KBaseActor } from '../documents/base-actor.ts';
import type { RegimentCatalogEntry } from '../rules/ow-regiment-catalog.ts';
import { loadedRegimentCatalog } from '../utils/regiment-catalog.ts';

/**
 * Structural type the regiment-edit handler expects. Any sheet whose
 * `actor` resolves to a {@link WH40KBaseActor} satisfies this without
 * needing to inherit from a specific sheet base.
 */
export interface OwRegimentActionHost {
    actor: WH40KBaseActor;
}

/**
 * `data-action="owRegimentEdit"` — open the RegimentBuilderDialog
 * against the sheet's owning actor. Static handler, bound to the sheet
 * instance by Foundry's ApplicationV2 action dispatcher.
 */
export async function owRegimentEdit(this: OwRegimentActionHost, event: Event, _target: HTMLElement): Promise<void> {
    event.preventDefault();
    await RegimentBuilderDialog.show(this.actor);
}

/**
 * The catalog for the sheet's synchronous panel build: whatever has finished
 * loading, else empty (the load starts as a side effect and the next render
 * picks it up).
 */
export function resolveRegimentCatalog(): ReadonlyArray<RegimentCatalogEntry> {
    return loadedRegimentCatalog();
}
