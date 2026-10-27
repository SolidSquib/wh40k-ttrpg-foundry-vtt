import { describe, expect, it } from 'vitest';
import {
    aggregateRegimentGrants,
    buildRegimentPanelSummary,
    computeKitAllowance,
    computeKitBudget,
    computeRegimentBudget,
    emptyRegimentSelection,
    kitOverLimit,
    KIT_POINTS_PER_UNSPENT,
    MAX_DOCTRINES,
    REGIMENT_BUDGET,
    REGIMENT_CATEGORIES,
    type RegimentOption,
    type RegimentSelection,
    STANDARD_KIT_BUDGET,
} from './ow-regiment-creation';

/* -------------------------------------------------------------- */
/*  Fixtures (content-agnostic ids only)                          */
/* -------------------------------------------------------------- */

/**
 * Synthetic catalog. Ids are intentionally opaque ("hw-a", "ct-3") so the test
 * surface stays content-agnostic — the engine must not care which compendium
 * document the option originated from.
 */
const CATALOG: ReadonlyArray<RegimentOption> = [
    { id: 'hw-a', category: 'homeWorld', cost: 3, grants: { characteristics: { weaponSkill: 3 }, skills: ['skill-survival'], wounds: 1 } },
    { id: 'hw-b', category: 'homeWorld', cost: 2, grants: { characteristics: { toughness: 3 }, talents: ['talent-hardy'] } },
    { id: 'hw-penal', category: 'homeWorld', cost: 2, grants: { kitBase: 15 } },
    { id: 'hw-rich', category: 'homeWorld', cost: 3, grants: { logistics: 10 } },
    { id: 'co-a', category: 'commandingOfficer', cost: 2, grants: { logistics: 5 } },
    { id: 'co-b', category: 'commandingOfficer', cost: 1 },
    { id: 'rt-a', category: 'regimentType', cost: 2, grants: { skills: ['skill-stealth'] } },
    { id: 'rt-b', category: 'regimentType', cost: 5, grants: { wounds: 2 } },
    { id: 'td-a', category: 'trainingDoctrine', cost: 1, grants: { talents: ['talent-sprint'] } },
    { id: 'td-b', category: 'trainingDoctrine', cost: 2 },
    { id: 'sed-a', category: 'specialEquipmentDoctrine', cost: 1, grants: { kitModifier: 5 } },
    { id: 'sed-b', category: 'specialEquipmentDoctrine', cost: 3 },
    { id: 'db-a', category: 'drawback', cost: 3, grants: { kitModifier: -5 } },
    { id: 'db-b', category: 'drawback', cost: 6 },
    { id: 'kit-a', category: 'kitItem', cost: 5, maxCount: 2 },
    { id: 'kit-b', category: 'kitItem', cost: 10 },
];

const BLANK = emptyRegimentSelection();

/** A complete, in-budget selection: hw-a (3) + co-a (2) + rt-a (2) = 7 of 12. */
const COMPLETE: RegimentSelection = { ...BLANK, homeWorld: 'hw-a', commandingOfficer: 'co-a', regimentType: 'rt-a' };

/* -------------------------------------------------------------- */
/*  Constants                                                     */
/* -------------------------------------------------------------- */

describe('OW Regiment Creation constants', () => {
    it('exposes the printed budgets and limits', () => {
        expect(REGIMENT_BUDGET).toBe(12);
        expect(STANDARD_KIT_BUDGET).toBe(30);
        expect(KIT_POINTS_PER_UNSPENT).toBe(2);
        expect(MAX_DOCTRINES).toBe(3);
    });

    it('lists the budget categories in stable order (favoured weapons are a kit purchase, not a category)', () => {
        expect(REGIMENT_CATEGORIES).toEqual(['homeWorld', 'commandingOfficer', 'regimentType', 'trainingDoctrine', 'specialEquipmentDoctrine', 'drawback']);
    });
});

describe('emptyRegimentSelection', () => {
    it('initialises the array slots and the favoured-weapons sub-slots', () => {
        expect(BLANK.trainingDoctrines).toEqual([]);
        expect(BLANK.specialEquipmentDoctrines).toEqual([]);
        expect(BLANK.drawbacks).toEqual([]);
        expect(BLANK.favouredWeapons).toEqual({});
    });
});

/* -------------------------------------------------------------- */
/*  Regiment budget                                               */
/* -------------------------------------------------------------- */

describe('computeRegimentBudget', () => {
    it('empty selection → nothing spent, the three required picks are missing', () => {
        const r = computeRegimentBudget(BLANK, CATALOG);
        expect(r.spent).toBe(0);
        expect(r.remaining).toBe(12);
        expect(r.valid).toBe(false);
        expect(r.issues).toEqual(['missingHomeWorld', 'missingCommandingOfficer', 'missingRegimentType']);
    });

    it('a complete selection under budget is valid — unspent points are not an error', () => {
        const r = computeRegimentBudget(COMPLETE, CATALOG);
        expect(r.spent).toBe(7);
        expect(r.remaining).toBe(5);
        expect(r.valid).toBe(true);
        expect(r.issues).toEqual([]);
    });

    it('a complete selection that spends exactly 12 is valid', () => {
        const r = computeRegimentBudget({ ...COMPLETE, trainingDoctrines: ['td-b'], specialEquipmentDoctrines: ['sed-b'] }, CATALOG);
        expect(r.spent).toBe(12);
        expect(r.remaining).toBe(0);
        expect(r.valid).toBe(true);
    });

    it('over budget is reported with a negative remainder', () => {
        const r = computeRegimentBudget({ ...COMPLETE, regimentType: 'rt-b', trainingDoctrines: ['td-b'], specialEquipmentDoctrines: ['sed-b'] }, CATALOG);
        expect(r.spent).toBe(3 + 2 + 5 + 2 + 3);
        expect(r.remaining).toBe(-3);
        expect(r.valid).toBe(false);
        expect(r.issues).toContain('overBudget');
    });

    it('counts the Regiment Type among the three doctrines', () => {
        const ok = computeRegimentBudget({ ...COMPLETE, trainingDoctrines: ['td-a'], specialEquipmentDoctrines: ['sed-a'] }, CATALOG);
        expect(ok.doctrineCount).toBe(3);
        expect(ok.issues).toEqual([]);

        const tooMany = computeRegimentBudget({ ...COMPLETE, trainingDoctrines: ['td-a', 'td-b'], specialEquipmentDoctrines: ['sed-a'] }, CATALOG);
        expect(tooMany.doctrineCount).toBe(4);
        expect(tooMany.issues).toContain('tooManyDoctrines');
        expect(tooMany.valid).toBe(false);
    });

    it('a drawback refunds points to the budget instead of costing any', () => {
        const over = { ...COMPLETE, regimentType: 'rt-b', trainingDoctrines: ['td-b'], specialEquipmentDoctrines: ['sed-b'] };
        expect(computeRegimentBudget(over, CATALOG).valid).toBe(false);

        const refunded = computeRegimentBudget({ ...over, drawbacks: ['db-b'] }, CATALOG);
        expect(refunded.refund).toBe(6);
        expect(refunded.budget).toBe(18);
        expect(refunded.spent).toBe(15);
        expect(refunded.remaining).toBe(3);
        expect(refunded.valid).toBe(true);
        expect(refunded.perCategory.drawback).toBe(6);
    });

    it('allows only one drawback', () => {
        const r = computeRegimentBudget({ ...COMPLETE, drawbacks: ['db-a', 'db-b'] }, CATALOG);
        expect(r.issues).toContain('tooManyDrawbacks');
        expect(r.valid).toBe(false);
    });

    it('reports a per-category breakdown', () => {
        const r = computeRegimentBudget({ ...COMPLETE, trainingDoctrines: ['td-a', 'td-b'] }, CATALOG);
        expect(r.perCategory).toEqual({
            homeWorld: 3,
            commandingOfficer: 2,
            regimentType: 2,
            trainingDoctrine: 3,
            specialEquipmentDoctrine: 0,
            drawback: 0,
        });
    });

    it('silently skips unknown ids — and does not count them as the required picks', () => {
        const r = computeRegimentBudget({ ...BLANK, homeWorld: 'ghost', commandingOfficer: 'co-a', regimentType: 'rt-a' }, CATALOG);
        expect(r.spent).toBe(4);
        expect(r.issues).toEqual(['missingHomeWorld']);
    });
});

/* -------------------------------------------------------------- */
/*  Standard Kit                                                  */
/* -------------------------------------------------------------- */

describe('computeKitAllowance', () => {
    it('is the 30-point base plus 2 per unspent regiment point', () => {
        const regiment = computeRegimentBudget(COMPLETE, CATALOG); // 5 unspent
        expect(computeKitAllowance(regiment, {})).toBe(30 + 2 * 5);
    });

    it('does not go below the base when over budget', () => {
        expect(computeKitAllowance({ remaining: -3 }, {})).toBe(30);
    });

    it('a kitBase override replaces the 30 (Penal Colony: 15), keeping the unspent bonus', () => {
        expect(computeKitAllowance({ remaining: 5 }, { kitBase: 15 })).toBe(15 + 10);
    });

    it('adds the kitModifier', () => {
        expect(computeKitAllowance({ remaining: 0 }, { kitModifier: 5 })).toBe(35);
        expect(computeKitAllowance({ remaining: 0 }, { kitModifier: -5 })).toBe(25);
    });
});

describe('computeKitBudget', () => {
    it('empty kit → 0 spent, full remaining, valid', () => {
        expect(computeKitBudget([])).toEqual({ spent: 0, remaining: 30, valid: true });
    });

    it('spends against the allowance and is valid up to and including it', () => {
        expect(computeKitBudget([{ id: 'kit-a', cost: 20 }], 30)).toEqual({ spent: 20, remaining: 10, valid: true });
        expect(computeKitBudget([{ id: 'kit-a', cost: 30 }], 30).valid).toBe(true);
    });

    it('over the allowance is invalid', () => {
        expect(computeKitBudget([{ id: 'kit-b', cost: 31 }], 30)).toEqual({ spent: 31, remaining: -1, valid: false });
    });
});

describe('kitOverLimit', () => {
    it('flags an item taken more times than its maxCount', () => {
        const kit = [
            { id: 'kit-a', cost: 5 },
            { id: 'kit-a', cost: 5 },
            { id: 'kit-a', cost: 5 },
        ];
        expect(kitOverLimit(kit, CATALOG)).toEqual(['kit-a']);
    });

    it('allows up to maxCount copies, and one copy where no maxCount is set', () => {
        expect(
            kitOverLimit(
                [
                    { id: 'kit-a', cost: 5 },
                    { id: 'kit-a', cost: 5 },
                    { id: 'kit-b', cost: 10 },
                ],
                CATALOG,
            ),
        ).toEqual([]);
    });
});

/* -------------------------------------------------------------- */
/*  Grant aggregation                                             */
/* -------------------------------------------------------------- */

describe('aggregateRegimentGrants', () => {
    it('empty selection → zero-valued grants', () => {
        const g = aggregateRegimentGrants(BLANK, CATALOG);
        expect(g.characteristics).toEqual({});
        expect(g.wounds).toBe(0);
        expect(g.logistics).toBe(0);
        expect(g.kitModifier).toBe(0);
        expect(g.kitBase).toBeUndefined();
    });

    it('sums characteristics, wounds, logistics and kitModifier across options', () => {
        const g = aggregateRegimentGrants(
            { ...BLANK, homeWorld: 'hw-a', commandingOfficer: 'co-a', regimentType: 'rt-b', specialEquipmentDoctrines: ['sed-a'], drawbacks: ['db-a'] },
            CATALOG,
        );
        expect(g.characteristics).toEqual({ weaponSkill: 3 });
        expect(g.wounds).toBe(3);
        expect(g.logistics).toBe(5);
        expect(g.kitModifier).toBe(5 - 5);
    });

    it('concatenates skills and talents in selection order', () => {
        const g = aggregateRegimentGrants({ ...BLANK, homeWorld: 'hw-b', regimentType: 'rt-a', trainingDoctrines: ['td-a'] }, CATALOG);
        expect(g.skills).toEqual(['skill-stealth']);
        expect(g.talents).toEqual(['talent-hardy', 'talent-sprint']);
    });

    it('carries the kitBase override through', () => {
        expect(aggregateRegimentGrants({ ...BLANK, homeWorld: 'hw-penal' }, CATALOG).kitBase).toBe(15);
    });
});

/* -------------------------------------------------------------- */
/*  Panel summary                                                 */
/* -------------------------------------------------------------- */

describe('buildRegimentPanelSummary', () => {
    it('reports both budgets for a fresh actor (never blank)', () => {
        const s = buildRegimentPanelSummary(BLANK, [], CATALOG);
        expect(s.regiment.spent).toBe(0);
        expect(s.regiment.budget).toBe(12);
        expect(s.kit.budget).toBe(30 + 2 * 12);
    });

    it('the kit allowance counts unspent points, the Penal base and kit modifiers', () => {
        const penal = { ...BLANK, homeWorld: 'hw-penal', commandingOfficer: 'co-b', regimentType: 'rt-a' }; // 2 + 1 + 2 = 5, 7 unspent
        const s = buildRegimentPanelSummary(penal, [{ id: 'kit-a', cost: 5 }], CATALOG);
        expect(s.regiment.remaining).toBe(7);
        expect(s.kit.budget).toBe(15 + 14);
        expect(s.kit.spent).toBe(5);
        expect(s.kit.valid).toBe(true);
    });

    it('works with an empty catalog (no compendium content staged)', () => {
        const s = buildRegimentPanelSummary(BLANK, [], []);
        expect(s.regiment.valid).toBe(false);
        expect(s.kit.spent).toBe(0);
    });
});
