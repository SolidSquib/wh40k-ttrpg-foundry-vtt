/**
 * Nested `<form>` repair for ApplicationV2 sheets.
 *
 * An item sheet's root element is itself a `<form>` (`tag: 'form'`), and many sheet templates wrap their
 * markup in a second `<form>`. Foundry's parts are parsed inside a `<template>`, which keeps the inner form,
 * and a control belongs to its NEAREST form: the root form's `elements` then lack every field in the inner
 * form, so `FormDataExtended` submits nothing from them. Only the `[data-edit]` elements (found with a plain
 * `querySelectorAll`) get through — a select or input there appears to change but never saves.
 *
 * Turning each inner form into a `<div>` with the same attributes and children puts every field back under
 * the root form, with the layout classes untouched.
 */

/** Replace every `<form>` inside `root` (not `root` itself) with a `<div>`. Returns how many were replaced. */
export function flattenNestedForms(root: HTMLElement): number {
    const nested = Array.from(root.querySelectorAll('form'));
    for (const form of nested) {
        const div = root.ownerDocument.createElement('div');
        for (const attr of Array.from(form.attributes)) {
            // `autocomplete` and `novalidate` only mean something on a form; the root form carries them
            if (attr.name === 'autocomplete' || attr.name === 'novalidate') continue;
            div.setAttribute(attr.name, attr.value);
        }
        div.append(...Array.from(form.childNodes));
        form.replaceWith(div);
    }
    return nested.length;
}
