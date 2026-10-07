#!/usr/bin/env python3
"""Author and independently check content/extended-puzzles.json.

This deliberately implements only the exact expression subset used by the
authored witnesses. It uses Fraction arithmetic, a+b*sqrt(2) values for the
wave checkpoints (including square roots of 3 and 6), and exact interval integration for piecewise-constant step
functions. It does not call the game kernel or AngouriMath.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from fractions import Fraction
from itertools import permutations
import json
import sys
from math import factorial
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "content" / "extended-puzzles.json"


def q(text: str | int) -> Fraction:
    return Fraction(text)


def qt(value: Fraction) -> str:
    return str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"


@dataclass(frozen=True)
class Exact:
    """a + b sqrt(2) + c sqrt(3) + d sqrt(6)."""

    a: Fraction = Fraction(0)
    b: Fraction = Fraction(0)
    c: Fraction = Fraction(0)
    d: Fraction = Fraction(0)

    @staticmethod
    def rational(value: Fraction | int) -> "Exact":
        return Exact(Fraction(value))

    def __add__(self, other: "Exact") -> "Exact":
        return Exact(self.a + other.a, self.b + other.b, self.c + other.c, self.d + other.d)

    def __neg__(self) -> "Exact":
        return Exact(-self.a, -self.b, -self.c, -self.d)

    def __sub__(self, other: "Exact") -> "Exact":
        return self + -other

    def __mul__(self, other: "Exact") -> "Exact":
        return Exact(
            self.a*other.a + 2*self.b*other.b + 3*self.c*other.c + 6*self.d*other.d,
            self.a*other.b + self.b*other.a + 3*(self.c*other.d + self.d*other.c),
            self.a*other.c + self.c*other.a + 2*(self.b*other.d + self.d*other.b),
            self.a*other.d + self.d*other.a + self.b*other.c + self.c*other.b)

    def scale(self, value: Fraction) -> "Exact":
        return Exact(self.a * value, self.b * value, self.c * value, self.d * value)

    def square(self) -> "Exact":
        return self * self

    def as_rational(self) -> Fraction:
        if self.b or self.c or self.d:
            raise ValueError(f"non-rational exact value {self}")
        return self.a

    def __str__(self) -> str:
        if not self.b:
            return qt(self.a)
        return f"{qt(self.a)} + {qt(self.b)}*sqrt(2) + {qt(self.c)}*sqrt(3) + {qt(self.d)}*sqrt(6)"


Expr = tuple
X: Expr = ("x",)


def const(value: Fraction | int) -> Expr:
    return ("const", Fraction(value))


def add(left: Expr, right: Expr) -> Expr:
    return ("add", left, right)


def scale(value: Fraction, child: Expr) -> Expr:
    return ("scale", value, child)


def mul(left: Expr, right: Expr) -> Expr:
    return ("mul", left, right)


def source_expr(text: str) -> Expr:
    if text == "x":
        return X
    if text == "x-2":
        return add(X, const(-2))
    if text == "2*x-4":
        return add(scale(q(2), X), const(-4))
    if text == "3-(x-2)^2":
        centered = add(X, const(-2))
        return add(const(3), scale(q(-1), mul(centered, centered)))
    if text == "4-(x-2)^2":
        centered = add(X, const(-2))
        return add(const(4), scale(q(-1), mul(centered, centered)))
    if text == "1-(x-2)^2/4":
        centered = add(X, const(-2))
        return add(const(1), scale(q("-1/4"), mul(centered, centered)))
    if text == "(x-2)^2-1":
        centered = add(X, const(-2))
        return add(mul(centered, centered), const(-1))
    if text == "x*(4-x)/4":
        return scale(q("1/4"), mul(X, add(const(4), scale(q(-1), X))))
    if text == "x^2/2":
        return scale(q("1/2"), mul(X, X))
    if text == "x^3":
        return mul(mul(X, X), X)
    raise ValueError(f"unknown source {text}")


def derivative(expr: Expr) -> Expr:
    kind = expr[0]
    if kind == "const":
        return const(0)
    if kind == "x":
        return const(1)
    if kind == "add":
        return add(derivative(expr[1]), derivative(expr[2]))
    if kind == "scale":
        return scale(expr[1], derivative(expr[2]))
    if kind == "mul":
        return add(mul(derivative(expr[1]), expr[2]), mul(expr[1], derivative(expr[2])))
    if kind == "square":
        return scale(q(2), mul(expr[1], derivative(expr[1])))
    if kind == "integral":
        return expr[1]
    raise ValueError(f"oracle intentionally does not differentiate {kind}")


def affine(expr: Expr) -> tuple[Fraction, Fraction] | None:
    kind = expr[0]
    if kind == "x":
        return q(1), q(0)
    if kind == "const":
        return q(0), expr[1]
    if kind == "scale":
        child = affine(expr[2])
        return None if child is None else (expr[1] * child[0], expr[1] * child[1])
    if kind == "add":
        left, right = affine(expr[1]), affine(expr[2])
        return None if left is None or right is None else (left[0] + right[0], left[1] + right[1])
    if kind == "mul":
        left, right = affine(expr[1]), affine(expr[2])
        if left is None or right is None:
            return None
        if left[0] == 0:
            return right[0] * left[1], right[1] * left[1]
        if right[0] == 0:
            return left[0] * right[1], left[1] * right[1]
        return None
    return None


def floor_fraction(value: Fraction) -> int:
    return value.numerator // value.denominator


def ceil_fraction(value: Fraction) -> int:
    return -floor_fraction(-value)


def sine_half_pi(value: Fraction) -> Exact:
    # sin(pi * value / 2), for multiples of pi/12. This covers all authored
    # integer, half-unit and third-unit checkpoints without floating point.
    twelfths = value * 6
    if twelfths.denominator != 1:
        raise ValueError(f"sine oracle supports pi/12 landmark inputs, got {value}")
    half = q("1/2")
    quarter = q("1/4")
    table = [
        Exact.rational(0), Exact(0,-quarter,0,quarter), Exact.rational(half), Exact(0,half),
        Exact(0,0,half), Exact(0,quarter,0,quarter), Exact.rational(1),
        Exact(0,quarter,0,quarter), Exact(0,0,half), Exact(0,half), Exact.rational(half),
        Exact(0,-quarter,0,quarter), Exact.rational(0), Exact(0,quarter,0,-quarter),
        Exact.rational(-half), Exact(0,-half), Exact(0,0,-half), Exact(0,-quarter,0,-quarter),
        Exact.rational(-1), Exact(0,-quarter,0,-quarter), Exact(0,0,-half), Exact(0,-half),
        Exact.rational(-half), Exact(0,quarter,0,-quarter)]
    return table[twelfths.numerator % 24]


def discontinuities(expr: Expr, low: Fraction, high: Fraction) -> set[Fraction]:
    kind = expr[0]
    found: set[Fraction] = set()
    if kind in {"floor", "ceil"}:
        line = affine(expr[1])
        if line is None or line[0] == 0:
            raise ValueError("rounding oracle requires a nonconstant rational affine operand")
        a, b = line
        values = [a * low + b, a * high + b]
        first = floor_fraction(min(values)) - 1
        last = ceil_fraction(max(values)) + 1
        for integer in range(first, last + 1):
            point = (q(integer) - b) / a
            if low < point < high:
                found.add(point)
    for child in expr[1:]:
        if isinstance(child, tuple):
            found.update(discontinuities(child, low, high))
    return found


def eval_integral(integrand: Expr, point: Fraction) -> Exact:
    if point < 0:
        return -eval_integral(integrand, -point)  # No authored negative-domain integral uses this path.
    cuts = [q(0), *sorted(discontinuities(integrand, q(0), point)), point]
    total = Exact.rational(0)
    for left, right in zip(cuts, cuts[1:]):
        if left == right:
            continue
        one_third = left + (right - left) / 3
        two_thirds = left + 2 * (right - left) / 3
        value = evaluate(integrand, one_third)
        if value != evaluate(integrand, two_thirds):
            raise ValueError("integration oracle only accepts piecewise-constant input")
        total += value.scale(right - left)
    return total


def evaluate(expr: Expr, point: Fraction) -> Exact:
    kind = expr[0]
    if kind == "const":
        return Exact.rational(expr[1])
    if kind == "x":
        return Exact.rational(point)
    if kind == "add":
        return evaluate(expr[1], point) + evaluate(expr[2], point)
    if kind == "scale":
        return evaluate(expr[2], point).scale(expr[1])
    if kind == "mul":
        return evaluate(expr[1], point) * evaluate(expr[2], point)
    if kind == "neg":
        return -evaluate(expr[1], point)
    if kind == "square":
        return evaluate(expr[1], point).square()
    if kind == "sin":
        return sine_half_pi(evaluate(expr[1], point).as_rational())
    if kind == "floor":
        return Exact.rational(floor_fraction(evaluate(expr[1], point).as_rational()))
    if kind == "ceil":
        return Exact.rational(ceil_fraction(evaluate(expr[1], point).as_rational()))
    if kind == "integral":
        return eval_integral(expr[1], point)
    raise ValueError(f"unknown expression node {kind}")


def apply(expr: Expr, op: str) -> Expr:
    return {
        "H": lambda: scale(q("1/2"), expr),
        "A": lambda: add(expr, const(1)),
        "N": lambda: ("neg", expr),
        "Q": lambda: ("square", expr),
        "D": lambda: derivative(expr),
        "I": lambda: ("integral", expr),
        "S": lambda: ("sin", expr),
        "F": lambda: ("floor", expr),
        "C": lambda: ("ceil", expr),
    }[op]()


def build(source: str, recipe: str) -> Expr:
    result = source_expr(source)
    for op in recipe:
        result = apply(result, op)
    return result


SPECS = [
    # id, source, degree, positions, inventory, limit, witness, name, hint, chapter, station?, relation?, signed y choices?
    (48,"x-2",1,["3","2","1","2"],{"Q":1,"N":1,"A":1},3,"QNA","The roof becomes a loop","Shape one squared height; both vertical sides must satisfy the same equation.",7,None,"height-squared",["0","1","0","-1"]),
    (49,"2*x-4",1,["3","1","1","13/5","13/5"],{"H":3,"A":5,"Q":2,"N":2},10,"HAQNAAAA","Build the whole circle","Fit the squared height at the centre and edge, then check both halves of the loop.",7,None,"height-squared",["0","2","-2","6/5","-6/5"]),
    (50,"x",1,["0","1","2","3","4"],{"S":1,"N":1},1,"S","A quarter turn","One input unit advances one quarter-turn around sine's repeating cycle.",8,None,None,None),
    (51,"x",1,["0","1","2","3","4"],{"A":1},3,"AS","Move the wave","Changing the input before sine shifts where its zeroes and peaks appear.",8,{"id":"station","op":"S","before":1,"after":1},None,None),
    (52,"x",1,["0","2","4"],{"H":1},3,"HS","Stretch the wave","Scaling the input before sine changes the horizontal period.",8,{"id":"station","op":"S","before":1,"after":1},None,None),
    (53,"x",1,["0","1","2","3","4"],{"Q":1,"N":1},2,"SQ","Fold both lobes","Squaring after sine folds the negative lobe above zero.",8,{"id":"station","op":"S","before":0,"after":1},None,None),
    (54,"x",1,["0","1/2","1","3/2","2","3","4"],{"H":1,"Q":1,"A":1},5,"SQHA","Set height and baseline","Operations after sine set the wave's amplitude and baseline.",8,{"id":"station","op":"S","before":1,"after":3},None,None),
    (55,"x",1,["0","1/2","1","3/2","2","5/2","3","4"],{"A":3,"H":2,"S":1,"Q":2,"N":1},8,"ASQHHA","Place the repeating pattern","Plan phase and period first, then fit the repeated shape's height.",8,None,None,None),
    (56,"x",1,["0","1/2","1","3/2","7/2","4"],{"F":1,"C":1},1,"F","Round down","Floor keeps each input on the step below until the next integer.",9,None,None,None),
    (57,"x",1,["0","1/2","1","3/2","7/2","4"],{"F":1,"C":1},1,"C","Round up","Ceiling moves a non-integer input to the step above.",9,None,None,None),
    (58,"x-2",1,["0","1/2","1","3/2","2","5/2","7/2","4"],{"N":1},3,"NF","Reverse the thresholds","A reflection before rounding changes the order and ownership of the steps.",9,{"id":"station","op":"F","before":1,"after":1},None,None),
    (59,"x",1,["0","1/2","3/2","2","5/2","7/2","4"],{"H":1},3,"HF","Widen each step","Scaling the input before floor changes every step's width.",9,{"id":"station","op":"F","before":1,"after":1},None,None),
    (60,"x",1,["0","1/2","1","3/2","2","5/2","3","4"],{"A":1,"H":1,"F":1},3,"AHF","Move and widen","Move the thresholds and set their spacing before rounding.",9,None,None,None),
    (61,"x",1,["0","1/2","1","3/2","5/2","3","7/2","4"],{"F":1,"C":1},2,"FS","Project the steps","Sine maps integer step levels onto a repeating sequence of heights.",9,{"id":"station","op":"S","before":1,"after":0},None,None),
    (62,"x",1,["0","1","3/2","2","5/2","3","7/2","4"],{"F":1,"S":1},3,"FSI","Accumulate signed steps","Positive and negative step widths add to the anchored accumulated height.",9,{"id":"station","op":"I","before":2,"after":0},None,None),
    (63,"x",1,["0","1/2","1","3/2","2","5/2","3","4"],{"H":2,"A":3,"F":1,"C":1,"S":1,"I":1,"Q":2,"N":2},10,"AHFSIQNA","Shape the staircase area","Build the signed step area as a subgoal, then shape its accumulated path.",9,None,None,None),
    (64,"x^3",3,["0","1/3","2/3","1","4/3","5/3","2","4"],{"D":1,"S":1,"Q":2,"H":2,"A":2,"N":1},8,"DSQHA","Uneven wave spacing","A changing input can wind the circle by unequal amounts. Find the bowl hidden in the starting curve.",10,None,None,None),
    (65,"x",1,["0","1/2","1","3/2","2","5/2","3","4"],{"A":4,"H":2,"F":1,"C":1,"S":1,"I":1,"N":3,"Q":2},12,"AHFSINAQNA","Build a gate","First accumulate a finite step pulse, then shape the resulting ramp and plateau.",10,None,None,None),
    (66,"x*(4-x)/4",2,["0","1","1","2","2","3","3","4"],{"Q":1,"H":1},1,"Q","Both sides of a roof","The squared-height equation asks one roof to account for matching upper and lower points.",7,None,"height-squared",["0","3/4","-3/4","1","-1","3/4","-3/4","0"]),
    (67,"x^2/2",2,["0","1","3/2","3/2","2","2","5/2","5/2","3","4"],{"H":3,"A":5,"N":3,"Q":3,"D":1,"I":1,"S":1,"F":1,"C":1},14,"DAHFSINAQNAQ","The whole garden","Connect a slope, thresholds, a repeating projection, signed area and a two-sided final shape.",10,None,"height-squared",["0","0","3/4","-3/4","1","-1","3/4","-3/4","0","0"]),
    (68,"3-(x-2)^2",2,["0","4/5","2","2","4"],{"A":1,"H":1},1,"A","Grow both sides","The block changes squared height. Watch both halves of the loop.",7,None,"height-squared",["0","8/5","2","-2","0"]),
    (69,"4-(x-2)^2",2,["0","4/5","2","2","4"],{"H":2,"A":1,"Q":1},2,"HH","Half the height","Compare halving the right side once with halving it twice.",7,None,"height-squared",["0","4/5","1","-1","0"]),
    (70,"(x-2)^2-1",2,["1","2","2","3"],{"N":1,"Q":1,"A":1},1,"N","Where heights exist","A negative right side has no real height. Change which regions can appear.",7,None,"height-squared",["0","1","-1","0"]),
    (71,"2*x-4",1,["0","0","3/2","3/2","5/2","5/2","7/2","4","4"],{"H":3,"A":3,"N":2,"Q":3},9,"AHHQNAHQ","A loop and its echoes","Use a signed roof as an intermediate shape, then account for both heights and the region beyond its zero.",7,None,"height-squared",["7/32","-7/32","1/2","-1/2","3/8","-3/8","0","9/32","-9/32"]),
]


def author_manifest() -> tuple[list[dict], dict[int, str]]:
    manifest: list[dict] = []
    witnesses: dict[int, str] = {}
    for (ident, source, degree, positions, inventory, limit, witness, name, hint,
         chapter, station, relation, signed) in SPECS:
        expression = build(source, witness)
        targets = []
        for index, x_text in enumerate(positions):
            x_value = q(x_text)
            actual = evaluate(expression, x_value)
            if relation:
                y_text = signed[index]
                if Exact.rational(q(y_text)).square() != actual:
                    raise AssertionError(f"{ident} relation mismatch at x={x_text}: {y_text}^2 != {actual}")
            else:
                y_text = qt(actual.as_rational())
            targets.append({"x": x_text, "y": y_text})
        item = {"id": ident, "source": source, "degree": degree, "endpoint": 4,
                "targets": targets, "inventory": inventory, "limit": limit}
        if station:
            item["station"] = station
        if relation:
            item["relation"] = relation
        item.update({"name": name, "hint": hint, "chapter": chapter})
        manifest.append(item)
        witnesses[ident] = witness
    return manifest, witnesses


def legal(recipe: str, inventory: dict[str, int], limit: int) -> bool:
    used = Counter(recipe)
    return len(recipe) <= limit and all(used[op] <= count for op, count in inventory.items()) \
        and all(op in inventory for op in used)


def solution_status(item: dict, recipe: str) -> bool | None:
    try:
        expression = build(item["source"], recipe)
        for target in item["targets"]:
            actual = evaluate(expression, q(target["x"]))
            expected = Exact.rational(q(target["y"]))
            if item.get("relation") == "height-squared":
                if expected.square() != actual:
                    return False
            elif expected != actual:
                return False
        return True
    except (ValueError, ZeroDivisionError):
        return None


def solves(item: dict, recipe: str) -> bool:
    return solution_status(item, recipe) is True


def analyze_candidates(item: dict, candidates) -> tuple[int, int, list[str]]:
    supported = unsupported = 0
    hits: list[str] = []
    for recipe in candidates:
        status = solution_status(item, recipe)
        if status is None:
            unsupported += 1
        else:
            supported += 1
            if status:
                hits.append(recipe)
    return supported, unsupported, sorted(hits)


def enumerate_legal(inventory: dict[str, int], max_length: int):
    remaining = dict(inventory)
    prefix: list[str] = []

    def walk():
        yield "".join(prefix)
        if len(prefix) == max_length:
            return
        for op in sorted(remaining):
            if remaining[op] == 0:
                continue
            remaining[op] -= 1
            prefix.append(op)
            yield from walk()
            prefix.pop()
            remaining[op] += 1

    yield from walk()


def unique_permutations(text: str):
    counts = Counter(text)
    prefix: list[str] = []

    def walk():
        if len(prefix) == len(text):
            yield "".join(prefix)
            return
        for op in sorted(counts):
            if counts[op] == 0:
                continue
            counts[op] -= 1
            prefix.append(op)
            yield from walk()
            prefix.pop()
            counts[op] += 1

    yield from walk()


def multinomial_count(text: str) -> int:
    result = factorial(len(text))
    for count in Counter(text).values():
        result //= factorial(count)
    return result


def one_edit_neighborhood(witness: str, inventory: dict[str, int]) -> set[str]:
    candidates = {witness[:i] + witness[i+1:] for i in range(len(witness))}
    candidates.update(witness[:i] + witness[i+1] + witness[i] + witness[i+2:]
                      for i in range(len(witness)-1) if witness[i] != witness[i+1])
    for index in range(len(witness)):
        for op in inventory:
            candidate = witness[:index] + op + witness[index+1:]
            if legal(candidate, inventory, len(witness)):
                candidates.add(candidate)
    return candidates


def exhaustive_rational_recipes(item: dict) -> tuple[list[int], list[str]]:
    """Visit every legal recipe when all operations act pointwise on rationals."""
    positions = list(dict.fromkeys(q(target["x"]) for target in item["targets"]))
    expected_by_position: dict[Fraction, Fraction] = {}
    for target in item["targets"]:
        position = q(target["x"])
        expected = q(target["y"])
        if item.get("relation") == "height-squared":
            expected *= expected
        previous = expected_by_position.setdefault(position, expected)
        assert previous == expected

    state = tuple(evaluate(source_expr(item["source"]), position).as_rational()
                  for position in positions)
    goal = tuple(expected_by_position[position] for position in positions)
    remaining = dict(item["inventory"])
    prefix: list[str] = []
    visited = [0] * (item["limit"] + 1)
    hits: list[str] = []

    def walk(values: tuple[Fraction, ...]) -> None:
        visited[len(prefix)] += 1
        if values == goal:
            hits.append("".join(prefix))
        if len(prefix) == item["limit"]:
            return
        for op in sorted(remaining):
            if remaining[op] == 0:
                continue
            if op == "A":
                next_values = tuple(value + 1 for value in values)
            elif op == "H":
                next_values = tuple(value / 2 for value in values)
            elif op == "N":
                next_values = tuple(-value for value in values)
            elif op == "Q":
                next_values = tuple(value * value for value in values)
            else:
                raise ValueError(f"rational recipe audit does not support {op}")
            remaining[op] -= 1
            prefix.append(op)
            walk(next_values)
            prefix.pop()
            remaining[op] += 1

    walk(state)
    return visited, sorted(hits, key=lambda recipe: (len(recipe), recipe))


def shortcut_evidence(manifest: list[dict], witnesses: dict[int, str]) -> list[str]:
    by_id = {item["id"]: item for item in manifest}
    report: list[str] = []
    for ident in (55, 64):
        item, witness = by_id[ident], witnesses[ident]
        candidates = list(enumerate_legal(item["inventory"], len(witness)-1))
        supported, unsupported, hits = analyze_candidates(item, candidates)
        report.append(f"{ident}: all {len(candidates)} legal recipes shorter than witness visited; "
                      f"{supported} exactly evaluable, {unsupported} outside oracle subset; solutions={hits}")
    for ident in (63, 65):
        item, witness = by_id[ident], witnesses[ident]
        candidates = list(unique_permutations(witness))
        assert len(candidates) == multinomial_count(witness)
        supported, unsupported, hits = analyze_candidates(item, candidates)
        edits = one_edit_neighborhood(witness, item["inventory"])
        edit_supported, edit_unsupported, edit_hits = analyze_candidates(item, edits)
        report.append(f"{ident}: all {len(candidates)} permutations of witness multiset visited "
                      f"({supported} exact, {unsupported} outside subset); solutions={hits}; "
                      f"{len(edits)} deletion/swap/substitution neighbors "
                      f"({edit_supported} exact, {edit_unsupported} outside subset); solutions={edit_hits}")
    ident = 67
    item, witness = by_id[ident], witnesses[ident]
    edits = one_edit_neighborhood(witness, item["inventory"])
    edit_supported, edit_unsupported, edit_hits = analyze_candidates(item, edits)
    report.append(f"67: {len(edits)} deletion/swap/substitution neighbors visited "
                  f"({edit_supported} exact, {edit_unsupported} outside subset); solutions={edit_hits}; "
                  f"full witness-multiset space is {multinomial_count(witness)} permutations and was not enumerated")
    ident = 71
    item = by_id[ident]
    visited, hits = exhaustive_rational_recipes(item)
    shortest = min(map(len, hits))
    shortest_hits = [recipe for recipe in hits if len(recipe) == shortest]
    core_retained = all(
        recipe.startswith("A")
        and recipe[:recipe.index("Q")].count("H") >= 2
        and "H" in recipe[recipe.index("Q") + 1:]
        and recipe.endswith("Q")
        for recipe in hits)
    assert core_retained
    report.append(
        f"71: all {sum(visited)} legal recipes through limit {item['limit']} visited exactly "
        f"(by length {visited}); shortest length={shortest}, shortest solutions={shortest_hits}; "
        f"all {len(hits)} solutions={hits}; every solution starts with the centering lift, "
        f"has two halves before its first square and another half afterward, and ends in square")
    return report


def main() -> None:
    manifest, witnesses = author_manifest()
    if "--write" in sys.argv:
        MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    # Round-trip schema/object integrity and witness legality.
    loaded = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert loaded == manifest, "Authored rules changed: update the independent fixtures deliberately."
    assert [item["id"] for item in loaded] == list(range(48, 72))
    allowed = {"id","source","degree","endpoint","targets","inventory","limit","station","relation","name","hint","chapter"}
    for item in loaded:
        assert set(item) <= allowed
        assert item["endpoint"] == 4 and item["chapter"] in {7,8,9,10}
        station_op = item.get("station", {}).get("op")
        movable = item["inventory"]
        witness_movable = witnesses[item["id"]]
        if station_op:
            assert witness_movable.count(station_op) == 1
            witness_movable = witness_movable.replace(station_op, "", 1)
        assert legal(witness_movable, movable, item["limit"])
        assert len(witnesses[item["id"]]) <= item["limit"]
        assert solves(item, witnesses[item["id"]])

    print(f"manifest: {MANIFEST}")
    print(f"verified: {len(loaded)} IDs, contiguous 48..71; every witness exact and legal")
    print("witnesses (oracle evidence only; absent from product JSON):")
    for ident in range(48, 72):
        print(f"  {ident}: {witnesses[ident]}")
    if "--shortcuts" in sys.argv:
        print("bounded shortcut checks:")
        for line in shortcut_evidence(loaded, witnesses):
            print(f"  {line}")
    print("scope: exact rational/half-unit sine identities and exact affine-step integration; no kernel calls")


if __name__ == "__main__":
    main()
