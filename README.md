# CBPrcsLab-HeatTransfer

Educational web tool for the heat transfer laboratory (Chemical Engineering Process Lab).

Students enter the values they measured on the apparatus, examine a steady-state
energy balance, calculate lumped-parameter temperature responses, and explore
pre-computed CFD results in dedicated screens.

- **Experiment A** — combined natural convection and radiation from a heated cylinder
- **Experiment B** — radiation error in thermocouple temperature measurement

Every calculation runs in the browser. No input is sent to a server.

Screen equations use LaTeX rendered by the locally bundled KaTeX 0.19.1.
Edit `data-tex` in `assets/views/*.html`; the selected model’s power term
is updated in `assets/js/views/experiment-a.js`. Fonts, renderer and license are
under `assets/vendor/katex/`, so formulas do not require a CDN or build step.

> **Prototype.** Several dimensions and material properties remain example values,
> and transient parameters need calibration against measurements. Each model screen
> describes its assumptions.

## Screens

The site opens on **Introduction**, with a short guide to the experiments and how to
use the tool. The introduction supports Korean and English; both lumped screens are in English. Existing screen links such as `#experiment-a` still open directly.

Each experiment has **Calculate**, **Lumped parameter**, **Watch the flow**, and
**Apparatus** screens. Experiment B also has **Compare** for two CFD cases side by
side. **My data** keeps measured values in the browser and exports them as an Excel file.

The lumped screens default to **600 seconds (10 minutes)**. Change the conditions and
press the calculate button to update the graph and results; the duration can be set
from 10 to 3,600 seconds. Experiment A shows the cylinder temperature and final
convection and radiation rates. Experiment B shows T6, T7 and T8 on one graph for
the selected duration. Both results tables show end-of-run temperatures and
convection and radiation rates evaluated at those temperatures. B rates are signed:
positive convection leaves the bead and positive radiation enters it.
Each sensor has a distinct colour; solid curves show the transient response.
Both graphs include matching dashed horizontal lines for steady-state temperatures.
A’s steady balance includes the extra loss UA. Coloured temperature labels in the outer left column identify the steady-state
guides; grey tick labels sit closer to the vertical axis. Nearby steady-state
labels are separated and connected to their actual heights. Only the inspected sample is marked.
Result tables use scientific notation with superscript exponents for nonzero
values below 0.1 in magnitude or at least one million. Unnecessary trailing zeros
in scientific-notation mantissas are omitted.
A short run may end before reaching steady state.

Shared input defaults match the Calculate screens: A uses 11 V, 1.87 A and
19.6 °C air; B uses a 165 °C wall, 25.5 °C air, 0.4 m/s velocity and T6
emissivity 0.4. A allows current up to 4 A. Initial transient temperatures default
to the corresponding air temperature. Calculate’s measured surface temperature
is not an initial condition for the heating simulation. Transient-only capacity,
extra loss and duration defaults remain editable model assumptions.

Both models integrate nonlinear energy balances using RK4 with step doubling for
local error estimation. Experiment B evaluates
the radiation and convection terms throughout the response, rather than fitting an
exponential curve to the equilibrium temperature. Step sizes are independent of
graph sampling; B also limits the step using heat-balance slopes across the
temperature interval. This estimates integration error; it does not validate the
physical correlations. Sensor capacity is configurable independently for T6, T7 and T8. Expand **Bead
material and effective heat capacity** to enter density and specific heat, or an
effective capacity directly. A blank override uses `C = ρ cₚ πd³/6`; an entered
capacity takes precedence. Capacity affects the response speed, but not the
steady-state temperature under these fixed boundary conditions.
Wall temperature, air temperature, velocity and bead material properties remain
constant during each B run; wire conduction is not included. Automatic air
properties can vary with the bead temperature.

Both lumped graphs support inspection: hover near a solid curve or tap it to read
a computed sample’s time, temperature and signed `dT/dt` in °C/s. The rate comes
from the energy balance at that sample, not a difference between plotted points.
The readout appears in a box beside the selected point, with separate lines for
its time, temperature and rate. The box stays inside the graph and hides when
inspection clears. Experiment B
provides **Inspect curve** when curves overlap; A has a single curve and no selector.
With the graph focused, left/right
arrows select time, up/down select the curve, Home/End select endpoints and Escape
clears the readout. Inspection and resizing reuse the computed response.

The model sections list fixed geometry, emissivities, view factors and the selected
air-property assumptions. These assumptions still need checking against the apparatus; exposing
thermal capacity does not calibrate the rest of the model.

Equations across the tabs use the same bundled KaTeX math font and include
accessible MathML output. On narrow screens, long equations can scroll within
their equation region. LaTeX sources live in screen HTML; the introduction
Markdown renderer is unchanged.

Typography is shared across tabs: section headings 15px, controls and chart
labels 14px, equations and calculated values 18px, explanatory text 13px and
small auxiliary labels 12px. Touch inputs use 16px throughout to avoid automatic
zoom. The size tokens live in `assets/css/tokens.css`.

### Convection models and air properties

In **Lumped parameter**, Experiment A offers **McAdams (natural convection)** and
**Morgan (natural convection)**. Experiment B offers **Ranz–Marshall (forced
convection)** and **Churchill (natural convection)**. The previous model defaults
are retained. Churchill disables the velocity input; the tool does not switch
models automatically or combine natural and forced convection.

Expand **Air properties** to choose constant manual inputs or opt-in automatic
properties. McAdams does not use these inputs. Manual defaults preserve the
previous values, including different A/B viscosities. Automatic properties use
local Sutherland formulas for viscosity and conductivity, dry ideal air at
101325 Pa and constant specific heat of 1006 J/(kg·K). This is an engineering
approximation, not a reference-quality air-property database. Its evaluation
temperature is restricted by this tool to 250–600 K; outside that range, use
manual inputs. The range is an application restriction, not a claimed validation
range for all properties. Automatic mode remains opt-in pending independent validation.

Morgan and both sphere correlations evaluate air at the body–air film temperature.
Each RK4 stage, equilibrium solve and reported heat rate uses the same property
policy. Automatic mode reports initial/final evaluated air properties; manual
values remain in the inputs. Results also report correlation range notices. A steady-state guide is omitted if the Morgan segment boundary
prevents the energy residual from satisfying its tolerance.

In A **Calculate**, Morgan fields are wider. Kinematic viscosity is entered in
10⁻⁶ m²/s (17.5 represents 0.0000175 m²/s). The −/+ buttons and up/down keys
adjust k by 0.001, displayed viscosity by 0.1 and Pr by 0.001; finer values may
still be typed. B **Calculate** retains its existing Ranz–Marshall and constant
properties; matching a Lumped result requires matching those settings.

See [air-property assumptions and sources](docs/AIR_PROPERTIES_MODEL.md) for
formulas, limits and the validation status. The new implementation has passed
JavaScript syntax checks; regression, independent numerical and browser checks
have not yet been run.

### Editing the introduction

Use the **KOR / ENG** toggle on Introduction to select a language. Korean is shown
by default, and the selection is saved in the browser when local storage is available.
Only the Introduction screen is translated.

Edit `assets/views/introduction.ko.md` for Korean or `assets/views/introduction.md`
for English, then reload the page. Keep the two versions in sync. Each file
supports headings (`#` through `###`), paragraphs, flat ordered and unordered lists,
bold text, inline code, blockquotes, HTTP(S) links, and links to registered screens
such as `[Experiment A](#experiment-a)`. Tables, nested lists, images, code blocks,
math rendering and embedded HTML are not supported.

The page layout is in `assets/views/introduction.html`; its styling is in
`assets/css/views/introduction.css`. Menu labels and the page title are defined in
`assets/js/data/views.js`.

## Requirements

What you need depends on what you are doing.

| You want to… | You need |
| --- | --- |
| **Use the tool** | A browser. Open the published URL — nothing to install. |
| **Serve or edit it locally** | Any static file server, e.g. `python3 -m http.server 8000`. |
| **Change `assets/js/physics/`** | Node 20+ and [uv](https://docs.astral.sh/uv/), to run the checks below. |

The site is plain HTML, CSS and ES modules with no libraries. Fonts are vendored into
the repository rather than pulled from a CDN, so nothing is fetched from another host
at runtime: it works offline, and deployment is a `git push`.

```bash
# only if you will run the checks
curl -LsSf https://astral.sh/uv/install.sh | sh
```

`npm install` is never needed. `package.json` declares no dependencies at all — only
the shortcuts below — so there is nothing to download and no `node_modules`. npm is
used here purely as a command runner; the commands themselves call Node's and
Python's built-in tooling.

## Scripts

```bash
npm start              # serve on http://localhost:8000 (no-cache, see below)
npm test               # physics, markup and design-token checks
npm run verify         # cross-check the models against an independent SciPy implementation
npm run verify:python  # same check using python3 instead of uv
```

`npm start` runs `tools/serve.py`, a fifteen-line standard-library server whose only
difference from `python3 -m http.server` is that it sends `Cache-Control: no-store`.
Without it the browser will happily serve one ES module from cache and another from
disk; the import then fails and the whole page renders blank. Plain
`python3 -m http.server 8000` works too, as long as you reload with Ctrl+Shift+R
after editing anything under `assets/js/`.

The app uses ES modules, so it has to be served over HTTP either way. Opening
`index.html` straight from the file system will show a blank page.

## Verification

The heat transfer models live in `assets/js/physics/` as pure functions with no DOM
access, so they can be checked outside the browser.

`npm test` asserts the properties the models must satisfy: a thermocouple reading
always sits between the gas and wall temperature, radiation error falls as flow speed
rises, a larger bead lags a smaller one, and the steady state closes the energy
balance. These hold regardless of the specific constants, so they keep working when
measured dimensions replace today's placeholders.

`npm run verify` is the stronger check. It exports the browser results to
`tools/reference.json`, then recomputes every case in `tools/verify_physics.py` using
Brent root finding and adaptive Runge–Kutta — deliberately *different* algorithms from
the bisection and fixed-step RK4 the browser uses, so a mistake in one implementation
cannot hide in the other. The B transient check uses DOP853 and compares the sampled
temperature histories across heating, cooling and equilibrium conditions. The first
run may also need to download NumPy and SciPy.

Run both before committing anything under `assets/js/physics/`.

For an additional B transient check without SciPy, export the reference results and
run the independent quadrature check. It recovers elapsed time from the energy
balance, `t = ∫ C / Qnet(T) dT`, over the early and middle parts of the response.
The near-equilibrium region is excluded because this integral becomes singular.

```bash
node tools/export_reference.mjs
python3 tools/verify_sensor_quadrature.py
node tools/benchmark_sensors.mjs       # 600-second, three-sensor engine benchmark
```

On Windows, `py` can replace `python3` if Python is installed through the launcher.
The benchmark reports computation time only; downloads and chart rendering are not
included. Its results are specific to the machine and JavaScript runtime.

## CFD frames

The raw OpenFOAM cutting planes (`assets/js/data/rawdata/<case>/*.npz`, about 100 MB
per case) are not what the site loads. `tools/cfd_to_frames.py` crops each plane to the
25 cm above the heater, resamples the mesh-cut points onto a 1 mm grid, keeps every
fourth frame (2 s), and writes one 8-bit PNG sprite per plane and field plus an
`index.json` that records the grid, the physical range of each field, and the frame
times. A case comes out at about 1.2 MB.

```bash
uv run tools/cfd_to_frames.py          # every case with a metadata.json
uv run tools/cfd_to_frames.py A5       # one case
```

Re-run it whenever a new case lands in `rawdata/`; commit the output under
`assets/data/cfd/` with a `data:` message.

## Layout

```text
index.html            app shell, screen containers and assumptions dialog
assets/css/
  tokens.css          the design system — colours, type, spacing, shape
  base.css            reset and base typography
  app.css             frame: dark sidebar, header, content
  components.css      panels, buttons, fields, notes, charts, tables
  views/              per-screen rules, including introduction and lumped screens
  fonts.css           vendored IBM Plex faces (no CDN)
assets/fonts/         vendored woff2 font files
assets/js/
  core/               DOM helpers, router, canvas plotting, numerical routines
  physics/            heat transfer models — no DOM access, unit-testable
  data/               component copy, CFD case metadata, table schemas
  views/              per-screen input handling and rendering
assets/views/         screen HTML and the editable introduction.md
                      apparatus SVG diagrams are generated by their view modules
assets/data/cfd/      CFD frames the browser actually loads: one PNG sprite per plane
                      and field, plus index.json and the integrated history
tests/                physics, markup and design-token checks
tools/                static server, CFD conversion, reference export, independent
                      physics checks and sensor benchmark
docs/                 roadmap and detailed introduction/lumped change records
```

## Conventions

See [`CLAUDE.md`](CLAUDE.md) for commit message and code comment conventions.

## Documents

- [Development plan](260727_공실_열전달_학습툴_계획.md) — full plan (Korean)
- [Summary](260727_공실_열전달_학습툴_계획_요약.md) — condensed version (Korean)
- [Roadmap](docs/ROADMAP.md) — next steps and deployment review (Korean)

- [Introduction changes](docs/INTRODUCTION_CHANGELOG.md) — implementation and editing notes (Korean)
- [Lumped changes](docs/LUMPED_CHANGELOG.md) — models, screens, verification and benchmark results (Korean)
