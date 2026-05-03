# Lab 7 + Assignment A7 — Talking Points

Script for walking through `MH_Lab7_A7.ipynb` with the teacher. Covers both
the lab section (basic PSO on Sphere) and the assignment section (two PSO
variants on Sphere + Michalewicz).

---

## Part 1: Lab 7 work (basic PSO on Sphere)

### What the lab asks for

Implement Particle Swarm Optimization for the Sphere function with:
- Particle initialization
- Position, velocity, fitness computation
- Local best (pbest) and global best (gbest) tracking
- Testing with multiple parameter settings

### How PSO works (one-liner)

A swarm of candidate solutions moves through the search space. Each particle $i$
has a position $x_i$ and a velocity $v_i$. Every iteration, velocity is pulled
toward two attractors:
- $p_i$: the best position *that particle* has ever seen (cognitive)
- $g$: the best position the *whole swarm* has ever seen (social)

The update rule used in the lab section (inertia-weight form, Shi & Eberhart 1998):

```
v_i <- w*v_i  +  c1*r1*(p_i - x_i)  +  c2*r2*(g - x_i)
x_i <- x_i + v_i
```

with $r_1, r_2 \sim U(0,1)$. The three hyperparameters are:
- `w` — inertia; how much of previous velocity is retained. High = explore, low = exploit.
- `c1` — cognitive weight (pull toward personal best).
- `c2` — social weight (pull toward global best).

### Implementation details to be ready for

- **Velocity clamping.** Without bounding $|v_i| \le v_{max}$, particles can shoot off the domain on early iterations. I clamp to $0.2 \times (\text{max} - \text{min})$ per dimension.
- **Position clamping.** After updating $x_i \leftarrow x_i + v_i$, I clip each coordinate into $[\text{min}, \text{max}]$ so the particle never leaves the domain. Necessary for Michalewicz later, harmless for Sphere.
- **Initial velocities** are drawn from $U(-v_{max}, v_{max})$, not zero — starting at zero would make every particle move toward pbest=current=gbest on iteration 1, stalling the swarm.
- **pbest and gbest update.** After evaluating a particle's new fitness, I update its pbest if it improved, and immediately update gbest if pbest improved — no need for a separate sweep at the end of each iteration.

### The parameter-setting experiment

Five settings run side by side on Sphere, each plotted on a log scale:

| Setting | Swarm | Iter | w   | c1  | c2  | Expected behavior                  |
|---|---|---|---|---|---|---|
| S1 | 30 | 200 | 0.7 | 1.5 | 1.5 | Balanced baseline                  |
| S2 | 80 | 200 | 0.7 | 1.5 | 1.5 | Larger swarm → more parallel search |
| S3 | 30 | 200 | 0.9 | 1.5 | 1.5 | More exploration (high inertia)    |
| S4 | 30 | 200 | 0.4 | 1.0 | 2.0 | More exploitation (low inertia + social pull) |
| S5 | 30 | 500 | 0.7 | 1.5 | 1.5 | More iterations of baseline        |

Observed:
- S3 (high inertia) converges *slowest* because particles keep drifting.
- S4 (low inertia, strong social) converges very fast; reached ~$10^{-24}$.
- S5 pushes below $10^{-29}$ simply by getting more budget.
- Takeaway: PSO works on Sphere across a wide range of parameters, but over-exploration hurts on a convex function.

---

## Part 2: Assignment A7 (two PSO variants, two functions)

### What A7 asks for

Implement **two variants of PSO**, run on Sphere and on one other function
(the same one used in A6 — I used **Michalewicz**), compare them.

### The two variants chosen (from the Shami et al. 2022 survey)

| Variant | Reference | Velocity update | Key idea |
|---|---|---|---|
| **LDW-PSO** (Linearly Decreasing Weight) | Shi & Eberhart, 1998 | $v \leftarrow w(t) v + c_1 r_1 (p-x) + c_2 r_2 (g-x)$ with $w(t)$ decreasing linearly from 0.9 to 0.4 | Explore early, exploit late — explicit schedule |
| **CF-PSO** (Constriction Factor) | Clerc & Kennedy, 2002 | $v \leftarrow \chi \left[ v + c_1 r_1 (p-x) + c_2 r_2 (g-x) \right]$ with $\chi \approx 0.7298$ | Mathematically-derived damping; no velocity clamping needed |

**Why these two?** They are the two most-compared non-trivial variants in the
PSO literature and appear side by side in the Shami survey. They differ only
in one place — the velocity update — which makes comparison clean. The classic
PSO (fixed inertia) is effectively a degenerate case of LDW (w_max = w_min).

**The $\chi$ derivation.** With $\varphi = c_1 + c_2 > 4$,
$$\chi = \frac{2}{|2 - \varphi - \sqrt{\varphi^2 - 4\varphi}|}$$
Clerc & Kennedy derived this so that particle trajectories remain bounded
without any $v_{max}$ clamp. The typical $c_1 = c_2 = 2.05$ gives $\varphi = 4.1$
and $\chi \approx 0.7298$ — this is the *only* number CF-PSO really has.

### Architecture (be ready to point at the code)

One generic function `run_pso(...)` with a `variant` flag. The init, pbest/gbest
bookkeeping, and position clipping are all shared; only the velocity update
branches on `variant='ldw'` vs `variant='cf'`. This makes the comparison fair —
any performance difference is due to the velocity rule, not to incidental
implementation differences.

### Experiment design

- 6 configurations total: 3 budgets × 2 variants.
- Budgets named `*-small` (30 particles, 200 iter), `*-large` (60×200), `*-long` (30×500).
- **10 independent runs per configuration** (seed 42 for reproducibility).
- For each: avg, best, worst, std across runs.
- Results written to `results_pso.txt` as a human-readable text report
  (not JSON — a teacher should be able to `cat` the file and read it).

### Key empirical findings

**Sphere (unimodal):**
| Setting | avg fitness |
|---|---|
| LDW-long  | **1.89e-38** |
| LDW-large | 5.88e-18     |
| LDW-small | 1.10e-15     |
| CF-long   | 7.93e-24     |
| CF-large  | 7.51e-11     |
| CF-small  | 1.70e-09     |

**LDW-PSO wins every budget by many orders of magnitude.** Why: once the swarm
is near the optimum, $w(t) \to 0.4$ shrinks the inertia term, and tiny pbest/gbest
residuals produce ever-smaller velocities. CF-PSO's $\chi = 0.73$ is a floor —
it can't damp below that, so late-stage refinement plateaus earlier.

**Michalewicz (multimodal, $d=10$, optimum ≈ $-9.66$):**
| Setting | avg fitness | best single run |
|---|---|---|
| LDW-small | **-8.77** | -9.33 |
| LDW-large | -8.76     | **-9.36** |
| LDW-long  | -8.36     | -9.37 |
| CF-small  | -8.11     | -9.25 |
| CF-large  | -8.02     | -9.12 |
| CF-long   | -7.87     | -8.96 |

LDW-PSO beats CF-PSO at every budget on average. Best single run (LDW-large)
gets within 0.3 of the true optimum. Neither variant reliably reaches the
global optimum — unsurprising given $10! \approx 3.6$M local minima.

**Interesting anomaly.** `LDW-long` is *worse on average* than `LDW-small`
despite 2.5× the iterations. Interpretation: the linear inertia schedule is
tied to iteration count, so doubling iterations means exploration is stretched
proportionally long, but the late-stage exploitation phase isn't any more
aggressive. If the swarm committed to a sub-optimal valley during the (now
longer) exploration phase, the extra budget just refines that wrong valley.
This is a known failure mode of linearly-scheduled inertia; adaptive or
chaotic inertia schedules address it.

### Summary statement

LDW-PSO outperforms CF-PSO on both benchmarks in these experiments. CF-PSO's
theoretical simplicity (no clamping, one fewer scheduled parameter) is why it
stays in textbooks, but when solution quality is what matters, the explicit
exploration → exploitation schedule of LDW wins.

---

## Likely teacher questions

- **"What happens if $\varphi \le 4$ in CF-PSO?"** — The formula breaks (negative
  under the square root), and the constriction guarantee doesn't hold. My code
  falls back to $\chi = 1$ as a safety net, but the tested $\varphi = 4.1$ is
  always valid.

- **"Why clip the position but not the velocity in CF-PSO?"** — Because the
  Clerc–Kennedy theorem guarantees bounded velocities through $\chi$ alone. I
  still clip position because Michalewicz is undefined outside $[0, \pi]^d$.

- **"Why 10 runs?"** — Enough for the standard deviation to be meaningful but
  not so many that reproducing the experiment is painful. Could easily scale
  to 30+ runs by bumping `runs_per_setting`.

- **"What would you change to improve Michalewicz results?"** — Adaptive inertia
  (replace the fixed linear schedule with one that reacts to swarm diversity),
  or a multi-swarm / niching variant — both listed in the Shami survey as
  state-of-the-art for multimodal landscapes.

- **"Is LDW-PSO guaranteed to converge?"** — No strict guarantee like CF-PSO's.
  In practice it always converges for these hyperparameters because $w_{\min}=0.4$
  is well below the CF-PSO boundary, so late-stage behavior is similar to a
  converging CF-PSO.

- **"What's the computational cost of one run?"** — $O(\text{iterations} \times
  \text{swarm} \times d)$ for the updates, plus one objective-function call per
  particle per iteration. For `LDW-long` on Michalewicz: $500 \times 30 \times
  10 = 150\text{k}$ element-level updates + $15\text{k}$ function evals.

- **"Did you use any library for the PSO itself?"** — No. Everything is plain
  Python with the standard `random` and `math` modules. `matplotlib` is only for
  the convergence plots.
