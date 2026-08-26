import React, { useRef, useState, type ReactElement } from "react";
import { StackLayout } from "@/components/layouts";
import { Block } from "@/components/templates";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineLinkedHighlight,
    InlineScrubbleNumber,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, damp, useRafLoop } from "@/lib/motion";
import {
    ACCENT,
    INK,
    INK_QUIET,
    INK_STRUCTURE,
    bitsToString,
    feedbackBit,
    outputsFrom,
    statesFrom,
    type Bits,
} from "./lfsrModel";
import {
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
    numberPropsFromDefinition,
} from "../variables";

// ── View geometry ───────────────────────────────────────────────────────────

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 320;

const MAX_TICKS = 10;

const REG_LEFT = 46;
const REG_PITCH = 46;
const REG_CELL = 40;
const REG_TOP = 92;
const REG_MID = REG_TOP + REG_CELL / 2;

/** Centre x of register slot `v` (0 = feedback entry, 1..4 = cells, 5 = exit). */
const regX = (v: number): number => REG_LEFT + v * REG_PITCH + REG_CELL / 2;

const TAPE_LEFT = 44;
const TAPE_PITCH = 46;
const TAPE_CELL = 34;
const TAPE_TOP = 232;
const tapeX = (index: number): number => TAPE_LEFT + index * TAPE_PITCH + TAPE_CELL / 2;

const XOR_CENTRE = { x: 200, y: 176 };

const DEFAULT_SEED: Bits = [1, 0, 0, 1];

// ── The bespoke drawing ─────────────────────────────────────────────────────

function OutputTraceDrawing() {
    const setVar = useSetVar();
    const seed = useVar<number[]>("traceSeedBits", DEFAULT_SEED);
    const ticks = useVar<number>("traceTicks", 0);
    const highlight = useVar<string>("traceHighlight", "");

    const [drag, setDrag] = useState<{ startX: number; base: number } | null>(null);
    const [raw, setRaw] = useState<number | null>(null);
    const [hovered, setHovered] = useState(false);
    const [display, setDisplay] = useState(0);
    const svgRef = useRef<SVGSVGElement>(null);

    // One continuous position drives the whole drawing: `display` follows the
    // pointer 1:1 while dragging and eases to the committed tick on release.
    const goal = raw ?? ticks;
    useRafLoop(
        (dt) => {
            setDisplay((current) => damp(current, goal, drag ? 40 : 14, dt));
        },
        { paused: Math.abs(display - goal) < 0.0005 && !drag },
    );

    const position = clamp(display, 0, MAX_TICKS);
    const step = Math.min(Math.floor(position), MAX_TICKS - 1);
    const frac = clamp(position - step, 0, 1);
    const states = statesFrom(seed, MAX_TICKS);
    const current = states[step];
    const feedback = feedbackBit(current);
    const tape = outputsFrom(seed, MAX_TICKS);

    const opacityFor = (id: string) => (highlight && highlight !== id ? 0.38 : 1);
    const isOn = (id: string) => highlight === id;
    const ease = { transition: "opacity 150ms ease-out, stroke-width 150ms ease-out" };
    const hoverProps = (id: string) => ({
        onPointerEnter: () => setVar("traceHighlight", id),
        onPointerLeave: () => setVar("traceHighlight", ""),
    });

    const pointerX = (event: React.PointerEvent) => {
        const svg = svgRef.current;
        if (!svg) return 0;
        const rect = svg.getBoundingClientRect();
        return ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    };

    const handlePointerDown = (event: React.PointerEvent<SVGRectElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({ startX: pointerX(event), base: ticks });
        setRaw(ticks);
    };

    const handlePointerMove = (event: React.PointerEvent<SVGRectElement>) => {
        if (!drag) return;
        const pulled = (pointerX(event) - drag.startX) / REG_PITCH;
        setRaw(clamp(drag.base + pulled, 0, MAX_TICKS));
    };

    const flipSeedBit = (index: number) => {
        const flipped = seed.map((bit, i) => (i === index ? (bit === 1 ? 0 : 1) : bit));
        setVar("traceSeedBits", flipped);
        setVar("traceTicks", 0);
    };

    const handlePointerUp = () => {
        if (raw !== null && drag !== null) {
            // A press with no travel is a click on cell 4, not a pull.
            if (Math.abs(raw - drag.base) < 0.06) flipSeedBit(3);
            else setVar("traceTicks", clamp(Math.round(raw), 0, MAX_TICKS));
        }
        setDrag(null);
        setRaw(null);
    };

    const handleGrabX = regX(4 + frac);
    const revealed = Math.round(position);

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full"
            role="img"
            aria-label="A four cell shift register above a tape collecting its output bits"
        >
            <defs>
                <filter id="lfsr-trace-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Readouts above the drawing surface */}
            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums" }} opacity={opacityFor("seedRow")}>
                <text x="24" y="46" fill={INK}>{`seed ${bitsToString(seed)}`}</text>
                <text x={VIEW_WIDTH - 24} y="46" fill={INK} textAnchor="end">
                    {`ticks pulled ${revealed}`}
                </text>
            </g>

            {/* Feedback entry slot */}
            <rect
                x={regX(0) - REG_CELL / 2}
                y={REG_TOP}
                width={REG_CELL}
                height={REG_CELL}
                rx="6"
                fill="#FFFFFF"
                stroke={INK_QUIET}
                strokeWidth="2"
                strokeDasharray="5 5"
                opacity={opacityFor("register")}
                style={ease}
            />
            <text
                x={regX(0)}
                y={REG_TOP - 12}
                fill={INK}
                fontSize="11"
                textAnchor="middle"
                opacity={opacityFor("register")}
                style={ease}
            >
                feedback
            </text>

            {/* The four cells — click one to flip that bit of the seed */}
            {[1, 2, 3, 4].map((cellIndex) => (
                <g key={cellIndex} opacity={opacityFor("register")} style={ease}>
                    <rect
                        x={regX(cellIndex) - REG_CELL / 2}
                        y={REG_TOP}
                        width={REG_CELL}
                        height={REG_CELL}
                        rx="6"
                        fill="#FFFFFF"
                        stroke={INK_STRUCTURE}
                        strokeWidth="2"
                        style={{ cursor: "pointer" }}
                        onClick={() => flipSeedBit(cellIndex - 1)}
                    />
                    <text x={regX(cellIndex)} y={REG_TOP - 12} fill={INK} fontSize="11" textAnchor="middle">
                        {`cell ${cellIndex}`}
                    </text>
                </g>
            ))}

            {/* Exit slot */}
            <g opacity={opacityFor("exit")} style={ease} {...hoverProps("exit")}>
                {isOn("exit") && (
                    <rect
                        x={regX(5) - REG_CELL / 2 - 3}
                        y={REG_TOP - 3}
                        width={REG_CELL + 6}
                        height={REG_CELL + 6}
                        rx="9"
                        fill="none"
                        stroke={INK_STRUCTURE}
                        strokeWidth="9"
                        opacity="0.28"
                    />
                )}
                <rect
                    x={regX(5) - REG_CELL / 2}
                    y={REG_TOP}
                    width={REG_CELL}
                    height={REG_CELL}
                    rx="6"
                    fill="#FFFFFF"
                    stroke={INK_STRUCTURE}
                    strokeWidth={isOn("exit") ? 3 : 2}
                    strokeDasharray="5 5"
                />
                <text x={regX(5)} y={REG_TOP - 12} fill={INK} fontSize="11" textAnchor="middle">
                    output
                </text>
            </g>

            {/* Tap wires and the XOR gate */}
            <g opacity={opacityFor("register")} style={ease}>
                <path
                    d={`M ${regX(3)} ${REG_TOP + REG_CELL} V 158 H ${XOR_CENTRE.x} M ${regX(4)} ${REG_TOP + REG_CELL} V 158 H ${XOR_CENTRE.x} M ${XOR_CENTRE.x} 158 V ${XOR_CENTRE.y - 14}`}
                    fill="none"
                    stroke={INK_STRUCTURE}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle cx={XOR_CENTRE.x} cy={XOR_CENTRE.y} r="14" fill="#FFFFFF" stroke={INK_STRUCTURE} strokeWidth="2" />
                <path
                    d={`M ${XOR_CENTRE.x - 7} ${XOR_CENTRE.y} H ${XOR_CENTRE.x + 7} M ${XOR_CENTRE.x} ${XOR_CENTRE.y - 7} V ${XOR_CENTRE.y + 7}`}
                    stroke={INK_STRUCTURE}
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                <path
                    d={`M ${XOR_CENTRE.x - 14} ${XOR_CENTRE.y} H ${regX(0)} V ${REG_TOP + REG_CELL + 6}`}
                    fill="none"
                    stroke={ACCENT}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>

            {/* The four bits in the register, sliding one slot per tick */}
            {current.map((bit, index) => (
                <text
                    key={`bit-${index}`}
                    x={regX(index + 1 + frac)}
                    y={REG_MID + 7}
                    fill={INK}
                    fontSize="20"
                    textAnchor="middle"
                    opacity={(index === 3 ? 1 - frac * 0.8 : 1) * opacityFor(index === 3 ? "exit" : "register")}
                    style={{ ...ease, fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}
                >
                    {bit}
                </text>
            ))}

            {/* The feedback bit entering from the left — the accent element */}
            <g opacity={opacityFor("register")} style={ease}>
                <rect
                    x={regX(frac) - 15}
                    y={REG_MID - 15}
                    width="30"
                    height="30"
                    rx="6"
                    fill={ACCENT}
                    opacity={0.25 + 0.75 * frac}
                />
                <text
                    x={regX(frac)}
                    y={REG_MID + 6}
                    fill="#FFFFFF"
                    fontSize="18"
                    textAnchor="middle"
                    opacity={0.25 + 0.75 * frac}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {feedback}
                </text>
            </g>

            {/* The grab handle: the bit on its way out of cell 4 */}
            {position < MAX_TICKS && (
                <>
                    <rect
                        x={handleGrabX - 21}
                        y={REG_MID - 21}
                        width="42"
                        height="42"
                        rx="8"
                        fill="none"
                        stroke={ACCENT}
                        strokeWidth={drag || hovered ? 3.5 : 2.5}
                        filter={drag || hovered ? "url(#lfsr-trace-shadow)" : undefined}
                        style={{ transition: "stroke-width 150ms ease-out", pointerEvents: "none" }}
                        opacity={opacityFor("exit")}
                    />
                    <rect
                        x={handleGrabX - 24}
                        y={REG_MID - 24}
                        width="48"
                        height="48"
                        fill="transparent"
                        style={{ cursor: drag ? "grabbing" : "grab", touchAction: "none" }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onPointerEnter={() => setHovered(true)}
                        onPointerLeave={() => setHovered(false)}
                    />
                </>
            )}

            {/* The output tape */}
            <g opacity={opacityFor("tape")} style={ease} {...hoverProps("tape")}>
                <text x={TAPE_LEFT} y={TAPE_TOP - 14} fill={INK} fontSize="11">
                    output so far, oldest bit first
                </text>
                {tape.map((bit, index) => {
                    const filled = index < step ? 1 : index === step ? frac : 0;
                    return (
                        <g key={`tape-${index}`}>
                            {isOn("tape") && filled > 0.5 && (
                                <rect
                                    x={tapeX(index) - TAPE_CELL / 2 - 3}
                                    y={TAPE_TOP - 3}
                                    width={TAPE_CELL + 6}
                                    height={TAPE_CELL + 6}
                                    rx="9"
                                    fill="none"
                                    stroke={INK_STRUCTURE}
                                    strokeWidth="9"
                                    opacity="0.28"
                                />
                            )}
                            <rect
                                x={tapeX(index) - TAPE_CELL / 2}
                                y={TAPE_TOP}
                                width={TAPE_CELL}
                                height={TAPE_CELL}
                                rx="5"
                                fill="#FFFFFF"
                                stroke={filled > 0.5 ? INK_STRUCTURE : INK_QUIET}
                                strokeWidth={filled > 0.5 && isOn("tape") ? 3 : 2}
                                strokeDasharray={filled > 0.5 ? undefined : "4 4"}
                            />
                            <text
                                x={tapeX(index)}
                                y={TAPE_TOP + 24}
                                fill={INK}
                                fontSize="18"
                                textAnchor="middle"
                                opacity={filled}
                                style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                                {bit}
                            </text>
                            <text
                                x={tapeX(index)}
                                y={TAPE_TOP + TAPE_CELL + 20}
                                fill={INK_STRUCTURE}
                                fontSize="10"
                                textAnchor="middle"
                                opacity={filled > 0.5 ? 1 : 0.5}
                                style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                                {index + 1}
                            </text>
                        </g>
                    );
                })}
            </g>
        </svg>
    );
}

function OutputTraceFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="lfsr-output-trace"
            onReset={() => {
                setVar("traceSeedBits", DEFAULT_SEED);
                setVar("traceTicks", 0);
                setVar("traceHighlight", "");
            }}
            caption="Grab the bit in cell 4 and pull it to the right to clock the register once. Click any cell to flip that bit of the seed and start the tape again."
        >
            <OutputTraceDrawing />
            <InteractionHintSequence
                hintKey="lfsr-output-trace-pull"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Pull the bit out of cell 4",
                        position: { x: "47%", y: "36%" },
                        dragPath: {
                            type: "line",
                            startOffset: { x: -12, y: 0 },
                            endOffset: { x: 34, y: 0 },
                        },
                    },
                ]}
            />
        </Figure>
    );
}

export const lfsrOutputSequenceBlocks: ReactElement[] = [
    <StackLayout key="layout-lfsr-trace-heading" maxWidth="xl">
        <Block id="lfsr-trace-heading" padding="md">
            <EditableH2 id="h2-lfsr-trace-heading" blockId="lfsr-trace-heading">
                Reading the Output Sequence
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-trace-setup" maxWidth="xl">
        <Block id="lfsr-trace-setup" padding="sm">
            <EditableParagraph id="para-lfsr-trace-setup" blockId="lfsr-trace-setup">
                One tick gives one output bit. Repeat the tick and those bits line up into a
                sequence, which is all a pseudo-random bit stream really is. Grab the bit sitting in
                cell 4 and pull it to the right:{" "}
                <InlineLinkedHighlight
                    id="link-lfsr-trace-exit"
                    varName="traceHighlight"
                    highlightId="exit"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("traceHighlight"))}
                >
                    it leaves the register
                </InlineLinkedHighlight>
                , lands on the tape below, and everything else slides across behind it. Click any
                cell to flip that bit of the seed and start again.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-trace-figure" maxWidth="xl">
        <Block id="lfsr-trace-figure" padding="sm" hasVisualization>
            <OutputTraceFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-trace-reflect" maxWidth="xl">
        <Block id="lfsr-trace-reflect" padding="sm">
            <EditableParagraph id="para-lfsr-trace-reflect" blockId="lfsr-trace-reflect">
                The{" "}
                <InlineLinkedHighlight
                    id="link-lfsr-trace-tape"
                    varName="traceHighlight"
                    highlightId="tape"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("traceHighlight"))}
                >
                    tape
                </InlineLinkedHighlight>{" "}
                holds{" "}
                <InlineScrubbleNumber
                    varName="traceTicks"
                    {...numberPropsFromDefinition(getVariableInfo("traceTicks"))}
                />{" "}
                bits so far. The first four carry no new information: that is the seed itself
                walking out, right-hand cell first. Only from the fifth tick does the XOR gate
                contribute bits the seed never held, and that is where the stream stops being
                readable by eye.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-trace-question-fifth" maxWidth="xl">
        <Block id="lfsr-trace-question-fifth" padding="sm">
            <EditableParagraph id="para-lfsr-trace-question-fifth" blockId="lfsr-trace-question-fifth">
                Starting from the seed 1001, the fifth bit to land on the tape is{" "}
                <InlineFeedback
                    varName="answer_trace_fifth_bit"
                    correctValue="1"
                    position="terminal"
                    successMessage="— yes, and it is the first bit the XOR gate actually invented"
                    failureMessage="— have another look."
                    hint="The first four bits are the seed leaving; the fifth is whatever the gate fed back in on tick one"
                    reviewBlockId="lfsr-trace-figure"
                    reviewLabel="Pull the bits out again"
                >
                    <InlineClozeInput
                        varName="answer_trace_fifth_bit"
                        correctAnswer="1"
                        {...clozePropsFromDefinition(getVariableInfo("answer_trace_fifth_bit"))}
                    />
                </InlineFeedback>
                .
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-trace-question-zero" maxWidth="xl">
        <Block id="lfsr-trace-question-zero" padding="sm">
            <EditableParagraph id="para-lfsr-trace-question-zero" blockId="lfsr-trace-question-zero">
                A seed with a single 1 in it behaves quite differently. Set the seed to 1000, pull
                three bits, and the tape reads{" "}
                <InlineFeedback
                    varName="answer_trace_zero_seed"
                    correctValue={["000", "0 0 0"]}
                    position="terminal"
                    successMessage="— correct, the lone 1 is still walking towards the exit and the taps have only zeros to work with"
                    failureMessage="— not quite."
                    hint="Ask which cell each of the first three output bits comes from, and what that cell holds in 1000"
                    visualizationHint={{
                        blockId: "lfsr-trace-figure",
                        hintKey: "lfsr-trace-zero-seed-hint",
                        label: "Discover it yourself",
                        resetVars: { traceTicks: 0, traceHighlight: "" },
                        steps: [
                            {
                                gesture: "click",
                                label: "Click cell 4 so the seed reads 1000",
                                position: { x: "45%", y: "36%" },
                            },
                            {
                                gesture: "drag-horizontal",
                                label: "Pull three bits out and read the tape",
                                position: { x: "47%", y: "36%" },
                                completionVar: "traceTicks",
                                completionValue: 3,
                                completionTolerance: 0,
                            },
                        ],
                    }}
                >
                    <InlineClozeInput
                        varName="answer_trace_zero_seed"
                        correctAnswer={["000", "0 0 0"]}
                        {...clozePropsFromDefinition(getVariableInfo("answer_trace_zero_seed"))}
                    />
                </InlineFeedback>
                .
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
