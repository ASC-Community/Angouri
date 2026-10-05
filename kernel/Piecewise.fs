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

    let evaluateAt (x: Entity.Variable) point fn =
        let segment = segmentAt point fn
        segment.Expression.Substitute(x,toEntity point).InnerSimplified

    let evaluateSegmentAt (x: Entity.Variable) point segment =
        segment.Expression.Substitute(x,toEntity point).InnerSimplified

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

    let private roundedValue round slope intercept point =
        add (multiply slope point) intercept |> round

    let private integerSequence first last = seq {
        let mutable current = first
        while current <= last do
            yield current
            current <- current + BigInteger.One
    }

    let private partitionSegment (x: Entity.Variable) maxSegments round segment =
        match tryAffine x segment.Expression with
        | None -> Error "Floor and Ceiling currently need a rational straight-line input on every segment."
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

    let private roundFunction x (maxSegments: int) round fn =
        let folder (state: Result<Segment list,string>) (segment: Segment) =
            match state with
            | Error message -> Error message
            | Ok segments ->
                match partitionSegment x maxSegments round segment with
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

    let apply (x: Entity.Variable) maxSegments op fn =
        let half = MathS.FromString("2")
        let oneEntity = MathS.FromString("1")
        match op with
        | "H" -> Ok (mapExpressions (fun expression -> (expression/half).InnerSimplified) fn)
        | "A" -> Ok (mapExpressions (fun expression -> (expression+oneEntity).InnerSimplified) fn)
        | "N" -> Ok (mapExpressions (fun expression -> (-expression).InnerSimplified) fn)
        | "Q" -> Ok (mapExpressions (fun expression -> expression.Pow(half).InnerSimplified) fn)
        | "S" ->
            let template = MathS.FromString("sin(pi*x/2)")
            Ok (mapExpressions (fun expression -> template.Substitute(x,expression).InnerSimplified) fn)
        | "F" -> roundFunction x maxSegments floorRational fn
        | "C" -> roundFunction x maxSegments ceilRational fn
        | "D" when fn.HasRounding -> Error "Find slope cannot follow Floor or Ceiling in the current preview."
        | "D" -> Ok (mapExpressions (fun expression -> expression.Differentiate(x).InnerSimplified) fn)
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
        rightSegment.Expression.Differentiate(x).Substitute(x,toEntity zero).InnerSimplified

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
