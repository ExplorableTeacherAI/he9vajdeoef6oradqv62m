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
    InlineTooltip,
    InlineTrigger,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { clamp, damp, useRafLoop } from "@/lib/motion";
import {
    FEEDBACK_HUE,
    INK,
    INK_QUIET,
    INK_STRUCTURE,
    OUTPUT_HUE,
    OUTPUT_SOFT,
    TAP_HUE,
    TOOLTIP_HUE,
    TOOLTIP_SOFT,
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
const VIEW_HEIGHT = 344;

const MAX_TICKS = 10;

const REG_LEFT = 46;
const REG_PITCH = 46;
const REG_CELL = 40;
const REG_TOP = 84;
const REG_MID = REG_TOP + REG_CELL / 2;

/** Centre x of register slot `v` (0 = feedback entry, 1..4 = cells, 5 = exit). */
const regX = (v: number): number => REG_LEFT + v * REG_PITCH + REG_CELL / 2;

const TAPE_LEFT = 44;
const TAPE_PITCH = 46;
const TAPE_CELL = 34;
const TAPE_TOP = 250;
const TAPE_MID = TAPE_TOP + TAPE_CELL / 2;
const tapeX = (index: number): number => TAPE_LEFT + index * TAPE_PITCH + TAPE_CELL / 2;

const XOR_CENTRE = { x: 227, y: 48 };

const DEFAULT_SEED: Bits = [1, 0, 0, 1];

type Point = { x: number; y: number };

/** Point on the quadratic chute that carries the bit from the exit to the tape. */
const chutePoint = (t: number, from: Point, control: Point, to: Point): Point => {
    const inv = 1 - t;
    return {
        x: inv * inv * from.x + 2 * inv * t * control.x + t * t * to.x,
        y: inv * inv * from.y + 2 * inv * t * control.y + t * t * to.y,
    };
};

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
    const leaving = current[3];

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

    // The chute: from the register's exit down to the slot this bit will fill.
    const chuteFrom: Point = { x: regX(5), y: REG_MID };
    const chuteTo: Point = { x: tapeX(step), y: TAPE_MID };
    const chuteControl: Point = {
        x: chuteFrom.x - (chuteFrom.x - chuteTo.x) * 0.35,
        y: 215,
    };
    const chutePath = `M ${chuteFrom.x} ${chuteFrom.y} Q ${chuteControl.x} ${chuteControl.y} ${chuteTo.x} ${chuteTo.y}`;

    // The bit on its way out: along the register first, then down the chute.
    const token =
        frac <= 0.5
            ? { x: regX(4 + frac * 2), y: REG_MID }
            : chutePoint((frac - 0.5) * 2, chuteFrom, chuteControl, chuteTo);

    const revealed = Math.round(position);
    const grabbable = position < MAX_TICKS;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full"
            role="img"
            aria-label="A four cell shift register whose output bits drop onto a tape below"
        >
            <defs>
                <filter id="lfsr-trace-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
                <marker id="lfsr-trace-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill={INK_QUIET} />
                </marker>
                <marker id="lfsr-trace-arrow-accent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill={FEEDBACK_HUE} />
                </marker>
                <marker id="lfsr-trace-arrow-output" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill={OUTPUT_HUE} />
                </marker>
            </defs>

            {/* Readouts above the drawing surface */}
            <g fontSize="12" style={{ fontVariantNumeric: "tabular-nums" }} opacity={opacityFor("readout")}>
                <text x="24" y="28" fill={INK}>{`seed ${bitsToString(seed)}`}</text>
                <text x={VIEW_WIDTH - 24} y="28" fill={INK} textAnchor="end">
                    {"bits pulled "}
                    <tspan fill={OUTPUT_HUE} fontWeight="700">
                        {revealed}
                    </tspan>
                </text>
            </g>

            {/* Feedback loop over the top: taps into the XOR gate, result back to cell 1 */}
            <g opacity={opacityFor("feedback")} style={ease} {...hoverProps("feedback")}>
                {isOn("feedback") && (
                    <path
                        d={`M ${regX(3)} ${REG_TOP} V 68 H ${XOR_CENTRE.x} M ${regX(4)} ${REG_TOP} V 68 H ${XOR_CENTRE.x} M ${XOR_CENTRE.x} 68 V ${XOR_CENTRE.y + 13}`}
                        fill="none"
                        stroke={TAP_HUE}
                        strokeWidth="9"
                        opacity="0.28"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                <path
                    d={`M ${regX(3)} ${REG_TOP} V 68 H ${XOR_CENTRE.x} M ${regX(4)} ${REG_TOP} V 68 H ${XOR_CENTRE.x} M ${XOR_CENTRE.x} 68 V ${XOR_CENTRE.y + 13}`}
                    fill="none"
                    stroke={TAP_HUE}
                    strokeWidth={isOn("feedback") ? 3 : 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle cx={regX(3)} cy={REG_TOP} r="3.5" fill={TAP_HUE} />
                <circle cx={regX(4)} cy={REG_TOP} r="3.5" fill={TAP_HUE} />
                <text x="190" y="64" fill={INK} fontSize="10" textAnchor="end">
                    taps
                </text>
                <circle cx={XOR_CENTRE.x} cy={XOR_CENTRE.y} r="13" fill="#FFFFFF" stroke={INK_STRUCTURE} strokeWidth="2" />
                <path
                    d={`M ${XOR_CENTRE.x - 7} ${XOR_CENTRE.y} H ${XOR_CENTRE.x + 7} M ${XOR_CENTRE.x} ${XOR_CENTRE.y - 7} V ${XOR_CENTRE.y + 7}`}
                    stroke={INK_STRUCTURE}
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                <text
                    x={XOR_CENTRE.x + 22}
                    y={XOR_CENTRE.y + 4}
                    fill={INK}
                    fontSize="12"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    <tspan fill={TAP_HUE} fontWeight="700">
                        {current[2]}
                    </tspan>
                    {" XOR "}
                    <tspan fill={TAP_HUE} fontWeight="700">
                        {current[3]}
                    </tspan>
                    {" = "}
                    <tspan fill={FEEDBACK_HUE} fontWeight="700">
                        {feedback}
                    </tspan>
                </text>
                <path
                    d={`M ${XOR_CENTRE.x - 13} ${XOR_CENTRE.y} H ${regX(0)} V ${REG_TOP - 6}`}
                    fill="none"
                    stroke={FEEDBACK_HUE}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd="url(#lfsr-trace-arrow-accent)"
                />
            </g>

            {/* Feedback entry slot */}
            <g opacity={opacityFor("register")} style={ease}>
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
                />
                <text x={regX(0)} y={REG_TOP + REG_CELL + 16} fill={INK} fontSize="11" textAnchor="middle">
                    next bit in
                </text>
            </g>

            {/* The four cells — click one to flip that bit of the seed */}
            {[1, 2, 3, 4].map((cellIndex) => (
                <rect
                    key={cellIndex}
                    x={regX(cellIndex) - REG_CELL / 2}
                    y={REG_TOP}
                    width={REG_CELL}
                    height={REG_CELL}
                    rx="6"
                    fill="#FFFFFF"
                    stroke={cellIndex >= 3 ? TAP_HUE : INK_STRUCTURE}
                    strokeWidth="2"
                    opacity={opacityFor("register")}
                    style={{ ...ease, cursor: "pointer" }}
                    onClick={() => flipSeedBit(cellIndex - 1)}
                />
            ))}
            {/* Exit slot and the chute down to the tape */}
            <g opacity={opacityFor("exit")} style={ease} {...hoverProps("exit")}>
                {isOn("exit") && (
                    <path
                        d={chutePath}
                        fill="none"
                        stroke={OUTPUT_HUE}
                        strokeWidth="9"
                        opacity="0.28"
                        strokeLinecap="round"
                    />
                )}
                <rect
                    x={regX(5) - REG_CELL / 2}
                    y={REG_TOP}
                    width={REG_CELL}
                    height={REG_CELL}
                    rx="6"
                    fill="#FFFFFF"
                    stroke={INK_QUIET}
                    strokeWidth={isOn("exit") ? 3 : 2}
                    strokeDasharray="5 5"
                />
                <text x={regX(5)} y={REG_TOP - 14} fill={INK} fontSize="11" textAnchor="middle">
                    output
                </text>
                <path
                    d={chutePath}
                    fill="none"
                    stroke={isOn("exit") ? OUTPUT_HUE : INK_QUIET}
                    strokeWidth={isOn("exit") ? 3 : 2}
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                    markerEnd={isOn("exit") ? "url(#lfsr-trace-arrow-output)" : "url(#lfsr-trace-arrow)"}
                />
            </g>

            {/* The three bits that stay in the register, sliding one place right */}
            {[0, 1, 2].map((index) => (
                <text
                    key={`bit-${index}`}
                    x={regX(index + 1 + frac)}
                    y={REG_MID + 7}
                    fill={INK}
                    fontSize="20"
                    textAnchor="middle"
                    opacity={opacityFor("register")}
                    style={{ ...ease, fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}
                >
                    {current[index]}
                </text>
            ))}

            {/* The bit the XOR gate is sending back in — the accent element */}
            <g opacity={opacityFor("register")} style={ease}>
                <rect
                    x={regX(frac) - 15}
                    y={REG_MID - 15}
                    width="30"
                    height="30"
                    rx="6"
                    fill={FEEDBACK_HUE}
                    opacity={0.3 + 0.7 * frac}
                />
                <text
                    x={regX(frac)}
                    y={REG_MID + 6}
                    fill="#FFFFFF"
                    fontSize="18"
                    textAnchor="middle"
                    opacity={0.3 + 0.7 * frac}
                    style={{ fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}
                >
                    {feedback}
                </text>
            </g>

            {/* The output tape */}
            <g opacity={opacityFor("tape")} style={ease} {...hoverProps("tape")}>
                {tape.map((bit, index) => {
                    const filled = index < step;
                    const isTarget = index === step;
                    return (
                        <g key={`tape-${index}`}>
                            {isOn("tape") && filled && (
                                <rect
                                    x={tapeX(index) - TAPE_CELL / 2 - 4}
                                    y={TAPE_TOP - 4}
                                    width={TAPE_CELL + 8}
                                    height={TAPE_CELL + 8}
                                    rx="8"
                                    fill="none"
                                    stroke={OUTPUT_HUE}
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
                                stroke={filled || isTarget ? OUTPUT_HUE : INK_QUIET}
                                strokeWidth={filled && isOn("tape") ? 3 : 2}
                                strokeDasharray={filled ? undefined : "4 4"}
                                opacity={filled || isTarget ? 1 : 0.55}
                            />
                            {filled && (
                                <text
                                    x={tapeX(index)}
                                    y={TAPE_TOP + 24}
                                    fill={INK}
                                    fontSize="18"
                                    textAnchor="middle"
                                    style={{ fontVariantNumeric: "tabular-nums" }}
                                >
                                    {bit}
                                </text>
                            )}
                            <text
                                x={tapeX(index)}
                                y={TAPE_TOP + TAPE_CELL + 18}
                                fill={INK_STRUCTURE}
                                fontSize="10"
                                textAnchor="middle"
                                opacity={filled ? 1 : 0.5}
                                style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                                {index + 1}
                            </text>
                        </g>
                    );
                })}
                <text x={VIEW_WIDTH / 2} y={TAPE_TOP + TAPE_CELL + 36} fill={INK} fontSize="11" textAnchor="middle">
                    output sequence, tick by tick
                </text>
            </g>

            {/* The bit being pulled out: the grab handle, and the same token that lands */}
            {grabbable && (
                <>
                    <g opacity={opacityFor("exit")} style={ease}>
                        <rect
                            x={token.x - 16}
                            y={token.y - 16}
                            width="32"
                            height="32"
                            rx="7"
                            fill="#FFFFFF"
                            stroke={OUTPUT_HUE}
                            strokeWidth={drag || hovered ? 3.5 : 2.5}
                            filter="url(#lfsr-trace-shadow)"
                            style={{ transition: "stroke-width 150ms ease-out", pointerEvents: "none" }}
                        />
                        <text
                            x={token.x}
                            y={token.y + 7}
                            fill={INK}
                            fontSize="19"
                            textAnchor="middle"
                            style={{ fontVariantNumeric: "tabular-nums", pointerEvents: "none" }}
                        >
                            {leaving}
                        </text>
                    </g>
                    <rect
                        x={token.x - 24}
                        y={token.y - 24}
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
            caption="Cells 3 and 4 feed the XOR gate, and its answer waits at the left-hand end. Pull the amber-ringed bit out of cell 4: it drops down the dashed chute onto the tape while everything else shifts one place right. Click any cell to change the seed."
        >
            <OutputTraceDrawing />
            <InteractionHintSequence
                hintKey="lfsr-output-trace-pull"
                steps={[
                    {
                        gesture: "drag-horizontal",
                        label: "Drag the amber-ringed bit in cell 4 to the right",
                        position: { x: "45%", y: "30%" },
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
                One tick gives one output bit, and repeating the tick lines those bits up into a
                sequence, which is all a{" "}
                <InlineTooltip
                    id="tooltip-lfsr-trace-pseudo-random"
                    tooltip="Looks random, but is made by a fixed rule, so the same start always gives the same bits."
                    color={TOOLTIP_HUE}
                    bgColor={TOOLTIP_SOFT}
                >
                    pseudo-random
                </InlineTooltip>{" "}
                stream really is. Try a tick now: the amber-ringed bit in cell 4, the last box of the register, is the one about to leave.
                Drag it to the right and it{" "}
                <InlineLinkedHighlight
                    id="link-lfsr-trace-exit"
                    varName="traceHighlight"
                    highlightId="exit"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("traceHighlight"))}
                    color={OUTPUT_HUE}
                    bgColor={OUTPUT_SOFT}
                >
                    rides the dashed chute
                </InlineLinkedHighlight>{" "}
                down into slot 1 of the tape, while the other three bits shift along behind it. Now
                pull four more, reading the XOR line above the register each time to see where the
                bit coming in was made.
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
                    color={OUTPUT_HUE}
                    bgColor={OUTPUT_SOFT}
                >
                    tape
                </InlineLinkedHighlight>{" "}
                holds{" "}
                <InlineScrubbleNumber
                    varName="traceTicks"
                    {...numberPropsFromDefinition(getVariableInfo("traceTicks"))}
                />{" "}
                bits so far. The{" "}
                <InlineTrigger
                    id="trigger-lfsr-trace-first-four"
                    varName="traceTicks"
                    value={4}
                    color={OUTPUT_HUE}
                    bgColor={OUTPUT_SOFT}
                >
                    first four
                </InlineTrigger>{" "}
                carry no new information: that is the{" "}
                <InlineTooltip
                    id="tooltip-lfsr-trace-seed"
                    tooltip="The starting pattern of bits loaded into the register before the first tick."
                    color={TOOLTIP_HUE}
                    bgColor={TOOLTIP_SOFT}
                >
                    seed
                </InlineTooltip>{" "}
                itself walking out, right-hand cell first. Only from the{" "}
                <InlineTrigger
                    id="trigger-lfsr-trace-fifth-tick"
                    varName="traceTicks"
                    value={5}
                    color={OUTPUT_HUE}
                    bgColor={OUTPUT_SOFT}
                >
                    fifth tick
                </InlineTrigger>{" "}
                does the XOR gate contribute bits the seed never held. Click any cell to try a different seed.
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
                                position: { x: "45%", y: "30%" },
                            },
                            {
                                gesture: "drag-horizontal",
                                label: "Pull three bits out and read the tape",
                                position: { x: "45%", y: "30%" },
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
