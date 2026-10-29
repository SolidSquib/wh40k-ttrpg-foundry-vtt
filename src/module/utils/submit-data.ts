/**
 * @file submit-data - tidying of a sheet's form payload before it reaches `update()`.
 */

import { asRawSource, type RawSource } from '../data/shared/raw-source.ts';

/**
 * Drop blank strings from every array of strings in a submit payload, in place (nested objects included).
 *
 * A group of checkboxes sharing one `name` (a Set field such as `system.weaponTypes`) submits one entry per
 * box, and an unchecked box contributes `""`, so selecting one of fifteen options would store fifteen
 * entries. Only arrays made entirely of strings are touched, so arrays of objects pass through unchanged.
 *
 * @param data  The expanded submit payload.
 */
export function dropBlankStrings(data: RawSource): void {
    for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
            if (value.every((entry) => typeof entry === 'string')) data[key] = value.filter((entry) => entry !== '');
        } else {
            const child = asRawSource(value);
            if (child !== null) dropBlankStrings(child);
        }
    }
}
