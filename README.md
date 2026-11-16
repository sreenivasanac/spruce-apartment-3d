# Spruce Apartment 3D

A walkable, **to-scale** Three.js model of a one-bedroom apartment (Plan 1D, 676 sq ft), built so we could plan furniture before moving in. Every wall, door, cabinet and piece of furniture comes from the floor plan, tape-measured dimensions or product listings, and is placed to the inch. You can orbit it like a dollhouse, walk through it at eye height, open doors and cabinets, compare storage options in place, read the clear space around each piece, measure between any two points, switch between day and night, and view cabinets at real size in your room with iPhone AR. A one-minute guided tour shows the main points.

**Live: https://apartment.pragnyalabs.com** · iPhone AR page: https://apartment.pragnyalabs.com/ar.html

![Dollhouse view of the whole apartment](docs/screenshots/dollhouse.jpg)

No external 3D assets or image textures are used. Every surface (wood grain, carpet, marble, bead board, louvers) is drawn procedurally on canvas, so the repo is just code.

---

## Quick start

```bash
pnpm install
pnpm run dev          # http://localhost:5173
```

Requires Node 20+ and pnpm. A production build is a static site:

```bash
pnpm run build        # → dist/ (index.html + ar.html + public/ar/*.usdz)
```

---

## The three views

| Dollhouse (`1`) | Plan (`3`) with dimensions (`M`) | Walk (`2`) |
|---|---|---|
| ![Dollhouse UI](docs/screenshots/ui-dollhouse.jpg) | ![Plan with dimensions](docs/screenshots/ui-plan.jpg) | ![Walk HUD](docs/screenshots/ui-walk.jpg) |
| Orbit and zoom. Drag furniture to move it; it stays on the floor and slides along walls. | Top-down, with room sizes, wall lengths and an area check against the 676 sq ft listing. | First person at 5'7" eye height with collisions. Aim the crosshair and press **F** to use what you're looking at. |

A first visit opens with a short intro and an offer of the tour. The page loads in about two seconds and draws a frame only when something changes, so an idle tab uses no GPU.

### Controls

| Where | Input | Does |
|---|---|---|
| Anywhere | `1` `2` `3` | Dollhouse · Walk · Plan |
| | `P` | Guided tour (arrow keys step, `Esc` ends it) |
| | `T` | Tape measure: click two points |
| | `L` | Lights: day / evening / night and a switch per fixture |
| | `M` | Dimensions overlay |
| | `C` / `G` | Cycle the storage-cabinet option / look at it |
| | `H` | Help panel |
| Dollhouse / Plan | Drag | Move a piece of furniture |
| | Click | Select a piece and show its size card; open things (doors, coffee table, futon, wardrobe, cabinet, shed, shoe-closet doors) |
| | `N`, arrows (`Shift` = 6"), `R` | Next piece, nudge 1", rotate 90° |
| Walk | Click, then mouse | Look around (`Esc` releases) |
| | `W A S D`, `← →` / `Q E` | Walk, turn |
| | `F` | Use the thing under the crosshair; the prompt says what it will do |

**Reset furniture** puts everything back where `src/dimensions.js` says. Dragged positions are not saved.

---

## Planning tools

### Size and clear space

Click a piece of furniture to see its product size and how much free floor is left on each of its four sides, measured to the nearest wall, built-in or other piece. Gaps narrower than 24" are highlighted. The numbers update while you drag.

![Size card for the futon](docs/screenshots/ui-info.jpg)

### Tape measure

Press `T` (or **Measure**) and click two points on any surface. The readout gives the straight-line distance, plus the horizontal and vertical parts when the two points are at different heights. In Walk mode the point under the crosshair is used.

![Tape measure in plan view](docs/screenshots/ui-measure.jpg)

### Day, evening and night

**Lights** switches the time of day and each fixture: kitchen ceiling, under-cabinet strip, dining track, hall, entry and bathroom. The fixtures can also be clicked in the 3D view (`F` in Walk mode). The living room and bedroom have no ceiling fixtures, which the night view makes obvious.

| Day | Night |
|---|---|
| ![Day](docs/screenshots/ui-day.jpg) | ![Night](docs/screenshots/ui-night.jpg) |

### Guided tour

**▶ Tour** (or `P`) flies through eight stops with a caption at each: the overview, the living room, the four cabinets cycling in their corner, things that open, the bedroom, the shoe-rack fit check and the deck.

| Cabinets, compared in place | The 10-tier rack hitting the rod |
|---|---|
| ![Tour: cabinets](docs/screenshots/ui-tour-cabinets.jpg) | ![Tour: shoe rack](docs/screenshots/ui-tour-shoes.jpg) |

### On a phone

Phones and tablets get a view-only version: orbit, pinch to zoom, tap furniture for its size card, tap doors and cabinets to open them, plus the tour, lights, plan and tape measure. Walk mode and furniture dragging need a keyboard and mouse. Rendering runs at a lower resolution there, with a smaller shadow map and no live mirrors.

<img src="docs/screenshots/ui-phone.jpg" alt="Phone view with a size card" width="280">

---

## A tour

### Living room

The long desk and monitor sit on the gray accent wall, the futon and lift-top coffee table face the slider, and the cabinet slot is in the corner by the balcony.

| | |
|---|---|
| ![Living room](docs/screenshots/living.jpg) | ![Living room toward the slider](docs/screenshots/living-slider.jpg) |
| ![Desk and chair](docs/screenshots/desk.jpg) | ![Futon](docs/screenshots/futon.jpg) |
| ![Lift-top coffee table](docs/screenshots/liftTop.jpg) | ![Mandir near the entry](docs/screenshots/mandir.jpg) |

The coffee table's top lifts and the futon folds into a bed (click or press `F`). The bookcase near the entry is set up as a home mandir.

### Bedroom

Full bed on the north wall, a three-door wardrobe beside it, and a second desk and chair by the window.

| | |
|---|---|
| ![Bedroom](docs/screenshots/bedroom.jpg) | ![Bedroom toward the closet](docs/screenshots/bedroom2.jpg) |
| ![Bed](docs/screenshots/bed.jpg) | ![Wardrobe](docs/screenshots/wardrobe.jpg) |
| ![Second desk](docs/screenshots/wifeDesk.jpg) | |

### Kitchen, bath and deck

| | |
|---|---|
| ![Kitchen](docs/screenshots/kitchen.jpg) | ![Bathroom](docs/screenshots/bathroom.jpg) |
| ![Deck](docs/screenshots/deck.jpg) | ![Deck storage shed](docs/screenshots/shed.jpg) |

The resin storage shed (51.2 × 29.1 × 43.3") stands at the end of the deck. Its doors and lid open.

### Shoe closet

The entry closet (36" W × 26.5" D) holds a 9-tier shoe rack under the existing rod and shelf. Its bypass doors slide left or right. Clicking the rack toggles it between 9 and 10 tiers: at 10 tiers it would hit the rod, which shows as a red clash marker.

| Left door open | Cutaway: rack under the rod |
|---|---|
| ![Shoe closet](docs/screenshots/shoeCloset.jpg) | ![Shoe rack cutaway](docs/screenshots/shoeRack.jpg) |

---

## Storage cabinet options

Four candidate cabinets share one slot by the slider. Switch between them with the panel at the bottom right, the `C` key, or `?cabinet=1..4` in the URL. Click a cabinet (or press `F` in Walk) to open its doors.

| A · Rustic 31.5 × 13.8 × 70.1" | B · Pantry 40.9 × 15.7 × 68.1" | C · Bead board 38.6 × 13.8 × 70.9" | D · Steel locker 31.5 × 15.7 × 70.9" |
|---|---|---|---|
| ![Cabinet A](docs/screenshots/cabinet-1.jpg) | ![Cabinet B](docs/screenshots/cabinet-2.jpg) | ![Cabinet C](docs/screenshots/cabinet-3.jpg) | ![Cabinet D](docs/screenshots/cabinet-4.jpg) |

### See them in your own room (iPhone AR)

`ar.html` lists each cabinet plus an "all four side by side" model as USDZ files. Tapping one on an iPhone opens **AR Quick Look**: the camera finds your floor and places the cabinet at true size, with scaling locked so it can't be resized by accident.

- From the deployed site, open `/ar.html` in Safari on the iPhone. AR Quick Look needs HTTPS or a local network address.
- Locally, run `pnpm run dev:phone` on the same Wi‑Fi and open `http://<mac-ip>:5183/ar.html`.
- After changing a cabinet model, run `pnpm run export:ar` to regenerate `public/ar/*.usdz`. The export re-imports each file and checks its size.

---

## How it's built

```
src/
  dimensions.js      single source of truth: every size and position, in inches
  apartment.js       assembles shell + rooms + furniture
  shell.js           walls, floors, ceilings (from WALLS / ROOMS)
  rooms/             finishes, openings (doors, sliders), kitchen, bath, closets, deck, lighting
  furniture/         one module per piece; cabinet.js is the A–D option slot, cabinets/* the models
  lib/               build helpers, procedural wood grain + normal maps
  main.js            viewer: renderer, render loop, modes, walking, furniture editing, shots
  viewer/            UI features, one file each: plan overlay, cabinet panel, info card, tape measure, lights panel, tour
  style.css          viewer chrome
  shots.js           named camera poses used for screenshots
ar.html              iPhone AR Quick Look page
tools/               screenshot, test and AR-export scripts (Playwright)
docs/                spec, photo index, assumptions log, screenshots
```

**Coordinates.** Plans use inches, with x running toward the kitchen side and y toward the deck. `m()` converts to metres once, at the point of building. Each furniture module returns a group whose origin is at the bottom centre with its front facing +Z. `apartment.js` then places it from `FURNITURE.<piece>.pos` and `rot`.

**Interactivity** is driven by `userData` hooks on objects: `onClick`, `tick`, `actionLabel`, `setOpen`/`animate`. The viewer handles clicks in Dollhouse and the `F` key in Walk the same way.

**Lighting** defaults to early evening: a low sun through the slider and the bedroom window, every real fixture switched on, rect-area sky light from the glazing, and GTAO ambient occlusion. `TIMES` in `src/rooms/lighting.js` holds the day, evening and night looks. Lights are dimmed to zero, never hidden, because changing the number of visible lights makes three.js recompile every shader.

**Performance.** Measured in Chrome at 1512 × 982 @2x, before and after the last round of work:

| | Before | After |
|---|---|---|
| Time to first frame | 25 s | 2 s |
| Frame time while orbiting | 30 ms | 14 ms |
| Draw calls per frame | 7,700 | 2,800 |
| Frames drawn while idle | 60 per second | 0 |

- Almost all of the load time was one wall texture. It drew 4,500 ellipses with a canvas `blur()` filter applied to each one, and Chrome spent 23 s rasterizing it. The texture now draws the ellipses sharp and blurs once.
- A frame is drawn only after input, during an animation or while the camera is moving (`invalidate()` in `src/main.js`).
- Shadow maps are static and are re-rendered only when a piece of furniture, a door or a light changes (`shadowsDirty()`).
- The two planar mirrors re-render the whole scene, so they are live only in Walk mode and only near the walker. Other views show a mirror-finish stand-in.
- Ambient occlusion is computed at half resolution on HiDPI screens.

### Changing things

- Resize or move furniture by editing `FURNITURE.<piece>` in `src/dimensions.js` (`w`, `d`, `h`, `pos: [x, y]`, `rot`).
- Swap the cabinet candidates by editing `CABINETS.rustic | pantry | beadboard | steel`. `CABINETS.anchor` is the slot position.
- The building itself is described by `ENV`, `WALLS`, `ROOMS` and `DOORS`. Set `toggle` on a door to make it clickable.

Anything that wasn't measured or photographed is recorded in [`docs/assumptions.md`](docs/assumptions.md), with one line per assumption. Measurements are in [`docs/spec.md`](docs/spec.md).

---

## Tools and tests

```bash
node tools/shot.mjs living desk 'cabinet&cabinet=2'   # → shots/*.png, deterministic camera poses from src/shots.js
node tools/shot.mjs --view=plan --dims               # plan view with dimensions
node tools/shot.mjs --eval="__apt.bounds('desk')"    # measure anything in the scene (inches)
node tools/interact-test.mjs                          # doors, F key, cabinet switching
node tools/walk-test.mjs                              # walk collisions + turning
node tools/drag-test.mjs                              # drag, rotate, reset
node tools/feature-test.mjs                           # tour, lights, tape measure, info card, idle rendering, load time
```

URL parameters for linking to a state: `?view=walk|plan`, `?cabinet=1..4`, `?time=day|evening|night`, `?tour`, `?dims`.

Each tool starts its own Vite server and drives headless Chrome through Playwright.

## Deployment

`pnpm run build` produces a fully static `dist/` with relative URLs, so it works at a domain root or under a sub-path. Any static host works; serve `.usdz` as `model/vnd.usdz+zip` or AR Quick Look won't open it (the dev server does this in `vite.config.js`).

The live copy is served by nginx with a Let's Encrypt certificate. To redeploy:

```bash
pnpm run deploy        # vite build + rsync dist/ to $DEPLOY_TARGET (default hetzner-user:/var/www/apartment/)
```

## Notes

- The reference photos used to build the model (the apartment and the product listings) are kept out of this public repo. Comments that mention `refs/` or `spruce_apt_photos/` refer to those local files.
- Built by Sreenivasan AC with Claude Code.
