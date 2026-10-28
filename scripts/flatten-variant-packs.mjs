#!/usr/bin/env node
/**
 * Flatten per-line variant containers in compendium `_source` JSON to their
 * Only War branch, mirroring `materializeItemVariants` in
 * `src/module/utils/item-variant-utils.ts` (active line = `ow`).
 *
 * Dry-run by default: reports per-file container counts and any container that
 * could not be resolved. `--write` rewrites the files (indent 4, trailing
 * newline — the repo's pack style). `--root <dir>` overrides the search root.
 * `--snapshot <file>` writes a JSON map { relPath: resolvedSystem } computed
 * independently of the rewrite, for diffing against a later load.
 *
 * `system.cost` is a schema-level per-line block, not a variant container: it is
 * recursed into but never collapsed (see SHARED_LINE_OBJECT_KEYS).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const LINE_ORDER = ['dh1', 'dh2', 'rt', 'dw', 'bc', 'ow', 'im'];
const LINES = new Set(LINE_ORDER);
const SHARED_OBJECT_KEYS = new Set(['cost']);
const ACTIVE = 'ow';

const args = process.argv.slice(2);
const write = args.includes('--write');
const rootIdx = args.indexOf('--root');
const root = rootIdx >= 0 ? args[rootIdx + 1] : 'src/packs-private';
const snapIdx = args.indexOf('--snapshot');
const snapshotPath = snapIdx >= 0 ? args[snapIdx + 1] : null;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isLineContainer = (v) => isObj(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => LINES.has(k));
const isBookContainer = (v) => isObj(v) && isObj(v.__books);
const defined = (v) => v !== undefined && v !== null;

function rawLines(system) {
    const map = system.source;
    if (!isObj(map)) return [];
    return LINE_ORDER.filter((l) => isObj(map[l]) && map[l].provenance === 'raw');
}

function resolveBook(v) {
    const { __books: books, __canonical: canonical } = v;
    if (typeof canonical === 'string' && defined(books[canonical])) return books[canonical];
    for (const k of Object.keys(books)) if (defined(books[k])) return books[k];
    return undefined;
}

/** @returns {{resolved: boolean, value: unknown}} */
function resolve(value, fallback) {
    const container = isLineContainer(value) || isBookContainer(value);
    let branch = value;
    if (isLineContainer(value)) {
        branch = value[ACTIVE];
        if (!defined(branch)) for (const l of fallback) if (defined(value[l])) { branch = value[l]; break; }
        if (!defined(branch)) for (const l of LINE_ORDER) if (defined(value[l])) { branch = value[l]; break; }
    }
    if (isBookContainer(branch)) branch = resolveBook(branch);
    if (!container) return { resolved: true, value };
    if (branch === undefined || branch === value) return { resolved: false, value };
    return { resolved: true, value: structuredClone(branch) };
}

function materialize(source, fallback, stats, path) {
    for (const [key, raw] of Object.entries(source)) {
        const next = `${path}.${key}`;
        if (SHARED_OBJECT_KEYS.has(key)) {
            if (isObj(raw)) materialize(raw, fallback, stats, next);
            continue;
        }
        if (isLineContainer(raw) || isBookContainer(raw)) {
            const { resolved, value } = resolve(raw, fallback);
            if (!resolved) stats.unresolved.push(next);
            else stats.containers++;
            source[key] = isObj(value) ? materialize(value, fallback, stats, next) : value;
            continue;
        }
        if (isObj(raw)) materialize(raw, fallback, stats, next);
    }
    return source;
}

function* sourceFiles(dir) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) yield* sourceFiles(full);
        else if (name.endsWith('.json') && full.includes('/_source/')) yield full;
    }
}

let files = 0;
let touched = 0;
let containers = 0;
const unresolved = [];
const snapshot = {};
for (const file of sourceFiles(root)) {
    files++;
    const text = readFileSync(file, 'utf8');
    const doc = JSON.parse(text);
    if (!isObj(doc.system)) continue;
    const stats = { containers: 0, unresolved: [] };
    const before = JSON.stringify(doc.system);
    materialize(doc.system, rawLines(doc.system), stats, 'system');
    containers += stats.containers;
    for (const u of stats.unresolved) unresolved.push(`${relative(root, file)} ${u}`);
    if (JSON.stringify(doc.system) !== before) {
        touched++;
        if (snapshotPath) snapshot[relative(root, file)] = doc.system;
        if (write) writeFileSync(file, `${JSON.stringify(doc, null, 4)}\n`);
    }
}
if (snapshotPath) writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`[flatten-variant-packs] ${write ? 'WROTE' : 'dry-run'}: ${files} files scanned, ${touched} changed, ${containers} containers collapsed, ${unresolved.length} unresolved`);
for (const u of unresolved.slice(0, 40)) console.log(`  unresolved: ${u}`);
process.exit(unresolved.length > 0 ? 1 : 0);
