import React, { useRef, useState, type ReactElement } from "react";
import { StackLayout } from "@/components/layouts";
import { Block } from "@/components/templates";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeChoice,
    InlineClozeInput,
    InlineFeedback,
    InlineFormula,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InlineTrigger,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, useSpring } from "@/lib/motion";
import {
    ACCENT,
    ACCENT_SOFT,
    INK,
    INK_QUIET,
    INK_STRUCTURE,
    OUTPUT_HUE,
    PREDICTION_HUE,
    PREDICTION_SOFT,
    bitsToString,
    outputBit,
    periodOf,
    statesFrom,
    type Bits,
} from "./lfsrModel";
import {
    choicePropsFromDefinition,
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
    numberPropsFromDefinition,
} from "../variables";

// ── View geometry ───────────────────────────────────────────────────────────

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 320;

const LAST_TICK = 16;
const COL_LEFT = 40;
const COL_PITCH = 28;
const COL_WIDTH = 20;
const CELL_HEIGHT = 15;
const TRAIL_TOP = 118;
const TRAIL_BOTTOM = TRAIL_TOP + 4 * CELL_HEIGHT;

const colX = (tick: number): number => COL_LEFT + tick * COL_PITCH + COL_WIDTH / 2;

const CYCLE_SEED: Bits = [1, 0, 0, 1];
const CYCLE_STATES = statesFrom(CYCLE_SEED, LAST_TICK);
const CYCLE_PERIOD = periodOf(CYCLE_SEED);

// ── The bespoke drawing ─────────────────────────────────────────────────────

function StateTrailDrawing() {
    const setVar = useSetVar();
    const reveal = useVar<number>("cycleReveal", 0);
    const prediction = useVar<number>("cyclePrediction", 6);
    const highlight = useVar<string>("cycleHighlight", "");

    const [dragging, setDragging] = useState<"scrubber" | "flag" | null>(null);
    const [hovered, setHovered] = useState<"scrubber" | "flag" | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const scrubberX = useSpring(colX(reveal), { stiffness: 320, damping: 30 });
    const flagX = useSpring(colX(prediction), { stiffness: 320, damping: 30 });
    const knobScale = useSpring(dragging === "scrubber" || hovered === "scrubber" ? 1.15 : 1, {
        stiffness: 400,
        damping: 26,
    });
    const flagScale = useSpring(dragging === "flag" || hovered === "flag" ? 1.15 : 1, {
        stiffness: 400,
        damping: 26,
    });

    const found = reveal >= CYCLE_PERIOD;
    const opacityFor = (id: string) => (highlight && highlight !== id ? 0.38 : 1);
    const isOn = (id: string) => highlight === id;
    const ease = { transition: "opacity 150ms ease-out, stroke-width 150ms ease-out" };
    const hoverProps = (id: string) => ({
        onPointerEnter: () => setVar("cycleHighlight", id),
        onPointerLeave: () => setVar("cycleHighlight", ""),
    });

    const tickFromEvent = (event: React.PointerEvent) => {
        const svg = svgRef.current;
        if (!svg) return 0;
        const rect = svg.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
        return Math.round((x - COL_LEFT - COL_WIDTH / 2) / COL_PITCH);
    };

    const startDrag = (which: "scrubber" | "flag") => (event: React.PointerEvent<SVGCircleElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(which);
    };

    const moveDrag = (which: "scrubber" | "flag") => (event: React.PointerEvent<SVGCircleElement>) => {
        if (dragging !== which) return;
        const tick = tickFromEvent(event);
        if (which === "scrubber") setVar("cycleReveal", clamp(tick, 0, LAST_TICK));
        else setVar("cyclePrediction", clamp(tick, 1, LAST_TICK));
    };

    const endDrag = () => setDragging(null);

    const currentState = CYCLE_STATES[clamp(reveal, 0, LAST_TICK)];

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full"
            role="img"
            aria-label="A trail of register patterns, one column per clock tick"
        >
            <defs>
                <filter id="lfsr-cycle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Readouts above the drawing surface */}
            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums" }} opacity={opacityFor("readout")}>
                <text x="24" y="40" fill={INK}>{`seed ${bitsToString(CYCLE_SEED)}`}</text>
                <text x={VIEW_WIDTH - 24} y="40" fill={INK} textAnchor="end">
                    {`tick ${reveal} · ${bitsToString(currentState)}`}
                </text>
            </g>

            {/* Tick numbers along the top of the trail */}
            <g opacity={opacityFor("trail")} style={ease}>
                {[5, 10, 15].map((tick) => (
                    <text
                        key={tick}
                        x={colX(tick)}
                        y={TRAIL_TOP - 12}
                        fill={INK_STRUCTURE}
                        fontSize="10"
                        textAnchor="middle"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                        {tick}
                    </text>
                ))}
            </g>

            {/* The state trail: one column of four bits per tick */}
            {CYCLE_STATES.map((state, tick) => {
                const shown = tick <= reveal;
                const isSeedColumn = tick === 0;
                const isRepeatColumn = found && tick === CYCLE_PERIOD;
                const groupId = isSeedColumn ? "seed" : "trail";
                const marked = (isSeedColumn || isRepeatColumn) && shown;
                return (
                    <g
                        key={tick}
                        opacity={opacityFor(groupId)}
                        style={ease}
                        {...(isSeedColumn ? hoverProps("seed") : {})}
                    >
                        {isOn("seed") && isSeedColumn && (
                            <rect
                                x={colX(tick) - COL_WIDTH / 2 - 6}
                                y={TRAIL_TOP - 6}
                                width={COL_WIDTH + 12}
                                height={4 * CELL_HEIGHT + 12}
                                rx="8"
                                fill="none"
                                stroke={ACCENT}
                                strokeWidth="9"
                                opacity="0.28"
                            />
                        )}
                        {marked && (
                            <rect
                                x={colX(tick) - COL_WIDTH / 2 - 4}
                                y={TRAIL_TOP - 4}
                                width={COL_WIDTH + 8}
                                height={4 * CELL_HEIGHT + 8}
                                rx="6"
                                fill="none"
                                stroke={ACCENT}
                                strokeWidth={isOn("seed") && isSeedColumn ? 4 : 2.5}
                                opacity="0.95"
                                style={{ transition: "stroke-width 150ms ease-out" }}
                            />
                        )}
                        {state.map((bit, row) => (
                            <rect
                                key={row}
                                x={colX(tick) - COL_WIDTH / 2}
                                y={TRAIL_TOP + row * CELL_HEIGHT}
                                width={COL_WIDTH}
                                height={CELL_HEIGHT}
                                fill={shown && bit === 1 ? ACCENT : "#FFFFFF"}
                                stroke={shown ? INK_STRUCTURE : INK_QUIET}
                                strokeWidth="1.5"
                                strokeDasharray={shown ? undefined : "3 3"}
                                opacity={shown ? 1 : 0.6}
                                style={{ transition: "fill 150ms ease-out, opacity 150ms ease-out" }}
                            />
                        ))}
                        {tick < reveal && (
                            <text
                                x={colX(tick)}
                                y={TRAIL_BOTTOM + 20}
                                fill={OUTPUT_HUE}
                                fontSize="12"
                                fontWeight="700"
                                textAnchor="middle"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                                {outputBit(state)}
                            </text>
                        )}
                    </g>
                );
            })}

            <text
                x={colX(0)}
                y={TRAIL_TOP - 12}
                fill={INK}
                fontSize="10"
                textAnchor="middle"
                opacity={opacityFor("seed")}
                style={ease}
            >
                seed
            </text>

            <text
                x={24}
                y={TRAIL_BOTTOM + 20}
                fill={INK_STRUCTURE}
                fontSize="10"
                textAnchor="start"
                opacity={reveal > 0 ? opacityFor("trail") : 0}
                style={ease}
            >
                out
            </text>

            {/* The prediction flag — the student's guess, in the second accent */}
            <g opacity={opacityFor("flag")} style={ease} {...hoverProps("flag")}>
                <line
                    x1={flagX}
                    y1={90}
                    x2={flagX}
                    y2={TRAIL_BOTTOM + 6}
                    stroke={PREDICTION_HUE}
                    strokeWidth={isOn("flag") ? 3 : 2}
                    strokeDasharray="4 5"
                    strokeLinecap="round"
                    opacity="0.8"
                />
                <g transform={`translate(${flagX} 76) scale(${flagScale})`}>
                    <path
                        d="M 0 -14 L 20 -7 L 0 0 Z"
                        fill={PREDICTION_HUE}
                        filter="url(#lfsr-cycle-shadow)"
                    />
                    <line x1="0" y1="-16" x2="0" y2="14" stroke={PREDICTION_HUE} strokeWidth="3" strokeLinecap="round" />
                </g>
                <circle
                    cx={flagX}
                    cy={76}
                    r="22"
                    fill="transparent"
                    style={{ cursor: dragging === "flag" ? "grabbing" : "grab", touchAction: "none" }}
                    onPointerDown={startDrag("flag")}
                    onPointerMove={moveDrag("flag")}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerEnter={() => setHovered("flag")}
                    onPointerLeave={() => setHovered(null)}
                />
                <text
                    x={prediction > 12 ? flagX - 8 : flagX + 26}
                    y={70}
                    fill={PREDICTION_HUE}
                    fontSize="10"
                    textAnchor={prediction > 12 ? "end" : "start"}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {`your guess: tick ${prediction}`}
                </text>
            </g>

            {/* The scrubber — drag right to reveal the trail tick by tick */}
            <g opacity={opacityFor("trail")} style={ease}>
                <line
                    x1={scrubberX}
                    y1={TRAIL_TOP - 6}
                    x2={scrubberX}
                    y2={233}
                    stroke={ACCENT}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />
                <g transform={`translate(${scrubberX} 246) scale(${knobScale})`}>
                    <circle r="13" fill={ACCENT} filter="url(#lfsr-cycle-shadow)" />
                </g>
                <circle
                    cx={scrubberX}
                    cy={246}
                    r="24"
                    fill="transparent"
                    style={{ cursor: dragging === "scrubber" ? "grabbing" : "grab", touchAction: "none" }}
                    onPointerDown={startDrag("scrubber")}
                    onPointerMove={moveDrag("scrubber")}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerEnter={() => setHovered("scrubber")}
                    onPointerLeave={() => setHovered(null)}
                />
            </g>

            {/* The closing bracket, drawn only once the seed pattern has come back */}
            {found && (
                <g opacity={opacityFor("trail")} style={ease}>
                    <path
                        d={`M ${colX(0)} 278 V 288 H ${colX(CYCLE_PERIOD)} V 278`}
                        fill="none"
                        stroke={ACCENT}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <text
                        x={(colX(0) + colX(CYCLE_PERIOD)) / 2}
                        y={306}
                        fill={INK}
                        fontSize="12"
                        textAnchor="middle"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                        {`the seed is back after ${CYCLE_PERIOD} ticks`}
                    </text>
                </g>
            )}
        </svg>
    );
}

function StateTrailFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="lfsr-state-trail"
            onReset={() => {
                setVar("cycleReveal", 0);
                setVar("cyclePrediction", 6);
                setVar("cycleHighlight", "");
            }}
            caption="Each column is the four-bit pattern after that tick, filled squares for ones. Put the indigo flag where you think the seed returns, then pull the teal scrubber to the right."
        >
            <StateTrailDrawing />
            <InteractionHintSequence
                hintKey="lfsr-state-trail-scrub"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Place the indigo flag on your predicted tick",
                        position: { x: "37%", y: "24%" },
                        dragPath: {
                            type: "line",
                            startOffset: { x: -20, y: 0 },
                            endOffset: { x: 40, y: 0 },
                        },
                    },
                    {
                        gesture: "drag-horizontal",
                        label: "Pull the teal scrubber right to reveal the columns",
                        position: { x: "12%", y: "77%" },
                        dragPath: {
                            type: "line",
                            startOffset: { x: -10, y: 0 },
                            endOffset: { x: 60, y: 0 },
                        },
                    },
                ]}
            />
        </Figure>
    );
}

export const lfsrPeriodBlocks: ReactElement[] = [
    <StackLayout key="layout-lfsr-cycle-heading" maxWidth="xl">
        <Block id="lfsr-cycle-heading" padding="md">
            <EditableH2 id="h2-lfsr-cycle-heading" blockId="lfsr-cycle-heading">
                It Always Comes Back Around
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-cycle-setup" maxWidth="xl">
        <Block id="lfsr-cycle-setup" padding="sm">
            <EditableParagraph id="para-lfsr-cycle-setup" blockId="lfsr-cycle-setup">
                The stream looks random, but four cells only have sixteen possible patterns, and
                all zeros would lock the register up forever. So the run cannot be endless: sooner
                or later a pattern must come round again, and from that moment everything repeats
                exactly. Before you reveal anything, drag the indigo flag to the tick where you
                think{" "}
                <InlineLinkedHighlight
                    id="link-lfsr-cycle-seed"
                    varName="cycleHighlight"
                    highlightId="seed"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("cycleHighlight"))}
                >
                    the seed column
                </InlineLinkedHighlight>{" "}
                comes back, then pull the teal scrubber right and watch the columns fill in.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-cycle-figure" maxWidth="xl">
        <Block id="lfsr-cycle-figure" padding="sm" hasVisualization>
            <StateTrailFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-cycle-reflect" maxWidth="xl">
        <Block id="lfsr-cycle-reflect" padding="sm">
            <EditableParagraph id="para-lfsr-cycle-reflect" blockId="lfsr-cycle-reflect">
                <InlineLinkedHighlight
                    id="link-lfsr-cycle-flag"
                    varName="cycleHighlight"
                    highlightId="flag"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("cycleHighlight"))}
                    color={PREDICTION_HUE}
                    bgColor={PREDICTION_SOFT}
                >
                    Your flag
                </InlineLinkedHighlight>{" "}
                sits at tick{" "}
                <InlineScrubbleNumber
                    varName="cyclePrediction"
                    {...numberPropsFromDefinition(getVariableInfo("cyclePrediction"))}
                />
                . The pattern itself returns at{" "}
                <InlineTrigger
                    id="trigger-lfsr-cycle-return-tick"
                    varName="cycleReveal"
                    value={15}
                    color={ACCENT}
                    bgColor={ACCENT_SOFT}
                >
                    tick 15
                </InlineTrigger>
                , having visited every state except all zeros, each one exactly once. Four cells
                can therefore never yield more than{" "}
                <InlineFormula
                    id="formula-lfsr-cycle-reflect-maximum"
                    latex="2^4 - 1 = \clr{period}{15}"
                    colorMap={{ period: ACCENT }}
                />{" "}
                bits before repeating, and choosing taps that reach that maximum is the whole
                design problem.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-cycle-question-length" maxWidth="xl">
        <Block id="lfsr-cycle-question-length" padding="sm">
            <EditableParagraph id="para-lfsr-cycle-question-length" blockId="lfsr-cycle-question-length">
                Add a fifth cell and the same argument applies. The longest run of bits such a
                register could ever produce before repeating is{" "}
                <InlineFeedback
                    varName="answer_period_length"
                    correctValue="31"
                    position="terminal"
                    successMessage="— exactly, two to the fifth is 32 patterns and all zeros is the one it can never use"
                    failureMessage="— close, but count again."
                    hint="Count every pattern five cells can hold, then take away the one that locks the register up"
                >
                    <InlineClozeInput
                        varName="answer_period_length"
                        correctAnswer="31"
                        {...clozePropsFromDefinition(getVariableInfo("answer_period_length"))}
                    />
                </InlineFeedback>
                .
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-cycle-question-character" maxWidth="xl">
        <Block id="lfsr-cycle-question-character" padding="sm">
            <EditableParagraph id="para-lfsr-cycle-question-character" blockId="lfsr-cycle-question-character">
                Which means that, however scrambled it looks, the bit stream leaving an LFSR is{" "}
                <InlineFeedback
                    varName="answer_period_character"
                    correctValue="repeating with a fixed period"
                    position="terminal"
                    successMessage="— yes, and that is why the word pseudo is doing so much work in pseudo-random"
                    failureMessage="— look at the trail once more."
                    hint="A finite register has finitely many patterns, so one of them has to come round again"
                    visualizationHint={{
                        blockId: "lfsr-cycle-figure",
                        hintKey: "lfsr-cycle-repeat-hint",
                        label: "Discover it yourself",
                        resetVars: { cycleReveal: 0, cycleHighlight: "" },
                        steps: [
                            {
                                gesture: "drag-horizontal",
                                label: "Pull the scrubber past tick 15 and compare that column with the seed",
                                position: { x: "12%", y: "77%" },
                                completionVar: "cycleReveal",
                                completionValue: 16,
                                completionTolerance: 1,
                            },
                        ],
                    }}
                >
                    <InlineClozeChoice
                        varName="answer_period_character"
                        correctAnswer="repeating with a fixed period"
                        options={[
                            "truly random and never repeating",
                            "repeating with a fixed period",
                            "the same bit forever",
                        ]}
                        {...choicePropsFromDefinition(getVariableInfo("answer_period_character"))}
                    />
                </InlineFeedback>
                .
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
