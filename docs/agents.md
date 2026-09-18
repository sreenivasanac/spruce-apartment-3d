# Rules for builder and critic agents

Read first: `docs/spec.md`, `docs/photo-index.md`, `docs/assumptions.md`, `src/dimensions.js`, `src/lib/build.js`, `src/materials.js`.

## Builders
- You own ONLY the file(s) named in your task. Never edit `src/main.js`, `src/apartment.js`, `src/shell.js`, `src/shots.js`, `tools/` or another item's module (the viewer item owns main.js/shots.js/index.html).
- **No magic numbers**: every real-world size comes from `src/dimensions.js` (inches). Need a new dimension? Add it to YOUR section of `dimensions.js` with a small targeted Edit (other agents edit that file concurrently — never rewrite it, re-read before editing, retry if the Edit fails). Same for `src/materials.js`: add new materials at the end of `MAT`, don't change existing ones unless they belong to your item.
- Plan space: x = plan-right (S), y = plan-down (W, deck), elevation up; helpers `boxAt(x0,y0,elev,w,d,h,mat,name)`, `box`, `cyl`, `place`, `slab`, `group` convert to metres. Room modules return a Group in world coords. Furniture modules are modelled around the origin (footprint centred, bottom at y=0, front = +Z, width along X) and are placed by `apartment.js`.
- Name every significant mesh/group (`obj.name = 'kitchen:range'`) — critics measure by name. Keep the top-level group name as is.
- Interaction hooks: `group.userData.onClick = fn` (called when the user clicks without dragging), `obj.userData.tick = (dt) => {}` (per frame), `obj.userData.hideInDollhouse = true` (hidden with the ceiling in dollhouse/plan views).
- Photos are ground truth. Never invent a feature a photo contradicts. If photos don't show it, choose the most plausible option and append one line to `docs/assumptions.md`. Do not ask the user anything.
- Procedural geometry and canvas textures only (no downloads, no external assets). Performance budget for the whole scene: 60 fps on a MacBook — prefer InstancedMesh/merged geometry for repeated parts (slats, louvers, blinds), keep each item under ~150 draw calls and ~150k triangles, only lights that matter cast shadows.
- Verify before you finish: `node tools/shot.mjs <shots…>` must print no `[page errors]`, then Read the PNGs in `shots/` next to the reference photo and fix what you see. Use your own `--out=shots/<item>` dir to avoid clobbering others.
- Commit only your own files when done: `git add <your files> && git commit -m "<item>: …"` (retry once if `.git/index.lock` exists).

## Critics
- You never edit code. You are a picky arch-viz art director + building surveyor.
- Render with `node tools/shot.mjs --out=shots/critic-<item> <shots…>`; Read render and reference photo (`refs/IMG_xxxx.jpg` or `spruce_apt_photos/<product>.jpg`) side by side.
- Measure independently: `node tools/shot.mjs --eval="__apt.bounds('<name>')"` → `[x0,y0,x1,y1,elev0,elev1]` inches in plan space; `__apt.size(name)`; `__apt.names()`; `__apt.area`. Compare to `docs/spec.md`, `src/dimensions.js` and the user-given numbers. Don't trust the builder's word.
- List every visible discrepancy: proportions, positions, colours, materials, missing fixtures, wrong door swing, CG-looking lighting, texture tiling/stretching, light leaks, z-fighting, floating or intersecting objects, page errors.
- Score realism and accuracy 1–10. Pass only if BOTH ≥ 9. Judge the item itself — don't fail it for defects that belong to another item (mention those separately under `otherItems`).
