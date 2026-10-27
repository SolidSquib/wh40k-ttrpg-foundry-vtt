/**
 * Only War · Regiment Creation catalog mapping.
 *
 * Turns the `originPath` compendium documents that carry a `system.regiment`
 * block into the engine's {@link RegimentOption} shape. Pure — the Foundry
 * pack walk that feeds it lives in `utils/regiment-catalog.ts`. Per Direction
 * #7 nothing here names a concrete Home World, Doctrine or kit item.
 */

import { iterateResolvedChoices } from '../utils/origin-choices.ts';
import { REGIMENT_OPTION_CATEGORIES, type RegimentGrants, type RegimentOption, type RegimentOptionCategory } from './ow-regiment-creation.ts';
import type { RegimentDrawback } from './ow-regiment-drawback.ts';

/** The `system.regiment` block of an `originPath` document. */
export interface RegimentBlockLike {
    readonly category?: string;
    readonly cost?: number;
    readonly kitBase?: number | null;
    readonly kitModifier?: number;
    readonly logistics?: number;
    readonly maxCount?: number;
    readonly restriction?: string;
    readonly kit?: ReadonlyArray<{ readonly label: string; readonly scope: 'character' | 'squad' }>;
}

/** One entry of an `originPath` document's `system.grants.choices`. */
export interface RegimentChoiceDocLike {
    readonly label?: string;
    readonly name?: string;
    readonly count?: number;
    readonly options?: ReadonlyArray<{ readonly value?: string; readonly name?: string; readonly label?: string }>;
}

/** The slice of an `originPath` document the catalog reads (a pack index entry or a document's `system`). */
export interface RegimentDocLike {
    readonly name: string;
    readonly system?: {
        readonly regiment?: RegimentBlockLike;
        readonly grants?: { readonly choices?: ReadonlyArray<RegimentChoiceDocLike> };
    };
}

/** A pick the player must make on a selected option: choose `count` of `options`. */
export interface RegimentChoice {
    /** Key the picks are stored under (`selectedChoices` on the owned origin item). */
    readonly key: string;
    readonly label: string;
    readonly count: number;
    readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
}

/** A catalog option plus what the dialog shows for it. */
export interface RegimentCatalogEntry extends RegimentOption {
    readonly label: string;
    readonly restriction: string;
    readonly kit: ReadonlyArray<{ readonly label: string; readonly scope: 'character' | 'squad' }>;
    readonly choices: ReadonlyArray<RegimentChoice>;
}

function isOptionCategory(value: string | undefined): value is RegimentOptionCategory {
    return value !== undefined && (REGIMENT_OPTION_CATEGORIES as ReadonlyArray<string>).includes(value);
}

/**
 * Map one document to a catalog entry, or `undefined` when it carries no
 * regiment metadata (an ordinary origin, or an empty category).
 */
export function regimentEntryFromDoc(uuid: string, doc: RegimentDocLike): RegimentCatalogEntry | undefined {
    const regiment = doc.system?.regiment;
    if (regiment === undefined || !isOptionCategory(regiment.category)) return undefined;

    const grants: RegimentGrants = {
        ...(regiment.logistics !== undefined && regiment.logistics !== 0 ? { logistics: regiment.logistics } : {}),
        ...(regiment.kitModifier !== undefined && regiment.kitModifier !== 0 ? { kitModifier: regiment.kitModifier } : {}),
        ...(regiment.kitBase !== undefined && regiment.kitBase !== null ? { kitBase: regiment.kitBase } : {}),
    };

    const choices: RegimentChoice[] = [];
    for (const resolved of iterateResolvedChoices(doc.system?.grants?.choices ?? [], {})) {
        const options = (resolved.choice.options ?? []).map((opt) => ({ value: opt.value ?? opt.name ?? '', label: opt.label ?? opt.name ?? opt.value ?? '' }));
        choices.push({ key: resolved.choiceKey, label: resolved.baseLabel, count: resolved.choice.count ?? 1, options });
    }

    return {
        id: uuid,
        category: regiment.category,
        cost: regiment.cost ?? 0,
        label: doc.name,
        restriction: regiment.restriction ?? '',
        kit: regiment.kit ?? [],
        choices,
        ...(regiment.category === 'kitItem' && regiment.maxCount !== undefined ? { maxCount: regiment.maxCount } : {}),
        grants,
    };
}

/** Entries of one category, sorted by cost then name so the dialog lists cheap options first. */
export function entriesInCategory(catalog: ReadonlyArray<RegimentCatalogEntry>, category: RegimentOptionCategory): RegimentCatalogEntry[] {
    return catalog.filter((entry) => entry.category === category).sort((a, b) => a.cost - b.cost || a.label.localeCompare(b.label));
}

/** Picks stored for an option: choice key → chosen option values. */
export type RegimentPicks = Readonly<Record<string, ReadonlyArray<string>>>;

/** True when every choice on the entry has exactly the number of picks it asks for. */
export function choicesComplete(entry: Pick<RegimentCatalogEntry, 'choices'>, picks: RegimentPicks | undefined): boolean {
    return entry.choices.every((choice) => (picks?.[choice.key] ?? []).length === Math.min(choice.count, choice.options.length));
}

/**
 * Toggle one option inside a choice's picks. Picking past `count` drops the
 * oldest pick, so a "choose two" row behaves like a sliding window.
 */
export function togglePick(current: ReadonlyArray<string>, value: string, count: number): string[] {
    if (current.includes(value)) return current.filter((v) => v !== value);
    const next = [...current, value];
    return next.length > count ? next.slice(next.length - count) : next;
}

/** The picks stored for one choice of one option, or none. */
export function picksFor(all: Readonly<Record<string, RegimentPicks>>, optionId: string, key: string): ReadonlyArray<string> {
    return new Map(Object.entries(new Map(Object.entries(all)).get(optionId) ?? {})).get(key) ?? [];
}

/**
 * The drawback panel's descriptor for a drawback id, from the catalog. The refund is the option's cost; its
 * penalties ride on the owned origin item the regiment commit creates, so the panel adds none of its own.
 */
export function drawbackDescriptorFor(catalog: ReadonlyArray<RegimentCatalogEntry>, id: string): RegimentDrawback | undefined {
    const entry = catalog.find((candidate) => candidate.id === id && candidate.category === 'drawback');
    return entry === undefined ? undefined : { id, description: entry.label, refund: entry.cost, penalty: {} };
}
