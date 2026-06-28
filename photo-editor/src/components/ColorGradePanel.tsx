// M3 color-grading panel: tone curves, HSL mixer, color wheels, split toning, and
// .cube LUT controls. Collapsible sections keep the sidebar manageable.

import { ReactNode, useState } from "react";
import { ToneCurve } from "./color/ToneCurve";
import { HSLMixer } from "./color/HSLMixer";
import { ColorWheels } from "./color/ColorWheels";
import { SplitToning } from "./color/SplitToning";
import { LutControls } from "./color/LutControls";

function Section({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  const [show, setShow] = useState(open);
  return (
    <div className="section">
      <button className="section-head" onClick={() => setShow((s) => !s)}>
        <span>{title}</span>
        <span className="chev">{show ? "▾" : "▸"}</span>
      </button>
      {show && <div className="section-body">{children}</div>}
    </div>
  );
}

export function ColorGradePanel() {
  return (
    <div className="grade-panel">
      <div className="panel-header">
        <span>Color</span>
      </div>
      <Section title="Tone Curve">
        <ToneCurve />
      </Section>
      <Section title="Color Wheels">
        <ColorWheels />
      </Section>
      <Section title="HSL / Color Mixer" open={false}>
        <HSLMixer />
      </Section>
      <Section title="Split Toning" open={false}>
        <SplitToning />
      </Section>
      <Section title="LUT (.cube)" open={false}>
        <LutControls />
      </Section>
    </div>
  );
}
