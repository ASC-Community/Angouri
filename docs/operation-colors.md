# Operation colors

Color identifies a block consistently across its stock, recipe, pickup, Flow card, discovery finding and reference badge. It supplements the formula, name and before/after icon. It does not encode correctness: green/red checks and their shapes carry validation separately.

| Operation | Identity | Surface | Formula | Contrast |
| --- | --- | --- | --- | --- |
| Halve | Sage | `#e5ecd9` | `#405d32` | 6.12:1 |
| Add one | Peach | `#f5e5d4` | `#815331` | 5.30:1 |
| Negate | Indigo blue | `#dce2f5` | `#3e5188` | 5.93:1 |
| Square | Lilac | `#ece5f2` | `#705286` | 5.26:1 |
| Find slope | Deep teal | `#b4d1c5` | `#245748` | 5.08:1 |
| Accumulate | Light teal | `#dcede6` | `#386652` | 5.42:1 |
| Sine | Rose | `#f4dfe9` | `#853e63` | 5.78:1 |
| Floor | Slate blue | `#b7cddd` | `#254c68` | 5.53:1 |
| Ceiling | Sky blue | `#e0edf7` | `#325f82` | 5.70:1 |

Every operation has its own fill. Related operations share a family: derivative and integral use distinct teal shades; Floor and Ceiling use distinct blue shades. Floor is darker than Ceiling, while their graphics explicitly show rounding down and up. Derivative and anchored integration are related transformations, not unconditional inverses; Floor and Ceiling are opposing rounding directions, not inverses. Hue alone does not communicate these distinctions. Nine pastel identities cannot be assumed distinguishable for every kind of color vision. The formula and transformation drawing remain necessary. See [W3C's use-of-color guidance](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html).

There is research on arithmetic/color associations, but it does not establish a universal mathematical palette. A [2026 study by Park and Youn](https://doi.org/10.1108/APJML-08-2025-1661) reports blue/increment and red/decrement associations across four experiments in Korea; only its published abstract was reviewed here. A [contrast-polarity study](https://pubmed.ncbi.nlm.nih.gov/32930070/) found brightness effects for addition/subtraction under particular conditions that did not generalize to multiplication/division. [Semantic color assignment research](https://idl.uw.edu/papers/semantically-resonant-colors) supports recognizable associations in categorical charts, without testing these game operations.

Accordingly, the palette groups relationships while preserving distinct block identities. These families are a design convention, not an experimentally established mathematical color code. Sine's rose identity is categorical, not a claim that waves intrinsically mean pink. A new operation needs its own shade and a readable noncolor cue; related operations can share a family without reusing an identical fill.
