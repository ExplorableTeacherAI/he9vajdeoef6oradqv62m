import React, { useRef, useState, type ReactElement } from "react";
import { StackLayout } from "@/components/layouts";
import { Block } from "@/components/templates";
import {
    EditableH2,
    EditableParagraph,
    InlineClozeInput,
    InlineFeedback,
    InlineFormula,
    InlineLinkedHighlight,
    InlineSpotColor,
    InlineTooltip,
    InteractionHintSequence,
} from "@/components/atoms";
import { Figure } from "@/components/molecules";
import { useVar, useSetVar } from "@/stores";
import { useSpring } from "@/lib/motion";
import {
    FEEDBACK_HUE,
    INK,
    INK_QUIET,
    INK_STRUCTURE,
    OUTPUT_HUE,
    OUTPUT_SOFT,
    TAP_HUE,
    TAP_SOFT,
    TOOLTIP_HUE,
    TOOLTIP_SOFT,
    feedbackBit,
    nextState,
    outputBit,
    type Bits,
} from "./lfsrModel";
import {
    clozePropsFromDefinition,
    getVariableInfo,
    linkedHighlightPropsFromDefinition,
    spotColorPropsFromDefinition,
} from "../variables";

// ── View geometry (safe viewBox, ≥24px padding on all sides) ────────────────

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 320;
const SLOT_PITCH = 62;
const CELL_SIZE = 52;
const SLOT0_LEFT = 99;
const CELL_TOP = 96;
const CELL_MID = CELL_TOP + CELL_SIZE / 2;

/** Centre x of slot `v` (0 = entry, 1..4 = cells, 5 = exit); v may be fractional. */
const slotX = (v: number): number => SLOT0_LEFT + v * SLOT_PITCH + CELL_SIZE / 2;

const XOR_CENTRE = { x: 280, y: 232 };
const CHIP_HOME = { x: 280, y: 268 };

const TICK_SEED: Bits = [1, 0, 0, 1];

type Placement = "none" | "left" | "right";

// ── The bespoke drawing ─────────────────────────────────────────────────────

function ClockTickDrawing() {
    const setVar = useSetVar();
    const placement = useVar<string>("tickFeedbackDrop", "none") as Placement;
    const highlight = useVar<string>("tickHighlight", "");

    const [chip, setChip] = useState<{ x: number; y: number } | null>(null);
    const [hovered, setHovered] = useState(false);
    const svgRef = useRef<SVGSVGElement>(null);
    const dragging = chip !== null;

    const dropped = placement !== "none";
    const shift = useSpring(dropped ? 1 : 0, { stiffness: 110, damping: 18 });
    const chipScale = useSpring(dragging || hovered ? 1.14 : 1, { stiffness: 400, damping: 26 });

    const bits = TICK_SEED;
    const feedback = feedbackBit(bits);
    const output = outputBit(bits);

    // Hover contract: the target pops, everything else recedes to 38%.
    const opacityFor = (id: string) => (highlight && highlight !== id ? 0.38 : 1);
    const isOn = (id: string) => highlight === id;
    const ease = { transition: "opacity 150ms ease-out, stroke-width 150ms ease-out" };
    const hoverProps = (id: string) => ({
        onPointerEnter: () => setVar("tickHighlight", id),
        onPointerLeave: () => setVar("tickHighlight", ""),
    });

    const pointFromEvent = (event: React.PointerEvent) => {
        const svg = svgRef.current;
        if (!svg) return { x: CHIP_HOME.x, y: CHIP_HOME.y };
        const rect = svg.getBoundingClientRect();
        return {
            x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
            y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
        };
    };

    const handlePointerDown = (event: React.PointerEvent<SVGCircleElement>) => {
        if (dropped) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setChip(pointFromEvent(event));
    };

    const handlePointerMove = (event: React.PointerEvent<SVGCircleElement>) => {
        if (!dragging) return;
        setChip(pointFromEvent(event));
    };

    const handlePointerUp = () => {
        if (!chip) return;
        setVar("tickFeedbackDrop", chip.x < XOR_CENTRE.x ? "left" : "right");
        setChip(null);
    };

    // Bit positions derive from the model: every bit slides one slot per tick.
    const bitSlot = (index: number) => index + 1 + shift;
    const chipPosition = (() => {
        if (chip) return chip;
        if (placement === "left") return { x: slotX(shift), y: CELL_MID };
        if (placement === "right") return { x: slotX(5), y: CELL_MID + 46 };
        return CHIP_HOME;
    })();

    const groupOfSlot = (slot: number) => {
        const rounded = Math.round(slot);
        if (rounded >= 5) return "output";
        if (rounded === 3 || rounded === 4) return "taps";
        if (rounded <= 0) return "entry";
        return "register";
    };

    const cellIsTapped = (cellIndex: number) => cellIndex === 3 || cellIndex === 4;
    const holeVisible = placement === "right" && shift > 0.55;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
            className="block w-full"
            role="img"
            aria-label="A four cell shift register with an XOR gate fed by cells three and four"
        >
            <defs>
                <filter id="lfsr-tick-chip-shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.25" />
                </filter>
            </defs>

            {/* Entry drop target (slot 0) */}
            <g
                opacity={opacityFor("entry")}
                style={ease}
                {...hoverProps("entry")}
            >
                {isOn("entry") && (
                    <rect
                        x={SLOT0_LEFT - 3}
                        y={CELL_TOP - 3}
                        width={CELL_SIZE + 6}
                        height={CELL_SIZE + 6}
                        rx="9"
                        fill="none"
                        stroke={INK_STRUCTURE}
                        strokeWidth="9"
                        opacity="0.28"
                    />
                )}
                <rect
                    x={SLOT0_LEFT}
                    y={CELL_TOP}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    rx="6"
                    fill="#FFFFFF"
                    stroke={INK_STRUCTURE}
                    strokeWidth={isOn("entry") ? 3 : 2}
                    strokeDasharray="5 5"
                />
                {placement === "left" && shift > 0.6 && (
                    <text x={slotX(0)} y={CELL_TOP - 12} fill={INK} fontSize="11" textAnchor="middle">
                        feedback in
                    </text>
                )}
            </g>

            {/* Exit drop target (slot 5) */}
            <g opacity={opacityFor("output")} style={ease} {...hoverProps("output")}>
                {isOn("output") && (
                    <rect
                        x={slotX(5) - CELL_SIZE / 2 - 3}
                        y={CELL_TOP - 3}
                        width={CELL_SIZE + 6}
                        height={CELL_SIZE + 6}
                        rx="9"
                        fill="none"
                        stroke={OUTPUT_HUE}
                        strokeWidth="9"
                        opacity="0.28"
                    />
                )}
                <rect
                    x={slotX(5) - CELL_SIZE / 2}
                    y={CELL_TOP}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    rx="6"
                    fill="#FFFFFF"
                    stroke={dropped ? OUTPUT_HUE : INK_STRUCTURE}
                    strokeWidth={isOn("output") ? 3 : 2}
                    strokeDasharray="5 5"
                />
                {dropped && shift > 0.6 && (
                    <text x={slotX(5)} y={CELL_TOP - 12} fill={INK} fontSize="11" textAnchor="middle">
                        output
                    </text>
                )}
            </g>

            {/* The four register cells — 3 and 4 are the tapped pair */}
            {[1, 2, 3, 4].map((cellIndex) => {
                const groupId = cellIsTapped(cellIndex) ? "taps" : "register";
                const active = isOn(groupId);
                const isHole = holeVisible && cellIndex === 1;
                return (
                    <g key={cellIndex} opacity={opacityFor(groupId)} style={ease} {...hoverProps(groupId)}>
                        {active && cellIsTapped(cellIndex) && (
                            <rect
                                x={slotX(cellIndex) - CELL_SIZE / 2 - 3}
                                y={CELL_TOP - 3}
                                width={CELL_SIZE + 6}
                                height={CELL_SIZE + 6}
                                rx="9"
                                fill="none"
                                stroke={TAP_HUE}
                                strokeWidth="9"
                                opacity="0.28"
                            />
                        )}
                        <rect
                            x={slotX(cellIndex) - CELL_SIZE / 2}
                            y={CELL_TOP}
                            width={CELL_SIZE}
                            height={CELL_SIZE}
                            rx="6"
                            fill="#FFFFFF"
                            stroke={isHole ? INK_QUIET : cellIsTapped(cellIndex) ? TAP_HUE : INK_STRUCTURE}
                            strokeWidth={active && cellIsTapped(cellIndex) ? 3 : 2}
                            strokeDasharray={isHole ? "5 5" : undefined}
                        />
                        <text
                            x={slotX(cellIndex)}
                            y={CELL_TOP - 12}
                            fill={INK}
                            fontSize="11"
                            textAnchor="middle"
                        >
                            {`cell ${cellIndex}`}
                        </text>
                    </g>
                );
            })}

            {/* Tap wires into the XOR gate */}
            <g opacity={opacityFor("taps")} style={ease} {...hoverProps("taps")}>
                {isOn("taps") && (
                    <path
                        d={`M ${slotX(3)} ${CELL_TOP + CELL_SIZE} V 205 H ${XOR_CENTRE.x} M ${slotX(4)} ${CELL_TOP + CELL_SIZE} V 205 H ${XOR_CENTRE.x} M ${XOR_CENTRE.x} 205 V ${XOR_CENTRE.y - 16}`}
                        fill="none"
                        stroke={TAP_HUE}
                        strokeWidth="9"
                        opacity="0.28"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                <path
                    d={`M ${slotX(3)} ${CELL_TOP + CELL_SIZE} V 205 H ${XOR_CENTRE.x} M ${slotX(4)} ${CELL_TOP + CELL_SIZE} V 205 H ${XOR_CENTRE.x} M ${XOR_CENTRE.x} 205 V ${XOR_CENTRE.y - 16}`}
                    fill="none"
                    stroke={TAP_HUE}
                    strokeWidth={isOn("taps") ? 3 : 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>

            {/* XOR gate */}
            <g opacity={opacityFor("register")} style={ease}>
                <circle
                    cx={XOR_CENTRE.x}
                    cy={XOR_CENTRE.y}
                    r="16"
                    fill="#FFFFFF"
                    stroke={INK_STRUCTURE}
                    strokeWidth="2"
                />
                <path
                    d={`M ${XOR_CENTRE.x - 8} ${XOR_CENTRE.y} H ${XOR_CENTRE.x + 8} M ${XOR_CENTRE.x} ${XOR_CENTRE.y - 8} V ${XOR_CENTRE.y + 8}`}
                    stroke={INK_STRUCTURE}
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                <text x={XOR_CENTRE.x + 26} y={XOR_CENTRE.y + 4} fill={INK} fontSize="11">
                    XOR
                </text>
            </g>

            {/* The wire the student chose, drawn only once they have committed */}
            {dropped && (
                <path
                    d={
                        placement === "left"
                            ? `M ${XOR_CENTRE.x} ${XOR_CENTRE.y + 16} V 288 H ${slotX(0)} V ${CELL_TOP + CELL_SIZE + 8}`
                            : `M ${XOR_CENTRE.x} ${XOR_CENTRE.y + 16} V 288 H ${slotX(5)} V ${CELL_MID + 68}`
                    }
                    fill="none"
                    stroke={FEEDBACK_HUE}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={opacityFor("register")}
                    style={ease}
                />
            )}

            {/* The four bits already in the register — ink, one slot right per tick */}
            {bits.map((bit, index) => {
                const slot = bitSlot(index);
                const groupId = groupOfSlot(slot);
                return (
                    <text
                        key={index}
                        x={slotX(slot)}
                        y={CELL_MID + 8}
                        fill={dropped && index === bits.length - 1 ? OUTPUT_HUE : INK}
                        fontSize="22"
                        textAnchor="middle"
                        opacity={opacityFor(groupId)}
                        style={{
                            transition: "opacity 150ms ease-out, fill 150ms ease-out",
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {bit}
                    </text>
                );
            })}

            {/* The feedback bit — the one accent element, and the only draggable one */}
            <g
                transform={`translate(${chipPosition.x} ${chipPosition.y}) scale(${chipScale})`}
                opacity={opacityFor(dropped ? groupOfSlot(placement === "left" ? shift : 5) : "register")}
                style={ease}
            >
                <rect
                    x="-19"
                    y="-19"
                    width="38"
                    height="38"
                    rx="7"
                    fill={FEEDBACK_HUE}
                    filter="url(#lfsr-tick-chip-shadow)"
                />
                <text
                    x="0"
                    y="8"
                    fill="#FFFFFF"
                    fontSize="22"
                    textAnchor="middle"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                >
                    {feedback}
                </text>
            </g>
            <circle
                cx={chipPosition.x}
                cy={chipPosition.y}
                r="26"
                fill="transparent"
                style={{
                    cursor: dropped ? "default" : dragging ? "grabbing" : "grab",
                    touchAction: "none",
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
            />

            {/* Output readout, beside the drawing surface, not over it */}
            {dropped && placement === "left" && shift > 0.6 && (
                <text
                    x={VIEW_WIDTH - 24}
                    y={44}
                    fill={INK}
                    fontSize="12"
                    textAnchor="end"
                    opacity={opacityFor("output")}
                    style={{ ...ease, fontVariantNumeric: "tabular-nums" }}
                >
                    {"output this tick: "}
                    <tspan fill={OUTPUT_HUE} fontWeight="700">
                        {output}
                    </tspan>
                </text>
            )}
        </svg>
    );
}

function ClockTickStatus() {
    const placement = useVar<string>("tickFeedbackDrop", "none") as Placement;
    if (placement === "left") {
        return (
            <span className="text-[#334155]">
                Every bit moved one place right, the feedback bit took cell 1, and 1001 became{" "}
                <span style={{ fontVariantNumeric: "tabular-nums" }}>1100</span>.
            </span>
        );
    }
    if (placement === "right") {
        return (
            <span className="text-[#334155]">
                Two bits are now stacked at the exit and cell 1 is empty, because nothing feeds it.
                Reset the figure and try the other end.
            </span>
        );
    }
    return <span className="text-[#64748B]">Both ends are open. Pick one and drop the bit in.</span>;
}

function ClockTickFigure() {
    const setVar = useSetVar();
    return (
        <Figure
            id="lfsr-clock-tick"
            onReset={() => {
                setVar("tickFeedbackDrop", "none");
                setVar("tickHighlight", "");
            }}
            caption="Cells 3 and 4 feed the XOR gate, which has produced a teal 1. Drag it into one end of the register and watch the tick play out."
        >
            <ClockTickDrawing />
            <div className="px-6 pb-5 text-[13px] leading-relaxed">
                <ClockTickStatus />
            </div>
            <InteractionHintSequence
                hintKey="lfsr-clock-tick-drop"
                steps={[
                    {
                        gesture: "drag",
                        label: "Drag the teal bit into one end of the register",
                        position: { x: "50%", y: "74%" },
                        dragPath: {
                            type: "line",
                            startOffset: { x: 0, y: 0 },
                            endOffset: { x: -60, y: -40 },
                        },
                    },
                ]}
            />
        </Figure>
    );
}

const nextBits = nextState(TICK_SEED);

export const lfsrOneClockTickBlocks: ReactElement[] = [
    <StackLayout key="layout-lfsr-tick-heading" maxWidth="xl">
        <Block id="lfsr-tick-heading" padding="md">
            <EditableH2 id="h2-lfsr-tick-heading" blockId="lfsr-tick-heading">
                One Clock Tick
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-tick-setup" maxWidth="xl">
        <Block id="lfsr-tick-setup" padding="sm">
            <EditableParagraph id="para-lfsr-tick-setup" blockId="lfsr-tick-setup">
                Everything the fob's register ever does happens in a single{" "}
                <InlineTooltip
                    id="tooltip-lfsr-tick-clock-tick"
                    tooltip="One beat of the circuit's clock. On each beat every cell updates once, all at the same moment."
                    color={TOOLTIP_HUE}
                    bgColor={TOOLTIP_SOFT}
                >
                    clock tick
                </InlineTooltip>
                , repeated.{" "}
                <InlineLinkedHighlight
                    id="link-lfsr-tick-taps"
                    varName="tickHighlight"
                    highlightId="taps"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("tickHighlight"))}
                    color={TAP_HUE}
                    bgColor={TAP_SOFT}
                >
                    Two of the four cells are tapped
                </InlineLinkedHighlight>
                , their bits go into an XOR gate, and the result is the bit the register takes in.
                The register below holds 1001, so the tapped cells hold 0 and 1, and since{" "}
                <InlineFormula
                    id="formula-lfsr-tick-setup-xor"
                    latex="\clr{tap}{0} \text{ XOR } \clr{tap}{1} = \clr{feedback}{1}"
                    colorMap={{ tap: TAP_HUE, feedback: FEEDBACK_HUE }}
                />{" "}
                the gate has already produced a teal 1. Drag that bit into whichever end you think takes it, and
                watch what the tick does to all four cells.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-tick-figure" maxWidth="xl">
        <Block id="lfsr-tick-figure" padding="sm" hasVisualization>
            <ClockTickFigure />
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-tick-reflect" maxWidth="xl">
        <Block id="lfsr-tick-reflect" padding="sm">
            <EditableParagraph id="para-lfsr-tick-reflect" blockId="lfsr-tick-reflect">
                A bit can only be taken in at the end where nothing is leaving. The right-hand end
                is already busy:{" "}
                <InlineLinkedHighlight
                    id="link-lfsr-tick-output"
                    varName="tickHighlight"
                    highlightId="output"
                    {...linkedHighlightPropsFromDefinition(getVariableInfo("tickHighlight"))}
                    color={OUTPUT_HUE}
                    bgColor={OUTPUT_SOFT}
                >
                    that bit is on its way out
                </InlineLinkedHighlight>
                , and it is the output. So{" "}
                <InlineSpotColor
                    id="spot-lfsr-tick-reflect-feedback"
                    varName="lfsrFeedbackBit"
                    {...spotColorPropsFromDefinition(getVariableInfo("lfsrFeedbackBit"))}
                >
                    feedback
                </InlineSpotColor>{" "}
                enters on the left, everything slides one place
                right, and {`${TICK_SEED.join("")} becomes ${nextBits.join("")}`}.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-tick-question-feedback" maxWidth="xl">
        <Block id="lfsr-tick-question-feedback" padding="sm">
            <EditableParagraph id="para-lfsr-tick-question-feedback" blockId="lfsr-tick-question-feedback">
                Now clock 1100 on by hand. Its tapped cells hold 0 and 0, so the bit the XOR gate
                sends back in is{" "}
                <InlineFormula
                    id="formula-lfsr-tick-question-xor"
                    latex="\clr{tap}{0} \text{ XOR } \clr{tap}{0} ="
                    colorMap={{ tap: TAP_HUE }}
                />{" "}
                <InlineFeedback
                    varName="answer_tick_feedback_bit"
                    correctValue="0"
                    position="terminal"
                    successMessage="— right, XOR gives 1 only when the two inputs differ, and these two match"
                    failureMessage="— not that one."
                    hint="Read cells 3 and 4 of 1100, then apply the XOR rule to just those two bits"
                >
                    <InlineClozeInput
                        varName="answer_tick_feedback_bit"
                        correctAnswer="0"
                        {...clozePropsFromDefinition(getVariableInfo("answer_tick_feedback_bit"))}
                    />
                </InlineFeedback>
                .
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-tick-question-state" maxWidth="xl">
        <Block id="lfsr-tick-question-state" padding="sm">
            <EditableParagraph id="para-lfsr-tick-question-state" blockId="lfsr-tick-question-state">
                Send that bit in the way the figure showed you, and after the tick the four cells
                read{" "}
                <InlineFeedback
                    varName="answer_tick_next_state"
                    correctValue={["0110", "0 1 1 0"]}
                    position="terminal"
                    successMessage="— exactly, the new bit takes cell 1 and 110 slides right to fill cells 2, 3 and 4"
                    failureMessage="— careful."
                    hint="If your answer ends in the new bit, you sent it into the end the output was leaving from"
                    reviewBlockId="lfsr-tick-figure"
                    reviewLabel="Look at the tick again"
                    visualizationHint={{
                        blockId: "lfsr-tick-figure",
                        hintKey: "lfsr-tick-feedback-hint",
                        label: "Discover it yourself",
                        resetVars: { tickFeedbackDrop: "none", tickHighlight: "" },
                        steps: [
                            {
                                gesture: "drag",
                                label: "Drop the teal bit into the right-hand end and watch cell 1 empty",
                                position: { x: "50%", y: "74%" },
                            },
                            {
                                gesture: "click",
                                label: "Reset the figure, then drop it into the left-hand end instead",
                                position: { x: "93%", y: "6%" },
                            },
                        ],
                    }}
                >
                    <InlineClozeInput
                        varName="answer_tick_next_state"
                        correctAnswer={["0110", "0 1 1 0"]}
                        {...clozePropsFromDefinition(getVariableInfo("answer_tick_next_state"))}
                    />
                </InlineFeedback>
                .
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
