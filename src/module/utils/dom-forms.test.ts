// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { flattenNestedForms } from './dom-forms';

const root = (html: string): HTMLFormElement => {
    const form = document.createElement('form');
    // a <template> keeps a nested <form>, as Foundry's part rendering does
    const template = document.createElement('template');
    template.innerHTML = html;
    form.append(template.content);
    return form;
};

describe('flattenNestedForms', () => {
    it('puts a nested form’s fields back under the root form', () => {
        const form = root('<div><form class="inner" autocomplete="off"><select name="system.step"><option value="a">A</option></select></form></div>');
        const select = form.querySelector('select');
        expect(select?.closest('form')).not.toBe(form); // the field's nearest form is the inner one, so the root form would not submit it

        expect(flattenNestedForms(form)).toBe(1);
        expect(form.querySelector('select')?.closest('form')).toBe(form);
    });

    it('keeps the inner form’s classes and children, and drops form-only attributes', () => {
        const form = root('<form class="tw-flex tw-h-full" autocomplete="off" data-x="1"><span id="kid">k</span></form>');
        flattenNestedForms(form);
        const div = form.querySelector('div');
        expect(div?.className).toBe('tw-flex tw-h-full');
        expect(div?.getAttribute('data-x')).toBe('1');
        expect(div?.hasAttribute('autocomplete')).toBe(false);
        expect(div?.querySelector('#kid')?.textContent).toBe('k');
        expect(form.querySelector('form')).toBeNull();
    });

    it('leaves a sheet with no nested form alone', () => {
        const form = root('<div><input name="name" /></div>');
        expect(flattenNestedForms(form)).toBe(0);
        expect(form.querySelector('input')?.name).toBe('name');
    });
});
