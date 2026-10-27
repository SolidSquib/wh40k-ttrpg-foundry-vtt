/**
 * Starting gear an origin or a regiment issues.
 *
 * Pure planning helpers for the steps that put compendium items into a character's inventory: which items an
 * origin's fixed equipment and resolved equipment choices call for, and how the same item issued twice
 * collapses into one stack. No Foundry access. Which items exist is compendium data — a plan only carries the
 * UUID the content names.
 */

/** One stack of an item to issue. */
export interface GearPlan {
    readonly uuid: string;
    readonly quantity: number;
    /** Blank when the item is issued at its own craftsmanship. */
    readonly craftsmanship: string;
}

/** What the planner reads from an origin: its fixed equipment and its resolved choices (an {@link OriginPathData} satisfies it). */
export interface GearSource {
    readonly grants?: {
        readonly equipment?: ReadonlyArray<{
            readonly uuid?: string | undefined;
            readonly quantity?: number | undefined;
            readonly craftsmanship?: string | undefined;
        }>;
    };
    readonly activeModifiers?: ReadonlyArray<{
        readonly type?: string | undefined;
        readonly itemUuid?: string | null | undefined;
        readonly value?: number | string | null | undefined;
        readonly craftsmanship?: string | undefined;
    }>;
}

/** A quantity as a positive count; anything missing, non-numeric or below one is a single item. */
const positive = (quantity: number | string | null | undefined): number => {
    const count = Number(quantity);
    return Number.isFinite(count) && count >= 1 ? count : 1;
};

/** The gear an origin issues: its fixed equipment, then the equipment its choices resolved to. Entries with no UUID are skipped. */
export function gearPlansFor(source: GearSource): GearPlan[] {
    const plans: GearPlan[] = [];
    for (const entry of source.grants?.equipment ?? []) {
        if (entry.uuid !== undefined && entry.uuid !== '')
            plans.push({ uuid: entry.uuid, quantity: positive(entry.quantity), craftsmanship: entry.craftsmanship ?? '' });
    }
    for (const mod of source.activeModifiers ?? []) {
        if (mod.type === 'equipment' && mod.itemUuid !== undefined && mod.itemUuid !== null && mod.itemUuid !== '') {
            plans.push({ uuid: mod.itemUuid, quantity: positive(mod.value), craftsmanship: mod.craftsmanship ?? '' });
        }
    }
    return plans;
}

/** Add up plans for the same item at the same craftsmanship, keeping first-seen order. */
export function mergeGearPlans(plans: ReadonlyArray<GearPlan>): GearPlan[] {
    const merged = new Map<string, GearPlan>();
    for (const plan of plans) {
        const key = `${plan.uuid}::${plan.craftsmanship}`;
        const held = merged.get(key);
        merged.set(key, held === undefined ? plan : { ...held, quantity: held.quantity + plan.quantity });
    }
    return [...merged.values()];
}
