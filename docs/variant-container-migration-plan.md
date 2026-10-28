# Variant-container collapse — migration plan

Status: plan only, nothing implemented. Only War is the single supported line, so
the per-line "variant container" machinery is migration debt.

## What exists today

Item `system` data may hold per-line containers (`{ dh1, dh2, bc, dw, rt, im, ow }`
objects at a field, e.g. `system.cost.ow.homebrew.throneGelt`, shared fields under
`cost`). `src/module/utils/item-variant-utils.ts` (556 lines) picks the active
line (`inferActiveGameLine` → `ownerGameLine` → world primary system), materializes
the active branch into flat values, and maps sheet submit paths back onto the
container paths (`remapSubmitDataToVariantPaths`). `rebaseLineVariantContent`,
`lineVariantSourceOf` and `canonicalSystemForLine` keep the unmaterialized source
available for writes.

Direct consumers (non-test): `compendium-hydrate.ts`, `hooks-manager.ts`,
`rules/condition-registry.ts`, `documents/item.ts`, `documents/base-actor.ts`,
`applications/item/base-item-sheet.ts`, `data/abstract/{item,actor}-data-model.ts`,
`data/shared/{physical-item,damage,description,attack}-template.ts`,
`data/item/{weapon,gear,cybernetic,armour,ammunition}.ts`, `data/actor/vehicle.ts`.

Pack data: `src/packs-private` has 1030 `_source` JSON files; 272 contain per-line
container keys. `src/packs` is not populated in this checkout.

## Target

Plain flat values everywhere (`system.cost.throneGelt`-style, one value per field),
no `SupportedLineKey`, no materialize/rebase layer, no `ownerGameLine`.

## Stages (each lands green on its own)

1. **Inventory and golden snapshot.** Script that loads every pack `_source` file
   and records, per file, the resolved Only War value of each container field.
   This is the correctness oracle for stage 3. Also list world-stored (actor-owned)
   items that persist containers in their overlay.
2. **Schema flatten, read side.** Make materialize a no-op fast path: DataModels
   declare flat fields; `migrateData()` reads either shape (container → OW branch,
   falling back to shared/default) so old data still loads. Cost fields first
   (`system.cost.*` is the widest), then damage/attack/description/physical.
3. **Pack rewrite.** Offline script rewrites the 272 container-bearing files in
   `src/packs-private` to flat OW values, verified against the stage 1 snapshot
   (zero diffs). Separate commit inside the `src/packs-private` submodule, then the
   pointer bump. `src/packs` content, if reinstated, needs the same script.
4. **World migration.** One-shot `migrateWorld` step flattening persisted
   actor-owned item overlays and any world items; idempotent, guarded by a
   system-migration version flag, with a dry-run log mode. Back up note in release
   notes.
5. **Delete the layer.** Remove `item-variant-utils.ts` (+ tests),
   `remapSubmitDataToVariantPaths` call in the item sheet, `ownerGameLine` /
   `inferActiveGameLine` users, the hydrate join's variant handling, and the
   `ow`/other-line cost sub-blocks from templates. Rebaseline knip/unconsumed/deps.
6. **Tidy.** `GameSystemId`/`SupportedLineKey` usages that only existed for this.

## Risks

- Sheet write paths: flat names must match the schema exactly (CLAUDE.md gotcha 3);
  covered by existing sheet-duplicate-input-name tests plus new round-trip tests.
- `compendium-hydrate` "persisted wins" contract: a flattened overlay must not
  shadow canonical pack values with stale per-line leftovers.
- Cost fields drive XP/requisition math; stage 1 snapshot must include them.
- Do not run stage 4 against a real world without a backup.

## Verification

Vitest for the flat read/migrate path (both shapes), snapshot-diff script as a
gate for stage 3, Tier B e2e if `.foundry-release/` is present, and a manual
open-item-sheet / equip / roll pass in Foundry after install.
