# Heat Transfer Laboratory Learning Tool

This educational web tool supports the heat transfer experiments in **Chemical and Biological Process Lab**, offered by the **Department of Chemical and Biological Engineering at Seoul National University**. It connects experimental measurements with apparatus diagrams, steady-state calculations, lumped-parameter models, and computational fluid dynamics (CFD) results.

[Laboratory handout](docs/CBPL-HT_handout.pdf)

## What this tool does

The tool visualizes internal flow and temperature distributions that are difficult to observe during the experiment, as well as transient behavior that steady-state measurements do not capture.

It helps students connect measured quantities to the underlying heat transfer processes, check their own calculations, and interpret differences between experimental results and model predictions while examining the assumptions and limitations of each model.

### Experiment A: Combined heat transfer by convection and radiation

Experiment A examines natural convection and radiation from a heated horizontal cylinder. Students can compare the Morgan and McAdams correlations, investigate how the relative contributions of convection and radiation change with surface temperature, and compare the estimated heat transfer rates with the electrical power input.

### Experiment B: Radiation errors in temperature measurement

Experiment B examines how radiative heat exchange with the surrounding wall affects thermocouple temperature measurements under natural and forced convection conditions. Students can investigate the effects of wall and air temperatures, air velocity, sensor size, and emissivity on measurement error, together with the heat transfer processes around the sensor.

## How to use this tool

Use this tool alongside the laboratory handout before or during the experiment, and to check calculations and interpret results when preparing your report.

1. Start with **Apparatus** to identify the components, sensor locations, and heat transfer pathways.
2. Use **Calculate** to analyze steady-state measurements and check heat transfer rates in Experiment A or thermocouple measurement error in Experiment B.
3. Use **Lumped parameter** to vary initial conditions and thermal parameters and examine the approach to steady state and the temperature response of the cylinder or sensors.
4. Use **Watch the flow** to examine precomputed CFD fields and the time histories of temperature and heat transfer rates.
5. Use **Compare** in Experiment B to examine two CFD cases side by side.

[Start Experiment A](#a-apparatus) · [Start Experiment B](#b-apparatus)

## Reading the results

All calculated and simulated results depend on modeling assumptions. Review the parameter values, their sources, and the assumptions listed on each screen and under **Models & assumptions**.

- **Lumped-parameter models** assume a spatially uniform temperature within each modeled body and do not resolve internal temperature gradients.
- **CFD simulations** use representations of geometry, material properties, and boundary conditions that may differ from the actual apparatus. Results are also subject to numerical errors associated with mesh resolution, time-step size, discretization methods, and solver convergence.

CFD results are precomputed for selected conditions. Changing inputs in **Calculate** or **Lumped parameter** does not generate a new CFD simulation.

When comparing measurements with steady-state, lumped-parameter, or CFD predictions, check that the operating conditions and physical quantities are comparable. In particular, distinguish local sensor temperatures from spatially averaged temperatures. Interpret differences in light of model assumptions, numerical errors, and measurement uncertainty.

> Use the results to support your own calculations and discussion. In laboratory reports, identify and cite the literature sources for equations, correlations, and material-property data, as required by the laboratory handout.