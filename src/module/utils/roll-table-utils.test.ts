import { afterEach, describe, expect, it, vi } from 'vitest';
import { RollTableUtils } from './roll-table-utils.ts';

/** Stands in for Foundry's `Roll`: records the formula it was built with. */
class FakeRoll {
    static formulas: string[] = [];
    constructor(readonly formula: string) {
        FakeRoll.formulas.push(formula);
    }
    async evaluate(): Promise<this> {
        await Promise.resolve();
        return this;
    }
}

describe('RollTableUtils failure-driven tables', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        FakeRoll.formulas = [];
    });

    it.each([
        ['rollShock', 'Shock'],
        ['rollMentalTrauma', 'Mental Traumas'],
    ] as const)('%s rolls %s with +10 per Degree of Failure', async (method, tableName) => {
        vi.stubGlobal('Roll', FakeRoll);
        const rollTable = vi.spyOn(RollTableUtils, 'rollTable').mockResolvedValue(null);

        await RollTableUtils[method](3);

        expect(FakeRoll.formulas).toEqual(['1d100 + 30']);
        expect(rollTable).toHaveBeenCalledWith(tableName, expect.objectContaining({ displayChat: true }));
    });

    it('defaults to one Degree of Failure', async () => {
        vi.stubGlobal('Roll', FakeRoll);
        vi.spyOn(RollTableUtils, 'rollTable').mockResolvedValue(null);

        await RollTableUtils.rollShock();

        expect(FakeRoll.formulas).toEqual(['1d100 + 10']);
    });
});
