import { CHAPTERS, chapterIndex, escape, LEVELS, puzzleLabel, type Result, type State } from './types';
import { icon } from './icons';
import { heightGapFormula, rationalTex, tex } from './views';

// Puzzle-specific planning prompts. The reference diagrams live in Notes;
// hints never evaluate or alter a recipe, and never supply a complete sequence.
const clues:Record<number,[string,string]> = {
  3:['Compare the height at the ends. Halving affects a lift only when the lift comes before it.','Two orders can produce the same height gap but different starting heights. Read both in Equation.'],
  24:['A lift can contribute a whole, a half, or a quarter, depending on what follows it.','Follow the height at the left end through Flow. Which later blocks shrink the lift you just added?'],
  25:['Fit the gap between the required heights, then work out how to place the curve.','Once the gap fits, think about each lift’s contribution. Halves shrink every lift before them, so the blocks may need to interleave.'],
  6:['The zeros already line up. Look at which side of zero the other targets occupy.','A sign change moves every nonzero height to the opposite side without moving the zeros.'],
  8:['The input is a bowl, while the targets make a roof. Separate its shape from its height.','First imagine turning the bowl over. Where would its middle be, and where does the target want it?'],
  9:['Compare the depth of the provided bowl with the gap from the peak to the ends.','Scale changes that gap; a lift does not. Fit the depth before deciding where the peak belongs.'],
  26:['This bowl starts above zero. Turning it over also turns that existing offset over.','Treat fitting the signed gap and placing the middle as two jobs. The fractional lifts from Height still work.'],
  7:['The targets put opposite sides of the line at the same positive height.','Which operation makes a negative height and its positive counterpart agree, while keeping zero fixed?'],
  10:['Halving before a square also changes what gets multiplied by itself.','Compare the two orders at the ends, not just at the zero. The order with the smaller bowl may help.'],
  4:['A roof contains a bowl turned over. This time you have to build the bowl.','Plan a useful intermediate shape before its final height. Reuse the line-to-bowl and bowl-to-roof ideas.'],
  27:['The square folds the input around zero. The location of that zero decides the new middle.','A lift of the line before squaring moves its zero; a lift after squaring only changes the bowl’s height.'],
  28:['Locate the required peak before fitting the depth and final height.','Move the line’s zero before making the bowl. Then reuse the familiar fitting, turning and placement jobs.'],
  12:['Compare heights between zero and one with the endpoints.','Squaring a number between zero and one makes it smaller while leaving zero and one fixed.'],
  13:['The new bowl has a flatter middle, but the old roof finish still applies.','Keep the fitted shape in mind while turning it and placing its middle.'],
  29:['The input is an S curve. Opposite heights still meet when squared.','Look between zero and one: squaring this cubic input makes a sixth-power bowl with a flatter middle.'],
  30:['The sixth-power bowl can use the same finishing idea as the earlier roof.','Separate the new shape from its final orientation and height.'],
  31:['Fit the provided bowl before squaring again. Heights above one would grow instead of flattening.','Keep its zero and one fitted, then compare what one square and another square do between them. Notes has that comparison.'],
  11:['Unlike the previous summit, this puzzle starts from a line. Build a bowl as an intermediate goal.','Fit that bowl and choose its power from the required heights. The largest available power is not automatically the right one.'],
  32:['Lifting a curve changes its height but not its slope.','Compare the two sides of the station: only a lift of its output changes the new heights.'],
  33:['A straight input has the same slope everywhere. The targets need a changing slope.','What familiar shape falls, becomes flat, then rises? Build that relationship before the station.'],
  34:['Find where the output should cross zero. The input needs to be flat at that position.','Move the input line’s zero before folding it. Follow the resulting turning point through the station.'],
  35:['The roof has a flat middle. Squaring can also flatten its zero-height ends.','Inspect all three places in Flow. A flat tangent need not change sign on its two sides.'],
  36:['Plan the input’s turning points from the output’s rises and falls.','Build the required changes before the station, then fit the output’s height afterward. A matching gap does not place every target.'],
  37:['Over the same distance, a taller input contributes more area.','Changing the input changes how the result grows. Lifting the output only changes where it starts.'],
  38:['The accumulated curve rises under positive input and falls under negative input.','Place the input’s zero crossing where the result should turn.'],
  39:['Read the target pattern as subtracting, adding, then subtracting area.','The input needs negative, positive, then negative regions. What familiar shape can provide those two sign changes?'],
  40:['Fitting how much the result changes is separate from choosing its starting height.','The integral itself starts at zero. Input changes affect the area; a lift after the station chooses a different baseline.'],
  41:['A slope remembers changes in height, but loses a constant offset.','Accumulating that slope rebuilds the change from zero. Compare the original starting height with the rebuilt one.'],
  42:['Plan the input’s signs and zeros before placing the final result.','Use the input side to shape the accumulated change. Use the output side for what remains to be fitted or placed.'],
  43:['The loop must reach both the upper and lower targets from one centre.','Changing the radius moves every point the same distance from the centre. Inspect both halves.'],
  48:['Build the nonnegative roof on the right of the squared-height relation.','Its zeros at $x=1$ and $x=3$ are the circle’s horizontal edges. Its height $1$ at $x=2$ is the squared radius; the relation supplies both signs.'],
  44:['A radius change cannot fix a centre that is in the wrong place.','Look for a middle shared by the targets, then compare their distances from it.'],
  45:['These opposite endpoints share the centre as their midpoint.','The diagonal radius has horizontal and vertical parts. Flow shows how their squared lengths combine.'],
  46:['Start with a pair of targets: their centre must be equally far from both.','One pair gives a perpendicular bisector, not a unique centre. A second pair narrows it to an intersection.'],
  47:['The final constellation needs the same equal-distance idea, applied to a new arrangement.','Inspect two different pairs in Flow. Find their shared centre before fitting the radius; the previous puzzle’s centre need not work.'],
  49:['Infer the circle’s centre and radius from the targets before shaping its squared height.','Translate the centre and radius into the roof’s zeros and maximum squared height, then use familiar transformations to build it.'],
  50:['Read each input unit as a quarter-turn around sine’s cycle.','Track the repeating heights $0,1,0,-1,0$ in Flow.'],
  51:['A lift before sine changes its phase; a lift afterward only changes its baseline.','Move the input by one quarter-turn and check which peaks become zeros.'],
  52:['Scaling sine’s input changes horizontal period, while scaling its output changes amplitude.','Halve before the sine station so one cycle takes twice as much horizontal room.'],
  53:['Keep the sine zeros fixed while bringing both lobes above zero.','A square after sine makes positive and negative peaks agree.'],
  54:['Fit the peak-to-trough range separately from the middle height.','Scale after sine for amplitude, then lift the output for its baseline.'],
  55:['Plan the repeating pattern’s phase and period before fitting its heights.','Move or scale the input before sine; fold, scale and place the output afterward.'],
  56:['Floor holds each input on the integer step below it.','At an exact whole input, the new higher step has the closed endpoint and the old lower step is open.'],
  57:['Ceiling sends every non-integer input to the step above it.','Compare a half-integer with an exact integer to see where the jump closes.'],
  58:['Reflection before rounding changes both direction and which side owns each threshold.','Use $\\lceil u\\rceil=-\\lfloor-u\\rfloor$ to predict the reversed staircase.'],
  59:['Decide whether the target changes step width or step height.','Halving before floor widens the steps; halving after floor shortens them.'],
  60:['Move the thresholds and set their spacing before rounding.','A full input shift can equal an output lift: $\\lfloor u+1\\rfloor=\\lfloor u\\rfloor+1$. Halving the shifted input first makes a half-step phase instead.'],
  61:['Feed the integer step levels into sine’s four-value cycle.','Track the repeating projection $0,1,0,-1$ in Flow.'],
  62:['Read each step as a constant signed rate over its width.','Positive steps raise the accumulated curve, zero steps hold it, and negative steps lower it.'],
  63:['Build the signed step area as an intermediate path before reshaping it.','Once the accumulated path has the right corners, decide how square, reflection and lift should change it.'],
  82:["Compare the straight line's rise from its first target to its last.",'Try each available relationship on that rise. Which one keeps the line planted at zero while setting its inclination?'],
  72:['The drawing interval is fixed. Which block changes height while keeping both zeros?','Compare the peak before and after a scale. The frame needs no adjustment.'],
  73:['Inspect the accumulated bowl before fitting the stroke.','Accumulation remains anchored at $x=0$. The fixed frame does not restart the area at its left edge.'],
  74:["Use the two zeros to read the loop's width, then compare the squared height at its middle.",'The required middle heights are $\\pm\\frac12$, so Equation compares their square with the right side.'],
  75:['Build a nonnegative roof from the line, with zeros at the leaf tips.','Square that roof on the right side so the solved positive and negative branches copy it and meet in pointed ends.'],
  83:['A familiar pointed leaf can become a petal. Keep its tips; change the shoulders.','Compare the roof with its square between zero and one. The garden repeats the one completed petal; repetition is not another target.'],
  76:['Compare the wave landmarks before changing a curve that almost fits.','If the ends and peak agree but the extra point misses, compare phase spacing and shoulder shape. A global lift would move the heights that already fit. Trace the input to sine in Flow; the drawing frame is fixed.'],
  78:['The roof reaches its maximum where the input to Square is zero.','Move that zero before the fixed Square, then turn and place the roof. Adding to the finished right side cannot shift its centre sideways.'],
  79:['Both input orders give a wider wave. Do they put its peak in the same place?','Trace the shifted input through Halve. A shift made first is halved too.'],
  81:['The sine is movable now, but its input still determines its period.','Use Flow to compare the distance between sine input values zero and two. Scaling after sine changes height instead of that spacing.'],
  77:["Separate the outline's length, thickness and flatness. The right-side roof's zeros name the two ends.",'Recall the flatter roofs from Flat tops, but keep the final right side as a roof rather than its square. Equation shows the square root that gives rounded caps and the scale that sets thickness.'],
  64:['The cubic hides a bowl in its slope. Shape that phase before sending it around sine’s circle.','Different phase heights wind around the circle at unequal intervals. Use the derivative to control that spacing, then fold and fit the output.'],
  65:['First isolate a positive step window with phase, rounding and sine.','What continuous shape does that finite pulse accumulate? Compare its midpoint and ends before choosing how to centre or fold it.'],
  66:['Compare the ends before and after squaring the provided roof.','With the original right side, solving takes a square root and rounds the ends. After squaring it, the two heights are copies of the roof and meet in points.'],
  67:['Find the zero outer regions and the positive inner window, then follow the accumulated total as its value goes from $0$ to $2$.','Its midpoint value is $1$ at the symmetry position $x=2$. Centre the values around $1$ and fold them; at the end, distinguish $h$ from $h^2$ so the relation supplies both sides.'],
  85:['The lobes reach the same height but take different horizontal distances. Which intermediate measurement controls that spacing?', 'Sine reads its incoming height as a phase. What should the accumulated value control next: the final height, or the advance around the circle? Compare the zero region and the two lobe widths in Flow.'],
  69:['The right side is squared height. Compare the visible height after each halve.','Quartering a squared value halves its square root. Track both heights in Equation.'],
  71:['A loop and its outer echoes can come from the same signed roof. Locate its middle and zero before choosing its scale.','The height beyond the zero belongs to a region where that roof has changed sign. Which operation makes both signs of its magnitude visible?'],
  14:['Where the bowl is flat, the slope is zero.','Compare downhill, flat and uphill positions in Flow before fitting the output.'],
  5:['The cubic’s slopes form a familiar bowl.','Inspect the slope first, then decide how that bowl needs to be scaled.'],
  15:['Look for the familiar shape in the S curve’s slope.','Once you have that bowl, reuse the turning and placement ideas.'],
  22:['Inspect what the first slope reveals before choosing the rest of the construction.','Break the target shape into a familiar bowl, its flattening and its final placement.'],
  16:['More distance under a positive input means more accumulated area.','The result starts at zero. Compare how the area grows as the position increases.'],
  17:['The accumulated shape is useful, but its scale may need changing.','Compare the result’s height gap before choosing where to place it.'],
  18:['Find the familiar shape built by accumulating this input.','Treat forming that shape and its final fit, turn and placement as separate jobs.'],
  19:['Area below zero subtracts from what area above zero has added.','Look for a balance of positive and negative area over the inspected interval.'],
  20:['The accumulated result starts at zero even if its final baseline needs to be higher.','Distinguish changing the input’s area from lifting the result after accumulation.'],
  21:['Slopes preserve changes in height, but discard a constant starting height.','Accumulating rebuilds the change from zero; compare what remains missing.'],
  23:['Accumulating a bowl can build an S curve. Think about what folding that new curve would do.','Place the useful intermediate shape before folding, then fit its final orientation and height.']
};

export function puzzleHints(state:State,result:Result) {
  const id=state.sourceId,chapter=chapterIndex(id),level=LEVELS[id-1];
  const [first,more]=clues[id]??[level.hint,'Compare the current construction with the required targets, one relationship at a time.'];
  const view=[74,75,77,82,83].includes(id)?'function':id>=43||chapter>=4||[24,14,5,15,22,16,17,18,19,20,21,23].includes(id)?'flow':'function';
  const label=view==='function'?'Equation':'Flow',guide=result.heightGuide;
  const gap=guide&&[25,26,28,11].includes(id)?`<div class="hint-reading">${tex(`${heightGapFormula(guide)}=${rationalTex(guide.target)}`)}<span>Required height gap</span></div>`:'';
  const triangle='<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M5 3L11 8L5 13Z" fill="currentColor"/></svg>';
  return `<p class="hint-level">${escape(puzzleLabel(id))} · ${escape(level.name)}</p><p class="hint-clue">${hintText(first)}</p>${gap}<div class="hint-actions"><button class="note-view-button" data-view="${view}">${icon(view,16)}${label}</button><button class="note-view-button" id="hint-notes">${icon('book',16)}${escape(chapter>=0?CHAPTERS[chapter].name:'Calculus')} notes</button></div><div class="hint-more"><button class="hint-more-button" id="hint-more-toggle" aria-expanded="false" aria-controls="hint-extra">${triangle}Another hint</button><div id="hint-extra" hidden><p>${hintText(more)}</p><button class="hint-more-button" id="hint-sketch-toggle" aria-expanded="false" aria-controls="hint-sketch">${triangle}Show a sketch</button><div id="hint-sketch" hidden></div></div></div>`;
}

function hintText(value:string) {
  return value.split('$').map((part,index)=>index%2?tex(part):escape(part)).join('');
}
