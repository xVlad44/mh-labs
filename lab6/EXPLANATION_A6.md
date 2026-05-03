# Assignment A6 — Talking Points

Short script for walking through the A6 section of `MH_Lab6_A6.ipynb` with the teacher.

## What A6 asks for

Implement and test an Evolutionary Algorithm for **two** continuous functions, and compare:
- 2 selection strategies
- 2 crossover operators
- 2 mutation operators

Save results to a file, write a short report.
v
## What I implemented

**Two benchmark functions:**
- **Sphere** — $f(x)=\sum_i x_i^2$, domain $[-5.12, 5.12]^d$, global minimum 0 at the origin. Unimodal, smooth. Used as a sanity check: any reasonable EA should drive it to near zero.
- **Michalewicz** ($m=10$) — $f(x) = -\sum_{i=1}^{d}\sin(x_i)\sin^{2m}(\tfrac{i x_i^2}{\pi})$, domain $[0,\pi]^d$, approximate global minimum $-9.66$ for $d=10$. Multimodal with $d!$ local minima; the steep ridges separated by flat regions make it a much harder search problem.

**Six operators (three pairs):**

| Category | Operator A | Operator B |
|---|---|---|
| Selection | **Tournament** — pick $k$ at random, keep the best. Selection pressure is tunable via $k$. | **Rank selection** — sort by fitness, sample proportionally to rank, not raw fitness. Insensitive to fitness scaling; can't be dominated by one super-fit individual. |
| Crossover | **Arithmetic** — children are weighted averages of parents: $c = \alpha p_1 + (1-\alpha) p_2$. Exploitative; children stay inside the parents' box. | **BLX-α (blend)** — each child gene drawn uniformly from an interval that *extends past* the parents by $\alpha \cdot |p_1 - p_2|$. Exploratory; can escape a box of converged parents. |
| Mutation | **Gaussian** — add $\mathcal{N}(0, \sigma)$ noise to a gene. Small, local perturbation. | **Uniform** — replace the gene with a fresh uniform random value in the whole domain. Large, non-local jump; good for escaping local optima, bad for fine-tuning. |

**Architecture.** One generic EA engine `run_custom_ea(...)` takes the three operators as arguments. This lets me swap any combination without duplicating the loop. The experiment tests 5 operator combinations (`A`–`E`) on both functions, 3 runs each, and writes a JSON log.

## Key implementation choices (be ready to defend)

- **Real-valued encoding** (not binary). Required because the functions are continuous; binary coding would lose precision.
- **Elitism** — the best individual is copied into the next generation unchanged. Prevents regression when bad crossover/mutation events occur. The report would look much noisier without it.
- **Clipping after BLX-α** — BLX can produce values outside the domain; I clip to `[min_val, max_val]`. Without clipping, the Michalewicz evaluation could produce `NaN` outside its valid domain.
- **Tournament size $k=3$** — a common default. Higher $k$ means more selection pressure (faster convergence, higher risk of premature convergence); $k=3$ is the mild choice.

## What the experiments actually show

Printed in the output of the experiments cell and saved to `results_continuous.txt`:

- **Sphere**: best config is `A` (tournament + arithmetic + gaussian), reaching avg fitness around $2 \times 10^{-4}$. Config `E` (rank + BLX + uniform) is worst at ~0.39 — both of its operators are exploratory, which hurts on a smooth convex function that rewards exploitation.
- **Michalewicz**: best is `C` (tournament + BLX + gaussian) at avg ~$-9.18$, vs the optimum $-9.66$. BLX's exploration pays off here because it lets the population reach other valleys. Uniform mutation (`E`) is too disruptive and ends at ~$-7.4$.

The **punchline** is the classic exploration/exploitation trade-off:
- Exploitative operators (arithmetic, gaussian) win on unimodal landscapes.
- At least one exploratory operator (BLX) helps on multimodal landscapes.
- Pure exploration (uniform mutation + rank + BLX) is bad everywhere — it never settles.

## Likely teacher questions

- **"Why only 3 runs per config?"** — Demonstration budget. The trends are consistent enough that 3 runs make the ranking clear, but I'd run 10–30 for a research-grade comparison.
- **"Why these operator pairs?"** — Each pair is the canonical textbook contrast: tournament vs. rank (pressure mechanism), arithmetic vs. BLX (exploit vs. explore within crossover), gaussian vs. uniform (local vs. global mutation).
- **"Could BLX children land outside the box?"** — Yes, that's why I clip. For Sphere it's cosmetic; for Michalewicz it's required because the function is undefined outside $[0, \pi]^d$.
- **"Why Michalewicz and not Rastrigin or Ackley?"** — Michalewicz is harder and more interesting: its local optima aren't symmetric around the origin, and the steep ridges test whether the EA can *find* the basin, not just *settle* in it.
- **"What's the global optimum of Michalewicz in 10D?"** — Approximately $-9.66$ (known numerical estimate from the literature; no closed form).
