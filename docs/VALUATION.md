# Valuation & economy-plugin compatibility

How item prices and currencies in **wh40k-rpg** interoperate with generic
Foundry economy/merchant modules (Item Piles, Loot Sheet, Trading, Monk's
Enhanced Journal, …).

## Source of truth: `system.cost`

Authored item value lives in the flat `system.cost` object (see
`docs/pack-authoring.md` → *Standard Cost Shape*): `{ logistics }`, the item's
Only War Logistics cost. It is hand-authored data and is never written to by the
compatibility layer.

## Derived baseline: `system.price`

`PhysicalItemTemplate` exposes a read-only getter:

```ts
system.price === { value: number | null, denomination: 'logistics' }
```

- **Derived, never authored.** It mirrors `system.cost.logistics`.
- `{ value, denomination }` is the dnd5e-style shape most merchant modules and
  Item Piles already understand, so basic plugins price items with no config.

## Currency registry: `CONFIG.wh40k.currencies`

| key | currency | cost path | wallet path |
| --- | --- | --- | --- |
| `logistics` | Logistics | `system.cost.logistics` | `system.logisticsRating` |

`logistics` is the `primary` currency (mirrored into `system.price`).

## Item Piles integration

`src/module/integrations/item-piles.ts` (`registerItemPilesValuation`, wired in
the `init` hook) registers with Item Piles when that module is active:

- **`ITEM_PRICE_ATTRIBUTE = 'system.price.value'`** — Item Piles reads item
  prices from the derived baseline.
- **`CURRENCIES`** — the registry above, each an `attribute` currency pointed at
  its actor wallet path, `logistics` flagged `primary`.

It feature-detects `game.itempiles.API.addSystemIntegration`; if the API surface
differs it logs a hint and you configure manually (below). It is a no-op when
Item Piles is absent.

### Manual Item Piles config (fallback)

In **Item Piles → Configure System**:

- **Item Price Attribute:** `system.price.value`
- **Currencies:** add one attribute-currency using the wallet path as the
  attribute path; mark Logistics primary.

## Other economy plugins

Any module that reads a conventional price path will see `system.price`
(`{ value, denomination }`). Point it at `system.price.value` if it needs a
scalar.
