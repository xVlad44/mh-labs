const fs = require("fs");
const path = require("path");

const {
  Presentation,
  PresentationFile,
  column,
  row,
  grid,
  panel,
  text,
  image,
  shape,
  rule,
  fill,
  hug,
  fixed,
  wrap,
  grow,
  fr,
} = require("@oai/artifact-tool");

const PROJECT = path.resolve(__dirname, "..");
const OUTPUT = path.join(PROJECT, "output");
const PREVIEW = path.join(OUTPUT, "slide_previews");
fs.mkdirSync(PREVIEW, { recursive: true });

const results = JSON.parse(fs.readFileSync(path.join(OUTPUT, "cs_results.json"), "utf8"));
const byFunction = new Map();
for (const rowData of results) {
  if (!byFunction.has(rowData.function)) byFunction.set(rowData.function, []);
  byFunction.get(rowData.function).push(rowData);
}

const C = {
  paper: "#FBFAF7",
  ink: "#1F2933",
  muted: "#5F6368",
  teal: "#246A73",
  rust: "#B5532F",
  violet: "#6B5CA5",
  gold: "#D19A3A",
  green: "#2E7D32",
  paleTeal: "#DDEDEA",
  paleRust: "#F1DFD7",
  paleViolet: "#E6E1F1",
  rule: "#D8D1C8",
  white: "#FFFFFF",
};

const OPTIMA = {
  Sphere: 0,
  Rastrigin: 0,
  Michalewicz: -9.66,
};

const titleStyle = { fontFace: "Aptos Display", fontSize: 62, bold: true, color: C.ink };
const sectionTitle = { fontFace: "Aptos Display", fontSize: 74, bold: true, color: C.ink };
const bodyStyle = { fontFace: "Aptos", fontSize: 29, color: C.ink };
const smallStyle = { fontFace: "Aptos", fontSize: 18, color: C.muted };
const monoStyle = { fontFace: "Consolas", fontSize: 24, color: C.ink };

function dataAsset(fileName) {
  const bytes = fs.readFileSync(path.join(OUTPUT, fileName));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function fmt(value) {
  const n = Number(value);
  if (n === 0) return "0";
  if (Math.abs(n) >= 1000 || Math.abs(n) < 0.001) return n.toExponential(2);
  return n.toFixed(Math.abs(n) < 10 ? 3 : 2);
}

function fmtSpread(rowData) {
  return `${fmt(rowData.avg)} +/- ${fmt(rowData.std)}`;
}

function runValues(rowData) {
  return JSON.parse(rowData.individual_runs || "[]").map(Number);
}

function pairedWins(cs, rs) {
  const a = runValues(cs);
  const b = runValues(rs);
  const count = Math.min(a.length, b.length);
  let wins = 0;
  for (let i = 0; i < count; i++) {
    if (a[i] < b[i]) wins += 1;
  }
  return `${wins}/${count}`;
}

function bestRow(fnName) {
  return [...byFunction.get(fnName)]
    .filter((r) => r.algorithm === "Cuckoo Search")
    .sort((a, b) => Number(a.avg) - Number(b.avg))[0];
}

function randomRow(fnName) {
  return [...byFunction.get(fnName)].find((r) => r.algorithm === "Random Search");
}

function root(content, fillColor = C.paper) {
  return panel(
    {
      name: "slide-background",
      width: fill,
      height: fill,
      fill: fillColor,
      padding: { x: 86, y: 64 },
    },
    content,
  );
}

function footer(label = "Yang & Deb, Cuckoo Search via Levy Flights, NaBIC 2009") {
  return text(label, {
    name: "source-footer",
    width: fill,
    height: hug,
    style: { fontFace: "Aptos", fontSize: 15, color: C.muted },
  });
}

function slideTitle(kicker, title, subtitle) {
  const children = [];
  if (kicker) {
    children.push(
      text(kicker.toUpperCase(), {
        name: "kicker",
        width: fill,
        height: hug,
        style: { fontFace: "Aptos", fontSize: 17, bold: true, color: C.teal },
      }),
    );
  }
  children.push(text(title, { name: "slide-title", width: fill, height: hug, style: titleStyle }));
  if (subtitle) {
    children.push(
      text(subtitle, {
        name: "slide-subtitle",
        width: wrap(1260),
        height: hug,
        style: { fontFace: "Aptos", fontSize: 27, color: C.muted },
      }),
    );
  }
  return column({ name: "title-stack", width: fill, height: hug, gap: 14 }, children);
}

function bullet(label, color = C.teal) {
  return row(
    { name: "bullet-row", width: fill, height: hug, gap: 18, align: "center" },
    [
      shape({ name: "bullet-mark", geometry: "ellipse", width: fixed(16), height: fixed(16), fill: color }),
      text(label, { name: "bullet-text", width: fill, height: hug, style: bodyStyle }),
    ],
  );
}

function metric(label, value, color) {
  return column(
    { name: "metric", width: fill, height: hug, gap: 8 },
    [
      text(value, {
        name: "metric-value",
        width: fill,
        height: hug,
        style: { fontFace: "Aptos Display", fontSize: 56, bold: true, color },
      }),
      text(label, {
        name: "metric-label",
        width: fill,
        height: hug,
        style: { fontFace: "Aptos", fontSize: 20, color: C.muted },
      }),
    ],
  );
}

function addSlide(presentation, node, bg = C.paper) {
  const slide = presentation.slides.add();
  slide.compose(root(node, bg), {
    frame: { left: 0, top: 0, width: 1920, height: 1080 },
    baseUnit: 8,
  });
  return slide;
}

async function saveBlobLike(blob, targetPath) {
  if (blob && typeof blob.save === "function") {
    await blob.save(targetPath);
    return;
  }
  if (blob && typeof blob.arrayBuffer === "function") {
    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(targetPath, buffer);
    return;
  }
  if (blob && blob.data) {
    fs.writeFileSync(targetPath, Buffer.from(blob.data));
    return;
  }
  throw new Error(`Cannot save exported artifact to ${targetPath}`);
}

function tableRow(values, opts = {}) {
  const { header = false, color = C.ink } = opts;
  return grid(
    {
      name: header ? "table-header" : "table-row",
      width: fill,
      height: hug,
      columns: [fr(0.85), fr(1.1), fr(1), fr(0.78), fr(0.74)],
      columnGap: 22,
      padding: { y: 12 },
    },
    values.map((value, i) =>
      text(String(value), {
        name: `table-cell-${i}`,
        width: fill,
        height: hug,
        style: {
          fontFace: "Aptos",
          fontSize: header ? 18 : 20,
          bold: header,
          color,
        },
      }),
    ),
  );
}

function resultRows() {
  const functions = ["Sphere", "Rastrigin", "Michalewicz"];
  return functions.map((fn) => {
    const cs = bestRow(fn);
    const rs = randomRow(fn);
    return [
      fn,
      `${cs.setting.replace("CS-", "")}: ${fmtSpread(cs)}`,
      fmt(rs.avg),
      fmt(Math.abs(Number(cs.avg) - OPTIMA[fn])),
      pairedWins(cs, rs),
    ];
  });
}

function benchmarkBand(name, why, expected, color) {
  return column(
    { name: `${name.toLowerCase()}-band`, width: fill, height: hug, gap: 12 },
    [
      rule({ name: `${name.toLowerCase()}-rule`, width: fill, stroke: C.rule, weight: 2 }),
      grid(
        { name: `${name.toLowerCase()}-row`, width: fill, height: hug, columns: [fr(0.72), fr(1.35), fr(1.25)], columnGap: 36, padding: { y: 12 } },
        [
          text(name, { name: `${name.toLowerCase()}-name`, width: fill, height: hug, style: { fontFace: "Aptos Display", fontSize: 38, bold: true, color } }),
          text(why, { name: `${name.toLowerCase()}-why`, width: fill, height: hug, style: { ...bodyStyle, fontSize: 25 } }),
          text(expected, { name: `${name.toLowerCase()}-expected`, width: fill, height: hug, style: { ...bodyStyle, fontSize: 25, color: C.muted } }),
        ],
      ),
    ],
  );
}

function miniMetric(label, value, color) {
  return column(
    { name: "mini-metric", width: fill, height: hug, gap: 6 },
    [
      text(value, {
        name: "mini-metric-value",
        width: fill,
        height: hug,
        style: { fontFace: "Aptos Display", fontSize: 48, bold: true, color },
      }),
      text(label, {
        name: "mini-metric-label",
        width: fill,
        height: hug,
        style: { fontFace: "Aptos", fontSize: 18, color: C.muted },
      }),
    ],
  );
}


function mappingBand(ruleText, meaning, implementation, color) {
  return column(
    { name: `${ruleText.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-band`, width: fill, height: hug, gap: 12 },
    [
      rule({ name: `${ruleText.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-rule`, width: fill, stroke: C.rule, weight: 2 }),
      grid(
        { name: `${ruleText.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-row`, width: fill, height: hug, columns: [fr(0.9), fr(1.35), fr(1.45)], columnGap: 36, padding: { y: 14 } },
        [
          text(ruleText, { name: "paper-rule-cell", width: fill, height: hug, style: { fontFace: "Aptos Display", fontSize: 32, bold: true, color } }),
          text(meaning, { name: "meaning-cell", width: fill, height: hug, style: { ...bodyStyle, fontSize: 25 } }),
          text(implementation, { name: "implementation-cell", width: fill, height: hug, style: { ...bodyStyle, fontSize: 25, color: C.muted } }),
        ],
      ),
    ],
  );
}

async function main() {
  const presentation = Presentation.create({ slideSize: { width: 1920, height: 1080 } });

  addSlide(
    presentation,
    column(
      { name: "cover", width: fill, height: fill, gap: 38, justify: "center" },
      [
        rule({ name: "cover-rule", width: fixed(360), stroke: C.gold, weight: 8 }),
        text("Cuckoo Search", {
          name: "cover-title-1",
          width: wrap(1280),
          height: hug,
          style: { fontFace: "Aptos Display", fontSize: 118, bold: true, color: C.white },
        }),
        text("via Levy Flights", {
          name: "cover-title-2",
          width: wrap(1080),
          height: hug,
          style: { fontFace: "Aptos Display", fontSize: 72, bold: true, color: "#F0D9A7" },
        }),
        text("Final metaheuristics presentation | continuous optimization demo", {
          name: "cover-subtitle",
          width: wrap(1040),
          height: hug,
          style: { fontFace: "Aptos", fontSize: 30, color: "#D6E3E0" },
        }),
        text("Reference: Yang & Deb, NaBIC 2009", {
          name: "cover-source",
          width: fill,
          height: hug,
          style: { fontFace: "Aptos", fontSize: 20, color: "#AFC3BE" },
        }),
      ],
    ),
    C.ink,
  );

  addSlide(
    presentation,
    column(
      { name: "content", width: fill, height: fill, gap: 34 },
      [
        slideTitle("Motivation", "A population search with rare long jumps", "Related to evolutionary algorithms and PSO through population search; distinctive because exploration uses heavy-tailed Levy flights."),
        row(
          { name: "two-forces", width: fill, height: grow(1), gap: 56, align: "center" },
          [
            column({ name: "left-force", width: grow(1), height: hug, gap: 20 }, [
              text("Intensification", {
                name: "force-title-1",
                width: fill,
                height: hug,
                style: { ...sectionTitle, fontSize: 58, color: C.teal },
              }),
              bullet("Best nests are preserved across iterations.", C.teal),
              bullet("Steps shrink naturally when nests approach the best solution.", C.teal),
            ]),
            column({ name: "right-force", width: grow(1), height: hug, gap: 20 }, [
              text("Diversification", {
                name: "force-title-2",
                width: fill,
                height: hug,
                style: { ...sectionTitle, fontSize: 58, color: C.rust },
              }),
              bullet("Levy flights sometimes make very large moves.", C.rust),
              bullet("Discovery probability replaces weak nests.", C.rust),
            ]),
          ],
        ),
        footer(),
      ],
    ),
  );

  addSlide(
    presentation,
    column(
      { name: "content", width: fill, height: fill, gap: 30 },
      [
        slideTitle("Definition", "From metaphor to optimization objects", "The biological story is only a design analogy. In code, everything becomes candidate solutions and objective values."),
        column({ name: "mapping-table", width: fill, height: hug, gap: 6 }, [
          grid(
            { name: "mapping-header", width: fill, height: hug, columns: [fr(0.9), fr(1.35), fr(1.45)], columnGap: 36 },
            [
              text("Paper rule", { name: "h1", width: fill, height: hug, style: { ...bodyStyle, fontSize: 22, bold: true, color: C.teal } }),
              text("Optimization meaning", { name: "h2", width: fill, height: hug, style: { ...bodyStyle, fontSize: 22, bold: true, color: C.teal } }),
              text("What my demo implements", { name: "h3", width: fill, height: hug, style: { ...bodyStyle, fontSize: 22, bold: true, color: C.teal } }),
            ],
          ),
          mappingBand("One egg", "new candidate solution", "Levy-generated vector in 10D", C.teal),
          mappingBand("Best nests survive", "elitist selection", "global best copied back if needed", C.rust),
          mappingBand("Discovery pa", "abandon weak regions", "population random-walk replacement", C.violet),
          rule({ name: "mapping-bottom-rule", width: fill, stroke: C.rule, weight: 2 }),
        ]),
        row({ name: "definition-details", width: fill, height: grow(1), gap: 56, align: "center" }, [
          metric("candidate", "x in R^10", C.teal),
          metric("fitness", "min f(x)", C.rust),
          metric("selection", "elitist", C.violet),
        ]),
        footer(),
      ],
    ),
  );

  addSlide(
    presentation,
    column(
      { name: "content", width: fill, height: fill, gap: 26 },
      [
        slideTitle("Algorithm", "The CS loop is short enough to explain live", "Most implementation complexity is in the Levy sampler and boundary handling."),
        row(
          { name: "algorithm-body", width: fill, height: grow(1), gap: 44 },
          [
            column({ name: "steps", width: grow(1), height: fill, gap: 22 }, [
              bullet("Initialize fixed number of nests uniformly in the search domain.", C.teal),
              bullet("Generate new nests with Levy flights.", C.rust),
              bullet("Keep a candidate only when it improves fitness.", C.green),
              bullet("Discover/replace part of the population using pa.", C.violet),
              bullet("Track the best nest after each iteration.", C.gold),
            ]),
            panel(
              { name: "code-artifact", width: fixed(700), height: hug, fill: "#F4EFE7", padding: { x: 30, y: 26 }, borderRadius: 8 },
              text("for iteration in range(max_iter):\n    new = levy_flight(nests, best)\n    nests = keep_improvements(nests, new)\n\n    discovered = random_walk(nests, pa)\n    nests = keep_improvements(nests, discovered)\n\n    best = min(nests, key=fitness)", {
                name: "pseudo-code",
                width: fill,
                height: hug,
                style: monoStyle,
              }),
            ),
          ],
        ),
        footer(),
      ],
    ),
  );

  addSlide(
    presentation,
    column(
      { name: "content", width: fill, height: fill, gap: 36 },
      [
        slideTitle("Levy Flights", "Small steps usually, large jumps sometimes", "That heavy tail is the search trick: local refinement remains possible, but the algorithm can still jump out of a bad basin."),
        row(
          { name: "levy-body", width: fill, height: grow(1), gap: 70, align: "center" },
          [
            column({ name: "levy-metrics", width: grow(1), height: hug, gap: 28 }, [
              miniMetric("normal local search move", "small", C.teal),
              miniMetric("Levy-flight escape move", "rare", C.rust),
              miniMetric("effect on search", "mixed", C.violet),
            ]),
            panel(
              { name: "levy-formula-artifact", width: fixed(780), height: hug, fill: "#F4EFE7", padding: { x: 34, y: 30 }, borderRadius: 8 },
              column({ name: "formula-stack", width: fill, height: hug, gap: 18 }, [
                text("Implementation detail", {
                  name: "formula-kicker",
                  width: fill,
                  height: hug,
                  style: { fontFace: "Aptos", fontSize: 20, bold: true, color: C.teal },
                }),
                text("step = alpha * Levy(beta) * (x_i - best)", {
                  name: "formula-main",
                  width: fill,
                  height: hug,
                  style: { ...monoStyle, fontSize: 25 },
                }),
                text("Mantegna sampler: Levy(beta) = u / |v|^(1 / beta), beta = 1.5", {
                  name: "formula-detail",
                  width: fill,
                  height: hug,
                  style: { fontFace: "Aptos", fontSize: 24, color: C.ink },
                }),
                text("After the move, each coordinate is clipped to the benchmark domain.", {
                  name: "formula-note",
                  width: fill,
                  height: hug,
                  style: { fontFace: "Aptos", fontSize: 22, color: C.muted },
                }),
              ]),
            ),
          ],
        ),
        footer(),
      ],
    ),
  );

  addSlide(
    presentation,
    column(
      { name: "content", width: fill, height: fill, gap: 28 },
      [
        slideTitle("Demo Design", "Three benchmarks, one fair baseline", "Continuous functions match the original CS paper, connect to the semester labs, and make the exploration-exploitation trade-off visible."),
        column({ name: "benchmark-bands", width: fill, height: hug, gap: 6 }, [
          grid(
            { name: "benchmark-header", width: fill, height: hug, columns: [fr(0.72), fr(1.35), fr(1.25)], columnGap: 36 },
            [
              text("Function", { name: "b-h1", width: fill, height: hug, style: { ...bodyStyle, fontSize: 22, bold: true, color: C.teal } }),
              text("Why it is useful", { name: "b-h2", width: fill, height: hug, style: { ...bodyStyle, fontSize: 22, bold: true, color: C.teal } }),
              text("Expected behavior", { name: "b-h3", width: fill, height: hug, style: { ...bodyStyle, fontSize: 22, bold: true, color: C.teal } }),
            ],
          ),
          benchmarkBand("Sphere", "smooth unimodal sanity check", "converge close to zero", C.teal),
          benchmarkBand("Rastrigin", "regular local minima across the domain", "large jumps should help", C.rust),
          benchmarkBand("Michalewicz", "sharp multimodal valleys", "good solutions, not guaranteed optimum", C.violet),
          rule({ name: "benchmark-bottom-rule", width: fill, stroke: C.rule, weight: 2 }),
        ]),
        row({ name: "demo-details", width: fill, height: hug, gap: 46 }, [
          metric("independent runs", "30", C.teal),
          metric("dimensions", "10D", C.rust),
          metric("per-run budget", "~10k evals", C.gold),
          metric("baseline", "same budget", C.violet),
        ]),
        footer(),
      ],
    ),
  );

  addSlide(
    presentation,
    column(
      { name: "content", width: fill, height: fill, gap: 24 },
      [
        slideTitle("Results", "CS beats random search on every benchmark", "Best CS setting by average performance over 30 runs; lower objective value and smaller gap are better."),
        column(
          { name: "result-table", width: fill, height: hug, gap: 0 },
          [
            tableRow(["Benchmark", "Best CS avg +/- std", "Random avg", "Gap", "Wins"], { header: true, color: C.teal }),
            rule({ name: "table-rule", width: fill, stroke: C.rule, weight: 2 }),
            ...resultRows().flatMap((values, i) => [
              tableRow(values, { color: i === 2 ? C.ink : C.ink }),
              rule({ name: `row-rule-${i}`, width: fill, stroke: C.rule, weight: 1 }),
            ]),
          ],
        ),
        row({ name: "result-callouts", width: fill, height: grow(1), gap: 50, align: "center" }, [
          metric("Sphere avg", fmt(bestRow("Sphere").avg), C.teal),
          metric("Rastrigin avg", fmt(bestRow("Rastrigin").avg), C.rust),
          metric("Michalewicz best run", fmt(Math.min(...byFunction.get("Michalewicz").filter((r) => r.algorithm === "Cuckoo Search").map((r) => Number(r.best)))), C.violet),
        ]),
        footer("Experiments in Cuckoo_Search_via_Levy_Flights_Final.ipynb; wins compare CS and Random Search run indices under the same budget."),
      ],
    ),
  );

  addSlide(
    presentation,
    column(
      { name: "content", width: fill, height: fill, gap: 26 },
      [
        slideTitle("Convergence", "The useful pattern is fast early improvement", "Average curves over 30 runs show where CS is stable and where it remains sensitive to settings."),
        row(
          { name: "plot-and-read", width: fill, height: grow(1), gap: 48, align: "center" },
          [
            image({ name: "michalewicz-plot", dataUrl: dataAsset("michalewicz_convergence.png"), contentType: "image/png", width: grow(1.55), height: fill, fit: "contain", alt: "Michalewicz convergence plot" }),
            column({ name: "convergence-read", width: grow(0.85), height: hug, gap: 28 }, [
              metric("early phase", "steep drop", C.teal),
              text("Most improvement happens before the final iterations, which is typical for population metaheuristics.", {
                name: "read-1",
                width: fill,
                height: hug,
                style: bodyStyle,
              }),
              metric("parameter effect", "visible", C.rust),
              text("The exploratory setting reaches better Michalewicz values here, but it also has higher run-to-run variance.", {
                name: "read-2",
                width: fill,
                height: hug,
                style: bodyStyle,
              }),
            ]),
          ],
        ),
        footer("Representative plot from the same 30-run experiment; Sphere and Rastrigin plots are saved in the output folder."),
      ],
    ),
  );

  addSlide(
    presentation,
    column(
      { name: "content", width: fill, height: fill, gap: 28 },
      [
        slideTitle("Discussion", "The algorithm is simple, but not magic", "The important scientific point is the exploration-exploitation trade-off, not just the nature metaphor."),
        grid(
          { name: "discussion-grid", width: fill, height: grow(1), columns: [fr(1), fr(1), fr(1)], columnGap: 44 },
          [
            column({ name: "advantages", width: fill, height: hug, gap: 18 }, [
              text("Advantages", { name: "adv-title", width: fill, height: hug, style: { ...sectionTitle, fontSize: 44, color: C.teal } }),
              bullet("few parameters", C.teal),
              bullet("strong global jumps", C.teal),
              bullet("easy continuous encoding", C.teal),
            ]),
            column({ name: "limits", width: fill, height: hug, gap: 18 }, [
              text("Limits", { name: "lim-title", width: fill, height: hug, style: { ...sectionTitle, fontSize: 44, color: C.rust } }),
              bullet("sensitive to alpha and pa", C.rust),
              bullet("no guarantee of global optimum", C.rust),
              bullet("discrete problems need redesign", C.rust),
            ]),
            column({ name: "extensions", width: fill, height: hug, gap: 18 }, [
              text("Extensions", { name: "ext-title", width: fill, height: hug, style: { ...sectionTitle, fontSize: 44, color: C.violet } }),
              bullet("adaptive step size", C.violet),
              bullet("hybrid local search", C.violet),
              bullet("multi-objective CS", C.violet),
            ]),
          ],
        ),
        footer(),
      ],
    ),
  );

  addSlide(
    presentation,
    column(
      { name: "content", width: fill, height: fill, gap: 36, justify: "center" },
      [
        rule({ name: "closing-rule", width: fixed(340), stroke: C.gold, weight: 8 }),
        text("Main takeaway", {
          name: "closing-kicker",
          width: fill,
          height: hug,
          style: { fontFace: "Aptos", fontSize: 24, bold: true, color: C.teal },
        }),
        text("Cuckoo Search is a compact global optimizer that gets its strength from elitism plus heavy-tailed exploration.", {
          name: "closing-title",
          width: wrap(1320),
          height: hug,
          style: { fontFace: "Aptos Display", fontSize: 68, bold: true, color: C.ink },
        }),
        text("Best use in this demo: continuous multimodal search where occasional long jumps are useful, but parameter tuning still matters.", {
          name: "closing-subtitle",
          width: wrap(1180),
          height: hug,
          style: { fontFace: "Aptos", fontSize: 30, color: C.muted },
        }),
        text("Questions", {
          name: "questions",
          width: fill,
          height: hug,
          style: { fontFace: "Aptos Display", fontSize: 54, bold: true, color: C.rust },
        }),
      ],
    ),
  );

  const pptxPath = path.join(OUTPUT, "Cuckoo_Search_via_Levy_Flights_Final.pptx");
  const pptxBlob = await PresentationFile.exportPptx(presentation);
  await pptxBlob.save(pptxPath);

  for (let i = 0; i < presentation.slides.count; i++) {
    const slide = presentation.slides.getItem(i);
    const blob = await slide.export({ format: "png" });
    await saveBlobLike(blob, path.join(PREVIEW, `slide_${String(i + 1).padStart(2, "0")}.png`));
  }

  const imported = await PresentationFile.importPptx(fs.readFileSync(pptxPath));
  const parityDir = path.join(OUTPUT, "pptx_parity_previews");
  fs.mkdirSync(parityDir, { recursive: true });
  for (let i = 0; i < imported.slides.count; i++) {
    const slide = imported.slides.getItem(i);
    const blob = await slide.export({ format: "png" });
    await saveBlobLike(blob, path.join(parityDir, `slide_${String(i + 1).padStart(2, "0")}.png`));
  }

  const layout = await presentation.inspect({ format: "layout" });
  fs.writeFileSync(path.join(OUTPUT, "presentation_inspect.json"), JSON.stringify(layout, null, 2), "utf8");
  console.log(pptxPath);
  console.log(PREVIEW);
  console.log(parityDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
