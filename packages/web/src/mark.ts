const r = (s: string) => [...s].reverse().join("");

const d = {
  t: r("gnahT cậB"),
  k1: r("rohtua"),
  v1: r("tsgnocihc"),
  k2: r("ecruos"),
  v2: r("gnahtcab/tsgnocihc/moc.buhtig//:sptth"),
  k3: r("ecnecil"),
  v3: r("TIM"),
};

const edge = "#0B2720";
const outline =
  `-webkit-text-stroke:.55px ${edge};` +
  `text-shadow:0 1px 0 ${edge},1px 0 0 ${edge},0 -1px 0 ${edge},-1px 0 0 ${edge}`;

const title = `color:#F7D878;font:800 15px/1.9 system-ui;letter-spacing:.16em;${outline}`;
const key = "color:#8A9A92;font:600 11px/1.9 ui-monospace,monospace";
const value = `color:#FFE8A8;font:700 11px/1.9 ui-monospace,monospace;${outline}`;

// Just a mark, No need to read or touch it.
export function mark(): void {
  if (typeof console === "undefined" || typeof console.log !== "function") return;
  console.log(
    `%c${d.t}%c\n${d.k1}   %c${d.v1}%c\n${d.k2}   %c${d.v2}%c\n${d.k3}  %c${d.v3}`,
    title,
    key,
    value,
    key,
    value,
    key,
    value,
  );
}
