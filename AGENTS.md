# Angouri working guidance

This index and the requirements kept below apply to every task. The topic contracts in [docs/agents/](docs/agents/) hold the remaining product requirements and remain mandatory whenever their behavior is affected. Before planning or editing, read every applicable topic and the dependencies it lists. Neither a summary in this index nor a historical entry in `docs/verification.md` replaces a contract. Code paths in the contracts are repository-relative.

## Coordination

For substantive work, use the installed `agent-deployment` skill to decide whether local work or a suitable independent subagent lowers total work and cost without lowering quality. Keep trivial conversation and exact small edits local. The main agent owns architecture, ambiguous reasoning, creative/spatial work, and integration. Routine authorized delegation needs no extra approval. External Claude accounts or paid services require explicit user authorization.

## Product decisions

This is a game that opens straight into play and fills the available viewport. Design from these player tasks:

1. Understand the target and shape a throw with mathematical blocks.
2. Throw the cucumber and see which targets it passes through.
3. Inspect the same construction through Flight, Equation, or Flow.
4. Revise the recipe, advance, or occasionally keep/share a creation.

Also moved to [play-and-workspaces](docs/agents/play-and-workspaces.md#product-decisions), [persistence-navigation](docs/agents/persistence-navigation.md#product-decisions), [views](docs/agents/views.md#product-decisions), [focus-keyboard](docs/agents/focus-keyboard.md#product-decisions), [notes-hints-language](docs/agents/notes-hints-language.md#product-decisions).

## Topic contracts

Route by the behavior a change affects, not by source filename: `web/src/main.ts` spans almost every topic, so an edit there needs only the contracts whose behavior it changes. Broad reviews may still need every contract.

| Contract | Read when a change affects |
| --- | --- |
| [play-and-workspaces](docs/agents/play-and-workspaces.md) | Chapter 1 landing, the play screen's primary views, direct single-slot play, the menu's occasional tasks or Create |
| [persistence-navigation](docs/agents/persistence-navigation.md) | Loading, unsaved-work protection, imports and links, the saved-recipe library, Restart or progress reset |
| [views](docs/agents/views.md) | Flight, Equation or Flow presentation, naming, validation previews, mathematical notation or Full curve |
| [editing-motion](docs/agents/editing-motion.md) | Blocks, slots, stacks, drag, tap, reorder, Undo/Redo/Restart, throws, stations, circle/crop manipulation or curve-edit transitions |
| [focus-keyboard](docs/agents/focus-keyboard.md) | Focus treatment, Tab order, shortcuts, dialog keys, action responsiveness or focus restoration |
| [layout](docs/agents/layout.md) | Dialog chrome, zoom and reflow, inspection scroll, label space, the viewport or scrolling |
| [garden-brand](docs/agents/garden-brand.md) | Cucumber artwork, wordmark, icons, operation colors or the Chapter 10 moonlit garden |
| [learning-progression](docs/agents/learning-progression.md) | Puzzle difficulty, playtesting, chapter order, titles and selector, or authored sources and challenges |
| [notes-hints-language](docs/agents/notes-hints-language.md) | The guidance area, Notes, Hints, discovery findings, block explanations or player-facing wording |
| [kernel-exactness](docs/agents/kernel-exactness.md) | Exact operations, circles, curve paths, implicit solving, ordered equations, algebraic targets or exact checkpoint proofs |
| [engine-recovery-performance](docs/agents/engine-recovery-performance.md) | The math worker, checkpoint evaluation cost, worker-epoch recovery or presentation caching |
| [community-release](docs/agents/community-release.md) | Community links, About, brand export, build checks, deployment or releases |

### Reading dependencies

- UI interaction changes also require [focus-keyboard](docs/agents/focus-keyboard.md) and [layout](docs/agents/layout.md).
- Notes changes require [notes-hints-language](docs/agents/notes-hints-language.md) and [learning-progression](docs/agents/learning-progression.md); interactive changes additionally require focus-keyboard and layout.
- Crop crosses [editing-motion](docs/agents/editing-motion.md), [kernel-exactness](docs/agents/kernel-exactness.md), [views](docs/agents/views.md) and [persistence-navigation](docs/agents/persistence-navigation.md).
- Kernel presentation-contract changes require [kernel-exactness](docs/agents/kernel-exactness.md) and the affected [views](docs/agents/views.md) requirements.
- Garden interaction changes require [garden-brand](docs/agents/garden-brand.md), [focus-keyboard](docs/agents/focus-keyboard.md) and [layout](docs/agents/layout.md).
- Async startup/navigation changes require [persistence-navigation](docs/agents/persistence-navigation.md) and [engine-recovery-performance](docs/agents/engine-recovery-performance.md).
- Follow further affected-topic dependencies when a change crosses these boundaries. These examples are not hard reading limits.

Keep transient author assignments, quota state and continuation instructions in the task handoff, not in these permanent product contracts.

## Interaction language

Moved to [views](docs/agents/views.md#interaction-language), [editing-motion](docs/agents/editing-motion.md#interaction-language), [focus-keyboard](docs/agents/focus-keyboard.md#interaction-language), [layout](docs/agents/layout.md#interaction-language), [notes-hints-language](docs/agents/notes-hints-language.md#interaction-language).

## Visual consistency

Moved to [views](docs/agents/views.md#visual-consistency), [layout](docs/agents/layout.md#visual-consistency), [garden-brand](docs/agents/garden-brand.md#visual-consistency).

## Implementation and verification

Edit `web`; the root website and `dist/` are generated outputs. Preserve the original community content under `/about/` and the existing Pages/CNAME configuration. A local build does not authorize public deployment.

The F# kernel remains authoritative for legal edits and exact target equality. Frontend animation must not change success criteria or commit unacknowledged state. Retain existing save/link compatibility when changing presentation.

For interaction changes, exercise actual drag, tap, keyboard, cancellation, return-to-stack, movable empty slots, Undo, and view switching. Inspect desktop, narrow portrait, and short landscape layouts, including intermediate interaction states and text-selection pickup. Use the build and focused-check commands in [README verification](README.md#verification), check the current packaged build, and record the command, browser/project and source/build identity honestly in `docs/verification.md`. Its dated results are historical evidence, not a second live product specification; do not assume ignored or temporary evidence paths exist in a fresh checkout. Automated browser coverage is not a claim of human usability or physical-device testing.

Remove obsolete prototypes and unused site assets when replacing them. Keep the runtime files referenced by the current .NET boot manifest; incremental publish folders may contain stale fingerprinted assemblies that should not ship.

Also moved to [views](docs/agents/views.md#implementation-and-verification), [editing-motion](docs/agents/editing-motion.md#implementation-and-verification), [learning-progression](docs/agents/learning-progression.md#implementation-and-verification), [kernel-exactness](docs/agents/kernel-exactness.md#implementation-and-verification).

## Chapters

Moved to [learning-progression](docs/agents/learning-progression.md#chapters).

## Notes, Hints and discovery support

Moved to [notes-hints-language](docs/agents/notes-hints-language.md#notes-hints-and-discovery-support).

### Discovery findings

Moved to [notes-hints-language](docs/agents/notes-hints-language.md#discovery-findings).

### Notes and requested Hints

Moved to [notes-hints-language](docs/agents/notes-hints-language.md#notes-and-requested-hints).

## Community and releases

Moved to [community-release](docs/agents/community-release.md#community-and-releases).

## Extension direction

Moved to [views](docs/agents/views.md#extension-direction), [editing-motion](docs/agents/editing-motion.md#extension-direction), [kernel-exactness](docs/agents/kernel-exactness.md#extension-direction).

## Combined progression and exact extensions

Moved to [views](docs/agents/views.md#combined-progression-and-exact-extensions), [editing-motion](docs/agents/editing-motion.md#combined-progression-and-exact-extensions), [learning-progression](docs/agents/learning-progression.md#combined-progression-and-exact-extensions), [kernel-exactness](docs/agents/kernel-exactness.md#combined-progression-and-exact-extensions), [engine-recovery-performance](docs/agents/engine-recovery-performance.md#combined-progression-and-exact-extensions).

## Loops and the playful ending

Moved to [editing-motion](docs/agents/editing-motion.md#loops-and-the-playful-ending), [garden-brand](docs/agents/garden-brand.md#loops-and-the-playful-ending), [learning-progression](docs/agents/learning-progression.md#loops-and-the-playful-ending), [kernel-exactness](docs/agents/kernel-exactness.md#loops-and-the-playful-ending).

## Critic review: phase, synthesis and compact play

Moved to [views](docs/agents/views.md#critic-review-phase-synthesis-and-compact-play), [focus-keyboard](docs/agents/focus-keyboard.md#critic-review-phase-synthesis-and-compact-play), [garden-brand](docs/agents/garden-brand.md#critic-review-phase-synthesis-and-compact-play), [learning-progression](docs/agents/learning-progression.md#critic-review-phase-synthesis-and-compact-play), [notes-hints-language](docs/agents/notes-hints-language.md#critic-review-phase-synthesis-and-compact-play).

## Viewport and scrolling

Moved to [layout](docs/agents/layout.md#viewport-and-scrolling).

## Curve transitions and player language

Moved to [views](docs/agents/views.md#curve-transitions-and-player-language), [editing-motion](docs/agents/editing-motion.md#curve-transitions-and-player-language), [garden-brand](docs/agents/garden-brand.md#curve-transitions-and-player-language), [notes-hints-language](docs/agents/notes-hints-language.md#curve-transitions-and-player-language), [kernel-exactness](docs/agents/kernel-exactness.md#curve-transitions-and-player-language).
