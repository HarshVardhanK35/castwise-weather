// PostCSS plugin: makes a widget's CSS work in browsers that predate container-query
// units and container queries (a TV browser before Chromium 105, which includes a
// 2022 Samsung's Chromium 85). Modern browsers read the original lines and change
// nothing. What it adds:
//
//  1. A declaration with a container unit (cqw, cqh, cqmin...) gets a copy placed
//     just before it with the unit worked out from CSS variables (--cq-w, --cq-h,
//     --cq-min, --cq-max, set from the container's real size by src/legacyShims.ts).
//     An unknown unit makes the later original line invalid, so an old browser keeps
//     the copy. A custom property (--x: ...), or a value containing var(), has no such
//     fallback (see below), so it gets the copy in a `@supports not (width: 1cqw)` block
//     after the rule instead.
//  2. `@container (aspect-ratio ...)` rules are repeated as `@media` rules inside
//     `@supports not (container-type: size)`. A widget fills its own frame, so the
//     frame's aspect ratio is the container's.
//  3. `inset` is also written as top / right / bottom / left (inset needs Chromium 87).
//  4. Every `container-type` element is marked (--cq-box: 1) so the script can find it.
const UNIT = /(-?\d*\.?\d+)(cqw|cqh|cqi|cqb|cqmin|cqmax)\b/g;
const HAS_UNIT = /\dcq(?:w|h|i|b|min|max)\b/;
const VARS = {
  cqw: ["--cq-w", "1vw"],
  cqi: ["--cq-w", "1vw"],
  cqh: ["--cq-h", "1vh"],
  cqb: ["--cq-h", "1vh"],
  cqmin: ["--cq-min", "1vmin"],
  cqmax: ["--cq-max", "1vmax"],
};
const DONE = Symbol("castwise-legacy-done");

const toFallbackValue = (value) =>
  value.replace(UNIT, (_, n, unit) => `calc(var(${VARS[unit][0]}, ${VARS[unit][1]}) * ${n})`);

// "ecs (aspect-ratio > 5/6) and (aspect-ratio <= 6/5)" -> "(min-aspect-ratio: 5/6) and (max-aspect-ratio: 6/5)"
function containerToMedia(params) {
  const conditions = params.replace(/^\s*[\w-]+\s+(?=\()/, "");
  const parts = conditions.split(/\s+and\s+/);
  const out = [];
  for (const part of parts) {
    const trimmed = part.trim();
    const range = trimmed.match(/^\(\s*aspect-ratio\s*(>=|<=|>|<)\s*([\d./\s]+?)\s*\)$/);
    if (range) {
      out.push(`(${range[1][0] === ">" ? "min" : "max"}-aspect-ratio: ${range[2].replace(/\s+/g, "")})`);
    } else if (/^\((?:min|max)-aspect-ratio:[^)]*\)$/.test(trimmed)) {
      out.push(trimmed);
    } else {
      return null;
    }
  }
  return out.join(" and ");
}

export default function legacyCss() {
  return {
    postcssPlugin: "castwise-legacy-css",
    Once(root, { Rule, Declaration }) {
      // every element is "not a container" unless its own rule says container-type
      root.prepend(new Rule({ selector: "*", nodes: [new Declaration({ prop: "--cq-box", value: "0" })] }));
    },
    AtRule: {
      container(rule, { AtRule }) {
        if (rule[DONE]) return;
        rule[DONE] = true;
        const media = containerToMedia(rule.params);
        if (!media) return;
        const supports = new AtRule({ name: "supports", params: "not (container-type: size)" });
        const mediaRule = new AtRule({ name: "media", params: media });
        rule.each((node) => mediaRule.append(node.clone()));
        supports.append(mediaRule);
        rule.after(supports);
      },
    },
    Declaration(decl, { Declaration, Rule, AtRule }) {
      if (decl[DONE]) return;

      if (decl.prop === "container-type") {
        decl[DONE] = true;
        const marker = new Declaration({ prop: "--cq-box", value: "1" });
        marker[DONE] = true;
        decl.after(marker);
        return;
      }

      if (decl.prop === "inset") {
        const parts = decl.value.trim().split(/\s+(?![^()]*\))/);
        if (parts.length > 2) return;
        decl[DONE] = true;
        const [vertical, horizontal = vertical] = parts;
        for (const [prop, value] of [
          ["top", vertical],
          ["right", horizontal],
          ["bottom", vertical],
          ["left", horizontal],
        ]) {
          const side = new Declaration({ prop, value });
          side[DONE] = true;
          decl.before(side);
        }
        return;
      }

      if (!HAS_UNIT.test(decl.value)) return;
      decl[DONE] = true;
      const fallbackValue = toFallbackValue(decl.value);

      // A custom property has no fallback line (it accepts anything), and neither does a
      // value with var() in it: the parser accepts it whatever its unit, then it turns invalid
      // when the browser works it out and the property falls back to its default. Both get
      // the copy in a `@supports not` block after the rule instead.
      if (decl.prop.startsWith("--") || decl.value.includes("var(")) {
        const rule = decl.parent;
        if (!rule || rule.type !== "rule") return;
        const copy = new Declaration({ prop: decl.prop, value: fallbackValue });
        copy[DONE] = true;
        const holder = new Rule({ selector: rule.selector, nodes: [copy] });
        const supports = new AtRule({ name: "supports", params: "not (width: 1cqw)" });
        supports.append(holder);
        rule.after(supports);
        return;
      }

      const fallback = decl.clone({ value: fallbackValue });
      fallback[DONE] = true;
      decl.before(fallback);
    },
  };
}
legacyCss.postcss = true;
