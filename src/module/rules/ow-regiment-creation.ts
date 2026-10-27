/**
 * Only War · Regiment Creation budget engine (#151 — OW core.md
 * §"CREATING A REGIMENT").
 *
 * Pure rules / math layer. Per Direction #7 the content (specific
 * Home Worlds, Commanding Officers, Regiment Types, Training and
 * Special Equipment Doctrines, Drawbacks, Standard Kit entries) lives in
 * compendium documents — this module never references concrete option
 * names. The caller supplies the option catalog (resolved from the
 * compendium) and a `RegimentSelection`; the engine returns budget
 * totals, validation issues and the aggregated kit / Logistics effects.
 *
 * The rules, as printed:
 *   - A regiment has 12 points to spend on a Home World, a Commanding
 *     Officer and up to three Doctrines (exactly one of them a Regiment
 *     Type; the rest Training or Special Equipment Doctrines).
 *   - A Regimental Drawback refunds extra points to that budget.
 *   - Points left unspent are not lost: each converts to 2 points of
 *     Standard Kit allowance, on top of the base 30.
 *   - Favoured Weapons are not part of the 12 points; they are Standard
 *     Kit purchases like any other.
 *
 * The engine is RNG-free and actor-decoupled; no I/O, no Foundry
 * Document reads.
 */

/* -------------------------------------------------------------------- */
/*  Budget constants                                                    */
/* -------------------------------------------------------------------- */

/** Regiment Creation points available before any Drawback refund. */
export const REGIMENT_BUDGET = 12;

/** Base Standard Kit allocation points. */
export const STANDARD_KIT_BUDGET = 30;

/** Standard Kit points each unspent Regiment Creation point converts to. */
export const KIT_POINTS_PER_UNSPENT = 2;

/** Most Doctrines (Regiment Type included) a regiment may hold. */
export const MAX_DOCTRINES = 3;

/** Most Regimental Drawbacks a regiment may take. */
export const MAX_DRAWBACKS = 1;

/* -------------------------------------------------------------------- */
/*  Category + option shapes                                            */
/* -------------------------------------------------------------------- */

/**
 * Categories a compendium option can belong to. `drawback` refunds points to
 * the budget; `kitItem` is bought from the Standard Kit allowance rather than
 * the Regiment Creation budget.
 */
export const REGIMENT_OPTION_CATEGORIES = [
    'homeWorld',
    'commandingOfficer',
    'regimentType',
    'trainingDoctrine',
    'specialEquipmentDoctrine',
    'drawback',
    'kitItem',
] as const;

export type RegimentOptionCategory = (typeof REGIMENT_OPTION_CATEGORIES)[number];

/** Categories shown as Regiment Creation budget rows (kit items have their own pool). */
export type RegimentCategory = Exclude<RegimentOptionCategory, 'kitItem'>;

/** Stable iteration order for the category list (chat cards, summaries). */
export const REGIMENT_CATEGORIES: ReadonlyArray<RegimentCategory> = Object.freeze([
    'homeWorld',
    'commandingOfficer',
    'regimentType',
    'trainingDoctrine',
    'specialEquipmentDoctrine',
    'drawback',
]);

/**
 * Mechanical effects of an option that the engine itself aggregates. The
 * rest of what an option grants (characteristics, skills, talents, aptitudes,
 * wounds) rides on the option's own `originPath` data and is applied by the
 * actor's normal origin pipeline.
 *
 * - `skills` / `talents`: opaque ID lists; the engine treats them as strings.
 * - `characteristics`: per-key bonus; options stack additively.
 * - `wounds` / `logistics`: sum.
 * - `kitModifier`: added to the Standard Kit allowance.
 * - `kitBase`: replaces the base Standard Kit allowance (Penal Colony).
 */
export interface RegimentGrants {
    readonly characteristics?: Readonly<Record<string, number>>;
    readonly skills?: ReadonlyArray<string>;
    readonly talents?: ReadonlyArray<string>;
    readonly wounds?: number;
    readonly logistics?: number;
    readonly kitModifier?: number;
    readonly kitBase?: number;
}

/**
 * One selectable option from the compendium catalog. `cost` is the point cost
 * against the Regiment budget (or, for a drawback, the points it refunds; for
 * a kit item, the Standard Kit points it costs).
 */
export interface RegimentOption {
    readonly id: string;
    readonly category: RegimentOptionCategory;
    readonly cost: number;
    /** Display name; falls back to the id when the catalog carries none. */
    readonly label?: string;
    /** Kit items: how many times the regiment may take the item. */
    readonly maxCount?: number;
    readonly grants?: RegimentGrants;
}

/**
 * The current Regiment Creation selection. Single-pick categories use an
 * optional string slot; the doctrine categories accept arrays. Favoured
 * Weapons record the chosen Basic and Heavy weapon; their cost is a kit item.
 */
export interface RegimentSelection {
    readonly homeWorld?: string;
    readonly commandingOfficer?: string;
    readonly regimentType?: string;
    readonly trainingDoctrines: ReadonlyArray<string>;
    readonly specialEquipmentDoctrines: ReadonlyArray<string>;
    /** Regimental Drawbacks taken (stored on the actor as `regimentDrawbacks`); the book allows one. */
    readonly drawbacks: ReadonlyArray<string>;
    readonly favouredWeapons: {
        readonly basic?: string;
        readonly heavy?: string;
    };
}

/* -------------------------------------------------------------------- */
/*  Catalog helpers                                                     */
/* -------------------------------------------------------------------- */

function indexCatalog(catalog: ReadonlyArray<RegimentOption>): ReadonlyMap<string, RegimentOption> {
    const map = new Map<string, RegimentOption>();
    for (const opt of catalog) {
        map.set(opt.id, opt);
    }
    return map;
}

/** Skip empty single-pick slots; preserve order across array slots. */
function* selectionIds(selection: RegimentSelection): Generator<{ id: string; category: RegimentCategory }> {
    const single: ReadonlyArray<[RegimentCategory, string | undefined]> = [
        ['homeWorld', selection.homeWorld],
        ['commandingOfficer', selection.commandingOfficer],
        ['regimentType', selection.regimentType],
    ];
    for (const [category, id] of single) {
        if (id !== undefined && id !== '') yield { id, category };
    }
    for (const id of selection.trainingDoctrines) {
        if (id !== '') yield { id, category: 'trainingDoctrine' };
    }
    for (const id of selection.specialEquipmentDoctrines) {
        if (id !== '') yield { id, category: 'specialEquipmentDoctrine' };
    }
    for (const id of selection.drawbacks) {
        if (id !== '') yield { id, category: 'drawback' };
    }
}

function emptyPerCategory(): Record<RegimentCategory, number> {
    return {
        homeWorld: 0,
        commandingOfficer: 0,
        regimentType: 0,
        trainingDoctrine: 0,
        specialEquipmentDoctrine: 0,
        drawback: 0,
    };
}

/* -------------------------------------------------------------------- */
/*  Regiment budget                                                     */
/* -------------------------------------------------------------------- */

/** Why a selection cannot be committed yet. */
export type RegimentIssue = 'overBudget' | 'missingHomeWorld' | 'missingCommandingOfficer' | 'missingRegimentType' | 'tooManyDoctrines' | 'tooManyDrawbacks';

/** Result of evaluating a Regiment Creation selection against the budget. */
export interface RegimentBudgetResult {
    /** Points spent on options (a drawback's refund is not counted here). */
    readonly spent: number;
    /** `REGIMENT_BUDGET` plus the drawback's refund. */
    readonly budget: number;
    /** Points a drawback returned to the budget. */
    readonly refund: number;
    /** `budget − spent`. Negative when over budget. */
    readonly remaining: number;
    /** Doctrines held: the Regiment Type plus every Training and Special Equipment Doctrine. */
    readonly doctrineCount: number;
    /** Everything still stopping the selection from being committed; empty when valid. */
    readonly issues: ReadonlyArray<RegimentIssue>;
    /** True when the selection is complete and within budget. */
    readonly valid: boolean;
    /** Spend per category, for sheet breakdowns. (`drawback` holds the refund.) */
    readonly perCategory: Record<RegimentCategory, number>;
}

/**
 * Compute the spent / remaining / per-category breakdown of a selection.
 *
 * Valid means the Home World, Commanding Officer and Regiment Type are chosen,
 * no more than {@link MAX_DOCTRINES} doctrines are held, and the spend fits the
 * budget. Unspent points are fine — they become Standard Kit points.
 *
 * Options referenced in the selection but absent from the catalog are skipped.
 */
export function computeRegimentBudget(selection: RegimentSelection, optionCatalog: ReadonlyArray<RegimentOption>): RegimentBudgetResult {
    const lookup = indexCatalog(optionCatalog);
    const perCategory = emptyPerCategory();
    let spent = 0;
    let refund = 0;
    let doctrineCount = 0;
    let drawbackCount = 0;

    for (const ref of selectionIds(selection)) {
        const opt = lookup.get(ref.id);
        if (opt === undefined) continue;
        const cost = Number.isFinite(opt.cost) ? opt.cost : 0;
        perCategory[ref.category] += cost;
        if (ref.category === 'drawback') {
            refund += cost;
            drawbackCount += 1;
            continue;
        }
        spent += cost;
        if (ref.category === 'regimentType' || ref.category === 'trainingDoctrine' || ref.category === 'specialEquipmentDoctrine') doctrineCount += 1;
    }

    const budget = REGIMENT_BUDGET + refund;
    const remaining = budget - spent;

    const resolved = (id: string | undefined): boolean => id !== undefined && lookup.has(id);
    const issues: RegimentIssue[] = [];
    if (!resolved(selection.homeWorld)) issues.push('missingHomeWorld');
    if (!resolved(selection.commandingOfficer)) issues.push('missingCommandingOfficer');
    if (!resolved(selection.regimentType)) issues.push('missingRegimentType');
    if (doctrineCount > MAX_DOCTRINES) issues.push('tooManyDoctrines');
    if (drawbackCount > MAX_DRAWBACKS) issues.push('tooManyDrawbacks');
    if (remaining < 0) issues.push('overBudget');

    return { spent, budget, refund, remaining, doctrineCount, issues, valid: issues.length === 0, perCategory };
}

/* -------------------------------------------------------------------- */
/*  Grant aggregation                                                   */
/* -------------------------------------------------------------------- */

interface MutableGrants {
    characteristics: Record<string, number>;
    skills: string[];
    talents: string[];
    wounds: number;
    logistics: number;
    kitModifier: number;
    kitBase: number | undefined;
}

function mergeGrants(target: MutableGrants, source: RegimentGrants | undefined): void {
    if (source === undefined) return;
    if (source.characteristics !== undefined) {
        for (const [key, value] of Object.entries(source.characteristics)) {
            if (!Number.isFinite(value)) continue;
            target.characteristics[key] = (target.characteristics[key] ?? 0) + value;
        }
    }
    if (source.skills !== undefined) {
        for (const s of source.skills) target.skills.push(s);
    }
    if (source.talents !== undefined) {
        for (const t of source.talents) target.talents.push(t);
    }
    if (source.wounds !== undefined && Number.isFinite(source.wounds)) {
        target.wounds += source.wounds;
    }
    if (source.logistics !== undefined && Number.isFinite(source.logistics)) {
        target.logistics += source.logistics;
    }
    if (source.kitModifier !== undefined && Number.isFinite(source.kitModifier)) {
        target.kitModifier += source.kitModifier;
    }
    if (source.kitBase !== undefined && Number.isFinite(source.kitBase)) {
        // Two options both replacing the base: the smaller (harsher) allowance wins.
        target.kitBase = target.kitBase === undefined ? source.kitBase : Math.min(target.kitBase, source.kitBase);
    }
}

/**
 * Merge the `RegimentGrants` of every option in the selection into a single
 * aggregate. Characteristics sum per key; skill / talent lists concatenate in
 * selection order; wounds, logistics and kitModifier sum; the smallest
 * `kitBase` wins. All numeric slots are present (zero when nothing contributed).
 */
export function aggregateRegimentGrants(selection: RegimentSelection, optionCatalog: ReadonlyArray<RegimentOption>): RegimentGrants {
    const lookup = indexCatalog(optionCatalog);
    const acc: MutableGrants = {
        characteristics: {},
        skills: [],
        talents: [],
        wounds: 0,
        logistics: 0,
        kitModifier: 0,
        kitBase: undefined,
    };

    for (const ref of selectionIds(selection)) {
        const opt = lookup.get(ref.id);
        if (opt === undefined) continue;
        mergeGrants(acc, opt.grants);
    }

    return {
        characteristics: acc.characteristics,
        skills: acc.skills,
        talents: acc.talents,
        wounds: acc.wounds,
        logistics: acc.logistics,
        kitModifier: acc.kitModifier,
        ...(acc.kitBase === undefined ? {} : { kitBase: acc.kitBase }),
    };
}

/* -------------------------------------------------------------------- */
/*  Standard Kit budget                                                 */
/* -------------------------------------------------------------------- */

/** A purchased Standard Kit entry. The same id may appear more than once. */
export interface KitEntry {
    readonly id: string;
    readonly cost: number;
}

/**
 * Result of evaluating a Standard Kit allocation. The kit is "valid" when total
 * spend does not exceed the allowance — leftover kit points may go unused.
 */
export interface KitBudgetResult {
    readonly spent: number;
    readonly remaining: number;
    readonly valid: boolean;
}

/**
 * The Standard Kit allowance: the base ({@link STANDARD_KIT_BUDGET}, or a
 * `kitBase` override), plus {@link KIT_POINTS_PER_UNSPENT} per unspent Regiment
 * Creation point, plus any `kitModifier`.
 */
export function computeKitAllowance(regiment: Pick<RegimentBudgetResult, 'remaining'>, grants: Pick<RegimentGrants, 'kitBase' | 'kitModifier'>): number {
    const base = grants.kitBase !== undefined && Number.isFinite(grants.kitBase) ? grants.kitBase : STANDARD_KIT_BUDGET;
    const modifier = grants.kitModifier !== undefined && Number.isFinite(grants.kitModifier) ? grants.kitModifier : 0;
    return base + KIT_POINTS_PER_UNSPENT * Math.max(0, regiment.remaining) + modifier;
}

/** Sum the cost of every kit entry against an allowance. */
export function computeKitBudget(kit: ReadonlyArray<KitEntry>, allowance: number = STANDARD_KIT_BUDGET): KitBudgetResult {
    let spent = 0;
    for (const entry of kit) {
        if (Number.isFinite(entry.cost)) spent += entry.cost;
    }
    const remaining = allowance - spent;
    return { spent, remaining, valid: remaining >= 0 };
}

/**
 * How many times each kit item has been taken beyond its `maxCount`, for the
 * ids that exceed it. Empty when every item is within its limit.
 */
export function kitOverLimit(kit: ReadonlyArray<KitEntry>, optionCatalog: ReadonlyArray<RegimentOption>): ReadonlyArray<string> {
    const lookup = indexCatalog(optionCatalog);
    const counts = new Map<string, number>();
    for (const entry of kit) counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
    const over: string[] = [];
    for (const [id, count] of counts) {
        const max = lookup.get(id)?.maxCount;
        if (max !== undefined && count > max) over.push(id);
    }
    return over;
}

/* -------------------------------------------------------------------- */
/*  Sheet panel summary                                                 */
/* -------------------------------------------------------------------- */

/** Regiment + Standard Kit budget readouts for the OW Regiment panel, each with its cap. */
export interface RegimentPanelSummary {
    readonly regiment: RegimentBudgetResult;
    readonly kit: KitBudgetResult & { readonly budget: number };
}

/**
 * Evaluate a persisted selection + kit for the sheet's Regiment panel. The kit
 * allowance counts unspent regiment points and the selection's kit effects, so
 * the panel and the builder dialog agree.
 */
export function buildRegimentPanelSummary(
    selection: RegimentSelection,
    kit: ReadonlyArray<KitEntry>,
    optionCatalog: ReadonlyArray<RegimentOption>,
): RegimentPanelSummary {
    const regiment = computeRegimentBudget(selection, optionCatalog);
    const allowance = computeKitAllowance(regiment, aggregateRegimentGrants(selection, optionCatalog));
    return { regiment, kit: { ...computeKitBudget(kit, allowance), budget: allowance } };
}

/* -------------------------------------------------------------------- */
/*  Empty-selection helper                                              */
/* -------------------------------------------------------------------- */

/** A blank `RegimentSelection` with the array slots initialised. */
export function emptyRegimentSelection(): RegimentSelection {
    return {
        trainingDoctrines: [],
        specialEquipmentDoctrines: [],
        drawbacks: [],
        favouredWeapons: {},
    };
}
