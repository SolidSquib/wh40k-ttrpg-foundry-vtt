/**
 * @file The three Only War origin item types and the step each one holds.
 *
 * What used to be one `originPath` item type is split by what the document *is*:
 *
 *  - `regiment`       — a pre-built regiment (a ready-made set of regiment choices).
 *  - `regimentOption` — one pick in the Regiment Builder's budget (home world,
 *                       regiment type, commanding officer, doctrines, drawbacks, kit).
 *  - `speciality`     — a character's Speciality, or an advanced one taken at a milestone.
 *
 * Pure enums and a step→type table: no content. Content (which regiments, which
 * options) lives in the compendium.
 */

export const ORIGIN_ITEM_TYPES = ['regiment', 'regimentOption', 'speciality'] as const;

export type OriginItemType = (typeof ORIGIN_ITEM_TYPES)[number];

/** The item type a document in a given origin-path step belongs to. */
const STEP_TYPE: Readonly<Record<string, OriginItemType>> = {
    regiment: 'regiment',
    speciality: 'speciality',
    advancedSpeciality: 'speciality',
    homeWorld: 'regimentOption',
    regimentType: 'regimentOption',
    commandingOfficer: 'regimentOption',
    trainingDoctrine: 'regimentOption',
    equipmentDoctrine: 'regimentOption',
    regimentalDrawback: 'regimentOption',
    kitItem: 'regimentOption',
};

/** Is `type` one of the origin item types? Narrows to {@link OriginItemType}. */
export function isOriginItemType(type: string | null | undefined): type is OriginItemType {
    return type !== null && type !== undefined && (ORIGIN_ITEM_TYPES as readonly string[]).includes(type);
}

/**
 * The origin item type for a step key. Unknown steps fall back to `regimentOption`
 * (the generic pick), so legacy documents still land somewhere valid.
 */
export function originItemTypeForStep(step: string | null | undefined): OriginItemType {
    return (step !== null && step !== undefined ? STEP_TYPE[step] : undefined) ?? 'regimentOption';
}

/**
 * Legacy read-compat: rewrite a stored `originPath` item source to its new type,
 * decided by `system.step`. Runs before validation, so old world items, owned
 * items and imports keep loading. A no-op for any other source.
 */
// eslint-disable-next-line no-restricted-syntax -- boundary: Foundry `migrateData` source is an untyped payload before schema validation
export function migrateLegacyOriginType(source: Record<string, unknown>): void {
    if (source['type'] !== 'originPath') return;
    const system = source['system'];
    // eslint-disable-next-line no-restricted-syntax -- boundary: narrowed to an object before reading `step`; the stored system payload is untyped
    const step = system !== null && typeof system === 'object' ? (system as { step?: unknown }).step : undefined;
    source['type'] = originItemTypeForStep(typeof step === 'string' ? step : undefined);
}

/** Legacy read-compat for an actor source: rewrite each embedded `originPath` item (see {@link migrateLegacyOriginType}). */
// eslint-disable-next-line no-restricted-syntax -- boundary: Foundry actor `migrateData` source is an untyped payload before schema validation
export function migrateLegacyOwnedOriginTypes(actorSource: Record<string, unknown>): void {
    const items = actorSource['items'];
    if (!Array.isArray(items)) return;
    for (const item of items) {
        // eslint-disable-next-line no-restricted-syntax -- boundary: embedded item sources are untyped before validation
        if (item !== null && typeof item === 'object') migrateLegacyOriginType(item as Record<string, unknown>);
    }
}
