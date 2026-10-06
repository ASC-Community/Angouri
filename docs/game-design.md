# Equation playground: current design and extensions

The game should offer new decisions, not merely longer permutations of height blocks. The current release supports explicit height equations, complete circle equations and implicit recipe relations. The latter can have two heights at one position; they are never reduced to the upper branch.

## Implemented progression

There are 63 main puzzles across ten chapters and fourteen optional puzzles: 77 playable sources. Stable source IDs keep their rules and saved recipes. The main sequence is:

| Chapter | Source IDs | New decision |
| --- | --- | --- |
| Height | 1, 2, 3, 24, 25 | Separate a gap from its placement; make fractional lifts |
| Reflection | 6, 8, 9, 26 | Account for direction, scale and an existing offset |
| Bowls and arches | 7, 10, 4, 27, 28 | Choose where the input crosses zero before folding |
| Flat tops | 12, 13, 29, 30, 31, 11 | Compare fourth, sixth and eighth powers; fit and construct before flattening |
| Slopes | 32–36 | Build the input's turning points, then place the output |
| Accumulation | 37–42 | Plan input signs and zero crossings, then choose the initial amount |
| Loops | 43, 44, 48, 68, 69, 70, 66, 49, 71 | Move a loop, then shape both heights and their real regions with block equations |
| Waves | 50-55 | Phase, period, amplitude and folded lobes |
| Steps | 56-63 | Exact rounding boundaries, threshold placement and accumulated steps |
| The shape garden | 72, 73, 74, 75, 76, 77, 64, 65, 67 | Connect slope, waves, steps, area and both branches in one construction |

The progression introduces a relationship, applies it in a more involved construction, and then asks for transfer. Every source occupies its own numbered step, records its own completion and appears in the ordinary Next route. Similar-looking puzzles stay separate when the later one adds scaling, reconstruction or another dependency; completing an earlier source never awards a later one.

Reflection first turns a provided bowl into a roof (8), then adds scaling while holding its peak (9), before the raised-bowl challenge (26). Flat tops first isolates fourth-power flattening (12) and its roof finish (13), then repeats those decisions for a sixth power (29–30). Source 31 gives a provided bowl so repeated flattening is the new decision. Source 11 follows it and raises complexity by requiring the player to construct and fit that bowl before flattening, turning and placing the summit.

The sixth power comes from squaring a cubic, rather than adding a button for each exponent. Source 31 rehomes the repeated-flattening idea from the earlier derivative-first capstone and asks for an eighth-power summit without making differentiation a prerequisite. Source 11 then tests whether the player can recover the needed bowl as part of the construction.

Sources 45-47 and the earlier calculus combinations remain under More shape puzzles. The geometry set provides hands-on practice with diameters and perpendicular bisectors; its Notes reveal the prerequisites for those tasks without exposing later block lessons. Optional puzzles can still be played and shared, but do not count toward chapter completion.

Single-slot polynomial puzzles use direct choices throughout the game. This depends on total capacity, not one remaining hole in a larger recipe. Later lessons retain their heading, notes and the three views; the one-choice palette replaces the rail and editing toolbar. The first two puzzles additionally withhold those views and notes, and 1.1 keeps a large centred wordmark as the landing title. A station's two sides remain visible in the normal editor.

## Fixed stations

The shared horizontal rail has Input slots, a fixed machine, and Output slots. A foundation shape distinguishes the machine from gripped, movable blocks. All other editing actions remain familiar: drag, tap, keyboard, return to stack, holes, Undo and Redo. Long recipes scroll inside that rail. Station chapters keep the same viewport layout as earlier chapters, including their minimum usable board and compact-screen fallback; they do not force the document taller.

The F# kernel derives each station's identity, operation and capacities from the source. It includes the station in every exact evaluation and preserves it on reset. A cross-station shift submits the entire resulting order for validation, because several blocks can cross the boundary when an occupied slot is filled. Saves retain holes on both sides. Create converts the station into an ordinary movable operation; exported creations and challenges keep the resulting mathematics without claiming authored station constraints.

Fixing a machine is useful only when the task needs its input. The slope sequence compares lift placement, then requires folding before differentiation, moves the fold, explores several flat positions, and ends with a two-sided construction. The accumulation sequence changes the incoming rate, relocates a zero crossing, creates multiple sign regions, separates scale from initial amount, reconnects differentiation and integration, then combines those relationships.

Small discovery tasks may be solved by a few experiments. The purpose of later tasks is to make a prediction useful. They have no timers, lives or attempt penalties. Exhaustive exact checks can detect shortcuts; only player observation can establish intuition, interest or satisfying difficulty.

## Spatial slope and signed area

Flight remains the common reward so the new chapters retain familiar targets and pacing. Flow adds a compact explanation at the fixed station:

- Differentiation reads height over horizontal position. A local tangent triangle shows signed rise/run with equal units; its slope is supplied by the kernel. The sketch represents rising, flat and falling places, not velocity.
- Integration accumulates signed area over horizontal position. The input height controls whether area adds or subtracts; the meter shows area from zero to the inspected position, not a fluid volume accumulated over time.

Each display is inside the Flow card of the derivative or integral it explains, to the left of that stage's output plot on a wide screen and above it on a narrow screen. Multiple calculus steps each read their own incoming and outgoing kernel samples; a panel never describes an unrelated first station. They share the existing slider and throw clock, disable manual scrubbing during playback, and restore the inspected position afterward. There is no additional simulator, evaluator, success rule or editor. A later world can replace the throw with motion or a vessel if its targets and notation make those quantities the actual task; the current analogies do not silently reinterpret every spatial puzzle as time.

## Circle equations and a geometric interaction

Sources 43-44 introduce radius and centre translation in the main Loops chapter. Optional sources 45-47 continue through a diagonal diameter, a three-point chord construction and a changed final constellation. Their new decision is geometric: make the target distances agree before matching the radius. The final three targets are non-collinear and do not offer an axis-aligned diameter. The first two discoveries have fixed quantities; later levels expose all three parameters. Fixed fields look fixed and have no handles.

The shared recipe contains centre coordinates and radius in exact quarter steps. In Flight, a four-direction arrow moves the centre and the slingshot changes radius when dragged left or right. The loaded artwork follows the preview, and dropping it edits without throwing. Both controls support tap destinations and keyboard actions. They edit the same state, not another recipe or physics simulation. A gesture commits one kernel action and one history entry. Cancellation restores the acknowledged state and artwork. Exact field entry provides a precise alternative. Representation changes in Create protect unsaved work and remain undoable.

The defining equation is `(h-b)^2 = r^2 - (x-a)^2`. AngouriMath checks `(x-a)^2+(h-b)^2 = r^2` at each required point. Equation compares those exact squared distances with the squared radius. Flow decomposes a selected target into the two legs of a right triangle and their squared sum. From the diameter lesson onward it can compare target pairs: a dashed chord and its perpendicular bisector reveal a locus for the centre, not the complete solution. The radius remains the player's decision. No height-gap guide is inherited by a circle.

Circle geometry comes from the kernel as a full, counterclockwise parametrized loop beginning at the rightmost point, with initial tangent `(0,1)`. Both axes use the same scale. Playback follows path index/phase, not increasing x; a target on the lower branch is confirmed when that branch is reached. Views share the same clock, and Flow restores its inspected phase after the reward. Floating-point samples draw the curve; exact membership alone decides success.

Circle creations save parameters, support Undo/Redo and sharing, and export hidden-recipe challenges from exact rational points on the circle. A challenge contains targets and never the source circle's centre/radius solution. The defining relation, geometry and target predicates stay inside the AngouriMath kernel boundary.

## Equations beyond height functions

The bridge from direct circles to block recipes is the familiar arch `h = 1-(x-2)^2` becoming the complete relation `h^2 = 1-(x-2)^2`. The same square, negate and lift recipe builds the right side; the new left side supplies both branches. Source 48 makes that bridge. Sources 68-70 then isolate three consequences: adding one to the right side moves its positive and negative heights apart, two halvings of `h^2` halve `|h|`, and negation changes where the right side is nonnegative and real heights exist. Source 66, Round or pointed?, explicitly contrasts the rounded square-root branches of a roof with the pointed positive and negative copies obtained by squaring it first. Source 49 applies the earlier geometry before source 71 combines these ideas. Direct circle lessons retain their handles. Distinguish changing the equation form from squaring a recipe expression. Whole-loop calculus needs a parameterized motion interpretation rather than a globally single-valued height.

The equation display starts with `h = …` for explicit-height worlds, and uses `h² = …` for squared-height relations. For example, `h² = 1-(x-2)²` describes a complete circle centered at `(2,0)`. AngouriMath's LaTeX renderer preserves necessary parentheses around nested powers and operations. Each displayed integral binds its own dummy variable; the evaluated equation uses the position variable `x`. The visible final-expression view is Equation; the stored `function` identifier remains compatible with earlier links and saves.

Operation blocks use an input placeholder, written `\square` in LaTeX: `\square+1`, `\frac{\square}{2}`, `-\square` and `\square^2`. Its outline is dashed, matching Flow's incoming curve. KaTeX handles its metrics and accessible MathML; a scoped decoration supplies the dashed outline. The short names Halve, Add one, Negate and Square do not bind those operations to height. Slope and accumulation templates use the same input placeholder. The help explains it once, without adding labels to every repeated action.

Squaring an incoming expression and choosing the equation form `h² = …` are different mechanics. The first transforms the recipe's right side; the second changes the relation and introduces two branches. Circle construction uses centre and distance controls, rather than ambiguously reusing a height-squaring block. Its explicit path parameter handles vertical tangents without pretending they have a finite height derivative.

Waves use a quarter-turn sine block. The input chooses a position around the circle and the output is its height. Shifting before this block changes phase; shifting after it moves every height. Halving before changes period; halving after changes amplitude. Squaring folds both lobes upward. The chapter combines these relationships without requiring a particular equivalent recipe.

Steps introduce floor and ceiling separately, then negative inputs, width, height and threshold placement. Floor and ceiling leave exact whole values unchanged. Rational affine and transformed quarter-turn sine inputs receive exact partitions with open and closed endpoints. Nonlinear rational-polynomial children can also be rounded with exact checkpoint readings; their compiled adaptive preview omits endpoint-ownership markers where a sampled boundary is only approximate. Later sine projection maps whole phases into a signed repeating step pattern; anchored integration turns supported partitions into ramps, plateaus and reversals while carrying a continuous constant across boundaries. Differentiation checks a segmented result for continuity instead of imposing a blanket ban after rounding. Engine guards still reject combinations for which the CAS cannot provide an honest exact accumulated form; this is deliberately narrower than claiming every composition works. The remaining upstream floor/ceiling exactness limitation is tracked in [AngouriMath issue 1807](https://github.com/ASC-Community/AngouriMath/issues/1807).

Together has three jobs. Uneven wave spacing uses the derivative of a cubic as a curved phase input, so equal changes in position turn the circle by unequal amounts. Build a gate asks for a window of positive input, its accumulation, then a centred fold. Loops has already taught how a squared roof produces paired branches. One curve, many ideas combines derivative, phase and scale, rounding, sine projection, signed accumulation, centring, reflection and powers in a two-sided equation. This is a synthesis of relationships; valid alternative recipes still win.

The new authoring data lives in `content/extended-puzzles.json`, embedded in the kernel and imported by the interface. It contains rules and target values, never solution recipes. Existing source IDs, rules and save identities stay stable. The main route has 63 puzzles across ten chapters, with fourteen preserved optional sources.

For recipe relations, blocks build the right side of `h^2 = ...`. The interface keeps the familiar `h` and `h^2` notation. AngouriMath solves for the real height branches and supplies their exact domain conditions; it also fully simplifies the displayed expressions. Exact validation compares each target's squared height with the right side. Only regions with nonnegative right side have real branches. Playback follows the locus: a simple loop uses one cucumber, as do two open branches joined at their sole shared endpoint. The latter launches from an outer endpoint and visits the tip once. Disconnected nonrounded real regions are paired separately. Crossing curves retain separate travellers that follow their smooth analytic continuation when an exact signed square root can be proved, instead of bouncing along the positive or negative principal branch. This bounded structural proof is cached and verified by AngouriMath exact equality; expanded squares outside the recognized expression-tree forms retain solver traversal. A stepped height solution keeps one traveller across its unconnected jumps. Equation retains the principal solved heights and conditions, and Flow finishes the right-side chain with a diagram of both heights. Empty real geometry remains editable, with Throw disabled until a path exists. The frontend does not choose a mathematical branch or evaluate the recipe.

## Picture construction and mastery

Chapter 10 first turns learned relationships into recognizable curves, then asks for harder synthesis. All nine lessons are mainline; the old optional collection remains separate. The centered level title names the current task. The chapter label, The shape garden, is itself a picture-icon button that opens the earned picture; Mastery labels use a distinct star.

| Puzzle | Stable source | Construction question |
| --- | --- | --- |
| 10.1 Keep one lobe | 72 | Which interval keeps the useful part without moving its heights? |
| 10.2 Grow a stem | 73 | How can accumulated area form a flowing stroke, still anchored at zero? |
| 10.3 Shape the moon | 74 | How do right-side zeros and maximum squared height determine a loop? |
| 10.4 Point a leaf | 75 | How does a roof supply both pointed sides? |
| 10.5 Settle a ripple | 76 | Separate phase, amplitude, baseline and retained extent. |
| 10.6 Draw the cucumber | 77 | Combine a broad body with rounded caps; distinguish right-side scale from actual-height thickness. |
| 10.7–10.9 Mastery | 64, 65, 67 | Plan nonuniform phase, a signed window, accumulation and paired magnitudes. |

Picture lessons include a kernel-sampled target outline as well as exact landmarks. Completion requires exact equality across the kept interval, not just passing the points. An independently placed picture piece is earned by solving its ordinary block recipe; there is no supplied-stamp shortcut or competing picture editor. The earned pieces gather in Picture Garden. Its curves and backed labels are directly selectable Build/Revisit controls, including keyboard focus; missing pieces stay faint silhouettes. The cucumber uses a broad roof with rounded square-root caps, contrasting with the pointed leaf. This reuses Flat tops and the strengthened 7.7 discovery rather than introducing an unexplained new operation. After construction, its mathematical outline morphs into the body sampled from the canonical SVG before the skin, stem, ridges and face appear. This decorative transition is not an additional equation or success predicate, and it does not leave the old outline underneath.

Crop is a terminal domain control after the shared block rail, not a movable arithmetic block. It uses exact rational closed bounds within the source domain. Retained heights stay unchanged, excluded positions are undefined rather than zero, and accumulation still begins at zero before cropping. AngouriMath `Provided` renders the restricted equation. Its current compiler does not compile `Provided`/boolean predicates, so the kernel compiles the inner expressions and clips their rational domain. Crop never crosses a derivative or integral, avoiding ambiguous calculus of a restricted input. Original stages remain available in Flow, followed by a final Crop card. The same crop survives history, creation, saves and fixed-domain shared challenges. The visible cut responds immediately by clipping existing kernel samples; coalesced exact replies supply validation without measuring the plot. A bounded cache avoids rebuilding the unchanged underlying recipe for every interval.

Full-outline equality compares exact expressions and boundary ownership over a common refinement of rational piecewise intervals. It is not a numerical curve tolerance. The authored outlines use the supported polynomial/sine subset; this is not a general decision procedure for every identity in arbitrary symbolic functions. Target parsing, sampling, simplification and verdict caches are bounded. The frontend draws and interpolates kernel samples only.

Mastery challenges keep their original stable IDs, rules and normal completion. They receive a visible title marker and a distinct earned seal. Inventories allow substantial search, but their planning route depends on earlier invariants rather than enumeration: name an intermediate phase, window, accumulated total or magnitude, inspect it in Flow, then fit the next relationship. A pedagogical dependency audit found no additional mechanic needed before these three; participant prediction and transfer checks are still required.

Desmos's [math art introduction](https://help.desmos.com/hc/en-us/articles/4406809622541-Math-Art) and [restriction guide](https://help.desmos.com/hc/en-us/articles/4407885334285-Inequalities-and-Restrictions) illustrate composing familiar bounded curves. Parametric drawing, arbitrary shading and freely placing multiple editable recipes on one canvas remain future extensions.

## Evidence of fun, clarity and depth

Notes are a reusable reference, with the current principle first and earlier numbered lessons directly visible. Independent examples explain order, scaling, zeros, signed area and equal distances without the active puzzle's targets or solution plan. They reveal only concepts introduced so far, even on a replay. Discovery puzzles instead show a short finding about the accepted move and hide Hints. Create has the full reference.

Hints own puzzle-specific help: an initial clue, shortcuts to Notes and the relevant view, then optional Another hint and Show a sketch disclosures. Target overlays and fitted intermediate shapes belong only to that explicit sketch. The shared diagram renderer keeps fixed scales and kernel-provided readings; neither reference nor hint examples change the player's construction, history or inspection position. Separating these roles makes recalling a rule safe without silently revealing a plan for the puzzle.

The reference audit covers the full route. Puzzle 4.5 combines fitting from 3.2 with the repeated-square relationship introduced in 4.1; its missing connection is explicit. Puzzle 4.6 adds constructing the bowl from a line and choosing its scale and finish. It need not use the largest power encountered. In Loops, sources 68-70 isolate growth, square-root scaling and real-domain changes before the synthesis in 71. An independent rational oracle enumerated all 92,124 legal recipes through the nine-block limit for source 71: eight solve it, and `AHHQNAHQ` is the unique shortest solution at eight blocks. These counts establish mathematical coverage, not human difficulty. If players still cannot predict these effects after the comparisons, use the observation protocol to decide whether a smaller discovery belongs before a combination.

Picture Garden displays the mathematical pieces earned in Chapter 10 and remains accessible from the ending. It never fills missing progress. A direct link to the final challenge can finish that construction without claiming the earlier picture was built.

The intended appeal is a readable target field, tactile manipulation, a cucumber that visibly travels the player's construction, and a new question at each chapter boundary. The intended depth lies in invariants: gaps, zeros, symmetry, input/output placement, signed accumulation and equal distances. The Flat tops sequence makes its added construction work explicit instead of treating related shapes as interchangeable. The geometric circle challenge uses a changed target arrangement; the new final garden asks players to combine ideas across chapters.

Exact oracles establish legality, solutions and the absence of named mathematical shortcuts. They do not establish that a person reasons instead of guessing, or that the game is fun. Ask for a prediction before one move, then observe a changed problem and voluntary continuation. Separate understanding the mathematics from operating a handle, reading an equation or finding a view. See `playtest.md` for that participant protocol.

## Framing and creation controls

Full curve is a reversible toggle for Flight and the parameter-circle Flow plot. It fits the current construction and targets after accepted edits; turning it off restores the default frame captured when that construction opened. Default framing and every drag gesture remain fixed. The toggle never changes recipe history, never measures a live drag to refit, and is hidden where it would not affect the plot.

Create centers equations and labels on each reusable deck block. The source chooser separates block-compatible equations from Circle controls, which visibly explain that centre/radius controls replace blocks. The preservation dialog repeats this consequence before Save, Discard or Cancel, and the accepted switch remains undoable. Undo, Redo and Restart use consistent icon-only buttons with accessible names and shortcut titles.
