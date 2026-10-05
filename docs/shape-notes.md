# Shape notes by puzzle

Notes support the puzzle currently on screen. They include its new idea and prerequisites, even when the player has completed later puzzles. Completion history never reveals later material on an earlier replay. Create and shared challenges have the complete reference because they have no authored lesson order.

The complete 1.5 lesson stays in the Height tab of later puzzles, including its Function/Flow buttons, signed-gap guidance and fractional-lift examples. Returning to 1.5 or reloading it restores the same lesson; returning to 1.4 or earlier still withholds the later capstone plan. Height-gap tracking remains available in every authored puzzle from 1.3 onward, so later references must not drop these instructions simply because the chapter changed. Function and Flow explicitly name the positions of the lowest and highest required targets, comparing the same fixed pair throughout edits. Ties use the first (leftmost) target. This selects extrema among the required target samples, without estimating extrema between them. Puzzle 3.5 compares h(1)-h(4), whose required gap is 9/8; the current recipe's difference remains signed.

Chapter tabs are restricted as well as their content. Shape notes first appear in the normal interface at 1.3; the first two puzzles use simple block choices. Within the reference content, lifting is absent from 1.1 and order comparisons are absent until 1.3. Hidden details must not contain future examples. Every diagram and operation badge follows the same boundary as its text. The first two content boundaries remain defined for reference reuse, but there is no full-controls override to expose notes in those puzzles.

| Puzzle | Reference available in its chapter | Material withheld |
| --- | --- | --- |
| 1.1 Lower the arc | Notes hidden; the retained core example shows halving preserves zeros | Lifting, ordering, other chapters |
| 1.2 Lift the path | Notes hidden; the retained core example adds a uniform upward shift | Order comparisons and other chapters |
| 1.3 Order matters | Compare lift–halve with halve–lift; use Function to distinguish a matching gap from the starting height | Fractional lift pieces and later chapters |
| 1.4 Lifts in pieces | Use the kernel-backed `AHH` example to show that two later halves turn one lift into a quarter; trace starting height at x=0 in Flow while the gap brackets show scale | The final move that completes this puzzle and the capstone placement plan |
| 1.5 A smaller perch | Use Function to fit the end-to-peak gap, then Flow to assemble the baseline from fractional lifts; planning order can require interleaved blocks | Every complete capstone recipe |
| 2.1 Turn it over | Reflection changes signs and preserves zeros; Function explains that the middle-minus-end gap changes sign too | Bowl-to-roof composition |
| 2.2 From bowl to roof | Turn a provided bowl, then lift; Flow's gap arrow reverses with reflection, while a lift preserves its size | Squaring, building a bowl from a line |
| 2.3 Keep the peak | Reuse turn-and-lift and earlier scaling; Flow shows halving shrink the bracket and reflection reverse its direction | Squaring and later mechanics |
| 2.4 Turn a raised bowl | Show `N` carrying the nonzero middle below zero; compare the signed gap in Function and track the middle at x=2 in Flow as separate jobs | Every complete capstone recipe |
| 3.1 Fold the line | Opposite heights square to the same height; line becomes bowl | Fitting the bowl and arch decomposition |
| 3.2 Fit the bowl | Compare scale-before-square with scale-after-square; recall folding | The assembled line-to-arch connection |
| 3.3 Build an arch | Connect the fitted bowl from 3.2 to the turn-and-lift from 2.2 | Repeated squaring and flatter tops |
| 3.4 Move the fold | Give the complete `AQ` introduction: lift moves the line's zero from `x=2` to `x=1`, then squaring folds there; Function and Flow compare its lowest and highest required targets at 1 and 4 | The off-center capstone plan |
| 3.5 An off-center arch | Connect the shifted fold to the old fit-bowl and turn-and-lift arch decomposition; name center, depth and final height | Every complete capstone recipe |
| 4.1 Flatten the middle | Squaring preserves zero and one while lowering intermediate heights | Round-roof composition and summit planning |
| 4.2 Round the roof | Connect the flatter bowl to the familiar turn-and-lift | Final-summit planning prompt |
| 4.3 Hold the summit | Earlier shapes plus a prompt to separate shape, depth and final height | Its complete recipe and derivative material |
| 5.1 Read the slope | Downhill, flat and uphill mapped to negative, zero and positive heights; a bowl becomes a line | Fitting the derivative of a cubic, order comparisons involving a lift, and the final S-curve connection |
| 5.2 The slope machine | Fit a slope using familiar scaling and lifting; compare lifting before and after differentiation | The S-curve-to-arch decomposition |
| 5.3 Find the arch | Reveal the familiar bowl in the S curve's slope, then connect to earlier fitting and turn-and-lift ideas | Repeated flattening and the Slopes capstone |
| 5.4 Shape the change | Name the intermediate goals: fit the slope-built bowl to zero and one, then flatten its middle twice before deciding direction and height | Every complete capstone recipe |
| 6.1 Area so far | Positive accumulated area starts at zero; use the upright differential d | Cancellation, scaling and later Area compositions |
| 6.2 Back to zero | Signed positive and negative areas cancel; recall the anchored start | Scaling, placement and reconstruction from slope |
| 6.3 Fit the area | Scale the accumulated-area curve; compare scaling before and after integration | Lifting to set a new start and derivative/integral composition |
| 6.4 Place the new path | Lift after integration to choose a nonzero starting height; contrast lift-before-integrate | Recovering a curve from its slope and the final S-curve connection |
| 6.5 Recover the arc | Differentiate then integrate to reconstruct changes while losing the original offset; integrate then differentiate retains the original curve | The final S-curve-to-bowl composition |
| 6.6 From area to arch | Reveal a familiar bowl in the S curve's signed accumulated area, then connect to fitting, turning and placing | Bowl-to-S integration and the Area capstone |
| 6.7 Bring it together | Show that integrating the bowl builds an S curve; name zero-centering its flat middle before folding, then reusing a familiar finish | Every complete capstone recipe |

Examples run through the same kernel as the game. Integration means exactly `F(x) = ∫₀ˣ h(u) du`: signed accumulated area from zero, written with an upright differential d and no free constant. Reading notes cannot change the recipe, completion, history, view or Flow inspection. The reference is optional; introduction examples show a mechanic, later connections name useful intermediate shapes, and the final challenge still requires a plan.

Browser regression should visit all twenty-eight authored puzzles, check every available topic for future lesson references, replay 1.1 after a later completion, and check the full Create reference at a compact viewport. That verifies information boundaries and rendering; participant testing in [playtest.md](playtest.md) must establish whether the explanations build transferable understanding.
