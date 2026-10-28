/**
 * Foundry V14 replaces `{ field: 'x' }` update keys of the form `==field` with an explicit operator: wrap the
 * value in `ForcedReplacement` and the update swaps the field wholesale instead of merging into it.
 */

interface OperatorsNamespace {
    data: { operators: { ForcedReplacement: new (value: object) => object } };
}

/** Wrap `value` so an update replaces the field it is assigned to rather than merging into it. */
export function forcedReplacement(value: object): object {
    // eslint-disable-next-line no-restricted-syntax -- TRUE Foundry framework boundary: `foundry.data.operators.ForcedReplacement` is a V14 global that fvtt-types does not declare as a value
    return new (foundry as unknown as OperatorsNamespace).data.operators.ForcedReplacement(value);
}
