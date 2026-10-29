/**
 * An item that lives in a compendium is editable exactly when its pack is unlocked: the sheet must
 * defer to ApplicationV2's `isEditable` (which already folds in the pack lock) instead of treating
 * every compendium item as read-only. Items carried by an actor keep their explicit edit toggle.
 */
import { describe, expect, it, vi } from 'vitest';

/** The slice of Foundry's global the sheet class chain reads while it is being defined. */
interface FoundryStub {
    applications: {
        api: { HandlebarsApplicationMixin: <T>(base: T) => T };
        sheets: { ItemSheetV2: new () => object };
    };
}

// The sheet classes extend Foundry's ApplicationV2 at import time, so the global must exist first.
vi.hoisted(() => {
    class ItemSheetV2Stub {
        static DEFAULT_OPTIONS = {};
        static PARTS = {};
    }
    const stub: FoundryStub = {
        applications: { api: { HandlebarsApplicationMixin: (base) => base }, sheets: { ItemSheetV2: ItemSheetV2Stub } },
    };
    vi.stubGlobal('foundry', stub);
});

const { default: BaseItemSheet } = await import('../src/module/applications/item/base-item-sheet.ts');

interface SheetFacts {
    pack: string | null;
    actor: object | null;
    isEditable: boolean;
}

/** A sheet whose document and framework-supplied `isEditable` are fixed, without booting ApplicationV2. */
function sheetWith({ pack, actor, isEditable }: SheetFacts): InstanceType<typeof BaseItemSheet> {
    const sheet = new BaseItemSheet();
    Object.defineProperty(sheet, 'item', { value: { pack, actor } });
    Object.defineProperty(sheet, 'isEditable', { value: isEditable });
    return sheet;
}

describe('BaseItemSheet editability', () => {
    it('lets an item in an unlocked compendium be edited', () => {
        const sheet = sheetWith({ pack: 'wh40k-rpg.ow-core-items-weapons', actor: null, isEditable: true });
        expect(sheet.canEdit).toBe(true);
        expect(sheet.inEditMode).toBe(true);
    });

    it('keeps an item in a locked compendium read-only', () => {
        const sheet = sheetWith({ pack: 'wh40k-rpg.ow-core-items-weapons', actor: null, isEditable: false });
        expect(sheet.canEdit).toBe(false);
        expect(sheet.inEditMode).toBe(false);
    });

    it('edits a world item whenever the user may edit it', () => {
        expect(sheetWith({ pack: null, actor: null, isEditable: true }).inEditMode).toBe(true);
        expect(sheetWith({ pack: null, actor: null, isEditable: false }).inEditMode).toBe(false);
    });

    it('leaves an actor-owned item in view mode until its edit toggle is used', () => {
        const sheet = sheetWith({ pack: null, actor: {}, isEditable: true });
        expect(sheet.canEdit).toBe(true);
        expect(sheet.inEditMode).toBe(false);
    });
});
