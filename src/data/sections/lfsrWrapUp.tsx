import { type ReactElement } from "react";
import { StackLayout } from "@/components/layouts";
import { Block } from "@/components/templates";
import { EditableH2, EditableParagraph } from "@/components/atoms";

export const lfsrWrapUpBlocks: ReactElement[] = [
    <StackLayout key="layout-lfsr-wrapup-heading" maxWidth="xl">
        <Block id="lfsr-wrapup-heading" padding="md">
            <EditableH2 id="h2-lfsr-wrapup-heading" blockId="lfsr-wrapup-heading">
                Wrapping Up
            </EditableH2>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-wrapup-summary" maxWidth="xl">
        <Block id="lfsr-wrapup-summary" padding="sm">
            <EditableParagraph id="para-lfsr-wrapup-summary" blockId="lfsr-wrapup-summary">
                So the key fob is not being clever. It is doing exactly what you just did by hand:
                shift the bits one place right, XOR the two tapped cells, send that bit back in at
                the left, and read whatever falls off the far end. Give it the same seed and the
                same taps and it produces the same fifteen bits, in the same order, every time.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-wrapup-next" maxWidth="xl">
        <Block id="lfsr-wrapup-next" padding="sm">
            <EditableParagraph id="para-lfsr-wrapup-next" blockId="lfsr-wrapup-next">
                That predictability is exactly why a receiver can stay in step with it, and why an
                LFSR on its own is never a cipher. Longer registers buy longer runs: sixteen cells
                give 65,535 bits before the pattern comes round. Which tap positions earn that full
                run, and which ones cut it short, is where we pick this up next.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
