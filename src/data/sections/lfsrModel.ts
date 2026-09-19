/**
 * Domain model for the Linear Feedback Shift Register lesson.
 * ==========================================================
 *
 * A 4-cell Fibonacci LFSR. Cells are written left to right as
 * [c1, c2, c3, c4]. On every clock tick:
 *
 *   output = c4                (the bit falling off the right-hand end)
 *   feedback = c3 XOR c4       (the two tapped cells)
 *   next  = [feedback, c1, c2, c3]
 *
 * Taps on cells 3 and 4 correspond to x^4 + x^3 + 1, which is primitive,
 * so the register visits all 15 non-zero states before repeating.
 *
 * Every figure in the lesson draws itself from these functions — no visual
 * quantity is ever hand-placed.
 */

export type Bits = number[];

/** 1-indexed cell positions feeding the XOR gate. */
export const TAP_CELLS = [3, 4] as const;

export const CELL_COUNT = 4;

/** The bit that falls off the right-hand end on this tick. */
export const outputBit = (bits: Bits): number => bits[3];

/** XOR of the two tapped cells — the bit that enters at the left. */
export const feedbackBit = (bits: Bits): number => bits[2] ^ bits[3];

/** The register one clock tick later. */
export const nextState = (bits: Bits): Bits => [
    feedbackBit(bits),
    bits[0],
    bits[1],
    bits[2],
];

/** States visited, starting with the seed itself: [s0, s1, ... s_count]. */
export const statesFrom = (seed: Bits, count: number): Bits[] => {
    const states: Bits[] = [seed.slice()];
    for (let index = 0; index < count; index += 1) {
        states.push(nextState(states[index]));
    }
    return states;
};

/** The output bits produced by `count` ticks, in emission order. */
export const outputsFrom = (seed: Bits, count: number): number[] =>
    statesFrom(seed, count)
        .slice(0, count)
        .map(outputBit);

export const bitsToString = (bits: Bits): string => bits.join("");

export const sameBits = (a: Bits, b: Bits): boolean =>
    a.length === b.length && a.every((bit, index) => bit === b[index]);

/** Ticks until the seed pattern returns (0 for the all-zero lock-up). */
export const periodOf = (seed: Bits, limit = 32): number => {
    if (seed.every((bit) => bit === 0)) return 0;
    let current = nextState(seed);
    for (let tick = 1; tick <= limit; tick += 1) {
        if (sameBits(current, seed)) return tick;
        current = nextState(current);
    }
    return 0;
};

// ── Shared drawing palette (FIGURE_DESIGN_LANGUAGE.md §2) ───────────────────

export const INK = "#334155";
export const INK_STRUCTURE = "#64748B";
export const INK_QUIET = "#CBD5E1";
export const PAPER_FILL = "#F1F5F9";
export const ACCENT = "#62D0AD";
export const ACCENT_SOFT = "rgba(98, 208, 173, 0.15)";
export const SECOND_ACCENT = "#8E90F5";
export const AMBER = "#F7B23B";

// ── One quantity, one hue, in every figure and every sentence ───────────────

/** The bit the XOR gate sends back in at the left-hand end. */
export const FEEDBACK_HUE = ACCENT;
/** The bit leaving at the right-hand end, and the output sequence it builds. */
export const OUTPUT_HUE = AMBER;
export const OUTPUT_SOFT = "rgba(247, 178, 59, 0.20)";
/** The tapped cells and the wires carrying their bits into the XOR gate. */
export const TAP_HUE = "#F8A0CD";
export const TAP_SOFT = "rgba(248, 160, 205, 0.22)";
/** The student's own prediction. */
export const PREDICTION_HUE = SECOND_ACCENT;
export const PREDICTION_SOFT = "rgba(142, 144, 245, 0.20)";
/** Blue for tooltips, so a definition never borrows a quantity's hue. */
export const TOOLTIP_HUE = "#2563EB";
export const TOOLTIP_SOFT = "rgba(37, 99, 235, 0.12)";
