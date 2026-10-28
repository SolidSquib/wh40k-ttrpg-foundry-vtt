/**
 * @file Starting Wounds / Fate rolls for the Origin Path Builder.
 *
 * The builder rolls these itself, inline, whenever an origin that grants them is
 * confirmed (and again on Re-roll), so there is no roll pop-up to click through.
 * The formula grammar is content-agnostic and lives here:
 *
 *  - **Wounds** — `"8+1d5"`, `"2xTB+1d5+2"`: `NxTB` is N × the character's Toughness Bonus.
 *  - **Fate**   — a plain number (`"3"`), or conditional bands on a d10 such as
 *    `"(1-5|=2),(6-10|=3)"`.
 *
 * The pure helpers take already-rolled dice, so they are unit-testable without Foundry;
 * {@link rollOriginStat} is the one function that touches `Roll`.
 */

import type { WH40KBaseActor } from '../../documents/base-actor.ts';
import { firstSystemId } from '../../utils/chat-system-id.ts';

/** Which starting stat a formula feeds. */
export type OriginStatType = 'wounds' | 'fate';

/** A finished roll: the stat total and a human-readable derivation. */
export interface OriginStatRoll {
    /** The value to store (wounds, or Fate Points). */
    total: number;
    /** What was rolled: the raw d10 for fate, the total for wounds. */
    rolled: number;
    /** e.g. `2×4 + [3] + 2 = 13` or `Rolled 7 on 1d10 (6-10 → 3 Fate Points)`. */
    breakdown: string;
    /** The formula with Toughness Bonus substituted (wounds only), for display. */
    expandedFormula: string;
}

const TB_TERM = /(\d+)xTB/gi;

/** A stored roll slot: the schema initialises it to `{ rolled: null }` until a roll is made. */
interface StoredStatRoll {
    rolled?: number | null | undefined;
}

/**
 * Drop roll slots that hold no roll. The origin schema seeds `rolled: null`, which the builder's
 * "has this been rolled?" checks (`rolled === undefined`) read as already rolled — so an unrolled
 * origin looked finished and was never auto-rolled. Pruning the empty slots makes absence mean unrolled.
 */
export function pruneUnrolledResults<T extends StoredStatRoll>(results: Record<string, T | undefined> | undefined): Record<string, T> {
    const kept: Record<string, T> = {};
    for (const [stat, entry] of Object.entries(results ?? {})) {
        if (entry !== undefined && typeof entry.rolled === 'number') kept[stat] = entry;
    }
    return kept;
}

/** `"2xTB+1d5"` → `"2×4+1d5"` — the formula as shown to the player. */
export function expandWoundsFormula(formula: string, tb: number): string {
    return formula.replace(TB_TERM, (_match, multiplier: string) => `${multiplier}×${tb}`);
}

/** `"2xTB+1d5"` → `"8+1d5"` — the formula as handed to `Roll`. */
export function substituteToughnessBonus(formula: string, tb: number): string {
    return formula.replace(TB_TERM, (_match, multiplier: string) => String(parseInt(multiplier, 10) * tb));
}

/**
 * Wounds derivation, with each `NdM` replaced by its rolled faces.
 * @param formula  The authored formula (`2xTB+1d5+2`).
 * @param tb  The character's Toughness Bonus.
 * @param dice  The faces rolled for each dice term, in formula order.
 * @param total  The roll total.
 */
export function formatWoundsBreakdown(formula: string, tb: number, dice: readonly (readonly number[])[], total: number): string {
    const queue = [...dice];
    const body = expandWoundsFormula(formula, tb).replace(/(\d+)d(\d+)/g, (match) => {
        const faces = queue.shift();
        return faces === undefined ? match : `[${faces.join('+')}]`;
    });
    return `${body} = ${total}`;
}

/** Fate from a plain number or conditional d10 bands. `d10` is the roll used for bands. */
export function resolveFateFormula(formula: string, d10: number): { total: number; breakdown: string } {
    const trimmed = formula.trim();
    if (/^\d+$/.test(trimmed)) {
        const total = parseInt(trimmed, 10);
        return { total, breakdown: `${total} Fate Points (fixed)` };
    }
    for (const match of trimmed.matchAll(/\((\d+)-(\d+)\|=(\d+)\)/g)) {
        const [, min, max, outcome] = match;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess parser mismatch: tsconfig.test.json (flag off) types regex captures as defined, tsc (flag on) requires the undefined guard
        if (min === undefined || max === undefined || outcome === undefined) continue;
        if (d10 >= parseInt(min, 10) && d10 <= parseInt(max, 10)) {
            const total = parseInt(outcome, 10);
            return { total, breakdown: `Rolled ${d10} on 1d10 (${min}-${max} → ${total} Fate Points)` };
        }
    }
    return { total: 0, breakdown: `Rolled ${d10} on 1d10 (no band matched "${trimmed}")` };
}

/** Roll an origin's starting Wounds or Fate, posting the roll to chat. */
export async function rollOriginStat(
    statType: OriginStatType,
    formula: string,
    actor: WH40KBaseActor,
    origin: { name: string; img?: string | undefined },
): Promise<OriginStatRoll> {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- noUncheckedIndexedAccess parser mismatch: tsconfig.test.json (flag off) types the characteristic as defined, tsc (flag on) requires the optional chain
    const tb = actor.system.characteristics.toughness?.bonus ?? 0;
    let outcome: OriginStatRoll;
    let roll: Roll;

    if (statType === 'wounds') {
        roll = new Roll(substituteToughnessBonus(formula, tb));
        await roll.evaluate();
        const dice = roll.terms.filter((t): t is foundry.dice.terms.Die => t instanceof foundry.dice.terms.Die).map((t) => t.results.map((r) => r.result));
        const total = roll.total ?? 0;
        outcome = { total, rolled: total, breakdown: formatWoundsBreakdown(formula, tb, dice, total), expandedFormula: expandWoundsFormula(formula, tb) };
    } else {
        roll = new Roll('1d10');
        await roll.evaluate();
        const d10 = roll.total ?? 0;
        const fate = resolveFateFormula(formula, d10);
        outcome = { total: fate.total, rolled: d10, breakdown: fate.breakdown, expandedFormula: formula };
    }

    const html = await foundry.applications.handlebars.renderTemplate('systems/wh40k-rpg/templates/chat/origin-roll-card.hbs', {
        _gameSystemId: firstSystemId(actor),
        actor: actor.name,
        actorImg: actor.img,
        origin: origin.name,
        originImg: origin.img ?? '',
        rollType: statType,
        rollTypeLabel: game.i18n.localize(statType === 'wounds' ? 'WH40K.Wounds' : 'WH40K.Fate'),
        formula,
        result: outcome.total,
        breakdown: outcome.breakdown,
        timestamp: new Date().toLocaleTimeString(),
    });
    await ChatMessage.create({ content: html, speaker: ChatMessage.getSpeaker({ actor }), rolls: [roll] });
    return outcome;
}
