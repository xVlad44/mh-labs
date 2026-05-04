from __future__ import annotations

import json
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
SOURCE_PATH = PROJECT_DIR / "src" / "cuckoo_search_experiment.py"
NOTEBOOK_PATH = PROJECT_DIR / "Cuckoo_Search_via_Levy_Flights_Final.ipynb"


def markdown_cell(text: str) -> dict:
    return {
        "cell_type": "markdown",
        "metadata": {},
        "source": [line + "\n" for line in text.strip().splitlines()],
    }


def code_cell(text: str) -> dict:
    return {
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": [line + "\n" for line in text.rstrip().splitlines()],
    }


def main() -> None:
    source = SOURCE_PATH.read_text(encoding="utf-8")
    source = source.split('if __name__ == "__main__":')[0].rstrip()

    notebook = {
        "cells": [
            markdown_cell(
                """
# Cuckoo Search via Levy Flights

Final metaheuristics lecture project.

Selected metaheuristic: **Cuckoo Search (CS)**, introduced by Xin-She Yang and Suash Deb in *Cuckoo Search via Levy Flights*, NaBIC 2009, pp. 210-214. The arXiv version is `arXiv:1003.1594`.

The goal of this notebook is to define the algorithm, implement it from scratch, and evaluate it on continuous benchmark functions in a way that connects naturally with the earlier labs on Evolutionary Algorithms and Particle Swarm Optimization.
                """
            ),
            markdown_cell(
                """
## 1. Idea of the algorithm

Cuckoo Search is a population-based metaheuristic. Each nest represents one candidate solution. The algorithm is inspired by two mechanisms:

1. Some cuckoo species lay eggs in other birds' nests.
2. Levy flights create random walks with many small moves and occasional very large jumps.

Yang and Deb use three idealized rules:

1. Each cuckoo lays one egg at a time in a randomly chosen nest.
2. The best nests survive to the next generation.
3. A fraction `pa` of nests is discovered and replaced.

For optimization, an egg/nest is just a solution vector. Good nests correspond to low objective values because all benchmark functions here are minimized.
                """
            ),
            markdown_cell(
                """
## 2. Pseudocode

```text
initialize n host nests
evaluate all nests

while stopping criterion is not met:
    generate new cuckoo solutions using Levy flights
    keep a new solution if it improves the corresponding nest

    discover/abandon a fraction pa of nests
    replace discovered nests by new population-based random walks

    keep the best nest found so far

return the best solution
```

Main parameters:

- `nests_count`: population size
- `pa`: discovery probability / abandonment fraction
- `alpha`: Levy-flight step scale
- `beta`: Levy exponent, usually around 1.5 in practical implementations
                """
            ),
            markdown_cell(
                """
## 3. Implementation

The implementation below is self-contained and uses no metaheuristic library. `numpy` is used only for vectors and random numbers. Levy steps are sampled with Mantegna's algorithm, a standard practical method for generating Levy-stable steps.
                """
            ),
            code_cell(source),
            markdown_cell(
                """
## 4. Experiment design

The demo uses three benchmark functions:

- **Sphere**: smooth unimodal function; a sanity check for exploitation.
- **Rastrigin**: many regular local minima; tests whether large jumps help exploration.
- **Michalewicz**: many sharp valleys; used in earlier labs, so it connects to the EA/PSO work.

Each configuration is run 30 times in 10 dimensions. I compare three CS settings plus a simple Random Search baseline with the same evaluation budget as the balanced CS setting. The table reports average, median, best/worst, standard deviation, and gap to the known optimum, so the discussion is based on reliability rather than a single lucky run.
                """
            ),
            code_cell(
                """
from pathlib import Path

PROJECT_DIR = Path.cwd()
if PROJECT_DIR.name != "final_cuckoo_search" and (PROJECT_DIR / "final_cuckoo_search").exists():
    PROJECT_DIR = PROJECT_DIR / "final_cuckoo_search"

results = run_experiments(PROJECT_DIR / "output", runs=30, dimension=10, seed=42)
print((PROJECT_DIR / "output" / "cs_results.txt").read_text(encoding="utf-8"))
                """
            ),
            markdown_cell(
                """
## 5. Convergence plots

The plots below show average convergence curves for the CS configurations. For Sphere and Rastrigin the y-axis is log-scaled because the optimum is zero and improvements span several orders of magnitude.
                """
            ),
            code_cell(
                """
try:
    from IPython.display import Image as DisplayImage, display

    for file_name in [
        "sphere_convergence.png",
        "rastrigin_convergence.png",
        "michalewicz_convergence.png",
        "summary_best_avg.png",
    ]:
        path = PROJECT_DIR / "output" / file_name
        if path.exists():
            display(DisplayImage(filename=str(path)))
except Exception as exc:
    print("Images were generated in the output folder, but inline display failed:", exc)
                """
            ),
            markdown_cell(
                """
## 6. Interpretation

The balanced and exploratory CS settings clearly outperform Random Search on all three functions over 30 independent runs. This is the expected result: Levy flights provide global exploration, while elitism keeps the best nests from being lost.

The exploratory setting performs best on Sphere and Michalewicz in this run, but it is also more variable. That is a useful discussion point: larger Levy steps can escape local minima, but they can also make the search less stable.

Rastrigin remains difficult because it has many local minima. CS improves strongly over Random Search, but it does not always reach the exact global optimum in the fixed evaluation budget.

Michalewicz is the most interesting benchmark for this project because it was also used in the EA and PSO labs. CS gets close to the known 10D optimum around `-9.66`, but not reliably all the way there. That makes the demo realistic instead of artificially perfect.
                """
            ),
            markdown_cell(
                """
## 7. Advantages, disadvantages, and extensions

Advantages:

- Simple population-based structure.
- Few parameters compared with many evolutionary algorithms.
- Levy flights combine local search with rare long jumps.
- Works naturally for continuous global optimization.

Disadvantages:

- Parameter choices still matter, especially `alpha` and `pa`.
- Standard CS is not guaranteed to find the global optimum.
- Continuous CS must be adapted carefully for discrete problems such as TSP.
- Performance comparisons depend heavily on evaluation budget and implementation details.

Potential extensions:

- Adaptive `pa` or adaptive `alpha`.
- Hybrid CS plus local search.
- Discrete CS for routing or scheduling.
- Multi-objective Cuckoo Search.
                """
            ),
            markdown_cell(
                """
## 8. References

- Yang, X.-S., and Deb, S. (2009). *Cuckoo Search via Levy Flights*. World Congress on Nature & Biologically Inspired Computing (NaBIC 2009), IEEE, pp. 210-214.
- arXiv version: https://arxiv.org/abs/1003.1594
                """
            ),
        ],
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {
                "codemirror_mode": {"name": "ipython", "version": 3},
                "file_extension": ".py",
                "mimetype": "text/x-python",
                "name": "python",
                "nbconvert_exporter": "python",
                "pygments_lexer": "ipython3",
                "version": "3.12",
            },
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }

    NOTEBOOK_PATH.write_text(json.dumps(notebook, indent=1), encoding="utf-8")
    print(NOTEBOOK_PATH)


if __name__ == "__main__":
    main()
