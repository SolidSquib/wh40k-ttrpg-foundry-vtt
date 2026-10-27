/**
 * Only War · talents and traits a committed regiment grants.
 *
 * Pure planning helpers for `actions/ow-regiment-apply.ts`: which talents an
 * owned origin item grants (fixed, or resolved from the player's choices),
 * which traits, and how duplicates collapse. No Foundry access.
 */

/** What the apply step reads from a created owned `originPath` item (an {@link OriginPathData} satisfies it). */
interface GrantSource {
    readonly grants: {
        readonly talents: ReadonlyArray<{ readonly uuid: string; readonly specialization: string }>;
        readonly traits: ReadonlyArray<{ readonly name: string; readonly uuid: string; readonly level: number | null }>;
    };
    readonly activeModifiers: ReadonlyArray<{ readonly type: string; readonly itemUuid: string | null; readonly specialization?: string }>;
}

export interface TalentPlan {
    readonly uuid: string;
    readonly specialization: string;
}

/** Talents an owned origin item grants, fixed or choice-resolved. Pure. */
export function talentPlansFor(source: GrantSource): TalentPlan[] {
    const plans: TalentPlan[] = [];
    for (const talent of source.grants.talents) {
        if (talent.uuid !== '') plans.push({ uuid: talent.uuid, specialization: talent.specialization });
    }
    for (const mod of source.activeModifiers) {
        if (mod.type === 'talent' && mod.itemUuid !== null && mod.itemUuid !== '') plans.push({ uuid: mod.itemUuid, specialization: mod.specialization ?? '' });
    }
    return plans;
}

/** Drop later duplicates of the same talent + specialisation. Pure. */
export function dedupeTalentPlans(plans: ReadonlyArray<TalentPlan>): TalentPlan[] {
    const seen = new Set<string>();
    const out: TalentPlan[] = [];
    for (const plan of plans) {
        const key = `${plan.uuid}::${plan.specialization.toLowerCase().trim()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(plan);
    }
    return out;
}

export interface TraitPlan {
    /** The name the regiment option gives the trait ("Unnatural Strength"); several share one generated trait. */
    readonly name: string;
    readonly uuid: string;
    readonly level: number | null;
}

/** Traits an owned origin item grants outright (those with a generated trait to copy). Pure. */
export function traitPlansFor(source: GrantSource): TraitPlan[] {
    return source.grants.traits.filter((trait) => trait.uuid !== '').map((trait) => ({ name: trait.name, uuid: trait.uuid, level: trait.level }));
}

/** Drop later duplicates of the same trait under the same name. Pure. */
export function dedupeTraitPlans(plans: ReadonlyArray<TraitPlan>): TraitPlan[] {
    const seen = new Set<string>();
    return plans.filter((plan) => {
        const key = `${plan.uuid}::${plan.name.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
