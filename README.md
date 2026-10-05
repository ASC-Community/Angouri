# Angouri · Shape the flight

The website opens into a fullscreen mathematical puzzle: build a recipe, then throw a cucumber through the targets. The original community, project and contributor content lives at `/about/`.

The first puzzle starts with a centered logo, the curve and targets, and two block choices. Pick either to update the curve; pick the other to replace it directly. Throw appears after a choice. Puzzle 1.2 adds its heading, axes and third choice. Puzzle 1.3 introduces ordering, the recipe editor, Shape notes and the three views. The first two puzzles display Flight while leaving the selected view and its saved preference untouched; that selection applies again at 1.3. They keep their focused presentation on replay, without a separate full-controls option. Menu remains available for navigation; creations and shared challenges use the full workspace.

Flight, Function and Flow are visible tabs sharing one editor and history. Flight and Function use `flight` and `function` consistently in URLs and artifacts. Earlier equation-view saves migrate without losing their recipes. Mathematical notation uses KaTeX. The current puzzles use h(x), meaning height over horizontal position; throwing speed does not change the answer. The dotted curve previews the recipe and the solid trail follows the cucumber. Green/red checks preview target validation immediately in Flight, Function and Flow. Throw fills their confirmation badges in passage order on one shared clock, and the last required hit reveals Next puzzle or Create. A secondary Rethrow button appears to its left; replaying keeps Next available.

Available blocks form visible stacks. Puzzle capacity appears as actual empty slots in the recipe. Empty slots can move and accept a block in place. Dropping an available block onto an occupied recipe slot inserts at that position and shifts blocks toward an empty slot. Moving an existing block into an empty slot exchanges those two positions without shifting the others. Drag a placed block off the recipe to return it to its stack. Tap a block and then another slot to move it, or its matching stack to return it. Arrow keys move the focused block or empty slot; Delete/Backspace returns a block. Visible Undo and Redo buttons share the same history, including slot positions. New accepted edits clear the redo branch. Escape, interrupted pickups and rejected edits preserve the accepted recipe. The starting curve is fixed in puzzles; in creation its formula under Start opens a visual chooser and supports Undo/Redo without discarding the recipe.

Function pairs the final function with an exact position/expected/actual comparison, updating immediately without a throw. Flow has a position slider and linked curve previews: compare each operation at the same x, including the incoming tangent before differentiation. Integration stages shade signed area under the input curve, solid for positive area and hatched for negative area. Flight, Flow and the reference sketches keep a solid, labelled zero line in view. The kernel supplies every displayed value; Flow shares the slider and throw clock with the other views. Targets and validation stay visible, and targets are drawn on the final graph. During a throw, the slider follows the shared flight clock with manual input disabled, then returns to the position you were inspecting. Horizontal and vertical inspection scroll survives edits, Undo and view changes. Confirmation pulses have reserved space and do not resize the panels. Wide layouts show the chain horizontally; narrow layouts show a vertical chain. Flight fits uniformly, preserving its curve proportions and mathematical bounds when resizing or zooming. Very short portrait layouts allow scrolling to keep the board usable.

The cucumber starts pulled behind stretched slingshot bands, aligned with the exact path tangent at `x = 0` so release begins in the curve's direction. This finite presentation slope is separate from target success and does not impose the height preview's magnitude cap. Speed streaks follow the path independently of the cucumber's tumble. The Skip animation setting gives the same exact result immediately and defaults to the system motion preference. One canonical SVG supplies the character and the wordmark's dotted final i; the build derives the matching favicon from it.

Eyes and smile share a contrasting cream color. Available copies are complete block shapes stacked downward; only the top copy highlights or lifts. The game and About use the same wordmark component. About explains the Greek cucumber etymology, separates section navigation from community links, and includes local social and official project artwork. Project sources and licenses are bundled under `web/public/projects/`.

Menu contains Puzzles, Create, Save & open, Share, How to play, and Settings. Back returns from a secondary menu to its opening tile; Back in the main menu returns to play. Creation has six reusable operations without puzzle inventories, recipe quotas or inherited target feedback. Its starting-curve chooser belongs under Start in the recipe. Saved recipes and hidden-solution challenges support longer recipes; a challenge's stock and capacity come from its creator's construction. Local progress, including empty-slot positions and partial challenges, survives reloads. Switching workspaces with unsaved blocks offers Save, Discard or Cancel; saved recipes retain their mode and empty slots. Failed saves keep the current recipe open. Restart beside Undo/Redo clears only the current recipe. The confirmed global reset states, “Saved recipes and settings stay.” There are no accounts or remote analytics. [AGENTS.md](AGENTS.md) records the design decisions and regression traps.

Twenty-eight puzzles form six chapters: Height (sources 1, 2, 3, 24, 25), Reflection (6, 8, 9, 26), Squaring (7, 10, 4, 27, 28), Flatter tops (12, 13, 11), Slopes (14, 5, 15, 22), and Area (16, 19, 17, 20, 21, 18, 23). Earlier lessons keep their small discovery spaces. New bridges introduce fractional lift placement in Lifts in pieces and moving a zero before folding in Move the fold. Each chapter ends with a larger planning task that combines its relationships: A smaller perch, Turn a raised bowl, An off-center arch, Hold the summit, Shape the change, and Bring it together. Optional Shape notes reveal only the current and preceding lessons, name useful intermediate goals, and never show a whole capstone recipe; Create offers the complete reference. Flight displays required heights and Flow exposes each transformation. Finish opens only after Bring it together, with chapter progress, an AngouriMath credit and Create/Revisit choices. Opening or completing that final source does not mark skipped puzzles complete. There are no time or attempt penalties. The independent finite-space counts are recorded in [the playtest plan](docs/playtest.md); participant testing must still establish whether this pacing supports planning and transferable understanding.

## Run and build

Requirements: .NET SDK 10.0.302 with the `wasm-tools` workload, and a Node version supported by Vite 7. Verification used .NET runtime 10.0.10 and Node 26.5.0 on Windows.

```powershell
dotnet workload install wasm-tools
npm ci
npm run build
npm run preview
```

`npm run dev` starts the frontend after an initial build supplies its runtime. `npm run build` checks TypeScript, publishes the .NET kernel and creates `dist/`. Use HTTP; `file://` cannot load WebAssembly modules correctly. No special isolation headers or backend are required.

For an optional local preview of the legacy repository-root layout:

```powershell
npm run build:pages
```

The optional staging command copies the static bundle to the repository root, preserving `CNAME` and `.nojekyll`. Edit `web`, then rebuild; root site assets and `dist/` are generated. Only runtime assemblies referenced by the current boot manifest are included, avoiding stale hashes left by incremental .NET publishing. Building does not push, merge or publicly deploy. Assets use relative paths and shared links use fragments, so no SPA rewrite is needed.

GitHub Actions builds and tests the source, then uploads dist/ directly to Pages from the default branch. See [deployment setup](docs/deployment.md). No generated-output branch push is needed.

The initial version is **0.1.0**, currently unreleased. [CHANGELOG.md](CHANGELOG.md) supplies the player-facing Version log in the main menu. See [release instructions](docs/releases.md) for version policy, checks and publication. The main menu also links Discord and this game repository. Settings contains Skip animation and a confirmed reset of puzzle progress.

About is rendered from the organization profile README, including projects, contributors, etymology and contributions. Run `npm run sync:community` to refresh the saved upstream content; deployment does this before building. [Community content](docs/community.md) explains editing and review. Honk# is included with its official artwork. All six project headings include matching GitHub star badges.

The organization README also uses the site's dotted-cucumber wordmark. `npm run export:brand` exports its actual rendered layout as self-contained light/dark SVGs for GitHub; see the community guide for regeneration.

## Source boundaries

| Path | Responsibility |
| --- | --- |
| `kernel/Game.fs` | Authored puzzle rules, legality, exact results, LaTeX, samples and artifact validation |
| `bridge/Program.cs` | Small C# `JSExport` adapter into the F# kernel |
| `web/public/engine-worker.js` | Dedicated .NET WebAssembly worker |
| `web/src/engine.ts` | Acknowledgements, timeout, worker restart and retry |
| `web/src/main.ts` | Shared state, ordered edits, slot layout, history, input and file workflows |
| `web/src/views.ts` | Flight SVG and read-only Function/Flow views |
| `web/src/notes.ts` | Kernel-backed visual chapter reference, separate from the player state |
| `content/community.json` | Saved organization profile with upstream blob SHA |
| `CHANGELOG.md` | Player-facing version history |
| `web/src/brand.ts` | Wordmark shared by the game and About |
| `web/about` | Community page, built as a second Vite entry |
| `web/public/cucumber.svg` | Canonical artwork; the build generates `favicon.svg` from it |
| `web/src/play.css` | Pieces, slots, stacks, controls and feedback |
| `tests` | Independent mathematical checker and browser interaction coverage |

AngouriMath 2.5.0 transforms expressions, differentiates and integrates functions, computes exact checkpoint values, produces LaTeX and samples curves through its bytecode interpreter. The six operations halve, lift, reflect, square, differentiate and integrate. Integration is signed accumulated area from zero: `F(x) = ∫₀ˣ h(u) du`, written with an upright differential d and no free constant. Numerical samples never decide success. Original source IDs 1 through 5 retain their constraints; new lessons extend the progression without renumbering saved puzzles. Creation supports repeated operations with technical preview guards of 64 blocks, polynomial degree 32, bounded numerical output, and a 100,000-step/two-second AngouriMath WorkBudget. Rejected moves explain the preview limit and leave the accepted recipe intact. An external timeout can terminate an unresponsive worker.

The frontend retains only acknowledged constructions. Edits run in order; a worker restart retries an unacknowledged request at most once against its original snapshot. Stale responses are ignored. History lasts for the session; accepted progress and slot layout are stored locally.

Save schema 1, ruleset `vine-1` and engine `AngouriMath-2.5.0` remain compatible. Legacy six-block creation saves validate and upgrade to reusable blocks. Imported JSON is limited to 64 KiB. Creation artifacts retain node identities; challenges derive targets and inventory without exposing node order and validate their own importability. Links fall back to files above 8,192 characters. Storage failure leaves the session playable and recommends export.

## Verification

```powershell
npm run check
npm run test:content
npm run test:kernel
npm exec playwright -- install chromium firefox webkit
npm run test:browser
```

Browser tests start a static `dist/` server on port 4174 if needed. They cover drag, tap, keyboard, movable empty slots, return-to-stack, cancellation, text-selection pickup, drop destinations, rail sizing, reusable creation, every puzzle, target feedback, history, KaTeX, artwork, sharing, reload, files, storage failure, reduced motion, worker recovery and About. They also check Flow scroll preservation, frame-by-frame confirmation layout, menu Back navigation, and source changes under Start. Chromium exercises injected touch gestures. `node scripts/inspect.mjs` captures visual review states; `npm run demo` records the working first move.

The suite also checks immediate function comparisons, slider inspection, derivative and integration samples, responsive view layouts, stable Flight proportions, top-copy pickup and the shared About branding. Social brand shapes in `web/public/social.svg` come from Simple Icons 9.21.0 under CC0-1.0.

See [verification](docs/verification.md) for results and limitations, and [playtest](docs/playtest.md) for the proposed outsider sessions. Automated checks do not establish audience demand or physical-device usability.
