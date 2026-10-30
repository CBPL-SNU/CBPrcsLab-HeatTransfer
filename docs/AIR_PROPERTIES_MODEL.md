# Air properties and selectable lumped correlations

Implemented: 2026-10-29. Numerical and browser validation pending.

## Models and defaults

A Lumped: McAdams (default) or Morgan. B Lumped: Ranz–Marshall (default) or Churchill. Manual constant properties remain the default; automatic properties are opt-in. A Calculate retains manual Morgan properties with improved controls. B Calculate retains its original UI and fixed-property Ranz–Marshall default; the optional UI expansion in the plan is not part of this implementation.

## Automatic air approximation

Dry ideal air at p = 101325 Pa, R = 287.05 J/(kg·K). Constant cp = 1006 J/(kg·K) is an explicit engineering approximation, not a temperature-dependent reference dataset. Humidity, composition changes and pressure variation are excluded. The implementation restricts evaluation temperatures to 250–600 K. This restriction does not assert independent accuracy over that interval.

For temperature T in kelvin:

- μ = μ₀ (T/T₀)^(3/2) (T₀ + Sμ)/(T + Sμ)
- k = k₀ (T/T₀)^(3/2) (T₀ + Sk)/(T + Sk)
- T₀ = 273 K, μ₀ = 1.716 × 10⁻⁵ Pa·s, Sμ = 111 K
- k₀ = 0.0241 W/(m·K), Sk = 194 K
- ρ = p/(RT), ν = μ/ρ, α = k/(ρcp), Pr = ν/α

Transport coefficients and formula source: [COMSOL Sutherland’s Law](https://doc.comsol.com/6.4/doc/com.comsol.help.cfd/cfd_ug_fluidflow_high_mach.08.46.html). Specific heat and ideal-gas assumptions are additional approximations of this tool; they are not supplied by that transport-coefficient table. No data is fetched at runtime.

## Temperature conventions and correlation limits

Morgan uses film temperature (body + air)/2. Both sphere correlations also use film temperature; β = 1/Tfilm for buoyancy. The film convention for Ranz–Marshall follows the formulation discussed in [A model for the drag and heat transfer of spheres in the laminar regime at high temperature differences](https://doi.org/10.1016/j.ijthermalsci.2018.07.009). This is a documented choice rather than an assumption that every published implementation uses identical evaluation rules.

Churchill: Nu = 2 + 0.589 Ra^(1/4) / [1 + (0.469/Pr)^(9/16)]^(4/9), with Ra = g β |Tb − Tg| D³/(να). The stated recommended range is approximately Pr ≥ 0.7 and Ra ≤ 10¹¹; outside-range evaluations are flagged as extrapolations. [EES sphere natural-convection documentation](https://www.fchartsoftware.com/ees/heat_transfer_library/free_convection/hs3035.htm).

Ranz–Marshall: Nu = 2 + 0.6 Re^(1/2) Pr^(1/3), Re = UD/ν. Re > 200 is flagged against the original low-Re regime discussed in the research source above. This flag alone is not a complete validity assessment. Churchill ignores imposed velocity; mixed convection is not included.

Manual mode keeps k, ν, Pr fixed but still updates temperature differences and natural-convection buoyancy. Bead density/cp/effective capacity are separate solid properties. Matching Calculate and Lumped steady states requires identical correlations and property settings.

## Numerical implementation

The same cylinder/sensor heat balances serve equilibrium, transient derivatives and final heat rates. Variable-property sensor time constants include the temperature derivative of h through a finite difference of net heat flow; the previous analytical formula is retained for constant-property forced convection.

Both transient solvers use RK4 step doubling: compare one full step with two half steps, estimate local temperature error as |Thalf − Tfull|/15 and retain the two-half-step result. Target local tolerance is 1e-7 °C plus 1e-9 times the temperature magnitude. This is a local estimator, not a guaranteed global error bound. B also samples heat-balance slopes to choose a conservative initial step cap. Work is limited to 2,000,000 attempted steps per body.

Morgan’s tabulated segments can have small discontinuities. Its equilibrium solver checks the energy residual; if it fails the tolerance, the UI omits the steady guide and reports the limitation. Property bounds apply during integration and root finding. Calculations stop with an explanation rather than silently extrapolating automatic air properties. Previously displayed results are labelled as belonging to the previous successful run if a new calculation fails.

## Verification status

Eight edited/new JavaScript modules passed node --check on 2026-10-29. No regression suite, independent integration comparison, performance benchmark or browser test was run in this update. Previous verification records concern earlier models and do not validate this implementation. Follow-up numerical comparisons and property-reference checks remain necessary before treating automatic mode as validated.

## 2026-10-30: Additional heat path

Both lumped models now default to UA = 0 W/K; A defaults to C = 6.5 J/K. B uses a shared user-entered conductance per bead and subtracts UA(Tb − Tg) from net heat input, independently of the convection correlation. This term is included in equilibrium, instantaneous slopes and local time constants; it is reported separately as extra loss. The constant-property forced-convection time constant is C/[A(h + hRadLocal) + UA]. The variable-property version differentiates the full balance. B Calculate omits the parameter and therefore retains UA = 0.
