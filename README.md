# Angouri · Shape the flight

The website opens into a fullscreen mathematical puzzle: build a recipe, then throw a cucumber through the targets. The original community, project and contributor content lives at `/about/`.

The first puzzle starts with a centered logo, the curve and targets, and two block choices. Pick either to update the curve; pick the other to replace it directly. Throw appears after a choice. Puzzle 1.2 adds its heading, axes and third choice. Puzzle 1.3 introduces ordering, the recipe editor, Notes and the three views. Discovery puzzles, including 1.3–1.4, report the mathematical effect of the move just made and hide Hints; Notes remains a reusable reference with independent examples and no active-puzzle plan. Hints first appears at the planning lesson 1.5. Larger authored combinations offer current-puzzle clues and an explicitly requested sketch, with a gentle glow after stalled rearrangements. The first two puzzles display Flight while leaving the selected view and its saved preference untouched; that selection applies again at 1.3. They keep their focused presentation on replay, without a separate full-controls option. Menu remains available for navigation; creations and shared challenges use the full workspace.

Flight, Equation and Flow are visible tabs sharing one editor and history from 1.3 onward. Flight uses `flight`; Equation preserves the earlier `function` identifier in URLs and artifacts. Earlier equation-view saves migrate without losing their recipes. Mathematical notation uses KaTeX. The current puzzles use equations in horizontal position x and height h; throwing speed does not change the answer. The dotted curve previews the recipe and the solid trail follows the cucumber. Green/red checks preview target validation immediately in Flight, Equation and Flow. Throw fills their confirmation badges in passage order on one shared clock, and the last required hit enables the next route action. A secondary Rethrow button appears to its left; replaying keeps Next available. The last authored puzzle offers Finish and a dedicated ending with the actual chapter record and Create/Revisit choices.

Available blocks form close, aligned stacks without connector nubs. Reusable stacks fade below and replenish after an accepted addition. Puzzle capacity appears as actual empty slots in the recipe. Empty slots can move and accept a block in place. Dropping an available block onto an occupied recipe slot inserts at that position and shifts blocks toward an empty slot. Moving an existing block into an empty slot exchanges those two positions without shifting the others. Drag a placed block off the recipe to return it to its stack. Tap a block and then another slot to move it, or its matching stack to return it. Left/Right moves the focused block or empty slot. Down or forward Delete returns a block while keeping its slot focused; Backspace clears it and moves focus one editable slot left. Visible Undo and Redo buttons share the same history, including slot positions. New accepted edits clear the redo branch. Escape, interrupted pickups and rejected edits preserve the accepted recipe. The starting curve is fixed in puzzles; in creation its formula under Start opens a visual chooser and supports Undo/Redo without discarding the recipe.

Equation shows the ordered construction and its simplified form beside an exact position/expected/actual comparison, updating immediately without a throw. Flow has a position slider and linked curve previews: compare each operation at the same x, including the incoming tangent before differentiation. Integration stages shade signed area under the input curve, solid for positive area and hatched for negative area. Flight, Flow and the reference sketches keep a solid, labelled zero line in view. The kernel supplies every displayed value; Flow shares the slider and throw clock with the other views. Targets and validation stay visible, and targets are drawn on the final graph. During a throw, the slider follows the shared flight clock with manual input disabled, then returns to the position you were inspecting. Horizontal and vertical inspection scroll survives edits, Undo and view changes. Confirmation pulses have reserved space and do not resize the panels. Wide layouts show the chain horizontally; narrow layouts show a vertical chain. Flight fits uniformly, preserving its curve proportions and mathematical bounds when resizing or zooming. All three views stay inside the shared viewport frame: short layouts scroll Flight, Flow or Equation content locally while keeping the launch action visible, without growing the game document.

The cucumber starts pulled behind stretched slingshot bands, aligned with the kernel path's exact initial tangent so release begins in the curve's direction. This launch direction is separate from target success and does not impose the height preview's magnitude cap. Speed streaks follow the path independently of the cucumber's tumble. The Skip animation setting gives the same exact result immediately and defaults to the system motion preference. One canonical SVG supplies the character and the wordmark's dotted final i; the build derives the matching favicon from it.

Eyes and smile share a contrasting cream color. Available copies are complete block shapes stacked downward; only the top copy highlights or lifts. The game and About use the same wordmark component. About explains the Greek cucumber etymology, separates section navigation from community links, and includes local social and official project artwork. Project sources and licenses are bundled under `web/public/projects/`.

Menu contains Puzzles, Create, Save & open, Share, How to play, and Settings. Back returns from a secondary menu to its opening tile; Back in the main menu returns to play. Creation has nine reusable operations without puzzle inventories, recipe quotas or inherited target feedback. Its starting-curve chooser belongs under Start in the recipe. Saved recipes and hidden-solution challenges support longer recipes; a challenge's stock and capacity come from its creator's construction. Local progress, including empty-slot positions and partial challenges, survives reloads. Switching workspaces with unsaved blocks offers Save, Discard or Cancel; saved recipes retain their mode and empty slots. Rename changes a saved name in place without changing its recipe or saved date. Failed saves keep the current recipe open. Restart beside Undo/Redo clears only the current recipe. The confirmed global reset states, “Saved recipes and settings stay.” There are no accounts or remote analytics. [AGENTS.md](AGENTS.md) records the design decisions and regression traps.

Seventy puzzles form ten chapters, ending with The moonlit garden. Every source is a distinct step with its own completion; Next follows the route in [the learning manifest](content/learning-path.json), explained in [the learning guide](docs/learning-path.md). Loops joins direct circle manipulation to squared-height recipes, then introduces how adding and halving the right side changes both heights and how its sign controls real regions. Waves teach phase, period and amplitude; Steps teach rounding boundaries and signed piecewise accumulation. The moonlit garden earns eight picture pieces before three marked Mastery challenges. Authored picture lessons fit exact targets inside fixed drawing frames; editable Crop belongs to Create. The cucumber's earned outline reveals the canonical mascot, and skipped puzzles remain unearned. Three earlier geometry puzzles, eleven earlier calculus puzzles and the former finale retain their stable rules in optional practice: 15 optional and 85 playable sources in total. No timers or attempt penalties are used. Participant testing is still needed to establish transferable understanding and fun. See [game design](docs/game-design.md) and [the playtest plan](docs/playtest.md).

## Run and build

Requirements: the .NET 10 SDK selected by [global.json](global.json), with its `wasm-tools` workload, and a Node version supported by Vite 7. Use Node 24 to match CI. Run `dotnet --version` from the repository to check the selected SDK; `global.json` owns its version and roll-forward policy. Historical platform/version observations are recorded in [verification](docs/verification.md).

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
| `kernel/Piecewise.fs` | Exact segmented domains, rounding, supported piecewise calculus and preview paths |
| `content/learning-path.json` | Main chapter order and prerequisites for all stable source IDs |
| `content/extended-puzzles.json` | Extended puzzle rules and names; embedded in the kernel and imported by the interface, without solution recipes |
| `bridge/Program.cs` | Small C# `JSExport` adapter into the F# kernel |
| `web/public/engine-worker.js` | Dedicated .NET WebAssembly worker |
| `web/src/engine.ts` | Acknowledgements, timeout, worker restart and retry |
| `web/src/main.ts` | Shared state, ordered edits, history, input and file workflows |
| `web/src/rail.ts` | Movable slot layout around fixed stations |
| `web/src/keyboard.ts` | Focus continuity and native tablist navigation |
| `web/src/station-scene.ts` | Kernel-driven spatial slope and area diagrams |
| `web/src/views.ts` | Shared Flight SVG and polynomial Equation/Flow views |
| `web/src/circle.ts` | Direct circle controls, exact-distance table and geometric Flow inspection |
| `web/src/notes.ts` | Kernel-backed visual chapter reference, separate from the player state |
| `web/src/discovery.ts`, `web/src/hints.ts` | Explicit discovery support classification, accepted-move findings and requested puzzle help |
| `content/community.json` | Saved organization profile with upstream blob SHA |
| `CHANGELOG.md` | Player-facing version history |
| `web/src/brand.ts` | Wordmark shared by the game and About |
| `web/about` | Community page, built as a second Vite entry |
| `web/public/cucumber.svg` | Canonical artwork; the build generates `favicon.svg` from it |
| `web/src/play.css` | Pieces, slots, stacks, controls and feedback |
| `tests` | Independent mathematical checker and browser interaction coverage |

Use the learning manifest for order and prerequisites. Earlier rules remain in `kernel/Game.fs`; `kernel/Angouri.Kernel.fsproj` embeds the extended rules. Source IDs and saved-rule compatibility are independent of displayed chapter positions.

AngouriMath 2.5.0 transforms expressions, differentiates and integrates functions, computes exact checkpoint values, produces LaTeX and samples curves through its bytecode interpreter. The nine operations halve, lift, reflect, square, differentiate, integrate, take a quarter-turn sine, floor and ceiling. Integration is signed accumulated area from zero: `F(x) = ∫₀ˣ h(u) du`, written with an upright differential d and no free constant. Its bound variable is `u`; a legitimate final expression may still contain the free position variable `x`. Formula rendering walks the expression AST so powers and other nested operations retain necessary parentheses. Numerical samples never decide success. Floor and ceiling accept nonlinear inputs when the kernel can preserve exact checkpoint readings; bounded rational partitions additionally support exact accumulated forms and continuity checks for differentiation. Adaptive samples draw other rounding previews without claiming exact ownership for approximate jump boundaries. Unsupported combinations are rejected by engine preview guards without changing the accepted recipe. Original source IDs retain their constraints. Creation also enforces limits of 64 blocks, polynomial degree 32, bounded numerical output, and a 100,000-step/two-second AngouriMath WorkBudget. An external timeout can terminate an unresponsive worker.

The frontend retains only acknowledged constructions. Edits run in order; a worker restart retries an unacknowledged request at most once against its original snapshot. Stale responses are ignored. History lasts for the session; accepted progress and slot layout are stored locally.

Save schema 1, ruleset `vine-1` and engine `AngouriMath-2.5.0` remain compatible. Legacy six-block creation saves validate and upgrade to reusable blocks. Imported JSON is limited to 64 KiB. Creation artifacts retain node identities; challenges derive targets and inventory without exposing node order and validate their own importability. Links fall back to files above 8,192 characters. Storage failure leaves the session playable and recommends export.

## Verification

```powershell
npm run test:unit
npm run test:oracles
npm run test:kernel
npm exec playwright -- install chromium firefox webkit
npm run test:browser
```

`test:unit` runs the Node unit/content/learning-path checks. `test:oracles` needs Python 3 and runs the independent sources 48–71 fixture/witness checks plus the 84 discovery and 64 phase-landmark checks. It does not run the more expensive shortcut/finale audits or the full 78–83 enumeration; invoke `tests/extended_puzzles_oracle.py --shortcuts`, `tests/mastery_oracle.py`, or `tests/learning_path_oracle.py` with Python 3 when that mathematical scope needs review.

`test:browser` first runs the complete build, including TypeScript checks and kernel publication, then tests that static `dist/` artifact with its own server on an isolated local port. `ANGOURI_TEST_PORT` can pin the port; an occupied port fails instead of reusing another server. After deliberately building the artifact already under review, `npm run test:browser:prebuilt` tests the existing `dist/` without rebuilding or rerunning checks. CI uses that explicit path after its build. Frontend-only repackaging with `node scripts/build.mjs` deliberately reuses the previously published kernel and cannot validate a kernel edit.

For a focused browser check, pass the file and browser project through the same build-owning command:

```powershell
npm run test:browser -- tests/browser/workspace-frame.spec.mjs --project=webkit
dotnet run --project tests/Angouri.Tests.csproj -c Release -- --relations-only
```

The kernel also accepts `--crop-only`, `--import-export-only` and `--placement-performance-only`. Choose the affected contract, then broaden only for changed behavior or unresolved failures. Useful browser entry points include:

| Changed contract | Browser specs |
| --- | --- |
| Shared frame, compact layout and motion | `workspace-frame`, `layout-motion`, `guidance-layout` |
| Keyboard, focus and block placement | `keyboard`, `recipe-keyboard`, `focus-affordances`, `placement-scroll`, `stack-motion` |
| Notes, Hints, discovery and route | `notes`, `notes-keyboard`, `discovery`, `learning-path`, `progression` |
| Circle, Crop, stations and extended curves | `circles`, `crop`, `stations`, `extensions` |
| Garden and saved recipes | `garden`, `garden-art`, `library-recovery` |

Each name expands to `tests/browser/<name>.spec.mjs`; `game.spec.mjs` also covers shared gameplay, storage, worker recovery, artifact and About workflows. The projects are `chromium`, `firefox` and `webkit`. Chromium's injected touch coverage is browser automation, not a physical-device test.

Visual capture helpers use Playwright's package-matched Chromium. After installing it and building, start a static preview:

```powershell
npm run build
node scripts/serve.mjs dist 4174
```

In another terminal, `npm run inspect:smoke` captures a short progression check, `npm run inspect` captures the broader visual review states, and `npm run demo` records the first move. These helpers require the preview to remain running; `ANGOURI_BASE_URL` overrides their default `http://127.0.0.1:4174` when reviewing another local server.

Record the actual command, browser/project, source commit/build identity and evidence location with each result. A targeted run is not a full-suite result. [Verification](docs/verification.md) contains historical results and limitations; temporary or ignored evidence paths may not exist in a fresh checkout. [Playtest](docs/playtest.md) describes the proposed outsider sessions. Automated checks do not establish audience demand or physical-device usability. Social brand shapes in `web/public/social.svg` come from Simple Icons 9.21.0 under CC0-1.0.
