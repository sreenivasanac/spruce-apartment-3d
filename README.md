# Spruce apartment 3D

A walkable, to-scale Three.js model of apartment G-110 (Plan 1D, 676 sq ft) at Spruce, built from the floor plan and photos in `spruce_apt_photos/`. It also has an iPhone AR page for comparing three storage-cabinet options in the real room.

## Run

```bash
pnpm install
pnpm run dev            # http://localhost:5173
```

## Controls

| View | How |
|---|---|
| **Dollhouse** (`1`) | Drag to orbit, scroll to zoom. Drag furniture to move it; it stays on the floor and stops at walls and other furniture. `R` rotates the selected piece. Click the **washer/dryer door**, the coffee table, the futon, the wardrobe or the cabinet to open or close it. |
| **Walk** (`2`) | Click to look around, `WASD` to walk, `←/→` or `Q/E` to turn. Eye height is 5'7". Point the crosshair at a door or piece of furniture and press **`F`** to use it; the prompt shows what will happen. |
| **Plan** (`3`) | Top-down view. `M` toggles room sizes, wall dimensions and the area check against 676 sq ft. |
| Anywhere | `C` cycles the storage cabinet A → B → C → none. `G` looks at it. `H` opens help. |

The **Storage cabinet options** panel (bottom right) switches between the three products in place. It shows each one's size and finish, links to the listing, and has buttons to open its doors or frame it in view. `?cabinet=1|2|3` picks one from the URL.

## See the cabinets in your room (iPhone AR)

`ar.html` lists the three cabinets plus an "all three side by side" model. Tapping one opens **AR Quick Look**: the camera finds your floor and places the cabinet at true size, with scaling locked. Drag it against the wall and twist with two fingers to turn it.

1. Put the Mac and iPhone on the same Wi‑Fi, then run:
   ```bash
   pnpm run dev:phone
   ```
2. Open the printed `Network:` address plus `/ar.html` in **Safari** on the iPhone, e.g. `http://192.168.1.20:5183/ar.html`.

Without a server, you can AirDrop `public/ar/cabinet-1.usdz` (or `-2`, `-3`, `cabinets-all`) to the phone and tap it. After changing a cabinet model, regenerate the AR files with `pnpm run export:ar`.

## Changing sizes and placement

Every real-world number lives in **`src/dimensions.js`**, in inches:

- `FURNITURE.<piece>`: `w`, `d`, `h` plus detail sizes, `pos: [x, y]` (plan inches; x runs toward the kitchen side and y toward the deck) and `rot` in degrees. For example, change `FURNITURE.desk.w`, or move the wardrobe with `FURNITURE.wardrobe.pos`.
- `CABINETS.rustic | pantry | beadboard`: the three cabinet options. `CABINETS.anchor` is where the slot sits.
- `ENV`, `WALLS`, `ROOMS`, `DOORS`: the building. `DOORS.wdDoor.toggle` makes that door clickable.

Dragged positions are not saved. **Reset furniture** puts everything back to `dimensions.js`.

## Project layout

- `src/shell.js`: walls, floors and ceilings.
- `src/rooms/*`: finishes, doors and windows, deck, kitchen, bath, closets, lighting.
- `src/furniture/*`: one module per piece. `cabinet.js` is the option slot and `cabinets/*` holds the three models, which are also exported to USDZ.
- `src/main.js`: the viewer, controls and HUD.
- `docs/spec.md`, `docs/photo-index.md`, `docs/assumptions.md`: measurements, photo evidence, and everything that had to be assumed.
- `tools/`:
  - `shot.mjs`: deterministic screenshots and measurements, e.g. `node tools/shot.mjs desk 'cabinet&cabinet=2'`.
  - `export-ar.mjs`: regenerates the USDZ files.
  - `interact-test.mjs`, `walk-test.mjs`, `drag-test.mjs`: interaction checks. Run each with `node tools/<name>.mjs`.
