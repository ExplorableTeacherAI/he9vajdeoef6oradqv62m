import { type ReactElement } from "react";
import { StackLayout } from "@/components/layouts";
import { Block } from "@/components/templates";
import { EditableH1, EditableParagraph, InlineTooltip } from "@/components/atoms";
import { TOOLTIP_HUE, TOOLTIP_SOFT } from "./lfsrModel";

export const lfsrIntroBlocks: ReactElement[] = [
    <StackLayout key="layout-lfsr-intro-title" maxWidth="xl">
        <Block id="lfsr-intro-title" padding="md">
            <EditableH1 id="h1-lfsr-intro-title" blockId="lfsr-intro-title">
                Linear Feedback Shift Registers
            </EditableH1>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-intro-hook" maxWidth="xl">
        <Block id="lfsr-intro-hook" padding="sm">
            <EditableParagraph id="para-lfsr-intro-hook" blockId="lfsr-intro-hook">
                The key fob in your pocket sends a different code every time you press it, and
                the receiver in the car knows which code to expect next. Neither device stores a
                list of codes. Both of them run the same tiny circuit: four boxes holding bits,
                one{" "}
                <InlineTooltip
                    id="tooltip-lfsr-intro-xor-gate"
                    tooltip="A logic gate with two inputs. It outputs 1 when the two bits differ and 0 when they match."
                    color={TOOLTIP_HUE}
                    bgColor={TOOLTIP_SOFT}
                >
                    XOR gate
                </InlineTooltip>
                , and a wire that loops back on itself. That circuit is a linear
                feedback shift register.
            </EditableParagraph>
        </Block>
    </StackLayout>,

    <StackLayout key="layout-lfsr-intro-promise" maxWidth="xl">
        <Block id="lfsr-intro-promise" padding="sm">
            <EditableParagraph id="para-lfsr-intro-promise" blockId="lfsr-intro-promise">
                You already read bits as a row of ones and zeros, and you know XOR gives 1 only
                when its two inputs differ. That is the whole toolkit. By the end of the hour you
                will take a starting pattern and a pair of{" "}
                <InlineTooltip
                    id="tooltip-lfsr-intro-taps"
                    tooltip="The cells whose bits are wired into the XOR gate."
                    color={TOOLTIP_HUE}
                    bgColor={TOOLTIP_SOFT}
                >
                    taps
                </InlineTooltip>{" "}
                and write out the bit sequence the
                register produces, one tick at a time.
            </EditableParagraph>
        </Block>
    </StackLayout>,
];
