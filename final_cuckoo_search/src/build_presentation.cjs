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
      columns: [fr(0.95), fr(1.05), fr(1), fr(1.4)],
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
          fontSize: header ? 19 : 22,
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
    let takeaway;
    if (fn === "Sphere") takeaway = "near-zero refinement";
    else if (fn === "Rastrigin") takeaway = "escapes many local basins";
    else takeaway = "close, but not guaranteed";
    return [fn, `${cs.setting.replace("CS-", "")}: ${fmt(cs.avg)}`, fmt(rs.avg), takeaway];
  });
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
        slideTitle("Motivation", "A population search with rare long jumps", "CS keeps good nests, perturbs them with Levy flights, and periodically replaces discovered weak nests."),
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
        grid(
          { name: "mapping-table", width: fill, height: grow(1), columns: [fr(0.9), fr(1.45), fr(1.45)], rowGap: 16, columnGap: 32 },
          [
            text("Paper rule", { name: "h1", width: fill, height: hug, style: { ...bodyStyle, bold: true, color: C.teal } }),
            text("Optimization meaning", { name: "h2", width: fill, height: hug, style: { ...bodyStyle, bold: true, color: C.teal } }),
            text("What my demo implements", { name: "h3", width: fill, height: hug, style: { ...bodyStyle, bold: true, color: C.teal } }),
            text("One egg", { name: "r1c1", width: fill, height: hug, style: bodyStyle }),
            text("One new candidate solution", { name: "r1c2", width: fill, height: hug, style: bodyStyle }),
            text("Levy-generated vector in 10D", { name: "r1c3", width: fill, height: hug, style: bodyStyle }),
            text("Best nests survive", { name: "r2c1", width: fill, height: hug, style: bodyStyle }),
            text("Elitist selection", { name: "r2c2", width: fill, height: hug, style: bodyStyle }),
            text("Global best is copied back if needed", { name: "r2c3", width: fill, height: hug, style: bodyStyle }),
            text("Discovery pa", { name: "r3c1", width: fill, height: hug, style: bodyStyle }),
            text("Abandon weak regions", { name: "r3c2", width: fill, height: hug, style: bodyStyle }),
            text("Population random walk replacement", { name: "r3c3", width: fill, height: hug, style: bodyStyle }),
          ],
        ),
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
          { name: "levy-metrics", width: fill, height: grow(1), gap: 60, align: "center" },
          [
            metric("normal local search move", "small", C.teal),
            metric("Levy-flight escape move", "rare", C.rust),
            metric("effect on search", "mixed", C.violet),
          ],
        ),
        text("In the implementation, Mantegna sampling generates the heavy-tailed steps; values outside the domain are clipped back to valid bounds.", {
          name: "levy-caption",
          width: wrap(1260),
          height: hug,
          style: { ...bodyStyle, color: C.muted },
        }),
        footer(),
      ],
    ),
  );

  addSlide(
    presentation,
    column(
      { name: "content", width: fill, height: fill, gap: 28 },
      [
        slideTitle("Demo Design", "Three benchmarks, one fair baseline", "I used continuous test functions because the original paper validates CS on test functions, and the semester labs already used Sphere and Michalewicz."),
        grid(
          { name: "benchmark-grid", width: fill, height: grow(1), columns: [fr(0.8), fr(1.15), fr(1.55)], rowGap: 18, columnGap: 32 },
          [
            text("Function", { name: "b-h1", width: fill, height: hug, style: { ...bodyStyle, bold: true, color: C.teal } }),
            text("Why it is useful", { name: "b-h2", width: fill, height: hug, style: { ...bodyStyle, bold: true, color: C.teal } }),
            text("Expected behavior", { name: "b-h3", width: fill, height: hug, style: { ...bodyStyle, bold: true, color: C.teal } }),
            text("Sphere", { name: "b1", width: fill, height: hug, style: bodyStyle }),
            text("smooth unimodal sanity check", { name: "b2", width: fill, height: hug, style: bodyStyle }),
            text("should converge close to zero", { name: "b3", width: fill, height: hug, style: bodyStyle }),
            text("Rastrigin", { name: "b4", width: fill, height: hug, style: bodyStyle }),
            text("many regular local minima", { name: "b5", width: fill, height: hug, style: bodyStyle }),
            text("large jumps should help", { name: "b6", width: fill, height: hug, style: bodyStyle }),
            text("Michalewicz", { name: "b7", width: fill, height: hug, style: bodyStyle }),
            text("sharp multimodal valleys", { name: "b8", width: fill, height: hug, style: bodyStyle }),
            text("good solutions, not guaranteed optimum", { name: "b9", width: fill, height: hug, style: bodyStyle }),
          ],
        ),
        row({ name: "demo-details", width: fill, height: hug, gap: 46 }, [
          metric("independent runs", "10", C.teal),
          metric("dimensions", "10D", C.rust),
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
        slideTitle("Results", "CS beats random search on every benchmark", "The table reports the best CS setting by average performance, compared with Random Search using the same evaluation budget."),
        column(
          { name: "result-table", width: fill, height: hug, gap: 0 },
          [
            tableRow(["Benchmark", "Best CS avg", "Random avg", "Main read"], { header: true, color: C.teal }),
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
        footer("Experiments in Cuckoo_Search_via_Levy_Flights_Final.ipynb; lower objective value is better."),
      ],
    ),
  );

  addSlide(
    presentation,
    column(
      { name: "content", width: fill, height: fill, gap: 26 },
      [
        slideTitle("Convergence", "The useful pattern is fast early improvement", "Average curves over 10 runs show where CS is stable and where it remains sensitive to settings."),
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
        footer("Representative plot from the same 10-run experiment; Sphere and Rastrigin plots are saved in the output folder."),
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
