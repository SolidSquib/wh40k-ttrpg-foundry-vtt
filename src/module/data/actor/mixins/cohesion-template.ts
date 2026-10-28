/**
 * Squad Cohesion schema slot.
 *
 * Cohesion is a SQUAD-LEVEL pool, attached to the squad LEADER character
 * (Only War orders spend it). Exporting fields + a declarations interface
 * lets the same slot be spread into another actor type later.
 *
 * Pure schema slot. The arithmetic + thresholds + per-turn cap live in
 * `src/module/rules/dw-cohesion.ts`; this file only persists the four
 * values the resolver reads/writes:
 *
 *   - `cohesionMax`              — derived from leader Fellowship Bonus
 *                                  + Table 7-8 (Rank/Command).
 *   - `cohesionCurrent`          — current pool value.
 *   - `cohesionLostThisTurn`     — bumped by `applyCohesionDamage`;
 *                                  driver clears it on turn boundary.
 *   - `rallied`                  — true once a successful Free-Action
 *                                  Command/Fellowship rally fires this
 *                                  turn; cleared on turn boundary.
 *
 * The orchestrator merges `cohesionSchemaFields()` into the
 * CharacterData defineSchema() and applies the `CohesionDeclarations`
 * shape to the class via the standard `declare` block. The panel and
 * actions read these fields off `system`; no class-level mixin is
 * needed for this round.
 */

const { NumberField, BooleanField } = foundry.data.fields;

/**
 * Class-level `declare` shape contributed by the Cohesion schema slot.
 * The orchestrator splices these declarations onto CharacterData so the
 * compiler narrows `actor.system.cohesionCurrent` etc. without casts.
 */
export interface CohesionDeclarations {
    cohesionMax: number;
    cohesionCurrent: number;
    cohesionLostThisTurn: number;
    rallied: boolean;
}

/**
 * Schema-field bundle for the Cohesion pool. Spread into a DataModel's
 * `defineSchema()` return value:
 *
 *     return {
 *         ...super.defineSchema(),
 *         ...cohesionSchemaFields(),
 *     };
 *
 * Every field has `initial: 0` (or `false` for `rallied`) so the
 * fields are safe for any actor that reflects over this schema.
 */
export function cohesionSchemaFields(): Record<string, foundry.data.fields.DataField.Any> {
    return {
        cohesionMax: new NumberField({ required: true, initial: 0, min: 0, integer: true }),
        cohesionCurrent: new NumberField({ required: true, initial: 0, min: 0, integer: true }),
        cohesionLostThisTurn: new NumberField({ required: true, initial: 0, min: 0, integer: true }),
        rallied: new BooleanField({ required: true, initial: false }),
    };
}
