from __future__ import annotations

import csv
import json
import math
import random
import statistics
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Iterable, List, Sequence, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFont


Vector = np.ndarray
Objective = Callable[[Vector], float]


@dataclass(frozen=True)
class Benchmark:
    name: str
    objective: Objective
    lower: float
    upper: float
    optimum: float
    note: str


def sphere(x: Vector) -> float:
    return float(np.sum(x * x))


def rastrigin(x: Vector) -> float:
    d = len(x)
    return float(10 * d + np.sum(x * x - 10 * np.cos(2 * math.pi * x)))


def michalewicz(x: Vector, m: int = 10) -> float:
    i = np.arange(1, len(x) + 1)
    return float(-np.sum(np.sin(x) * np.sin(i * x * x / math.pi) ** (2 * m)))


BENCHMARKS: Tuple[Benchmark, ...] = (
    Benchmark("Sphere", sphere, -5.12, 5.12, 0.0, "smooth unimodal sanity check"),
    Benchmark("Rastrigin", rastrigin, -5.12, 5.12, 0.0, "multimodal with regular local minima"),
    Benchmark("Michalewicz", michalewicz, 0.0, math.pi, -9.66, "multimodal with many sharp valleys"),
)


def levy_step(beta: float, dimension: int, rng: np.random.Generator) -> Vector:
    """Mantegna's algorithm for Levy-stable random steps.

    The original CS paper specifies Levy flights with a heavy-tailed step-length
    distribution. Mantegna sampling is a common practical way to generate those
    steps for continuous optimization.
    """
    numerator = math.gamma(1 + beta) * math.sin(math.pi * beta / 2)
    denominator = math.gamma((1 + beta) / 2) * beta * (2 ** ((beta - 1) / 2))
    sigma_u = (numerator / denominator) ** (1 / beta)
    u = rng.normal(0, sigma_u, dimension)
    v = rng.normal(0, 1, dimension)
    return u / (np.abs(v) ** (1 / beta))


def random_positions(
    count: int,
    dimension: int,
    lower: float,
    upper: float,
    rng: np.random.Generator,
) -> np.ndarray:
    return rng.uniform(lower, upper, size=(count, dimension))


def cuckoo_search(
    objective: Objective,
    dimension: int,
    lower: float,
    upper: float,
    nests_count: int = 25,
    iterations: int = 200,
    pa: float = 0.25,
    alpha: float = 0.01,
    beta: float = 1.5,
    seed: int = 42,
) -> Dict[str, object]:
    """Minimize an objective function with Cuckoo Search via Levy flights."""
    rng = np.random.default_rng(seed)
    nests = random_positions(nests_count, dimension, lower, upper, rng)
    fitness = np.array([objective(nest) for nest in nests])

    best_index = int(np.argmin(fitness))
    best = nests[best_index].copy()
    best_fitness = float(fitness[best_index])
    history = [best_fitness]
    evaluations = nests_count
    scale = upper - lower

    for _ in range(iterations):
        # 1. Generate new nests by Levy flights. This vectorized form is widely
        # used in practical CS implementations: the step is heavy-tailed, while
        # the distance from the current best scales the move size.
        levy = np.array([levy_step(beta, dimension, rng) for _ in range(nests_count)])
        candidate_nests = nests + alpha * levy * (nests - best) * rng.normal(size=nests.shape)
        candidate_nests = np.clip(candidate_nests, lower, upper)
        candidate_fitness = np.array([objective(candidate) for candidate in candidate_nests])
        evaluations += nests_count

        improved = candidate_fitness < fitness
        nests[improved] = candidate_nests[improved]
        fitness[improved] = candidate_fitness[improved]

        current_best_index = int(np.argmin(fitness))
        if fitness[current_best_index] < best_fitness:
            best = nests[current_best_index].copy()
            best_fitness = float(fitness[current_best_index])

        # 2. A fraction pa of nests is discovered/abandoned. The replacement is
        # implemented as a biased random walk between shuffled nests, which keeps
        # the search population-based instead of restarting everything randomly.
        perm_1 = rng.permutation(nests_count)
        perm_2 = rng.permutation(nests_count)
        discovery_mask = rng.random(size=nests.shape) > pa
        random_walk = rng.random() * (nests[perm_1] - nests[perm_2])
        discovered_nests = nests + random_walk * discovery_mask
        discovered_nests = np.clip(discovered_nests, lower, upper)
        discovered_fitness = np.array([objective(candidate) for candidate in discovered_nests])
        evaluations += nests_count

        improved = discovered_fitness < fitness
        nests[improved] = discovered_nests[improved]
        fitness[improved] = discovered_fitness[improved]

        # 3. Keep the best solution found so far explicitly, even if a future
        # discovery step creates worse nests around it.
        current_best_index = int(np.argmin(fitness))
        if fitness[current_best_index] < best_fitness:
            best = nests[current_best_index].copy()
            best_fitness = float(fitness[current_best_index])
        else:
            worst_index = int(np.argmax(fitness))
            nests[worst_index] = best
            fitness[worst_index] = best_fitness

        history.append(best_fitness)

    return {
        "best_position": best.tolist(),
        "best_fitness": best_fitness,
        "history": history,
        "evaluations": evaluations,
    }


def random_search(
    objective: Objective,
    dimension: int,
    lower: float,
    upper: float,
    evaluations: int,
    seed: int,
) -> Dict[str, object]:
    rng = np.random.default_rng(seed)
    best = None
    best_fitness = math.inf
    history = []
    for _ in range(evaluations):
        candidate = rng.uniform(lower, upper, size=dimension)
        value = objective(candidate)
        if value < best_fitness:
            best_fitness = float(value)
            best = candidate.copy()
        history.append(best_fitness)
    return {
        "best_position": best.tolist() if best is not None else [],
        "best_fitness": best_fitness,
        "history": history,
        "evaluations": evaluations,
    }


def summarize(values: Sequence[float]) -> Dict[str, float]:
    return {
        "avg": statistics.mean(values),
        "best": min(values),
        "worst": max(values),
        "std": statistics.pstdev(values),
    }


def run_experiments(
    output_dir: Path,
    runs: int = 10,
    dimension: int = 10,
    seed: int = 42,
) -> Dict[str, object]:
    output_dir.mkdir(parents=True, exist_ok=True)

    configurations = [
        {"name": "CS-balanced", "nests_count": 25, "iterations": 200, "pa": 0.25, "alpha": 0.01},
        {"name": "CS-exploratory", "nests_count": 25, "iterations": 200, "pa": 0.25, "alpha": 0.05},
        {"name": "CS-conservative", "nests_count": 25, "iterations": 200, "pa": 0.10, "alpha": 0.01},
    ]

    rows: List[Dict[str, object]] = []
    histories: Dict[str, List[float]] = {}

    for benchmark in BENCHMARKS:
        for config in configurations:
            values = []
            aligned_histories = []
            eval_budget = None
            for run_id in range(runs):
                run_seed = seed + 1000 * run_id + 17 * len(rows)
                result = cuckoo_search(
                    benchmark.objective,
                    dimension,
                    benchmark.lower,
                    benchmark.upper,
                    seed=run_seed,
                    **{k: v for k, v in config.items() if k != "name"},
                )
                values.append(float(result["best_fitness"]))
                aligned_histories.append(result["history"])
                eval_budget = int(result["evaluations"])

            stats = summarize(values)
            row = {
                "function": benchmark.name,
                "setting": config["name"],
                "algorithm": "Cuckoo Search",
                "runs": runs,
                "dimension": dimension,
                "evaluations_per_run": eval_budget,
                "avg": stats["avg"],
                "best": stats["best"],
                "worst": stats["worst"],
                "std": stats["std"],
                "params": json.dumps(config),
                "individual_runs": json.dumps(values),
            }
            rows.append(row)
            histories[f"{benchmark.name}:{config['name']}"] = list(np.mean(aligned_histories, axis=0))

        # Same evaluation budget as CS-balanced, used only as a simple baseline.
        balanced_budget = int(rows[-3]["evaluations_per_run"])
        values = []
        for run_id in range(runs):
            result = random_search(
                benchmark.objective,
                dimension,
                benchmark.lower,
                benchmark.upper,
                balanced_budget,
                seed + 9000 + run_id,
            )
            values.append(float(result["best_fitness"]))
        stats = summarize(values)
        rows.append(
            {
                "function": benchmark.name,
                "setting": "Random Search",
                "algorithm": "Random Search",
                "runs": runs,
                "dimension": dimension,
                "evaluations_per_run": balanced_budget,
                "avg": stats["avg"],
                "best": stats["best"],
                "worst": stats["worst"],
                "std": stats["std"],
                "params": json.dumps({"evaluations": balanced_budget}),
                "individual_runs": json.dumps(values),
            }
        )

    csv_path = output_dir / "cs_results.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    json_path = output_dir / "cs_results.json"
    json_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")

    txt_path = output_dir / "cs_results.txt"
    write_text_report(txt_path, rows)

    for benchmark in BENCHMARKS:
        plot_path = output_dir / f"{benchmark.name.lower()}_convergence.png"
        plot_convergence(
            plot_path,
            {
                key.split(":")[1]: value
                for key, value in histories.items()
                if key.startswith(f"{benchmark.name}:")
            },
            title=f"{benchmark.name}: average CS convergence over {runs} runs",
            y_label="best objective value",
            log_scale=benchmark.optimum >= 0,
        )

    plot_summary_bar(output_dir / "summary_best_avg.png", rows)

    return {"rows": rows, "histories": histories}


def format_float(value: float) -> str:
    if value == 0:
        return "0"
    if abs(value) >= 1000 or abs(value) < 0.001:
        return f"{value:.4e}"
    return f"{value:.4f}"


def write_text_report(path: Path, rows: Sequence[Dict[str, object]]) -> None:
    functions = []
    for row in rows:
        if row["function"] not in functions:
            functions.append(row["function"])

    lines = [
        "=" * 78,
        "CUCKOO SEARCH VIA LEVY FLIGHTS -- FINAL PROJECT EXPERIMENTS",
        "=" * 78,
        "All objective functions are minimized. Each row summarizes 10 independent runs.",
        "",
    ]
    for function in functions:
        lines.append("-" * 78)
        lines.append(f"FUNCTION: {function}")
        lines.append("-" * 78)
        lines.append(f"{'Setting':<18} {'Algorithm':<16} {'Avg':>13} {'Best':>13} {'Worst':>13} {'Std':>13}")
        for row in rows:
            if row["function"] != function:
                continue
            lines.append(
                f"{row['setting']:<18} {row['algorithm']:<16} "
                f"{format_float(float(row['avg'])):>13} "
                f"{format_float(float(row['best'])):>13} "
                f"{format_float(float(row['worst'])):>13} "
                f"{format_float(float(row['std'])):>13}"
            )
        lines.append("")

    lines.extend(
        [
            "Notes:",
            "* CS-balanced is the main configuration used in the presentation.",
            "* Random Search uses the same evaluation budget as CS-balanced.",
            "* The exploratory setting increases the Levy step scale alpha.",
            "* The conservative setting lowers the nest discovery probability pa.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/aptos.ttf",
        "C:/Windows/Fonts/calibri.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    bold_candidates = [
        "C:/Windows/Fonts/aptosbd.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ]
    for candidate in (bold_candidates if bold else candidates):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def plot_convergence(
    path: Path,
    histories: Dict[str, Sequence[float]],
    title: str,
    y_label: str,
    log_scale: bool,
) -> None:
    width, height = 1400, 850
    margin_left, margin_top, margin_right, margin_bottom = 120, 90, 60, 120
    plot_w = width - margin_left - margin_right
    plot_h = height - margin_top - margin_bottom
    image = Image.new("RGB", (width, height), "#fbfaf7")
    draw = ImageDraw.Draw(image)
    title_font = load_font(34, bold=True)
    label_font = load_font(22)
    small_font = load_font(18)
    colors = ["#246A73", "#B5532F", "#6B5CA5", "#2E7D32"]

    draw.text((margin_left, 25), title, fill="#1f2933", font=title_font)
    draw.line((margin_left, margin_top + plot_h, margin_left + plot_w, margin_top + plot_h), fill="#404040", width=2)
    draw.line((margin_left, margin_top, margin_left, margin_top + plot_h), fill="#404040", width=2)

    transformed = {}
    all_y = []
    for name, history in histories.items():
        y_values = list(history)
        if log_scale:
            y_values = [math.log10(max(v, 1e-45)) for v in y_values]
        transformed[name] = y_values
        all_y.extend(y_values)

    y_min, y_max = min(all_y), max(all_y)
    if abs(y_max - y_min) < 1e-12:
        y_min -= 1
        y_max += 1

    for i in range(6):
        t = i / 5
        y = margin_top + plot_h - t * plot_h
        raw = y_min + t * (y_max - y_min)
        label = f"1e{raw:.0f}" if log_scale else format_float(raw)
        draw.line((margin_left, y, margin_left + plot_w, y), fill="#e4ded5", width=1)
        draw.text((25, y - 12), label, fill="#5f6368", font=small_font)

    for index, (name, y_values) in enumerate(transformed.items()):
        points = []
        for x_index, y_value in enumerate(y_values):
            x = margin_left + x_index / (len(y_values) - 1) * plot_w
            y = margin_top + plot_h - (y_value - y_min) / (y_max - y_min) * plot_h
            points.append((x, y))
        draw.line(points, fill=colors[index % len(colors)], width=4)
        lx = margin_left + 20 + 300 * index
        ly = height - 70
        draw.line((lx, ly + 12, lx + 50, ly + 12), fill=colors[index % len(colors)], width=5)
        draw.text((lx + 62, ly), name, fill="#1f2933", font=label_font)

    draw.text((margin_left + plot_w // 2 - 45, height - 38), "iteration", fill="#5f6368", font=small_font)
    draw.text((8, margin_top - 35), y_label + (" (log10)" if log_scale else ""), fill="#5f6368", font=small_font)
    image.save(path)


def plot_summary_bar(path: Path, rows: Sequence[Dict[str, object]]) -> None:
    cs_rows = [r for r in rows if r["setting"] == "CS-balanced"]
    width, height = 1300, 800
    image = Image.new("RGB", (width, height), "#fbfaf7")
    draw = ImageDraw.Draw(image)
    title_font = load_font(36, bold=True)
    label_font = load_font(24)
    small_font = load_font(18)
    draw.text((70, 35), "CS-balanced average best fitness by benchmark", fill="#1f2933", font=title_font)
    y_positions = [180, 360, 540]
    colors = ["#246A73", "#B5532F", "#6B5CA5"]
    for row, y, color in zip(cs_rows, y_positions, colors):
        function = str(row["function"])
        value = float(row["avg"])
        optimum = next(b.optimum for b in BENCHMARKS if b.name == function)
        closeness = abs(value - optimum)
        # Use a visual score where smaller distance to known optimum produces a longer bar.
        score = 1 / (1 + closeness)
        bar_w = int(760 * score)
        draw.text((90, y - 12), function, fill="#1f2933", font=label_font)
        draw.rounded_rectangle((330, y - 20, 1090, y + 30), radius=8, fill="#e8e0d6")
        draw.rounded_rectangle((330, y - 20, 330 + bar_w, y + 30), radius=8, fill=color)
        draw.text((1110, y - 12), f"avg {format_float(value)}", fill="#1f2933", font=small_font)
        draw.text((330, y + 45), f"known optimum ~= {format_float(optimum)}", fill="#5f6368", font=small_font)
    image.save(path)


if __name__ == "__main__":
    run_experiments(Path(__file__).resolve().parents[1] / "output")
