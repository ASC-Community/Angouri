import { CHAPTERS, chapterIndex, escape, LEVELS, puzzleLabel, type Result, type State } from './types';
import { icon } from './icons';
import { heightGapFormula, rationalTex, tex } from './views';

// Puzzle-specific planning prompts. The reference diagrams live in Notes;
// hints never evaluate or alter a recipe, and never supply a complete sequence.
const clues:Record<number,[string,string]> = {
  25:['Fit the gap between the required heights, then work out how to place the curve.','Once the gap fits, think about each lift’s contribution. Halves shrink every lift before them, so the blocks may need to interleave.'],
  26:['This bowl starts above zero. Turning it over also turns that existing offset over.','Treat fitting the signed gap and placing the middle as two jobs. The fractional lifts from Height still work.'],
  4:['A roof contains a bowl turned over. This time you have to build the bowl.','Plan a useful intermediate shape before its final height. Reuse the line-to-bowl and bowl-to-roof ideas.'],
  28:['Locate the required peak before fitting the depth and final height.','Move the line’s zero before making the bowl. Then reuse the familiar fitting, turning and placement jobs.'],
  31:['Fit the provided bowl before squaring again. Heights above one would grow instead of flattening.','Keep its zero and one fitted, then compare what one square and another square do between them. Notes has that comparison.'],
  11:['Unlike the previous summit, this puzzle starts from a line. Build a bowl as an intermediate goal.','Fit that bowl and choose its power from the required heights. The largest available power is not automatically the right one.'],
  36:['Read the curve immediately after Find slope. Flat places in its input give zeros there.','Build the required changes before the station, then fit the output’s height afterward. A matching gap does not place every target.'],
  42:['Plan the input’s signs and zeros before placing the final result.','Use the input side to shape the accumulated change. Use the output side for what remains to be fitted or placed.'],
  45:['These opposite endpoints share the centre as their midpoint.','The diagonal radius has horizontal and vertical parts. Flow shows how their squared lengths combine.'],
  46:['Start with a pair of targets: their centre must be equally far from both.','One pair gives a perpendicular bisector, not a unique centre. A second pair narrows it to an intersection.'],
  47:['The final constellation needs the same equal-distance idea, applied to a new arrangement.','Inspect two different pairs in Flow. Find their shared centre before fitting the radius; the previous puzzle’s centre need not work.'],
  49:['Infer the circle’s centre and radius from the targets before shaping its squared height.','Translate the centre and radius into the roof’s zeros and maximum squared height, then use familiar transformations to build it.'],
  55:['Plan the repeating pattern’s phase and period before fitting its heights.','Move or scale the input before sine; fold, scale and place the output afterward.'],
  63:['Build the signed step area as an intermediate path before reshaping it.','Once the accumulated path has the right corners, decide how square, reflection and lift should change it.'],
  73:['Inspect the accumulated bowl before fitting the stroke.','Accumulation remains anchored at $x=0$. The fixed frame does not restart the area at its left edge.'],
  74:["Use the two zeros to read the loop's width, then compare the squared height at its middle.",'The required middle heights are $\\pm\\frac12$, so Equation compares their square with the right side.'],
  75:['Build a nonnegative roof from the line, with zeros at the leaf tips.','Square that roof on the right side so the solved positive and negative branches copy it and meet in pointed ends.'],
  76:['Compare the wave landmarks before changing a curve that almost fits.','If the ends and peak agree but the extra point misses, compare phase spacing and shoulder shape. A global lift would move the heights that already fit. Trace the input to sine in Flow; the drawing frame is fixed.'],
  77:["Separate the outline's length, thickness and flatness. The right-side roof's zeros name the two ends.",'Recall the flatter roofs from Flat tops, but keep the final right side as a roof rather than its square. Equation shows the square root that gives rounded caps and the scale that sets thickness.'],
  64:['The cubic hides a bowl in its slope. Shape that phase before sending it around sine’s circle.','Different phase heights wind around the circle at unequal intervals. Use the derivative to control that spacing, then fold and fit the output.'],
  65:['First isolate a positive step window with phase, rounding and sine.','What continuous shape does that finite pulse accumulate? Compare its midpoint and ends before choosing how to centre or fold it.'],
  67:['Find the zero outer regions and the positive inner window, then follow the accumulated total as its value goes from $0$ to $2$.','Its midpoint value is $1$ at the symmetry position $x=2$. Centre the values around $1$ and fold them; at the end, distinguish $h$ from $h^2$ so the relation supplies both sides.'],
  85:['The lobes reach the same height but take different horizontal distances. Which intermediate measurement controls that spacing?', 'Sine reads its incoming height as a phase. What should the accumulated value control next: the final height, or the advance around the circle? Compare the zero region and the two lobe widths in Flow.'],
  71:['A loop and its outer echoes can come from the same signed roof. Locate its middle and zero before choosing its scale.','The height beyond the zero belongs to a region where that roof has changed sign. Which operation makes both signs of its magnitude visible?'],
  15:['Look for the familiar shape in the S curve’s slope.','Once you have that bowl, reuse the turning and placement ideas.'],
  22:['Inspect what the first slope reveals before choosing the rest of the construction.','Break the target shape into a familiar bowl, its flattening and its final placement.'],
  18:['Find the familiar shape built by accumulating this input.','Treat forming that shape and its final fit, turn and placement as separate jobs.'],
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
