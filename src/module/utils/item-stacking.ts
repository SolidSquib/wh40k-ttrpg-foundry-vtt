/**
 * @file Stack merging for owned physical items.
 *
 * Gear arrives from several places (a regiment's standard kit, a Speciality's
 * Specialist Equipment, a shop purchase), each creating its own item, so one actor
 * ends up with "Krak Grenade ×4" and "Krak Grenade ×2". Two items belong in one stack
 * when they are the same thing in the same state: same type, same identity, and every
 * other piece of their stored data equal. `quantity` is the one field allowed to
 * differ — it is what gets summed.
 *
 * Pure: it plans the merge from item data; the actor applies it.
 */

/** The surface of an owned item the planner reads. A `WH40KItem` satisfies it. */
export interface StackableItem {
    id: string | null;
    name: string;
    type: string;
    system: { quantity?: number | undefined };
    /** The persisted (lean) system data — compared as a whole, minus `quantity`. */
    // eslint-disable-next-line no-restricted-syntax -- boundary: Foundry Document `_source.system` is an untyped stored payload
    _source?: { system?: Record<string, unknown> } | undefined;
    /** The system's own flag scope (`flags['wh40k-rpg']`): provenance markers such as origin grants. */
    // eslint-disable-next-line no-restricted-syntax -- boundary: Foundry Document flags are an untyped bag
    scopeFlags?: Record<string, unknown> | undefined;
}

/** One merge: keep `keepId` at `quantity` and delete `removeIds`. */
export interface StackMergePlan {
    keepId: string;
    name: string;
    quantity: number;
    removeIds: string[];
    /**
     * The merged stack's flag scope. A provenance flag survives if ANY stack had it, so
     * whichever source later re-applies (a regiment kit, an origin grant) still finds, and
     * replaces, its share of the merged stack.
     */
    // eslint-disable-next-line no-restricted-syntax -- boundary: Foundry Document flags are an untyped bag
    scopeFlags: Record<string, unknown>;
}

/** JSON with object keys sorted, so equal data stringifies equally whatever its key order. */
// eslint-disable-next-line no-restricted-syntax -- boundary: serialises an arbitrary untyped stored payload
function stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
    }
    return value === undefined ? 'undefined' : JSON.stringify(value);
}

/**
 * The identity two items must share to stack, or `null` when the item cannot stack
 * (it has no numeric quantity or no stored data to compare).
 */
export function stackSignature(item: StackableItem): string | null {
    const quantity = item.system.quantity;
    const stored = item._source?.system;
    if (typeof quantity !== 'number' || stored === undefined) return null;
    const { quantity: _quantity, ...rest } = stored;
    return `${item.type}|${item.name}|${stableStringify(rest)}`;
}

/** OR the boolean provenance flags of a group; for any other key the first stack's value wins. */
// eslint-disable-next-line no-restricted-syntax -- boundary: Foundry Document flags are an untyped bag
function mergeScopeFlags(group: readonly StackableItem[]): Record<string, unknown> {
    // eslint-disable-next-line no-restricted-syntax -- boundary: Foundry Document flags are an untyped bag
    const merged: Record<string, unknown> = {};
    for (const item of group) {
        for (const [key, value] of Object.entries(item.scopeFlags ?? {})) {
            if (!(key in merged) || (value === true && merged[key] !== true)) merged[key] = value;
        }
    }
    return merged;
}

/** Plan which stacks to merge. Items with no id, or a unique signature, are left alone. */
export function planStackMerges(items: readonly StackableItem[]): StackMergePlan[] {
    const groups = new Map<string, StackableItem[]>();
    for (const item of items) {
        if (item.id === null) continue;
        const signature = stackSignature(item);
        if (signature === null) continue;
        const group = groups.get(signature) ?? [];
        group.push(item);
        groups.set(signature, group);
    }

    const plans: StackMergePlan[] = [];
    for (const group of groups.values()) {
        const [keep, ...rest] = group;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-optional-chain -- noUncheckedIndexedAccess parser mismatch: tsconfig.test.json (flag off) types `keep` as defined, tsc (flag on) requires the undefined guard
        if (keep === undefined || keep.id === null || rest.length === 0) continue;
        const quantity = group.reduce((sum, item) => {
            const each = item.system.quantity;
            return sum + (typeof each === 'number' ? each : 0);
        }, 0);
        plans.push({
            keepId: keep.id,
            name: keep.name,
            quantity,
            removeIds: rest.flatMap((item) => (item.id === null ? [] : [item.id])),
            scopeFlags: mergeScopeFlags(group),
        });
    }
    return plans;
}
