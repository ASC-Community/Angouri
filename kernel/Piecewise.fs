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

    let exactEqual (left: Entity) (right: Entity) =
        if left = right then true
        else
            match left,right with
            // These are already exact number nodes. Checking their stored rational
            // values cannot involve AngouriMath's approximate evaluator or numeric
            // downcasting, and structural equality above already handled a match.
            | (:? Entity.Number.Rational),(:? Entity.Number.Rational) -> false
            // Algebraic constants need the full symbolic pass. In particular, do not
            // use Signum().InnerSimplified here: AngouriMath may obtain its integer
            // result by numerically evaluating and tolerance-downcasting the sign.
            | _ -> (left-right).Simplify() = exactZeroEntity

    let tryRationalEntity (value: Entity) =
        value.InnerSimplified.ToString() |> tryParseRational

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

    let apply (x: Entity.Variable) maxSegments op fn =
        let half = MathS.FromString("2")
        let oneEntity = MathS.FromString("1")
        match op with
        | "H" -> Ok (mapExpressions (fun expression -> (expression/half).InnerSimplified) fn)
        | "A" -> Ok (mapExpressions (fun expression -> (expression+oneEntity).InnerSimplified) fn)
        | "N" -> Ok (mapExpressions (fun expression -> -expression) fn)
        | "Q" -> Ok (mapExpressions (fun expression -> expression.Pow(half).InnerSimplified) fn)
        | "S" ->
            let template = MathS.FromString("sin(pi*x/2)")
            Ok (mapExpressions (fun expression -> template.Substitute(x,expression)) fn)
        | "F" -> roundFunction x maxSegments floorRational true fn
        | "C" -> roundFunction x maxSegments ceilRational false fn
        | "D" -> differentiateFunction x fn
        | "I" -> integrateFunction x fn
        | _ -> Error "Unknown operation."

    let rightSlopeAtZero (x: Entity.Variable) fn =
        let rightSegment =
            fn.Segments
            |> List.filter (fun segment -> compareRational segment.Start segment.End < 0 &&
                                           compareRational segment.Start zero <= 0 &&
                                           compareRational segment.End zero > 0)
            |> List.tryHead
            |> Option.orElseWith (fun () ->
                fn.Segments
                |> List.filter (fun segment -> compareRational segment.Start segment.End < 0)
                |> List.sortWith (fun left right -> compareRational left.Start right.Start)
                |> List.tryHead)
            |> Option.defaultWith (fun () -> invalidOp "The construction has no right-hand interval at zero.")
        // With no subsequent integral or derivative, compositions of these
        // rounding nodes are locally constant on the right of the endpoint.
        if hasSymbolicRounding rightSegment.Expression then exactZeroEntity
        else rightSegment.Expression.Differentiate(x).Substitute(x,toEntity zero).InnerSimplified

    let segmentConditionLatex segment =
        let startRelation = if segment.StartClosed then "\\le" else "<"
        let endRelation = if segment.EndClosed then "\\le" else "<"
        if compareRational segment.Start segment.End = 0 then
            sprintf "x = %s" ((toEntity segment.Start).Latexize())
        else
            sprintf "%s %s x %s %s"
                ((toEntity segment.Start).Latexize()) startRelation endRelation ((toEntity segment.End).Latexize())

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
            |> List.map (fun segment -> segment,segment.Expression.Simplify())
        let simplifiedFunction =
            { fn with Segments=segments |> List.map (fun (segment,simplified) -> { segment with Expression=simplified }) }
        match segments with
        | [(segment,simplified)] when compareRational segment.Start segment.End < 0 ->
            { Simplified=simplifiedFunction; ExpressionText=simplified.ToString(); Latex=simplified.Latexize() }
        | segments ->
            let expressionText =
                segments
                |> List.map (fun (segment,simplified) -> sprintf "%s for %s" (simplified.ToString()) (segmentConditionLatex segment))
                |> String.concat "; "
                |> sprintf "piecewise(%s)"
            let rows =
                segments
                |> List.map (fun (segment,simplified) -> sprintf "%s & %s" (simplified.Latexize()) (segmentConditionLatex segment))
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
