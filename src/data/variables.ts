/**
 * Variables Configuration
 * =======================
 * 
 * CENTRAL PLACE TO DEFINE ALL SHARED VARIABLES
 * 
 * This file defines all variables that can be shared across sections.
 * AI agents should read this file to understand what variables are available.
 * 
 * USAGE:
 * 1. Define variables here with their default values and metadata
 * 2. Use them in any section with: const x = useVar('variableName', defaultValue)
 * 3. Update them with: setVar('variableName', newValue)
 */

import { type VarValue } from '@/stores';

/**
 * Variable definition with metadata
 */
export interface VariableDefinition {
    /** Default value */
    defaultValue: VarValue;
    /** Human-readable label */
    label?: string;
    /** Description for AI agents */
    description?: string;
    /** Variable type hint */
    type?: 'number' | 'text' | 'boolean' | 'select' | 'array' | 'object' | 'spotColor' | 'linkedHighlight';
    /** Unit (e.g., 'Hz', '°', 'm/s') - for numbers */
    unit?: string;
    /** Minimum value (for number sliders) */
    min?: number;
    /** Maximum value (for number sliders) */
    max?: number;
    /** Step increment (for number sliders) */
    step?: number;
    /** Display color for InlineScrubbleNumber / InlineSpotColor (e.g. '#D81B60') */
    color?: string;
    /** Options for 'select' type variables */
    options?: string[];
    /** Placeholder text for text inputs */
    placeholder?: string;
    /**
     * Correct answer for cloze input validation.
     * Accepts a single string, pipe-separated alternates (e.g. "first | 1 | 1st"),
     * or an array of accepted answers (e.g. ["first", "1", "1st"]).
     */
    correctAnswer?: string | string[];
    /** Whether cloze matching is case sensitive */
    caseSensitive?: boolean;
    /** Background color for inline components */
    bgColor?: string;
    /** Schema hint for object types (for AI agents) */
    schema?: string;
}

/**
 * =====================================================
 * 🎯 DEFINE YOUR VARIABLES HERE
 * =====================================================
 * 
 * SUPPORTED TYPES:
 * 
 * 1. NUMBER (slider):
 *    { defaultValue: 5, type: 'number', min: 0, max: 10, step: 1 }
 * 
 * 2. TEXT (free text):
 *    { defaultValue: 'Hello', type: 'text', placeholder: 'Enter text...' }
 * 
 * 3. SELECT (dropdown):
 *    { defaultValue: 'sine', type: 'select', options: ['sine', 'cosine', 'tangent'] }
 * 
 * 4. BOOLEAN (toggle):
 *    { defaultValue: true, type: 'boolean' }
 * 
 * 5. ARRAY (list of numbers):
 *    { defaultValue: [1, 2, 3], type: 'array' }
 * 
 * 6. OBJECT (complex data):
 *    { defaultValue: { x: 5, y: 10 }, type: 'object', schema: '{ x: number, y: number }' }
 */
export const variableDefinitions: Record<string, VariableDefinition> = {
    // ========================================
    // LESSON: Linear Feedback Shift Registers
    // ========================================

    // ── Lesson-wide quantity colours (match lfsrModel.ts hues) ─────
    lfsrTappedCells: {
        defaultValue: 'tapped cells',
        type: 'spotColor',
        label: 'Tapped cells',
        description: 'Colour of the tapped cells and their wires into the XOR gate',
        color: '#F8A0CD',
    },
    lfsrFeedbackBit: {
        defaultValue: 'feedback bit',
        type: 'spotColor',
        label: 'Feedback bit',
        description: 'Colour of the bit the XOR gate sends back in at the left',
        color: '#62D0AD',
    },
    lfsrOutputBit: {
        defaultValue: 'output bit',
        type: 'spotColor',
        label: 'Output bit',
        description: 'Colour of the bit leaving on the right and of the output tape',
        color: '#F7B23B',
    },

    // ── Section 2 — One Clock Tick ────────────────────────────────
    tickFeedbackDrop: {
        defaultValue: 'none',
        type: 'text',
        label: 'Feedback bit placement',
        description: 'Which end of the register the student dropped the feedback bit into: none | left | right',
    },
    tickHighlight: {
        defaultValue: '',
        type: 'linkedHighlight',
        label: 'Clock tick highlight',
        description: 'Hovered element in the single-tick figure: taps | output | entry',
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.20)',
    },
    answer_tick_feedback_bit: {
        defaultValue: '',
        type: 'text',
        label: 'Feedback bit from 1100',
        description: 'Student answer: XOR of the tapped cells when the register holds 1100',
        placeholder: '???',
        correctAnswer: '0',
        color: '#8E90F5',
    },
    answer_tick_next_state: {
        defaultValue: '',
        type: 'text',
        label: 'Register after the tick',
        description: 'Student answer: the four cells after clocking 1100',
        placeholder: '????',
        correctAnswer: ['0110', '0 1 1 0'],
        color: '#8E90F5',
    },

    // ── Section 3 — Reading the Output Sequence ───────────────────
    traceSeedBits: {
        defaultValue: [1, 0, 0, 1],
        type: 'array',
        label: 'Seed bits',
        description: 'The four starting bits of the register, leftmost cell first',
    },
    traceTicks: {
        defaultValue: 0,
        type: 'number',
        label: 'Ticks pulled',
        description: 'How many clock ticks have been pulled out onto the output tape',
        min: 0,
        max: 10,
        step: 1,
        color: '#F7B23B',
    },
    traceHighlight: {
        defaultValue: '',
        type: 'linkedHighlight',
        label: 'Output trace highlight',
        description: 'Hovered element in the tracing figure: tape | exit',
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.20)',
    },
    answer_trace_fifth_bit: {
        defaultValue: '',
        type: 'text',
        label: 'Fifth output bit',
        description: 'Student answer: the fifth bit onto the tape from the seed 1001',
        placeholder: '?',
        correctAnswer: '1',
        color: '#8E90F5',
    },
    answer_trace_zero_seed: {
        defaultValue: '',
        type: 'text',
        label: 'First three bits from seed 1000',
        description: 'Student answer: first three output bits when the seed is 1000',
        placeholder: '???',
        correctAnswer: ['000', '0 0 0'],
        color: '#8E90F5',
    },

    // ── Section 4 — It Always Comes Back Around ───────────────────
    cycleReveal: {
        defaultValue: 0,
        type: 'number',
        label: 'Ticks revealed',
        description: 'How far along the state trail the scrubber has been dragged',
        min: 0,
        max: 16,
        step: 1,
        color: '#62D0AD',
    },
    cyclePrediction: {
        defaultValue: 6,
        type: 'number',
        label: 'Predicted repeat tick',
        description: 'Where the student predicts the seed pattern will return',
        min: 1,
        max: 16,
        step: 1,
        color: '#8E90F5',
    },
    cycleHighlight: {
        defaultValue: '',
        type: 'linkedHighlight',
        label: 'State trail highlight',
        description: 'Hovered element in the state-trail figure: seed | repeat',
        color: '#62D0AD',
        bgColor: 'rgba(98, 208, 173, 0.20)',
    },
    answer_period_length: {
        defaultValue: '',
        type: 'text',
        label: 'Longest run from five cells',
        description: 'Student answer: the longest sequence a five-cell register could produce',
        placeholder: '??',
        correctAnswer: '31',
        color: '#8E90F5',
    },
    answer_period_character: {
        defaultValue: '',
        type: 'select',
        label: 'Character of the output',
        description: 'Student answer: how the output stream is best described',
        placeholder: '???',
        options: [
            'truly random and never repeating',
            'repeating with a fixed period',
            'the same bit forever',
        ],
        correctAnswer: 'repeating with a fixed period',
        color: '#8E90F5',
    },

    /*
    // ─────────────────────────────────────────
    // NUMBER - Use with sliders
    // ─────────────────────────────────────────
    myValue: {
        defaultValue: 5,
        type: 'number',
        label: 'My Value',
        description: 'A number that controls something',
        unit: 'm',           // optional unit display
        min: 0,
        max: 10,
        step: 0.5,
    },

    // ─────────────────────────────────────────
    // TEXT - Free text input
    // ─────────────────────────────────────────
    lessonTitle: {
        defaultValue: 'My Lesson',
        type: 'text',
        label: 'Lesson Title',
        description: 'The title of your lesson',
        placeholder: 'Enter a title...',
    },

    // ─────────────────────────────────────────
    // SELECT - Dropdown with options
    // ─────────────────────────────────────────
    difficulty: {
        defaultValue: 'medium',
        type: 'select',
        label: 'Difficulty',
        description: 'The difficulty level of the lesson',
        options: ['easy', 'medium', 'hard', 'expert'],
    },

    // ─────────────────────────────────────────
    // BOOLEAN - Toggle switch
    // ─────────────────────────────────────────
    showHints: {
        defaultValue: true,
        type: 'boolean',
        label: 'Show Hints',
        description: 'Toggle to show or hide hints',
    },

    // ─────────────────────────────────────────
    // ARRAY - List of numbers
    // ─────────────────────────────────────────
    dataPoints: {
        defaultValue: [1, 4, 9, 16, 25],
        type: 'array',
        label: 'Data Points',
        description: 'Y-values for plotting a graph',
    },

    // ─────────────────────────────────────────
    // OBJECT - Complex structured data
    // ─────────────────────────────────────────
    graphSettings: {
        defaultValue: { 
            xMin: -10, 
            xMax: 10, 
            showGrid: true 
        },
        type: 'object',
        label: 'Graph Settings',
        description: 'Configuration for the graph display',
        schema: '{ xMin: number, xMax: number, showGrid: boolean }',
    },
    */
};

/**
 * Get all variable names (for AI agents to discover)
 */
export const getVariableNames = (): string[] => {
    return Object.keys(variableDefinitions);
};

/**
 * Get a variable's default value
 */
export const getDefaultValue = (name: string): VarValue => {
    return variableDefinitions[name]?.defaultValue ?? 0;
};

/**
 * Get a variable's metadata
 */
export const getVariableInfo = (name: string): VariableDefinition | undefined => {
    return variableDefinitions[name];
};

/**
 * Get all default values as a record (for initialization)
 */
export const getDefaultValues = (): Record<string, VarValue> => {
    const defaults: Record<string, VarValue> = {};
    for (const [name, def] of Object.entries(variableDefinitions)) {
        defaults[name] = def.defaultValue;
    }
    return defaults;
};

/**
 * Get number props for InlineScrubbleNumber from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx, or getExampleVariableInfo(name) in exampleBlocks.tsx.
 */
export function numberPropsFromDefinition(def: VariableDefinition | undefined): {
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    color?: string;
} {
    if (!def || def.type !== 'number') return {};
    return {
        defaultValue: def.defaultValue as number,
        min: def.min,
        max: def.max,
        step: def.step,
        ...(def.color ? { color: def.color } : {}),
    };
}

/**
 * Get cloze input props for InlineClozeInput from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx, or getExampleVariableInfo(name) in exampleBlocks.tsx.
 */
/**
 * Get cloze choice props for InlineClozeChoice from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx.
 */
export function choicePropsFromDefinition(def: VariableDefinition | undefined): {
    placeholder?: string;
    color?: string;
    bgColor?: string;
} {
    if (!def || def.type !== 'select') return {};
    return {
        ...(def.placeholder ? { placeholder: def.placeholder } : {}),
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

/**
 * Get toggle props for InlineToggle from a variable definition.
 * Use with getVariableInfo(name) in blocks.tsx.
 */
export function togglePropsFromDefinition(def: VariableDefinition | undefined): {
    color?: string;
    bgColor?: string;
} {
    if (!def || def.type !== 'select') return {};
    return {
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

export function clozePropsFromDefinition(def: VariableDefinition | undefined): {
    placeholder?: string;
    color?: string;
    bgColor?: string;
    caseSensitive?: boolean;
} {
    if (!def || def.type !== 'text') return {};
    return {
        ...(def.placeholder ? { placeholder: def.placeholder } : {}),
        ...(def.color ? { color: def.color } : {}),
        ...(def.bgColor ? { bgColor: def.bgColor } : {}),
        ...(def.caseSensitive !== undefined ? { caseSensitive: def.caseSensitive } : {}),
    };
}

/**
 * Get spot-color props for InlineSpotColor from a variable definition.
 * Extracts the `color` field.
 *
 * @example
 * <InlineSpotColor
 *     varName="radius"
 *     {...spotColorPropsFromDefinition(getVariableInfo('radius'))}
 * >
 *     radius
 * </InlineSpotColor>
 */
export function spotColorPropsFromDefinition(def: VariableDefinition | undefined): {
    color: string;
} {
    return {
        color: def?.color ?? '#8B5CF6',
    };
}

/**
 * Get linked-highlight props for InlineLinkedHighlight from a variable definition.
 * Extracts the `color` and `bgColor` fields.
 *
 * @example
 * <InlineLinkedHighlight
 *     varName="activeHighlight"
 *     highlightId="radius"
 *     {...linkedHighlightPropsFromDefinition(getVariableInfo('activeHighlight'))}
 * >
 *     radius
 * </InlineLinkedHighlight>
 */
export function linkedHighlightPropsFromDefinition(def: VariableDefinition | undefined): {
    color?: string;
    bgColor?: string;
} {
    return {
        ...(def?.color ? { color: def.color } : {}),
        ...(def?.bgColor ? { bgColor: def.bgColor } : {}),
    };
}

/**
 * Build the `variables` prop for FormulaBlock from variable definitions.
 *
 * Takes an array of variable names and returns the config map expected by
 * `<FormulaBlock variables={...} />`.
 *
 * @example
 * import { scrubVarsFromDefinitions } from './variables';
 *
 * <FormulaBlock
 *     latex="\scrub{mass} \times \scrub{accel}"
 *     variables={scrubVarsFromDefinitions(['mass', 'accel'])}
 * />
 */
export function scrubVarsFromDefinitions(
    varNames: string[],
): Record<string, { min?: number; max?: number; step?: number; color?: string }> {
    const result: Record<string, { min?: number; max?: number; step?: number; color?: string }> = {};
    for (const name of varNames) {
        const def = variableDefinitions[name];
        if (!def) continue;
        result[name] = {
            ...(def.min !== undefined ? { min: def.min } : {}),
            ...(def.max !== undefined ? { max: def.max } : {}),
            ...(def.step !== undefined ? { step: def.step } : {}),
            ...(def.color ? { color: def.color } : {}),
        };
    }
    return result;
}
