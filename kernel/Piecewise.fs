namespace Angouri.Kernel

open System
open System.Numerics
open System.Collections.Generic
open AngouriMath

module internal Piecewise =
    type Rational = { Numerator: BigInteger; Denominator: BigInteger }

    type Segment = {
        Start: Rational
        End: Rational
        StartClosed: bool
        EndClosed: bool
        Expression: Entity
    }

    type Function = {
        DomainStart: Rational
        DomainEnd: Rational
        Segments: Segment list
        HasRounding: bool
    }

    type Presentation = {
        Simplified: Function
        ExpressionText: string
        Latex: string
    }

    type private SineTransform = {
        PhaseSlope: Rational
        PhaseIntercept: Rational
        OutputScale: Rational
        OutputIntercept: Rational
        Squared: bool
    }

    let private exactZeroEntity = MathS.FromString("0")
    let private exactOneEntity = MathS.FromString("1")
    let private exactNegativeOneEntity = MathS.FromString("-1")
    let private piEntity = MathS.FromString("pi")
    let private twoEntity = MathS.FromString("2")

    // Crop changes interval ownership, not the algebra inside each segment.
    // Keep the expensive exact transformations bounded and reuse them while a
    // player drags an endpoint through many distinct rational positions.
    let private expressionCacheLimit = 256
    let private expressionCacheGate = obj()
    let private simplifiedExpressionCache = Dictionary<string,Entity*string*string>()
    let private simplifiedExpressionOrder = Queue<string>()
    let private derivativeCache = Dictionary<string,Entity>()
    let private derivativeOrder = Queue<string>()
    let private exactEqualityCache = Dictionary<string,bool>()
    let private exactEqualityOrder = Queue<string>()
    let private pointwiseValueCache = Dictionary<string,Entity>()
    let private pointwiseValueOrder = Queue<string>()

    let private boundedExpressionCached (cache: Dictionary<string,'value>) (order: Queue<string>) key create =
        match lock expressionCacheGate (fun () ->
            match cache.TryGetValue(key) with
            | true,cached -> Some cached
            | false,_ -> None) with
        | Some cached -> cached
        | None ->
            let computed = create()
            lock expressionCacheGate (fun () ->
                match cache.TryGetValue(key) with
                | true,cached -> cached
                | false,_ ->
                    if cache.Count >= expressionCacheLimit then
                        cache.Remove(order.Dequeue()) |> ignore
                    cache[key] <- computed
                    order.Enqueue(key)
                    computed)

    let private simplifiedExpression (expression: Entity) =
        let key = expression.ToString()
        boundedExpressionCached simplifiedExpressionCache simplifiedExpressionOrder key (fun () ->
            let simplified = expression.Simplify()
            simplified,simplified.ToString(),simplified.Latexize())

    let private differentiatedExpression (x: Entity.Variable) (expression: Entity) =
        let key = x.ToString()+"\u001f"+expression.ToString()
        boundedExpressionCached derivativeCache derivativeOrder key (fun () -> expression.Differentiate(x))

    let createRational (numerator: BigInteger) (denominator: BigInteger) =
        if denominator = BigInteger.Zero then invalidArg "denominator" "A rational denominator cannot be zero."
        let numerator,denominator =
            if denominator.Sign < 0 then -numerator,-denominator else numerator,denominator
        let divisor = BigInteger.GreatestCommonDivisor(BigInteger.Abs(numerator),denominator)
        { Numerator=numerator/divisor; Denominator=denominator/divisor }

    let zero = createRational BigInteger.Zero BigInteger.One
    let one = createRational BigInteger.One BigInteger.One
    let ofInt (value: int) = createRational (BigInteger value) BigInteger.One
    let ofBigInteger (value: BigInteger) = createRational value BigInteger.One

    let tryParseRational (text: string) =
        if isNull text then None
        else
            let parts = text.Trim().Split('/')
            let mutable numerator = BigInteger.Zero
            let mutable denominator = BigInteger.One
            if parts.Length = 1 && BigInteger.TryParse(parts[0].Trim(),&numerator) then
                Some (createRational numerator BigInteger.One)
            elif parts.Length = 2 && BigInteger.TryParse(parts[0].Trim(),&numerator) &&
                 BigInteger.TryParse(parts[1].Trim(),&denominator) && denominator <> BigInteger.Zero then
                Some (createRational numerator denominator)
            else None

    let parseRational text =
        tryParseRational text |> Option.defaultWith (fun () -> invalidArg "text" "Expected an exact rational number.")

    let rationalText value =
        if value.Denominator = BigInteger.One then value.Numerator.ToString()
        else sprintf "%O/%O" value.Numerator value.Denominator

    let toEntity value = MathS.FromString(rationalText value)
    let toFloat value = float value.Numerator / float value.Denominator
    let compareRational left right = compare (left.Numerator * right.Denominator) (right.Numerator * left.Denominator)
    let add left right = createRational (left.Numerator*right.Denominator + right.Numerator*left.Denominator) (left.Denominator*right.Denominator)
    let subtract left right = createRational (left.Numerator*right.Denominator - right.Numerator*left.Denominator) (left.Denominator*right.Denominator)
    let multiply left right = createRational (left.Numerator*right.Numerator) (left.Denominator*right.Denominator)
    let divide left right =
        if right.Numerator = BigInteger.Zero then invalidArg "right" "Cannot divide by zero."
        createRational (left.Numerator*right.Denominator) (left.Denominator*right.Numerator)
    let negate value = createRational (-value.Numerator) value.Denominator
    let midpoint left right = divide (add left right) (ofInt 2)
    let square value = multiply value value

    let floorRational value =
        let quotient = value.Numerator / value.Denominator
        let remainder = value.Numerator % value.Denominator
        if remainder <> BigInteger.Zero && value.Numerator.Sign < 0 then quotient-BigInteger.One else quotient

    let ceilRational value =
        let quotient = value.Numerator / value.Denominator
        let remainder = value.Numerator % value.Denominator
        if remainder <> BigInteger.Zero && value.Numerator.Sign > 0 then quotient+BigInteger.One else quotient

    let tryRationalEntity (value: Entity) =
        value.InnerSimplified.ToString() |> tryParseRational

    let private trySineLandmarkEquality (left: Entity) (right: Entity) =
        let landmark value =
            if value = exactNegativeOneEntity then Some -1
            elif value = exactZeroEntity then Some 0
            elif value = exactOneEntity then Some 1
            else None
        let quarterTurnPhase (sine: Entity.Sinf) =
            match sine.Argument with
            | :? Entity.Divf as division when division.Divisor = twoEntity ->
                match division.Dividend with
                | :? Entity.Mulf as product when product.Multiplier = piEntity -> Some product.Multiplicand
                | :? Entity.Mulf as product when product.Multiplicand = piEntity -> Some product.Multiplier
                | _ -> None
            | _ -> None
        let rec sineEqualsLandmark depth (sine: Entity.Sinf) expected =
            if depth > 64 then None
            else
                // Every S block is sin(pi * input / 2). Recognizing that exact
                // phase shape lets quarter-turn landmarks bypass a much more
                // expensive general simplification of nested sine constants.
                match quarterTurnPhase sine with
                | None -> None
                | Some phase ->
                    match tryRationalEntity phase with
                    | Some rational when rational.Denominator = BigInteger.One ->
                        let remainder = rational.Numerator % BigInteger(4)
                        let normalized = if remainder.Sign < 0 then remainder+BigInteger(4) else remainder
                        let actual =
                            if normalized = BigInteger.One then 1
                            elif normalized = BigInteger(3) then -1
                            else 0
                        Some (actual = expected)
                    | Some _ -> Some false
                    | None ->
                        match phase with
                        | :? Entity.Sinf as inner ->
                            // The inner sine is in [-1,1]. In that interval the
                            // outer sine reaches -1, 0 or 1 only when its input is
                            // the same corresponding landmark.
                            sineEqualsLandmark (depth+1) inner expected
                        | _ -> None
        match left,right with
        | (:? Entity.Sinf as sine),target -> landmark target |> Option.bind (sineEqualsLandmark 0 sine)
        | target,(:? Entity.Sinf as sine) -> landmark target |> Option.bind (sineEqualsLandmark 0 sine)
        | _ -> None

    let private proofEntity value : Entity =
        // Parsing while numeric downcasting is disabled can cache Real numeral
        // nodes for later requests. Construct exact nodes without the parser.
        let numerator = PeterO.Numbers.EInteger.FromString(value.Numerator.ToString())
        if value.Denominator = BigInteger.One then Entity.Number.Integer.Create(numerator)
        else Entity.Number.Rational.Create(numerator,PeterO.Numbers.EInteger.FromString(value.Denominator.ToString()))

    let rec private proofRational depth (value: Entity) =
        if depth > 64 then None
        else
            let child = proofRational (depth+1)
            let binary operation left right =
                match child left,child right with
                | Some a,Some b -> Some (operation a b)
                | _ -> None
            match value with
            | :? Entity.Number.Rational -> tryParseRational (value.ToString())
            | :? Entity.Sumf as sum -> binary add sum.Augend sum.Addend
            | :? Entity.Minusf as difference -> binary subtract difference.Minuend difference.Subtrahend
            | :? Entity.Mulf as product -> binary multiply product.Multiplier product.Multiplicand
            | :? Entity.Divf as division ->
                match child division.Dividend,child division.Divisor with
                | Some numerator,Some denominator when denominator <> zero -> Some (divide numerator denominator)
                | _ -> None
            | :? Entity.Powf as power ->
                match child power.Base,child power.Exponent with
                | Some basis,Some exponent when exponent.Denominator = BigInteger.One &&
                        BigInteger.Abs(exponent.Numerator) <= BigInteger(1024) &&
                        basis <> zero &&
                        BigInteger.Abs(exponent.Numerator) * BigInteger(basis.Numerator.GetBitLength()+basis.Denominator.GetBitLength()) <= BigInteger(16384) ->
                    let count = int (BigInteger.Abs(exponent.Numerator))
                    let result = createRational (BigInteger.Pow(basis.Numerator,count)) (BigInteger.Pow(basis.Denominator,count))
                    Some (if exponent.Numerator.Sign < 0 then divide one result else result)
                | Some basis,Some exponent when basis = zero && exponent.Denominator = BigInteger.One && exponent.Numerator.Sign > 0 -> Some zero
                | _ -> None
            | _ -> None

    let rec private proofPiMultiple depth (value: Entity) =
        if depth > 64 then None
        elif value = piEntity then Some one
        else
            let child = proofPiMultiple (depth+1)
            match value with
            | :? Entity.Sumf as sum ->
                match child sum.Augend,child sum.Addend with | Some a,Some b -> Some (add a b) | _ -> None
            | :? Entity.Minusf as difference ->
                match child difference.Minuend,child difference.Subtrahend with | Some a,Some b -> Some (subtract a b) | _ -> None
            | :? Entity.Mulf as product ->
                match proofRational 0 product.Multiplier,child product.Multiplicand with
                | Some scale,Some angle -> Some (multiply scale angle)
                | _ ->
                    match child product.Multiplier,proofRational 0 product.Multiplicand with
                    | Some angle,Some scale -> Some (multiply angle scale)
                    | _ -> None
            | :? Entity.Divf as division ->
                match child division.Dividend,proofRational 0 division.Divisor with
                | Some angle,Some divisor when divisor <> zero -> Some (divide angle divisor)
                | _ -> None
            | _ -> if proofRational 0 value = Some zero then Some zero else None

    // Exact table landmarks and half-angle identities restore radical shoulder
    // proofs without allowing the CAS to guess rational values numerically.
    let rec private proofSine depth angle =
        if depth > 16 then None
        else
            let two = ofInt 2
            let half = divide one two
            let reduced = subtract angle (multiply two (ofBigInteger (floorRational (divide angle two))))
            let negative = compareRational reduced one > 0
            let positive = if negative then subtract reduced one else reduced
            let acute = if compareRational positive half > 0 then subtract one positive else positive
            let value =
                if acute = zero then Some exactZeroEntity
                elif acute = half then Some exactOneEntity
                elif acute = divide one (ofInt 6) then Some (proofEntity half)
                elif acute = divide one (ofInt 4) then Some ((twoEntity.Pow(proofEntity half))/twoEntity)
                elif acute = divide one (ofInt 3) then Some (((proofEntity (ofInt 3)).Pow(proofEntity half))/twoEntity)
                elif acute.Denominator.IsEven then
                    proofSine (depth+1) (subtract half (multiply two acute))
                    |> Option.map (fun cosine -> ((exactOneEntity-cosine)/twoEntity).Pow(proofEntity half))
                else None
            value |> Option.map (fun result -> if negative then -result else result)

    let private proveConstantEquality (left: Entity) (right: Entity) =
        // Numeric downcasting can turn an unresolved difference
        // such as sin(pi/18)-r into zero when r is a very close
        // rational. Proofs must keep approximate numbers apart.
        use exactNumbers = MathS.Settings.DowncastingEnabled.Set(false)
        let rewrite (expression: Entity) =
            expression.Replace(Func<Entity,Entity>(fun node ->
                match proofRational 0 node with
                | Some rational -> proofEntity rational
                | None ->
                    let sine =
                        match node with
                        | :? Entity.Sinf as sine -> proofPiMultiple 0 sine.Argument |> Option.bind (proofSine 0)
                        | :? Entity.Cosf as cosine -> proofPiMultiple 0 cosine.Argument |> Option.bind (fun angle -> proofSine 0 (add angle (divide one (ofInt 2))))
                        | _ -> None
                    sine |> Option.defaultValue node))
        let rec normalize remaining expression =
            let next = rewrite expression
            if remaining = 0 || next = expression then next else normalize (remaining-1) next
        let rec finish remaining (expression: Entity) =
            // Keep rational arithmetic and known angle identities
            // exact while restoring the integer nodes needed by
            // rewrite rules. Never reinterpret decimal estimates.
            let integers = normalize 64 expression
            let next = integers.InnerSimplified
            if remaining = 0 || next = expression then integers
            else finish (remaining-1) next
        let expanded = (left-right) |> finish 64 |> fun value -> value.Expand() |> finish 64
        expanded = exactZeroEntity || (expanded.Simplify() |> finish 64) = exactZeroEntity

    let exactEqual (left: Entity) (right: Entity) =
        if left = right then true
        else
            match left,right with
            // These are already exact number nodes. Checking their stored rational
            // values cannot involve AngouriMath's approximate evaluator or numeric
            // downcasting, and structural equality above already handled a match.
            | (:? Entity.Number.Rational),(:? Entity.Number.Rational) -> false
            | _ ->
                match trySineLandmarkEquality left right with
                | Some equal -> equal
                | None ->
                    // Algebraic constants need the full symbolic pass. In particular,
                    // do not use Signum().InnerSimplified here: AngouriMath may obtain
                    // its integer result by numerically evaluating and tolerance-downcasting the sign.
                    let leftText,rightText = left.ToString(),right.ToString()
                    let key =
                        if String.CompareOrdinal(leftText,rightText) <= 0 then leftText+"\u001f"+rightText
                        else rightText+"\u001f"+leftText
                    boundedExpressionCached exactEqualityCache exactEqualityOrder key (fun () ->
                        if Seq.isEmpty left.Vars && Seq.isEmpty right.Vars then proveConstantEquality left right
                        else (left-right).Simplify() = exactZeroEntity)

    let private containsIntegral (value: Entity) =
        value.Nodes |> Seq.exists (fun node -> node :? Entity.Integralf)

    let hasSymbolicRounding (value: Entity) =
        value.Nodes |> Seq.exists (fun node -> node :? Entity.Floorf || node :? Entity.Ceilf)

    let create source endpoint =
        let domainEnd = ofInt endpoint
        { DomainStart=zero; DomainEnd=domainEnd
          Segments=[{ Start=zero; End=domainEnd; StartClosed=true; EndClosed=true; Expression=source }]
          HasRounding=false }

    let private contains point segment =
        let startComparison,endComparison = compareRational point segment.Start,compareRational point segment.End
        (startComparison > 0 || startComparison = 0 && segment.StartClosed) &&
        (endComparison < 0 || endComparison = 0 && segment.EndClosed)

    let segmentAt point fn =
        let pointSegment =
            fn.Segments |> List.tryFind (fun segment ->
                compareRational segment.Start segment.End = 0 && contains point segment)
        pointSegment
        |> Option.orElseWith (fun () -> fn.Segments |> List.tryFind (contains point))
        |> Option.defaultWith (fun () -> invalidOp (sprintf "No exact segment owns x=%s." (rationalText point)))

    let trySegmentAt point fn =
        let pointSegment =
            fn.Segments |> List.tryFind (fun segment ->
                compareRational segment.Start segment.End = 0 && contains point segment)
        pointSegment
        |> Option.orElseWith (fun () -> fn.Segments |> List.tryFind (contains point))

    let isDefinedAt point fn = trySegmentAt point fn |> Option.isSome

    let crop fromPoint toPoint fn =
        if compareRational fromPoint toPoint >= 0 ||
           compareRational fromPoint fn.DomainStart < 0 ||
           compareRational toPoint fn.DomainEnd > 0 then
            invalidArg "interval" "The crop must be a non-empty interval inside the function domain."
        let clipped =
            fn.Segments
            |> List.choose (fun segment ->
                let startPoint = if compareRational segment.Start fromPoint < 0 then fromPoint else segment.Start
                let endPoint = if compareRational segment.End toPoint > 0 then toPoint else segment.End
                let comparison = compareRational startPoint endPoint
                if comparison > 0 then None
                elif comparison = 0 && not (contains startPoint segment) then None
                else
                    Some {
                        segment with
                            Start=startPoint
                            End=endPoint
                            StartClosed=(if compareRational startPoint segment.Start = 0 then segment.StartClosed else true)
                            EndClosed=(if compareRational endPoint segment.End = 0 then segment.EndClosed else true) })
        { fn with DomainStart=fromPoint; DomainEnd=toPoint; Segments=clipped }

    let boundaries fn =
        fn.Segments
        |> List.collect (fun segment -> [segment.Start;segment.End])
        |> List.distinct
        |> List.sortWith compareRational

    let private tryAffine (x: Entity.Variable) (expression: Entity) =
        let simplified = expression.InnerSimplified
        let atZero = simplified.Substitute(x,toEntity zero).InnerSimplified
        let atOne = simplified.Substitute(x,toEntity one).InnerSimplified
        match tryRationalEntity atZero,tryRationalEntity atOne with
        | Some intercept,Some valueAtOne ->
            let slope = subtract valueAtOne intercept
            let candidate = (toEntity slope * x + toEntity intercept).InnerSimplified
            if exactEqual simplified candidate then Some (slope,intercept) else None
        | _ -> None

    let tryAffineRange (x: Entity.Variable) fn =
        let endpoints =
            fn.Segments
            |> List.map (fun segment ->
                tryAffine x segment.Expression
                |> Option.map (fun (slope,intercept) ->
                    let at point = add (multiply slope point) intercept
                    [at segment.Start;at segment.End]))
        if endpoints |> List.exists Option.isNone then None
        else
            let values = endpoints |> List.choose id |> List.collect id
            match values with
            | [] -> None
            | first::rest ->
                let low,high =
                    rest |> List.fold (fun (low,high) value ->
                        (if compareRational value low < 0 then value else low),
                        (if compareRational value high > 0 then value else high)) (first,first)
                Some (low,high)

    let private tryQuarterTurnSineTransform (x: Entity.Variable) (expression: Entity) =
        let simplified = expression.InnerSimplified
        let pi = MathS.FromString("pi")
        let two = MathS.FromString("2")
        expression.Nodes
        |> Seq.choose (function | :? Entity.Sinf as sine -> Some sine | _ -> None)
        |> Seq.tryPick (fun sine ->
            let sineEntity = sine :> Entity
            let phase = (sine.Argument*two/pi).Simplify()
            match tryAffine x phase with
            | Some (phaseSlope,phaseIntercept) when phaseSlope.Numerator <> BigInteger.Zero ->
                let atPhase phaseValue =
                    let point = divide (subtract phaseValue phaseIntercept) phaseSlope
                    expression.Substitute(x,toEntity point).InnerSimplified |> tryRationalEntity
                match atPhase zero,atPhase one with
                | Some atZero,Some atOne ->
                    let outputScale = subtract atOne atZero
                    let scaleEntity,interceptEntity = toEntity outputScale,toEntity atZero
                    let candidates = [false,scaleEntity*sineEntity+interceptEntity; true,scaleEntity*sineEntity.Pow(two)+interceptEntity]
                    candidates
                    |> List.tryPick (fun (squared,candidate) ->
                        if exactEqual simplified candidate then
                            Some { PhaseSlope=phaseSlope; PhaseIntercept=phaseIntercept
                                   OutputScale=outputScale; OutputIntercept=atZero; Squared=squared }
                        else None)
                | _ -> None
            | _ -> None)

    let private roundedValue round slope intercept point =
        add (multiply slope point) intercept |> round

    let private integerSequence first last = seq {
        let mutable current = first
        while current <= last do
            yield current
            current <- current + BigInteger.One
    }

    let private moduloFour (value: BigInteger) =
        let remainder = value % BigInteger(4)
        if remainder.Sign < 0 then remainder+BigInteger(4) else remainder

    let private quarterTurnSineAtInteger integer =
        match moduloFour integer with
        | remainder when remainder = BigInteger.One -> one
        | remainder when remainder = BigInteger(3) -> negate one
        | _ -> zero

    let private transformedSineAtInteger transform integer =
        let sine = quarterTurnSineAtInteger integer
        let basis = if transform.Squared then square sine else sine
        add (multiply transform.OutputScale basis) transform.OutputIntercept

    let private transformedSineRange transform =
        if transform.Squared then
            let atZero,atOne = transform.OutputIntercept,add transform.OutputIntercept transform.OutputScale
            if compareRational atZero atOne <= 0 then atZero,atOne else atOne,atZero
        else
            let magnitude =
                if transform.OutputScale.Numerator.Sign < 0 then negate transform.OutputScale else transform.OutputScale
            subtract transform.OutputIntercept magnitude,add transform.OutputIntercept magnitude

    let private transformedSineHasOnlyRationalCuts transform =
        if transform.OutputScale.Numerator = BigInteger.Zero then true
        else
            let minimum,maximum = transformedSineRange transform
            let firstInteger,lastInteger = ceilRational minimum,floorRational maximum
            integerSequence firstInteger lastInteger
            |> Seq.forall (fun integer ->
                let level = divide (subtract (ofBigInteger integer) transform.OutputIntercept) transform.OutputScale
                level = zero || level = one || not transform.Squared && level = negate one)

    let private roundedTransformedSine isFloor transform phase =
        let representative =
            if phase.Denominator = BigInteger.One then
                transformedSineAtInteger transform phase.Numerator
            else
                let lower = floorRational phase
                midpoint (transformedSineAtInteger transform lower) (transformedSineAtInteger transform (lower+BigInteger.One))
        if isFloor then floorRational representative else ceilRational representative

    // Generic rounded expressions need not have rational jump positions. Keep
    // their symbolic node, but reduce exact checkpoints before the native Floor
    // evaluator can pass them through a finite-precision decimal conversion.
    let private roundConstant isFloor (value: Entity) =
        let round = if isFloor then floorRational else ceilRational
        let sineRounded =
            value.Nodes
            |> Seq.choose (function :? Entity.Sinf as sine -> Some sine | _ -> None)
            |> Seq.tryPick (fun sine ->
                let pi = MathS.FromString("pi")
                let phase = (sine.Argument * toEntity (ofInt 2) / pi).Simplify() |> tryRationalEntity
                let variable = MathS.Var("round_input")
                let replaced = value.Substitute(sine,variable)
                let at point = replaced.Substitute(variable,toEntity point).InnerSimplified |> tryRationalEntity
                match phase,at zero,at one with
                | Some phase,Some offset,Some atOne ->
                    let scale = subtract atOne offset
                    [false;true]
                    |> List.tryPick (fun squared ->
                        let basis = if squared then variable.Pow(toEntity (ofInt 2)) else variable :> Entity
                        let candidate = toEntity scale*basis + toEntity offset
                        let transform = { PhaseSlope=one;PhaseIntercept=zero;OutputScale=scale;OutputIntercept=offset;Squared=squared }
                        if exactEqual replaced candidate && transformedSineHasOnlyRationalCuts transform then
                            Some (roundedTransformedSine isFloor transform phase)
                        else None)
                | _ -> None)
        sineRounded
        |> Option.orElseWith (fun () -> tryRationalEntity value |> Option.map round)
        |> Option.orElseWith (fun () -> value.Simplify() |> tryRationalEntity |> Option.map round)

    let evaluateExpressionAt (x: Entity.Variable) point (expression: Entity) =
        let rec reduce (current: Entity) =
            let leaf =
                current.Nodes |> Seq.tryPick (function
                    | :? Entity.Floorf as node when not (hasSymbolicRounding node.Argument) -> Some (node :> Entity,node.Argument,true)
                    | :? Entity.Ceilf as node when not (hasSymbolicRounding node.Argument) -> Some (node :> Entity,node.Argument,false)
                    | _ -> None)
            match leaf with
            | None -> current.Substitute(x,toEntity point).InnerSimplified
            | Some (node,argument,isFloor) ->
                match roundConstant isFloor (argument.Substitute(x,toEntity point)) with
                | Some integer -> reduce (current.Substitute(node,toEntity (ofBigInteger integer)))
                | None -> invalidArg "preview" "This rounded value cannot yet be resolved exactly at the required position."
        reduce expression

    let evaluateAt (x: Entity.Variable) point fn =
        evaluateExpressionAt x point (segmentAt point fn).Expression

    let evaluateSegmentAt (x: Entity.Variable) point segment =
        evaluateExpressionAt x point segment.Expression

    /// Compile smooth children with AngouriMath; round only their visual double
    /// readings. These delegates never decide checkpoint equality.
    let rec compileNumeric (x: Entity.Variable) (expression: Entity) : (float -> float) * (float -> float list) =
        let real (value: Complex) =
            if not (Double.IsFinite(value.Real)) || not (Double.IsFinite(value.Imaginary)) || abs value.Imaginary>0.0000001 then
                invalidArg "preview" "The curve did not return a real number."
            value.Real
        let rounds =
            expression.Nodes
            |> Seq.filter (fun node -> node :? Entity.Floorf || node :? Entity.Ceilf)
            |> Seq.distinct |> Seq.toArray
        if rounds.Length=0 then
            let compiled = expression.Compile([|x|])
            (fun point -> compiled.Call([|Complex(point,0.)|]) |> real),(fun _ -> [])
        else
            let variables = rounds |> Array.mapi (fun index _ -> MathS.Var(sprintf "rounded_%d" index))
            let children = rounds |> Array.map (function
                | :? Entity.Floorf as node -> let child,_=compileNumeric x node.Argument in fun point -> Math.Floor(child point)
                | :? Entity.Ceilf as node -> let child,_=compileNumeric x node.Argument in fun point -> Math.Ceiling(child point)
                | _ -> invalidOp "Expected a rounding node.")
            let smooth = (expression,Array.zip rounds variables) ||> Array.fold (fun current (node,variable) -> current.Substitute(node,variable))
            let compiled = smooth.Compile(Array.append [|x|] variables)
            let values point = children |> Array.map (fun child -> child point)
            (fun point -> compiled.Call(Array.append [|Complex(point,0.)|] (values point |> Array.map (fun value -> Complex(value,0.)))) |> real),
            (fun point -> values point |> Array.toList)

    let private partitionQuarterTurnSine maxSegments isFloor transform segment =
        let slope,intercept = transform.PhaseSlope,transform.PhaseIntercept
        if not (transformedSineHasOnlyRationalCuts transform) then
            Error "This transformed Sine crosses an integer away from an exact quarter-turn landmark, so Floor or Ceiling cannot partition it exactly yet."
        elif compareRational segment.Start segment.End = 0 then
            let phase = add (multiply slope segment.Start) intercept
            let rounded = roundedTransformedSine isFloor transform phase |> ofBigInteger
            Ok [{ segment with Expression=toEntity rounded }]
        elif slope.Numerator = BigInteger.Zero then
            let rounded = roundedTransformedSine isFloor transform intercept |> ofBigInteger
            Ok [{ segment with Expression=toEntity rounded }]
        else
            let startPhase = add (multiply slope segment.Start) intercept
            let endPhase = add (multiply slope segment.End) intercept
            let minimum,maximum =
                if compareRational startPhase endPhase <= 0 then startPhase,endPhase else endPhase,startPhase
            let firstInteger,lastInteger = ceilRational minimum,floorRational maximum
            let landmarkCount =
                if firstInteger > lastInteger then BigInteger.Zero else lastInteger-firstInteger+BigInteger.One
            if landmarkCount > BigInteger(maxSegments+1) then
                Error (sprintf "This rounding construction creates more than %d exact segments." maxSegments)
            else
                let interiorLandmarks =
                    integerSequence firstInteger lastInteger
                    |> Seq.map (fun integer -> divide (subtract (ofBigInteger integer) intercept) slope)
                    |> Seq.filter (fun point -> compareRational point segment.Start > 0 && compareRational point segment.End < 0)
                    |> Seq.toList
                let breakpoints =
                    segment.Start :: segment.End :: interiorLandmarks
                    |> List.distinct
                    |> List.sortWith compareRational
                let roundedAt point =
                    add (multiply slope point) intercept
                    |> roundedTransformedSine isFloor transform
                let intervals =
                    breakpoints
                    |> List.pairwise
                    |> List.map (fun (startPoint,endPoint) ->
                        let rounded = roundedAt (midpoint startPoint endPoint)
                        let startRounded = roundedAt startPoint
                        let endRounded = roundedAt endPoint
                        let ownsStart =
                            (compareRational startPoint segment.Start <> 0 || segment.StartClosed) && startRounded = rounded
                        let ownsEnd =
                            (compareRational endPoint segment.End <> 0 || segment.EndClosed) && endRounded = rounded
                        { Start=startPoint; End=endPoint; StartClosed=ownsStart; EndClosed=ownsEnd
                          Expression=toEntity (ofBigInteger rounded) })
                let points =
                    breakpoints
                    |> List.choose (fun point ->
                        let inputOwns =
                            (compareRational point segment.Start <> 0 || segment.StartClosed) &&
                            (compareRational point segment.End <> 0 || segment.EndClosed)
                        if not inputOwns then None
                        else
                            let expected = roundedAt point |> ofBigInteger |> toEntity
                            let covered = intervals |> List.exists (fun interval -> contains point interval && exactEqual interval.Expression expected)
                            if covered then None
                            else Some { Start=point;End=point;StartClosed=true;EndClosed=true;Expression=expected })
                Ok (intervals @ points)

    let private partitionSegment (x: Entity.Variable) maxSegments round isFloor segment =
        let symbolic () =
            let expression : Entity = if isFloor then upcast Entity.Floorf(segment.Expression) else upcast Entity.Ceilf(segment.Expression)
            Ok [{segment with Expression=expression}]
        match if hasSymbolicRounding segment.Expression then None else tryAffine x segment.Expression with
        | None ->
            match if hasSymbolicRounding segment.Expression then None else tryQuarterTurnSineTransform x segment.Expression with
            | Some transform when transformedSineHasOnlyRationalCuts transform -> partitionQuarterTurnSine maxSegments isFloor transform segment
            | _ -> symbolic ()
        | Some (slope,intercept) when compareRational segment.Start segment.End = 0 ->
            let rounded = roundedValue round slope intercept segment.Start |> ofBigInteger
            Ok [{ segment with Expression=toEntity rounded }]
        | Some (slope,intercept) when slope.Numerator = BigInteger.Zero ->
            let rounded = round intercept |> ofBigInteger
            Ok [{ segment with Expression=toEntity rounded }]
        | Some (slope,intercept) ->
            let startValue = add (multiply slope segment.Start) intercept
            let endValue = add (multiply slope segment.End) intercept
            let minimum,maximum =
                if compareRational startValue endValue <= 0 then startValue,endValue else endValue,startValue
            let firstInteger,lastInteger = ceilRational minimum,floorRational maximum
            let thresholdCount =
                if firstInteger > lastInteger then BigInteger.Zero else lastInteger-firstInteger+BigInteger.One
            if thresholdCount > BigInteger(maxSegments+1) then
                Error (sprintf "This rounding construction creates more than %d exact segments." maxSegments)
            else
                let interiorThresholds =
                    integerSequence firstInteger lastInteger
                    |> Seq.map (fun integer -> divide (subtract (ofBigInteger integer) intercept) slope)
                    |> Seq.filter (fun point -> compareRational point segment.Start > 0 && compareRational point segment.End < 0)
                    |> Seq.toList
                let breakpoints =
                    segment.Start :: segment.End :: interiorThresholds
                    |> List.distinct
                    |> List.sortWith compareRational
                let intervals =
                    breakpoints
                    |> List.pairwise
                    |> List.map (fun (startPoint,endPoint) ->
                        let sample = midpoint startPoint endPoint
                        let rounded = roundedValue round slope intercept sample
                        let startValue = roundedValue round slope intercept startPoint
                        let endValue = roundedValue round slope intercept endPoint
                        let ownsStart =
                            (compareRational startPoint segment.Start <> 0 || segment.StartClosed) && startValue = rounded
                        let ownsEnd =
                            (compareRational endPoint segment.End <> 0 || segment.EndClosed) && endValue = rounded
                        { Start=startPoint; End=endPoint; StartClosed=ownsStart; EndClosed=ownsEnd
                          Expression=toEntity (ofBigInteger rounded) })
                let points =
                    breakpoints
                    |> List.choose (fun point ->
                        let inputOwns =
                            (compareRational point segment.Start <> 0 || segment.StartClosed) &&
                            (compareRational point segment.End <> 0 || segment.EndClosed)
                        if not inputOwns then None
                        else
                            let expected = roundedValue round slope intercept point |> ofBigInteger |> toEntity
                            let covered = intervals |> List.exists (fun interval -> contains point interval && exactEqual interval.Expression expected)
                            if covered then None
                            else Some { Start=point;End=point;StartClosed=true;EndClosed=true;Expression=expected })
                Ok (intervals @ points)

    let private sortSegments segments =
        segments |> List.sortWith (fun left right ->
            let byStart = compareRational left.Start right.Start
            if byStart <> 0 then byStart
            else
                let leftPoint = compareRational left.Start left.End = 0
                let rightPoint = compareRational right.Start right.End = 0
                compare rightPoint leftPoint)

    let private roundFunction x (maxSegments: int) round isFloor fn =
        let folder (state: Result<Segment list,string>) (segment: Segment) =
            match state with
            | Error message -> Error message
            | Ok segments ->
                match partitionSegment x maxSegments round isFloor segment with
                | Error message -> Error message
                | Ok additions when segments.Length + additions.Length > maxSegments ->
                    Error (sprintf "This rounding construction creates more than %d exact segments." maxSegments)
                | Ok additions -> Ok (segments @ additions)
        match fn.Segments |> List.fold folder (Ok []) with
        | Error message -> Error message
        | Ok segments -> Ok { fn with Segments=sortSegments segments; HasRounding=true }

    let private mapExpressions transform fn =
        { fn with Segments=fn.Segments |> List.map (fun segment -> { segment with Expression=transform segment.Expression }) }

    let private integrateFunction (x: Entity.Variable) fn =
        let intervals =
            fn.Segments
            |> List.filter (fun segment -> compareRational segment.Start segment.End < 0)
            |> List.sortWith (fun left right -> compareRational left.Start right.Start)
        let mutable accumulated = MathS.FromString("0")
        let output = ResizeArray<Segment>()
        let mutable failure : string option = None
        for segment in intervals do
            if failure.IsNone then
                let startValue,endValue = toEntity segment.Start,toEntity segment.End
                let local = segment.Expression.Integrate(x,startValue,x).Simplify()
                let area = segment.Expression.Integrate(x,startValue,endValue).Simplify()
                if containsIntegral local || containsIntegral area then
                    failure <- Some "This construction does not have an exact supported accumulated form."
                else
                    let expression = (accumulated + local).Simplify()
                    output.Add({ segment with StartClosed=true;EndClosed=true;Expression=expression })
                    accumulated <- (accumulated + area).Simplify()
        match failure with
        | Some message -> Error message
        | None when output.Count = 0 -> Error "This construction has no interval to accumulate."
        | None -> Ok { fn with Segments=output |> Seq.toList; HasRounding=fn.HasRounding }

    let private differentiateFunction (x: Entity.Variable) fn =
        let intervals =
            fn.Segments
            |> List.filter (fun segment -> compareRational segment.Start segment.End < 0)
        let valueAt point segment =
            segment.Expression.Substitute(x,toEntity point).InnerSimplified
        let derivativeAt point segment =
            segment.Expression.Differentiate(x).Substitute(x,toEntity point).InnerSimplified
        let incident point =
            let left =
                intervals
                |> List.filter (fun segment -> compareRational segment.End point = 0)
                |> List.sortWith (fun first second -> compareRational second.Start first.Start)
                |> List.tryHead
            let right =
                intervals
                |> List.filter (fun segment -> compareRational segment.Start point = 0)
                |> List.sortWith (fun first second -> compareRational first.End second.End)
                |> List.tryHead
            left,right
        let boundaryFailure point =
            let owned = evaluateAt x point fn
            let left,right = incident point
            let jump =
                [left;right]
                |> List.choose id
                |> List.exists (fun segment -> not (exactEqual owned (valueAt point segment)))
            if jump then
                Some (sprintf "Find slope cannot follow this construction because it has a jump at x = %s." (rationalText point))
            else
                match left,right with
                | Some leftSegment,Some rightSegment
                    when not (exactEqual (derivativeAt point leftSegment) (derivativeAt point rightSegment)) ->
                    Some (sprintf "Find slope cannot follow this construction because it has a corner at x = %s." (rationalText point))
                | _ -> None
        let unpartitioned = fn.Segments |> List.exists (fun segment -> hasSymbolicRounding segment.Expression)
        match if unpartitioned then Some "Find slope needs an everywhere-defined slope. This rounded curve has unresolved jump boundaries." else boundaries fn |> List.tryPick boundaryFailure with
        | Some message -> Error message
        | None ->
            let differentiated =
                fn.Segments
                |> List.map (fun segment ->
                    let expression =
                        if compareRational segment.Start segment.End < 0 then
                            segment.Expression.Differentiate(x).InnerSimplified
                        else
                            let left,right = incident segment.Start
                            let source = right |> Option.orElse left
                            match source with
                            | Some interval -> derivativeAt segment.Start interval
                            | None -> segment.Expression.Differentiate(x).InnerSimplified
                    { segment with Expression=expression })
            Ok { fn with Segments=differentiated }

    /// Build the bounded piecewise form of an authored outline. Rounding is
    /// accepted only when it is the outer operation, so the same exact
    /// partitioner used by game blocks remains the authority.
    let rec fromExpression (x: Entity.Variable) maxSegments endpoint (expression: Entity) =
        match expression with
        | :? Entity.Floorf as floorNode ->
            fromExpression x maxSegments endpoint floorNode.Argument
            |> Result.bind (roundFunction x maxSegments floorRational true)
        | :? Entity.Ceilf as ceilNode ->
            fromExpression x maxSegments endpoint ceilNode.Argument
            |> Result.bind (roundFunction x maxSegments ceilRational false)
        | _ when hasSymbolicRounding expression ->
            Error "This authored outline contains nested rounding that cannot be partitioned exactly yet."
        | _ -> Ok (create expression endpoint)

    // The same pointwise operation builds a stage and advances its exact
    // checkpoint readings. Reusing a preceding reading avoids substituting
    // through (and simplifying) every earlier sine again after a lift or scale.
    let private pointwiseOperation op =
        match op with
        | "H" -> Some (fun (expression: Entity) -> (expression/twoEntity).InnerSimplified)
        | "A" -> Some (fun expression -> (expression+exactOneEntity).InnerSimplified)
        | "N" -> Some (fun expression -> -expression)
        | "Q" -> Some (fun expression -> expression.Pow(twoEntity).InnerSimplified)
        | "S" ->
            Some (fun expression -> MathS.Sin(piEntity*expression/twoEntity))
        | _ -> None

    let tryMapExactValues op (values: Entity list) =
        pointwiseOperation op |> Option.map (fun transform ->
            values |> List.map (fun value ->
                let key = op+"\u001f"+value.ToString()
                boundedExpressionCached pointwiseValueCache pointwiseValueOrder key (fun () ->
                    (transform value).InnerSimplified)))

    let apply (x: Entity.Variable) maxSegments op fn =
        match pointwiseOperation op with
        | Some transform -> Ok (mapExpressions transform fn)
        | None ->
            match op with
            | "F" -> roundFunction x maxSegments floorRational true fn
            | "C" -> roundFunction x maxSegments ceilRational false fn
            | "D" -> differentiateFunction x fn
            | "I" -> integrateFunction x fn
            | _ -> Error "Unknown operation."

    let rightSlopeAt (x: Entity.Variable) point fn =
        let rightSegment =
            fn.Segments
            |> List.filter (fun segment -> compareRational segment.Start segment.End < 0 &&
                                           compareRational segment.Start point <= 0 &&
                                           compareRational segment.End point > 0)
            |> List.tryHead
            |> Option.orElseWith (fun () ->
                fn.Segments
                |> List.filter (fun segment -> compareRational segment.Start segment.End < 0)
                |> List.sortWith (fun left right -> compareRational left.Start right.Start)
                |> List.tryHead)
            |> Option.defaultWith (fun () -> invalidOp (sprintf "The construction has no right-hand interval at x=%s." (rationalText point)))
        // With no subsequent integral or derivative, compositions of these
        // rounding nodes are locally constant on the right of the endpoint.
        if hasSymbolicRounding rightSegment.Expression then exactZeroEntity
        else
            (differentiatedExpression x rightSegment.Expression)
                .Substitute(x,toEntity point).InnerSimplified

    let rightSlopeAtZero (x: Entity.Variable) fn = rightSlopeAt x zero fn

    let segmentConditionLatex segment =
        let startRelation = if segment.StartClosed then "\\le" else "<"
        let endRelation = if segment.EndClosed then "\\le" else "<"
        if compareRational segment.Start segment.End = 0 then
            sprintf "x = %s" ((toEntity segment.Start).Latexize())
        else
            sprintf "%s %s x %s %s"
                ((toEntity segment.Start).Latexize()) startRelation endRelation ((toEntity segment.End).Latexize())

    let intervalConditionLatex fromPoint toPoint =
        sprintf "%s \\le x \\le %s" ((toEntity fromPoint).Latexize()) ((toEntity toPoint).Latexize())

    let providedLatex fn =
        let conditionText segment =
            if compareRational segment.Start segment.End = 0 then
                sprintf "x = %s" (rationalText segment.Start)
            else
                let left = if segment.StartClosed then ">=" else ">"
                let right = if segment.EndClosed then "<=" else "<"
                sprintf "x %s %s and x %s %s" left (rationalText segment.Start) right (rationalText segment.End)
        let cases =
            fn.Segments
            |> List.map (fun segment ->
                Entity.Providedf(segment.Expression,MathS.FromString(conditionText segment)))
        let provided : Entity =
            match cases with
            | [single] -> upcast single
            | _ -> upcast Entity.Piecewise(cases)
        provided.Latexize()

    let private presentationCacheLimit = 256
    let private presentationCache = Dictionary<string,Presentation>()
    let private presentationCacheOrder = Queue<string>()
    let private presentationCacheGate = obj()

    let private presentationKey fn =
        fn.Segments
        |> List.map (fun segment ->
            sprintf "%s\u001f%s\u001f%b\u001f%b\u001f%s"
                (rationalText segment.Start) (rationalText segment.End)
                segment.StartClosed segment.EndClosed (segment.Expression.ToString()))
        |> String.concat "\u001e"

    let private buildPresentation fn =
        // Full simplification is a display concern. Evaluation keeps the original
        // segment entities so rendering cannot change exact ownership or values.
        // Reuse each simplified entity for both plain text and LaTeX serialization.
        let segments =
            fn.Segments
            |> List.map (fun segment ->
                let simplified,text,latex = simplifiedExpression segment.Expression
                segment,simplified,text,latex)
        let simplifiedFunction =
            { fn with Segments=segments |> List.map (fun (segment,simplified,_,_) -> { segment with Expression=simplified }) }
        match segments with
        | [(segment,_,text,latex)] when compareRational segment.Start segment.End < 0 ->
            { Simplified=simplifiedFunction; ExpressionText=text; Latex=latex }
        | segments ->
            let expressionText =
                segments
                |> List.map (fun (segment,_,text,_) -> sprintf "%s for %s" text (segmentConditionLatex segment))
                |> String.concat "; "
                |> sprintf "piecewise(%s)"
            let rows =
                segments
                |> List.map (fun (segment,_,_,latex) -> sprintf "%s & %s" latex (segmentConditionLatex segment))
                |> String.concat " \\\\ "
            { Simplified=simplifiedFunction; ExpressionText=expressionText; Latex=sprintf "\\begin{cases}%s\\end{cases}" rows }

    let presentation fn =
        let key = presentationKey fn
        match lock presentationCacheGate (fun () ->
            match presentationCache.TryGetValue(key) with
            | true,cached -> Some cached
            | false,_ -> None) with
        | Some cached -> cached
        | None ->
            let rendered = buildPresentation fn
            lock presentationCacheGate (fun () ->
                match presentationCache.TryGetValue(key) with
                | true,cached -> cached
                | false,_ ->
                    if presentationCache.Count >= presentationCacheLimit then
                        let oldest = presentationCacheOrder.Dequeue()
                        presentationCache.Remove(oldest) |> ignore
                    presentationCache[key] <- rendered
                    presentationCacheOrder.Enqueue(key)
                    rendered)

    let latex fn = (presentation fn).Latex
    let expressionText fn = (presentation fn).ExpressionText

    let tryQuadratic (x: Entity.Variable) (expression: Entity) =
        let valueAt point = expression.Substitute(x,toEntity point).InnerSimplified |> tryRationalEntity
        match valueAt zero,valueAt one,valueAt (negate one) with
        | Some atZero,Some atOne,Some atNegativeOne ->
            let two = ofInt 2
            let linear = divide (subtract atOne atNegativeOne) two
            let quadratic = subtract (divide (add atOne atNegativeOne) two) atZero
            let candidate =
                (toEntity quadratic * x.Pow(MathS.FromString("2")) + toEntity linear*x + toEntity atZero).InnerSimplified
            if exactEqual expression candidate then Some (quadratic,linear,atZero) else None
        | _ -> None

    let integerSquareRoot (value: BigInteger) =
        if value.Sign < 0 then invalidArg "value" "Cannot take the integer square root of a negative number."
        elif value < BigInteger(2) then value
        else
            let mutable estimate = BigInteger.One <<< int ((value.GetBitLength()+1L)/2L)
            let mutable next = (estimate + value/estimate) >>> 1
            while next < estimate do
                estimate <- next
                next <- (estimate + value/estimate) >>> 1
            estimate

    let tryRationalSquareRoot value =
        if value.Numerator.Sign < 0 then None
        else
            let numeratorRoot = integerSquareRoot value.Numerator
            let denominatorRoot = integerSquareRoot value.Denominator
            if numeratorRoot*numeratorRoot = value.Numerator && denominatorRoot*denominatorRoot = value.Denominator then
                Some (createRational numeratorRoot denominatorRoot)
            else None

    // Machin's identity pi = 16 atan(1/5) - 4 atan(1/239), with each
    // alternating series bracketed by consecutive partial sums. No floating
    // point approximation participates in these bounds or target validation.
    let private piBoundsCache = Dictionary<string,Rational*Rational>()
    let private piBoundsOrder = Queue<string>()
    let private piBounds bits =
        boundedExpressionCached piBoundsCache piBoundsOrder (string bits) (fun () ->
            let epsilon = createRational BigInteger.One (BigInteger.One <<< (bits+8))
            let arctangent (denominator: int) =
                let inverse = createRational BigInteger.One (BigInteger denominator)
                let inverseSquared = square inverse
                let mutable power = inverse
                let mutable sum = zero
                let mutable index = 0
                let mutable term = inverse
                while compareRational term epsilon > 0 do
                    sum <- if index % 2 = 0 then add sum term else subtract sum term
                    power <- multiply power inverseSquared
                    index <- index+1
                    term <- divide power (ofInt (2*index+1))
                if index % 2 = 0 then sum,add sum term else subtract sum term,sum
            let fiveLow,fiveHigh = arctangent 5
            let otherLow,otherHigh = arctangent 239
            subtract (multiply (ofInt 16) fiveLow) (multiply (ofInt 4) otherHigh),
            subtract (multiply (ofInt 16) fiveHigh) (multiply (ofInt 4) otherLow))

    let private minRational values = values |> List.reduce (fun best value -> if compareRational value best < 0 then value else best)
    let private maxRational values = values |> List.reduce (fun best value -> if compareRational value best > 0 then value else best)
    let private absoluteRational value = if value.Numerator.Sign < 0 then negate value else value
    let private multiplyBounds (leftLow,leftHigh) (rightLow,rightHigh) =
        let products = [multiply leftLow rightLow;multiply leftLow rightHigh
                        multiply leftHigh rightLow;multiply leftHigh rightHigh]
        minRational products,maxRational products

    let private sineBounds bits (low,high) =
        let piLow,piHigh = piBounds bits
        let periodLow,periodHigh = multiply (ofInt 2) piLow,multiply (ofInt 2) piHigh
        let turns = floorRational (add (divide (midpoint low high) (midpoint periodLow periodHigh)) (divide one (ofInt 2)))
        let shiftLow,shiftHigh = multiplyBounds (ofBigInteger turns,ofBigInteger turns) (periodLow,periodHigh)
        let reducedLow,reducedHigh = subtract low shiftHigh,subtract high shiftLow
        let four = ofInt 4
        if compareRational reducedLow (negate four) < 0 || compareRational reducedHigh four > 0 then
            // A wide or enormous argument may lose useful information in range
            // reduction. [-1,1] is still a valid enclosure; never guess its sign.
            negate one,one
        else
            let scale = ofBigInteger (BigInteger.One <<< (bits+8))
            let centre = divide (ofBigInteger (floorRational (multiply (midpoint reducedLow reducedHigh) scale))) scale
            let radius = maxRational [absoluteRational (subtract centre reducedLow);absoluteRational (subtract reducedHigh centre)]
            let epsilon = divide one scale
            let squared = square centre
            let mutable term = centre
            let mutable sum = centre
            let mutable index = 0
            let mutable remainder = one
            while compareRational remainder epsilon > 0 do
                let divisor = ofInt ((2*index+2)*(2*index+3))
                let next = negate (divide (multiply term squared) divisor)
                remainder <- absoluteRational next
                if compareRational remainder epsilon > 0 then
                    sum <- add sum next
                    term <- next
                    index <- index+1
            // Taylor's remainder is bounded by the first omitted odd power
            // (all sine derivatives have magnitude <= 1). Sine is 1-Lipschitz,
            // so widening by radius also covers every argument in the interval.
            let error = add radius remainder
            maxRational [negate one;subtract sum error],minRational [one;add sum error]

    /// Only disjoint rational enclosures prove an order. Preserve the incoming
    /// expression tree: InnerSimplified can expand innocent sin(pi/18) into
    /// complex cube roots before the inexpensive sine bound gets to see it.
    let trySeparateConstants (left: Entity) (right: Entity) =
        let sqrtBounds bits value =
            if value.Numerator.Sign < 0 then None
            else
                let scale = BigInteger.One <<< bits
                let scaledSquare = value.Numerator*scale*scale
                let quotient = scaledSquare/value.Denominator
                let root = integerSquareRoot quotient
                let lower = createRational root scale
                let upper =
                    if root*root*value.Denominator = scaledSquare then lower
                    else createRational (root+BigInteger.One) scale
                Some (lower,upper)
        let rec bounds bits depth (value: Entity) =
            if depth > 64 then None
            else
                let child = bounds bits (depth+1)
                match value with
                | :? Entity.Number.Rational -> tryParseRational (value.ToString()) |> Option.map (fun rational -> rational,rational)
                | _ when value = piEntity -> Some (piBounds bits)
                | :? Entity.Sumf as sum ->
                    match child sum.Augend,child sum.Addend with
                    | Some (leftLow,leftHigh),Some (rightLow,rightHigh) ->
                        Some (add leftLow rightLow,add leftHigh rightHigh)
                    | _ -> None
                | :? Entity.Minusf as difference ->
                    match child difference.Minuend,child difference.Subtrahend with
                    | Some (leftLow,leftHigh),Some (rightLow,rightHigh) ->
                        Some (subtract leftLow rightHigh,subtract leftHigh rightLow)
                    | _ -> None
                | :? Entity.Mulf as product ->
                    match child product.Multiplier,child product.Multiplicand with
                    | Some leftBounds,Some rightBounds -> Some (multiplyBounds leftBounds rightBounds)
                    | _ -> None
                | :? Entity.Divf as division ->
                    match child division.Dividend,child division.Divisor with
                    | Some numerator,Some (denominatorLow,denominatorHigh)
                        when compareRational denominatorLow zero > 0 || compareRational denominatorHigh zero < 0 ->
                        Some (multiplyBounds numerator (divide one denominatorHigh,divide one denominatorLow))
                    | _ -> None
                | :? Entity.Powf as power ->
                    // A symbolic exponent close to 1/2 can be downcast to that
                    // rational by InnerSimplified. The bound must prove its
                    // exponent using exact arithmetic as well as its base.
                    match proofRational 0 power.Exponent,child power.Base with
                    | Some exponent,Some (baseLow,baseHigh) when exponent = createRational BigInteger.One (BigInteger 2) && compareRational baseLow zero >= 0 ->
                        match sqrtBounds bits baseLow,sqrtBounds bits baseHigh with
                        | Some (low,_),Some (_,high) -> Some (low,high)
                        | _ -> None
                    | Some exponent,Some baseBounds when exponent.Denominator = BigInteger.One && exponent.Numerator > BigInteger.Zero && exponent.Numerator <= BigInteger(32) ->
                        let mutable product = one,one
                        for _ in 1..int exponent.Numerator do product <- multiplyBounds product baseBounds
                        Some product
                    | _ -> None
                | :? Entity.Sinf as sine -> child sine.Argument |> Option.map (sineBounds bits)
                | :? Entity.Cosf as cosine ->
                    child cosine.Argument |> Option.map (fun (low,high) ->
                        let piLow,piHigh = piBounds bits
                        sineBounds bits (add low (divide piLow (ofInt 2)),add high (divide piHigh (ofInt 2))))
                | _ -> None
        if left = right then None
        else
            [32;64;128;256]
            |> List.tryPick (fun bits ->
                match bounds bits 0 left,bounds bits 0 right with
                | Some (_,leftHigh),Some (rightLow,_) when compareRational leftHigh rightLow < 0 -> Some -1
                | Some (leftLow,_),Some (_,rightHigh) when compareRational leftLow rightHigh > 0 -> Some 1
                | _ -> None)

    /// Enclosures reject unequal constants; an overlap never establishes a hit.
    /// Retain symbolic equality for identities and values outside the bounds API.
    let tryCompareConstants (left: Entity) (right: Entity) =
        if left = right then Some 0
        else
            match trySeparateConstants left right with
            | Some value -> Some value
            | None -> if exactEqual left right then Some 0 else None
