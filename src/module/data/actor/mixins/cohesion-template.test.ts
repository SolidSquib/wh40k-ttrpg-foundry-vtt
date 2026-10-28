import { afterAll, describe, expect, it } from 'vitest';

/**
 * The cohesion schema slot's field set. The slot destructures `foundry.data.fields`
 * at module load, so recording stubs are installed before the dynamic import.
 */
type FieldCtor = new () => { readonly _kind: string };
type AnyCtor = abstract new (...args: never[]) => object;

function makeField(kind: string): FieldCtor {
    return class {
        readonly _kind = kind;
    };
}
const fields = { BooleanField: makeField('BooleanField'), NumberField: makeField('NumberField') };
interface GlobalShim {
    foundry?: { data: { fields: Record<string, AnyCtor> } } | undefined;
}
const G = globalThis as GlobalShim;
const ORIGINAL_FOUNDRY = G.foundry;
G.foundry = { data: { fields } };

afterAll(() => {
    G.foundry = ORIGINAL_FOUNDRY;
});

const { cohesionSchemaFields } = await import('./cohesion-template.ts');

describe('cohesionSchemaFields', () => {
    it('contributes exactly the four cohesion slots', () => {
        expect(Object.keys(cohesionSchemaFields()).sort()).toEqual(['cohesionCurrent', 'cohesionLostThisTurn', 'cohesionMax', 'rallied']);
    });

    it('types the pool as numbers and the rally marker as a boolean', () => {
        const schema = cohesionSchemaFields();
        expect(schema['cohesionCurrent']).toBeInstanceOf(fields.NumberField);
        expect(schema['rallied']).toBeInstanceOf(fields.BooleanField);
    });
});
