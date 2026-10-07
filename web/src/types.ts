export type View = 'flight' | 'function' | 'flow';
import extensions from '../../content/extended-puzzles.json';
import learningPath from '../../content/learning-path.json';
export type Op = 'H' | 'A' | 'N' | 'Q' | 'D' | 'I' | 'S' | 'F' | 'C';
export interface Part { id: string; op: Op }
export interface Station { id: string; op: Op; before: number; after: number }
export interface Goal { x: string; y: string }
export interface Circle { x:string; y:string; radius:string }
export interface Crop { from:string; to:string }
export interface State {
  schema: 1; rules: 'vine-1'; engine: 'AngouriMath-2.5.0'; sourceId: number;
  mode: 'puzzle' | 'remix' | 'challenge'; nodes: Part[]; goals: Goal[];
  inventory: Partial<Record<Op, number>>; limit: number;
  station?: Station;
  circle?: Circle;
  crop?: Crop;
}
export type Point = [number,number];
export interface CurvePath { points:Point[]; startClosed:boolean; endClosed:boolean; approximateEnds?:boolean }
export interface Stage { id: string; expression: string; latex: string; values: string[]; valueLatex?:string[]; points: Point[]; paths?:CurvePath[]; projection?:Point[] }
export interface Checkpoint { x: string; target: string; targetNumber?:number; targetLatex?:string; actual: string; actualLatex?:string; actualNumber?:number; defined?:boolean; hit: boolean; y: number; phase?:number; lhs?:string; rhs?:string; dx?:string; dy?:string; dxSquared?:string; dySquared?:string }
export interface CircleResult { equationLatex:string; radiusSquared:string; centre:[number,number]; radius:number; editable:(keyof Circle)[]; bounds:{minX:number;maxX:number;minY:number;maxY:number}; tangent:[number,number]; initial:Circle }
export interface HeightGuide { fromX:string; toX:string; target:string; targetNumber?:number; targetLatex?:string; actual:string; actualLatex?:string; hit:boolean; stages:{from:string;to:string;gap:string;fromLatex?:string;toLatex?:string;gapLatex?:string;fromNumber?:number;toNumber?:number;gapNumber?:number}[] }
export interface RelationResult { kind:'height-squared'; equationLatex:string; solvedLatex?:string; solvedLines?:{heightLatex:string;conditionLatex:string}[]; paths:CurvePath[]; playback:Point[]; breaks:number[]; flights?:[number,number][] }
export interface Result { constructedLatex: string; equationLatex?:string; stages: Stage[]; checkpoints: Checkpoint[]; points: Point[]; paths?:CurvePath[]; startSlope: number; solved: boolean; heightGuide?:HeightGuide; circle?:CircleResult; relation?:RelationResult; crop?:Crop & {fromNumber:number;toNumber:number;editable:boolean;required?:Crop;hit:boolean}; picture?:{paths:CurvePath[]} }
export interface Artifact { schema: number; rules: string; engine: string; type: string; sourceId: number; view: View; nodes?: Part[]; goals?: Goal[]; inventory?: Partial<Record<Op,number>>; limit?: number; circle?:Circle; crop?:Crop }
export interface Response { status: 'ok' | 'invalid' | 'error'; state?: State; result?: Result; message?: string; artifact?: Artifact }
export type Action = { type: string; [key: string]: unknown };
export const OPS: Record<Op, { name: string; formula: string; description: string; color: string }> = {
  H: { name: 'Halve', formula: '\\frac{\\square}{2}', description: 'Divide the input by two.', color: 'sage' },
  A: { name: 'Add one', formula: '\\square + 1', description: 'Add one to the input.', color: 'peach' },
  N: { name: 'Negate', formula: '-\\square', description: 'Reverse the input’s sign.', color: 'blue' },
  Q: { name: 'Square', formula: '\\square^{2}', description: 'Multiply the input by itself.', color: 'lilac' },
  D: { name: 'Find slope', formula: '\\frac{\\mathrm{d}\\square}{\\mathrm{d}x}', description: 'Take the input’s slope at each position.', color: 'sea' },
  I: { name: 'Accumulate', formula: '\\int_0^x\\!\\square', description: 'Accumulate signed area from zero to this position. The result starts at zero.', color: 'teal' },
  S: { name: 'Sine', formula: '\\sin\\!\\left(\\frac{\\pi\\square}{2}\\right)', description: 'Turn each input unit a quarter of a circle. Read its height.', color: 'rose' },
  F: { name: 'Floor', formula: '\\lfloor\\square\\rfloor', description: 'Round down to the next whole number. Exact whole numbers stay put.', color: 'slate' },
  C: { name: 'Ceiling', formula: '\\lceil\\square\\rceil', description: 'Round up to the next whole number. Exact whole numbers stay put.', color: 'sky' }
};
export const LEVELS = [
  { name: 'Lower the arc', hint: 'Which move keeps the ends at zero?', y: [-0.8,5.2] },
  { name: 'Lift the path', hint: 'The ends need to rise with the middle.', y: [-1,5] },
  { name: 'Order matters', hint: 'Which order leaves the ends halfway up?', y: [-1,6] },
  { name: 'Build an arch', hint: 'What could turn this line into a useful bowl?', y: [-3,5] },
  { name: 'The slope machine', hint: 'Use the old curve’s slope as the new height.', y: [-1.5,10] },
  { name: 'Turn it over', hint: 'Keep the zeros. Change which side is above them.', y: [-3,3] },
  { name: 'Fold the line', hint: 'Opposite heights can meet at the same height.', y: [-3,5] },
  { name: 'From bowl to roof', hint: 'Turn the bowl over. Where should its middle finish?', y: [-2,3] },
  { name: 'Keep the peak', hint: 'Set the bowl’s depth. Then place its peak.', y: [-3,5] },
  { name: 'Fit the bowl', hint: 'Halve then square, or square then halve?', y: [-3,5] },
  { name: 'Hold the summit', hint: 'Which smaller shapes could build this summit?', y: [-3,3] },
  { name: 'Flatten the middle', hint: 'Keep zero and one. What happens between them?', y: [-0.5,1.5] },
  { name: 'Round the roof', hint: 'Flatten the bowl, then use a familiar pair of moves.', y: [-0.5,1.5] },
  { name: 'Read the slope', hint: 'Where the bowl is flat, its slope is zero.', y: [-1.5,2] },
  { name: 'Find the arch', hint: 'What familiar shape is hidden in this curve’s slope?', y: [-1.5,5] },
  { name: 'Area so far', hint: 'More distance under a positive height means more area.', y: [-1,5] },
  { name: 'Fit the area', hint: 'The shape is right. How tall should it be?', y: [-2.5,3] },
  { name: 'From area to arch', hint: 'What shape does this curve’s area build? Then fit, turn and place it.', y: [-5,5] },
  { name: 'Back to zero', hint: 'Area below zero takes away what area above zero added.', y: [-2.5,3] },
  { name: 'Place the new path', hint: 'Area starts at zero. Where should the new path begin?', y: [-1,6] },
  { name: 'Recover the arc', hint: 'Slopes remember changes in height. Area builds them back from zero.', y: [-1,4] },
  { name: 'Shape the change', hint: 'Find a familiar shape in the slope. What would flatten its middle further?', y: [-1.5,5] },
  { name: 'Bring it together', hint: 'What does this bowl build with area? Where should its middle be before folding?', y: [-0.5,2] },
  { name: 'Lifts in pieces', hint: 'A lift can become a half or a quarter. Where does each halve go?', y: [-0.5,4.5] },
  { name: 'A smaller perch', hint: 'Fit the gap from the ends to the peak. Then decide where the lifts belong.', y: [-0.5,4.5] },
  { name: 'Turn a raised bowl', hint: 'The bowl’s middle is already above zero. Account for it when placing the roof.', y: [-1,5.5] },
  { name: 'Move the fold', hint: 'Squaring folds around zero. Which move changes where that zero is?', y: [-2.5,10] },
  { name: 'An off-center arch', hint: 'Choose where the fold belongs. Then fit, turn and place the arch.', y: [-2.5,2.5] },
  { name: 'A sixth-power bowl', hint: 'Fold this S curve. Which heights stay at zero or one?', y: [-1.4,1.4] },
  { name: 'A broader roof', hint: 'The new bowl still knows the old turn-and-lift trick.', y: [-1.4,1.5] },
  { name: 'Hold a wider summit', hint: 'Fit the bowl before flattening again. Keep its zero and one in place.', y: [-1,4.5] },
  { name: 'Before or after?', hint: 'Does lifting a curve change its slope? Try the two sides of the station.', y: [-1.5,2.5] },
  { name: 'Make a turning point', hint: 'The station reads slopes. What input would give a changing slope?', y: [-5,5] },
  { name: 'Move the turning point', hint: 'Move the input’s zero before folding. Where will its slope change sign?', y: [-3,7] },
  { name: 'Three flat places', hint: 'Square the arch. Where does its new curve become flat?', y: [-1.5,1.5] },
  { name: 'Shape the slope', hint: 'Build the input’s turning points, then set the output’s height.', y: [-1,4.5] },
  { name: 'Feed the accumulator', hint: 'A taller input adds more area over the same distance.', y: [-1,9] },
  { name: 'Move the high point', hint: 'The accumulated curve turns where its input crosses zero.', y: [-2.5,5.5] },
  { name: 'Subtract, add, subtract', hint: 'Make the input change sign twice. Follow what adds and what takes away.', y: [-2.5,4.5] },
  { name: 'Set the starting amount', hint: 'Fit how much changes, then choose where the result starts.', y: [-2.5,3] },
  { name: 'Recover the change', hint: 'A slope remembers change. Which part of the original height is lost?', y: [-1,4] },
  { name: 'A machine of your own', hint: 'Plan the input’s signs and zeros. Then place the accumulated result.', y: [-1,4.5] },
  { name: 'A path comes back', hint: 'Move the slingshot. One loop reaches above and below.', y: [-2,2] },
  { name: 'Find the middle', hint: 'Move the centre. Every target wants the same distance from it.', y: [-2,3] },
  { name: 'From end to end', hint: 'Opposite ends of a diameter share a midpoint. The radius is half that distance.', y: [-2,3] },
  { name: 'Between three points', hint: 'Compare a pair in Flow. Which line could their centre lie on?', y: [-2,3] },
  { name: 'One last loop', hint: 'Find a centre with equal distances. Then fit the radius.', y: [-4,4] }
  ,...extensions.map(level=>({name:level.name,hint:level.hint,y:[-2,4]}))
];
// Stable source ids keep creations and links independent of the teaching order.
export const CHAPTERS = [
  { name:'Height', idea:'Lift and scale', color:'sage', zero:29, before:'M3 29Q18-13 33 29', after:'M3 29Q18 9 33 29', levels:learningPath.chapters[0] },
  { name:'Reflection', idea:'Turn, then place', color:'blue', zero:18, before:'M3 18Q18 46 33 18', after:'M3 18Q18-10 33 18', levels:learningPath.chapters[1] },
  { name:'Bowls and arches', idea:'Build in parts', color:'lilac', zero:23, before:'M3 33L33 13', after:'M3 3Q18 43 33 3', levels:learningPath.chapters[2] },
  { name:'Flat tops', idea:'Familiar moves, new silhouettes', color:'peach', zero:30, before:'M3 4Q18 56 33 4', after:'M3 4C7 29 11 30 18 30C25 30 29 29 33 4', levels:learningPath.chapters[3] },
  { name:'Slopes', idea:'Shape what changes', color:'sea', zero:23, before:'M3 3Q18 43 33 3', after:'M3 32L33 14', levels:learningPath.chapters[4] },
  { name:'Accumulation', idea:'Shape what builds up', color:'teal', zero:29, before:'M3 18H33', after:'M3 29L33 7', levels:learningPath.chapters[5] },
  { name:'Loops', idea:'One equation. Both sides.', color:'lilac', zero:18, before:'M4 18Q18-10 32 18', after:'M32 18A14 14 0 1 1 4 18A14 14 0 1 1 32 18', levels:learningPath.chapters[6] },
  { name:'Waves', idea:'A circle unfolds', color:'rose', zero:18, before:'M3 32L33 4', after:'M3 18C8-1 13-1 18 18S28 37 33 18', levels:learningPath.chapters[7] },
  { name:'Steps', idea:'Shape the jumps and what builds up', color:'slate', zero:30, before:'M3 30L33 3', after:'M3 30H13M13 20H23M23 10H33', levels:learningPath.chapters[8] },
  { name:'The moonlit garden', idea:'Make a picture. Master the connections.', color:'teal', zero:18, before:'M3 18H10V4H26V18H33', after:'M3 18H8Q18-8 28 18Q18 44 8 18M28 18H33', levels:learningPath.chapters[9] }
];
export const PUZZLE_ORDER = CHAPTERS.flatMap(chapter=>chapter.levels);
// Earlier authored puzzles retain their IDs and rules in a small optional collection.
export const EXTRA_PUZZLES = [14,5,15,22,16,19,17,20,21,18,23];
export const GEOMETRY_PUZZLES = [45,46,47];
export const OPTIONAL_PUZZLES = [...EXTRA_PUZZLES,...GEOMETRY_PUZZLES];
export const chapterIndex=(sourceId:number)=>CHAPTERS.findIndex(chapter=>chapter.levels.includes(sourceId));
export const isCapstone=(sourceId:number)=>CHAPTERS.some(chapter=>chapter.levels.at(-1)===sourceId);
export const isMastery=(sourceId:number)=>[64,65,67].includes(sourceId);
export const isPicture=(sourceId:number)=>sourceId>=72&&sourceId<=77||sourceId===82||sourceId===83;
export const puzzleLabel=(sourceId:number)=>{const chapter=chapterIndex(sourceId);return chapter<0?'Bonus':`${chapter+1}.${CHAPTERS[chapter].levels.indexOf(sourceId)+1}`;};
export const CURVES = [
  { id:1, name:'Arch', latex:'x(4-x)', path:'M3 29Q18-16 33 29' },
  { id:2, name:'Low arch', latex:'\\frac{x(4-x)}{2}', path:'M3 29Q18 6 33 29' },
  { id:4, name:'Line', latex:'x-2', path:'M3 32L33 4' },
  { id:6, name:'Inverted arch', latex:'-\\frac{x(4-x)}{2}', path:'M3 8Q18 43 33 8' },
  { id:8, name:'Shallow bowl', latex:'\\frac{(x-2)^2}{4}', path:'M3 13Q18 45 33 13' },
  { id:9, name:'Bowl', latex:'(x-2)^2', path:'M3 3Q18 55 33 3' },
  { id:5, name:'Cubic', latex:'x^3', path:'M3 31C23 31 29 27 33 3' },
  { id:15, name:'S curve', latex:'\\frac{(x-2)^3}{3}+2', path:'M3 31C13 7 23 29 33 5' },
  { id:16, name:'Flat height', latex:'1', path:'M3 18H33' },
  { id:17, name:'Falling line', latex:'2-x', path:'M3 4L33 32' },
  { id:18, name:'Centered S', latex:'\\frac{(x-2)^3}{2}', path:'M3 32C13 5 23 31 33 4' },
  { id:21, name:'Raised arch', latex:'1+\\frac{x(4-x)}{2}', path:'M3 25Q18-4 33 25' },
  { id:23, name:'Wide bowl', latex:'\\frac{3(x-2)^2}{8}', path:'M3 8Q18 48 33 8' },
  { id:26, name:'Raised bowl', latex:'(x-2)^2+1', path:'M3 3Q18 43 33 3' },
  { id:29, name:'Small S', latex:'\\left(\\frac{x-2}{2}\\right)^3', path:'M3 32C13 5 23 31 33 4' },
  { id:35, name:'Unit roof', latex:'1-\\frac{(x-2)^2}{4}', path:'M3 29Q18-13 33 29' },
  { id:42, name:'Steep bowl', latex:'3(x-2)^2', path:'M3 3Q18 57 33 3' },
  { id:43, name:'Circle', latex:'(h-b)^2=r^2-(x-a)^2', path:'M31 18A13 13 0 1 1 5 18A13 13 0 1 1 31 18' },
  { id:50, name:'Position', latex:'h=x', path:'M3 31L33 3' },
  { id:48, name:'Paired heights', latex:'h^2=x-2', path:'M18 18Q20 5 33 3M18 18Q20 31 33 33' },
  { id:49, name:'Paired steep line', latex:'h^2=2x-4', path:'M18 18Q20 3 30 1M18 18Q20 33 30 35' },
  { id:66, name:'A roof, both sides', latex:'h^2=\\frac{x(4-x)}4', path:'M3 18Q18-8 33 18Q18 44 3 18' },
  { id:67, name:'Paired bowl', latex:'h^2=\\frac{x^2}{2}', path:'M3 18L33 3M3 18L33 33' }
];
export const isCircleSource=(id:number)=>id>=43&&id<=47;
export const isRelationSource=(id:number)=>extensions.some(level=>level.id===id&&level.relation==='height-squared');
export const curveId=(sourceId:number)=>isCircleSource(sourceId)?43:[3,24,25].includes(sourceId)?1:[7,10,11,27,28,33,34,58].includes(sourceId)?4:[12,13,14,32].includes(sourceId)?8:[31,36,39].includes(sourceId)?9:[19,38,40].includes(sourceId)?17:[20,37].includes(sourceId)?16:sourceId===22?15:sourceId===30?29:sourceId===41?21:sourceId===64?5:sourceId>=50&&sourceId<=65?50:sourceId;
export const fraction = (s: string) => { const [n,d] = s.split('/').map(Number); return n / (d ?? 1); };
/** Display decimal exponents as mathematical powers, never programming e notation. */
export const decimalTex = (value:string|number) => {
  const [mantissa,exponent]=String(value).split(/[eE]/);
  return exponent===undefined?mantissa:`${mantissa}\\times 10^{${Number(exponent)}}`;
};
export const escape = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Numeric target placement comes from the kernel for algebraic heights. */
export const targetHeight = (checkpoint:Checkpoint) => checkpoint.targetNumber ?? fraction(checkpoint.target);
