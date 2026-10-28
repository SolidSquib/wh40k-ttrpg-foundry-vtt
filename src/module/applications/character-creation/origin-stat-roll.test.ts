import { describe, expect, it } from 'vitest';
import { expandWoundsFormula, formatWoundsBreakdown, resolveFateFormula, substituteToughnessBonus } from './origin-stat-roll.ts';

describe('wounds formulas', () => {
    it('substitutes Toughness Bonus for the roll and for display', () => {
        expect(substituteToughnessBonus('2xTB+1d5+2', 4)).toBe('8+1d5+2');
        expect(expandWoundsFormula('2xTB+1d5+2', 4)).toBe('2×4+1d5+2');
        expect(substituteToughnessBonus('8+1d5', 4)).toBe('8+1d5');
    });

    it('shows each die as its rolled faces and ends with the total', () => {
        expect(formatWoundsBreakdown('2xTB+1d5+2', 4, [[3]], 13)).toBe('2×4+[3]+2 = 13');
        expect(formatWoundsBreakdown('10+2d5', 3, [[2, 4]], 16)).toBe('10+[2+4] = 16');
    });

    it('leaves a dice term it has no faces for', () => {
        expect(formatWoundsBreakdown('8+1d5', 3, [], 9)).toBe('8+1d5 = 9');
    });
});

describe('resolveFateFormula', () => {
    it('reads a plain number as a fixed value', () => {
        expect(resolveFateFormula('3', 7)).toEqual({ total: 3, breakdown: '3 Fate Points (fixed)' });
    });

    it('picks the band the d10 falls in', () => {
        const formula = '(1-5|=2),(6-10|=3)';
        expect(resolveFateFormula(formula, 5)).toEqual({ total: 2, breakdown: 'Rolled 5 on 1d10 (1-5 → 2 Fate Points)' });
        expect(resolveFateFormula(formula, 6)).toEqual({ total: 3, breakdown: 'Rolled 6 on 1d10 (6-10 → 3 Fate Points)' });
    });

    it('is 0 and says so when no band matches', () => {
        expect(resolveFateFormula('(1-3|=2)', 9).total).toBe(0);
    });
});
