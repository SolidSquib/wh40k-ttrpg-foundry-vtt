/**
 * @file Read-compat for stored data that still carries per-game-line "variant
 * containers" (`{ dh1: …, dh2: …, ow: … }`) at a field.
 *
 * Pack sources are flat Only War values; this exists only so older world items
 * (and homebrew copied before the flatten) keep loading. It collapses every
 * container to its Only War branch in place, falling back to the first authored
 * line when no Only War branch exists. `system.cost` is a schema-level per-line
 * block, not a container: it is recursed into but never collapsed.
 */

const LINE_ORDER = ['dh1', 'dh2', 'rt', 'dw', 'bc', 'ow', 'im'] as const;
const LINES: ReadonlySet<string> = new Set(LINE_ORDER);
const SHARED_OBJECT_KEYS: ReadonlySet<string> = new Set(['cost']);
const ACTIVE_LINE = 'ow';

// eslint-disable-next-line no-restricted-syntax -- boundary: Foundry `_migrateData` source payloads are untyped before schema validation; this alias is the single place that admits it
type Raw = unknown;
type PlainObject = Record<string, Raw>;

function isPlainObject(value: Raw): value is PlainObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Set) && !(value instanceof Map);
}

function isLineContainer(value: Raw): value is PlainObject {
    if (!isPlainObject(value)) return false;
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every((key) => LINES.has(key));
}

/** Book-variant container: `{ __books: { slug: value }, __canonical?: slug }`. */
function isBookContainer(value: Raw): value is { __books: PlainObject; __canonical?: Raw } {
    return isPlainObject(value) && isPlainObject(value['__books']);
}

function defined(value: Raw): boolean {
    return value !== undefined && value !== null;
}

function resolveBook(container: { __books: PlainObject; __canonical?: Raw }): Raw {
    const books = container.__books;
    const canonical = container.__canonical;
    if (typeof canonical === 'string' && defined(books[canonical])) return books[canonical];
    for (const key of Object.keys(books)) {
        if (defined(books[key])) return books[key];
    }
    return undefined;
}

/** The `provenance: 'raw'` lines in a system's `source` map — the fallback when no Only War branch exists. */
function rawProvenanceLines(system: PlainObject): string[] {
    const sourceMap = system['source'];
    if (!isPlainObject(sourceMap)) return [];
    return LINE_ORDER.filter((line) => {
        const entry = sourceMap[line];
        return isPlainObject(entry) && entry['provenance'] === 'raw';
    });
}

function collapse(container: PlainObject, fallback: readonly string[]): Raw {
    if (defined(container[ACTIVE_LINE])) return container[ACTIVE_LINE];
    for (const line of fallback) {
        if (defined(container[line])) return container[line];
    }
    for (const line of LINE_ORDER) {
        if (defined(container[line])) return container[line];
    }
    return undefined;
}

function flatten(source: PlainObject, fallback: readonly string[]): PlainObject {
    for (const [key, raw] of Object.entries(source)) {
        if (SHARED_OBJECT_KEYS.has(key)) {
            if (isPlainObject(raw)) flatten(raw, fallback);
            continue;
        }
        if (isLineContainer(raw) || isBookContainer(raw)) {
            let branch: Raw = raw;
            if (isLineContainer(raw)) branch = collapse(raw, fallback);
            if (isBookContainer(branch)) branch = resolveBook(branch);
            if (branch === undefined || branch === raw) continue; // nothing authored: leave for validation to reject
            const cloned = structuredClone(branch);
            source[key] = isPlainObject(cloned) ? flatten(cloned, fallback) : cloned;
            continue;
        }
        if (isPlainObject(raw)) flatten(raw, fallback);
    }
    return source;
}

/** Collapse every legacy variant container in an item `system` payload to its Only War value, in place. */
export function flattenLegacySystem(system: PlainObject): PlainObject {
    return flatten(system, rawProvenanceLines(system));
}

/**
 * Collapse legacy containers on a `_migrateData` source. Foundry passes either the
 * inner `system` payload or the whole document (with `system` nested).
 */
export function flattenLegacySource(source: PlainObject): void {
    const system = source['system'];
    flattenLegacySystem(isPlainObject(system) ? system : source);
}

/** Collapse legacy containers on every embedded item of a raw actor source, in place. */
export function flattenLegacyOwnedItems(actorSource: PlainObject): void {
    const items = actorSource['items'];
    if (!Array.isArray(items)) return;
    for (const item of items) {
        if (isPlainObject(item) && isPlainObject(item['system'])) flattenLegacySystem(item['system']);
    }
}
