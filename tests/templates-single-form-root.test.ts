import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * An ApplicationV2 part must render ONE root element, and an HTML parser ignores a `<form>` opened inside another:
 * the inner `</form>` then closes the outer one early, and whatever follows (a dialog's buttons) becomes a second
 * root. Foundry refuses to render such a part ("must render a single HTML element"), as the Assign Damage dialog
 * once did. A template may hold at most one `<form>`.
 */
const ROOT = join(process.cwd(), 'src/templates');

function templates(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return templates(path);
        return path.endsWith('.hbs') ? [path] : [];
    });
}

describe('templates', () => {
    it('no template nests a form inside a form', () => {
        const nested = templates(ROOT)
            .filter((path) => (readFileSync(path, 'utf8').match(/<form[\s>]/g) ?? []).length > 1)
            .map((path) => path.slice(ROOT.length + 1));
        expect(nested).toEqual([]);
    });
});
