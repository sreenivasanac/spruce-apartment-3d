# Measured spec

All numbers live in `src/dimensions.js` (inches). This file explains where they came from. Photo IDs refer to `docs/photo-index.md`.

## Coordinate system
- Plan space: **x = plan-right (S)**, **y = plan-down (W, toward deck)**, origin = outer top-left corner of `spruce_layout.png`. Elevation = inches above finished floor.
- World: `X = x·0.0254`, `Z = y·0.0254`, `Y` up. Conversion happens once, in `m()`.

## Scale derivation
- Plan image: outer walls span 410 px × 400 px. Living room interior 212 px ↔ labelled 13'; bedroom 191 px ↔ 12' ⇒ **≈0.761 in/px**.
- Envelope = 316.5" × 307" (26'4½" × 25'7") = **675 sq ft** vs listing 676 ✔. (Deck excluded.)
- Living room interior 158" × 161" (13'2" × 13'5"; label "13×14" is nominal). Bedroom 142" × 144.5" (11'10" × 12'½").
- Where the plan and fixtures disagree, fixtures win: tub alcove forced to 60" (plan scales to 65"), W/D closet sized for 24" units, doors to standard widths.

## Wall segments
See `WALLS` in `src/dimensions.js` — each entry: axis, low-face coordinate `c`, thickness `t`, extent `a..b`, openings `{a,b,sill,head}`. Exterior 6", interior 4.5" (bath/coat-closet wall too — plan draws it thin and the shower plumbing is on the N wall), closet door-track wall 2.5", pony wall 34.5" high. Walls butt at corners (no overlapping boxes). `accent: {side, a, b}` marks darker-gray faces (living S wall y 140–301, pony wall living face, bedroom-closet front).

| Element | Value | Source |
|---|---|---|
| Ceiling | 96" | user-confirmed; door-to-ceiling ratio 3933/3945 |
| Kitchen ceiling | 96" — **no drop**; one continuous ceiling plane dining→kitchen→living (`ENV.kitchenCeiling` kept = 96) | 3933, 3934 (contrast-boosted crops) |
| Entry door | 36×80, opening x 107–143, hinge plan-left, swings in | plan, 3952 |
| Bath door | 26×80 (opening x 39.5–65.5; leaf edge measured at x≈41 in 3937), hinge plan-right, swings into bath against E wall | plan arc, 3942 |
| Bedroom (hall) door | 28×80 in hall wall (x=101), opening y 97.5–125.5, casing butts the y=128 corner (3933), hinge at top end, swings into hall | plan (diagonal leaf), 3945 |
| W/D door | 28×80 full-louver, opening y 55.5–83.5, hinge plan-up (entry) side, swings to dining; ~14" of wall between it and the hall doorway; closet 30.5×30 | 3945 |
| Linen door | 24×80 slab (plan draws it at 45°; simplified to flat wall) | 3940 |
| Coat closet | 40" bypass slab doors facing entry (closet 30.5×44; shortened from the plan so the W/D closet fits the real 23.5" stack) | plan, 3945 |
| Bedroom closet | 66" bypass mirror doors (x 79.5–145.5; 8" pier on the hall side, casing butts the bed/living wall), white frame | 3937, 3938 |
| Slider | 96×80 at x 180–276 (27.5" from bed wall, 34.5" from S wall) | plan px 287–410; 3925, 3932 |
| Bedroom window | 72×56, sill 24", head 80", x 47–119 (28.7" from the bed/living wall) | 3935 (fronto-parallel wall, outlet at 13" validates the scale); overrides plan |
| Kitchen opening | 66" between 34" stubs | plan, 3934 |
| Deck | 164" × 66", rail 42", ~60" above grade | plan, 3926–3930 |
| Counters | 36" high, 25.5" deep, 4" splash; uppers 54"–87", 12.5" deep | standard + 3946 |
| Range / fridge / DW | 30" / 36" / 24" | standard + 3946 |
| Vanity | 37.5" alcove, 22" deep, 34.5" high | plan, 3941 |
| Tub | 60×30, surround to ~74" | 3942, 3944 |

## Kitchen run layout (3946, 3948)
- E wall (y=6): fridge x 225.5–261.5 → 4-drawer base 261.5–285 → corner.
- S wall (x=310.5): corner → 2-door base y 31.5–55.5 → range 55.5–85.5 (centred on the 66" opening ✔ 3934) → 2-door base 85.5–110 → corner. OTR microwave over range. Uppers full run.
- Peninsula (y 110–135.5): DW x 226–250 (at stub, 3933) → sink base 250–280 → corner base. No uppers. Pony wall y 135.5–140, counter overhangs 1.5" to living side.

## Material / fixture schedule
| Item | Finish | Photos |
|---|---|---|
| Walls | warm greige, light orange-peel; heavier knock-down in hall/bath/kitchen | all; 3940, 3947 |
| Accent | darker neutral gray: living S wall; bedroom closet (E) wall reads darker | 3932, 3948, 3937 |
| Ceiling | off-white; smooth in living/bed, knock-down in kitchen/hall | 3932, 3946 |
| Trim | flat white 5¼" base, 2½" flat casing, semi-gloss | 3925, 3941 |
| Interior doors | white flat slab, satin-nickel levers | 3941, 3942 |
| Floor | espresso LVP ~6×48, planks run E–W; bedroom + closet greige cut-pile carpet | 3933, 3935, 3950 |
| Cabinets | white textured-thermofoil slab, brushed bar pulls (vertical on doors, horizontal on drawers) | 3946, 3948 |
| Counters | mid-gray quartz, fine speckle, eased edge | 3949 |
| Appliances | GE stainless: bottom-freezer fridge, glass-top range, OTR microwave, DW w/ black top panel; GE white stacked W/D | 3946, 3933, 3945 |
| Kitchen light | 32" oval flush, frosted lens, nickel bands; warm LED under-cabinet strip | 3946 |
| Dining light | 4-head nickel track on round canopy | 3934 |
| Hall / entry lights | 13" flush dome, nickel ring | 3937, 3945 |
| Vanity light | 24" nickel bar w/ white cylinder | 3941 |
| Living / bedroom | **no ceiling fixtures** | 3932, 3935 |
| HVAC | Daikin mini-split head in bedroom; condenser on deck N end | 3935, 3927 |
| Deck | gray painted floor, charcoal slat rail, stucco soffit, white B&B partition S end, cylinder sconce | 3926–3930 |
| Windows | white vinyl; slider w/ white vertical blinds + cornice; bedroom faux-wood blind | 3925, 3936 |

## Furniture
User-measured: desk 63×24×29. Everything else estimated — see `docs/assumptions.md`. Placement: `FURNITURE.*.pos/rot`.
