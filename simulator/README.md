# SkidCopter Simulator

This is a local browser-based simulator for SkidCopter development. It shows a 3D vehicle on a test pad, lets you tune vehicle dimensions and physics values, runs scripted control scenarios, and displays simulated CAN output and telemetry.

The simulator is for software-side development and debugging. It does not replace VESC Tool setup, wheels-off-ground bench testing, hardware E-stops, or real motor/controller validation.

## Controller Source

The simulator loads `../src/skid-steer.lisp` directly through Vite, parses the Lisp forms in the browser, and evaluates the script's `def`, `defun`, startup checks, runtime globals, and main control-loop body.

The browser runtime stubs the VESC LispBM hardware functions:

- ADC and GPIO reads are driven by the simulator controls and scenarios.
- CAN freshness, motor temperature, and fault inputs are supplied by the fault injectors.
- CAN command functions record simulated `CAN Out` rows instead of sending real traffic.
- Timing functions use simulator time.

The 3D motion model is still browser-side physics. The controller decisions and CAN command calls come from the Lisp script; hardware behavior, firmware scheduling, and real VESC motor response still require bench and vehicle testing.

## Start The Simulator

From this directory:

```sh
npm install
npm run dev -- --port 5173
```

Then open:

```text
http://127.0.0.1:5173/
```

If port `5173` is already busy, use another port:

```sh
npm run dev -- --port 5174
```

## Build Check

Run this before committing simulator changes:

```sh
npm run build
npm audit --audit-level=moderate
```

The app is built with Vite, React, and Three.js.

## Main Screen

The simulator has four main areas:

- Top toolbar: run, pause, step one control tick, reset, playback speed, and follow camera.
- Vehicle panel: vehicle layout, ground surface, dimensions, mass, speed limits, command limits, and motion-model values.
- 3D test pad: live vehicle pose, selected ground surface, grid, trail, speed, yaw rate, distance, and slip readout.
- Controls and telemetry: scenario selection, live inputs, fault injection, arming/fault state, CAN output, command traces, speed, acceleration, and slip.

All user-facing vehicle dimensions use American units:

- Wheel diameter: inches
- Track width and wheelbase: feet
- Mass: pounds
- Speed: miles per hour
- Drive and brake force: pounds-force

The simulation math still uses SI units internally.

## Basic Workflow

1. Choose the drive layout:
   - `Four wheel`
   - `Two wheel front`
   - `Two wheel rear`
2. Choose the mix mode:
   - `Skid steer`: throttle and steering mix into left/right commands.
   - `Same power`: throttle drives both sides equally.
3. Tune the vehicle dimensions and physics values.
4. Pick `Manual` or a scripted scenario.
5. Press `Run`.
6. Watch the 3D motion, telemetry chart, status chips, and `CAN Out` rows.
7. Use `Reset` to return to the initial pose and controller state.

## Manual Controls

Use `Manual` scenario when you want direct control:

- `Sliders`: separate throttle and steering sliders.
- `Joystick`: a self-centering two-axis control. Drag up/down for throttle and left/right for steering; releasing it returns both axes to neutral.
- `Throttle`: normalized input from reverse to forward.
- `Steer`: normalized steering input. Disabled when using `Same power`.
- `Enable`: simulated enable switch.
- `Brake`: simulated operator brake input. The simulator starts with `Brake mode` set to `Local GPIO` so the button and brake scenario work immediately; switch it to `Off` when testing a configuration with no dedicated brake input.
- `Cruise` and `Cancel`: available when cruise mode is enabled.

The Lisp script still requires neutral arming when `*require-neutral-on-enable*` is enabled. If the vehicle does not drive immediately, return throttle and steering to neutral, make sure the configured enable mode is active, and wait for the arming delay.

## Scenarios

The scenario selector provides repeatable software-side tests:

- `Manual`: direct live input.
- `Arm, Ramp, Stop`: neutral arming, forward ramp, release to neutral.
- `Skid Turn`: forward command with a right steering sweep.
- `Caster Turn`: low-speed S-turn for caster swivel lag and scrub in two-wheel layouts.
- `Brake Re-arm`: drive, brake, release, neutral re-arm, and drive again.
- `ADC Fault`: inject a bad input range while moving.

Scenario-controlled inputs are read-only while the scenario is selected.

## Vehicle And Physics Values

The vehicle panel includes:

- `Wheel diameter`: visual wheel size and wheel rotation math.
- `Track width`: left/right wheel spacing; affects yaw rate.
- `Wheelbase`: front/rear spacing; affects visual model and yaw inertia.
- `Mass`: affects acceleration and rotational inertia.
- `Ground`: preset surface model. Presets change both the 3D ground appearance and the tire-grip value.
- `Max speed`: command-to-wheel-speed target.
- `Max command`: command scale sent to simulated CAN output.
- `Drive force`: maximum forward/reverse force used by the acceleration limit.
- `Brake force`: maximum slowing force used when commands drop or reverse.
- `Tire grip`: available grip in g; lower values trigger skid-steer slip sooner. Editing this value switches the ground selector to `Custom`.
- `Caster roll drag`: rolling resistance from the unpowered caster pair in two-wheel layouts.
- `Caster scrub`: extra resistance when caster wheels lag behind the local travel direction.
- `Caster swivel`: how quickly caster wheels align to the local travel direction.
- `Accel rate`, `Decel rate`: controller command slew rates, separate from the physical force limits.

Ground presets:

- `Asphalt`: `0.85 g`, dark paved texture.
- `Sand`: `0.30 g`, loose sand texture.
- `Burning Man`: `0.38 g`, dry playa-dust texture.
- `Grass`: `0.45 g`, grass texture.
- `Custom`: keeps the current custom tire-grip value and uses a neutral test-pad texture.

The current physics model includes:

- mass-based wheel speed changes
- separate drive and brake force limits
- approximate yaw inertia
- tire-grip limiting
- skid-steer scrub slip
- lateral slip and slip-angle telemetry
- caster rolling drag, swivel lag, scrub drag, and caster telemetry for two-wheel layouts

Still open:

- calibrated motor response from bench logs

See `TODO.md` for the current fidelity backlog.

## Fault Injection

The fault section lets you exercise safety-state behavior:

- `ADC`: simulate an input outside the configured ADC range.
- `Thermal`: simulate thermal stop.
- `Motor stale`: simulate missing motor status.
- `CAN stale`: simulate stale CAN input data for CAN-backed input modes.

The fault state appears in the telemetry status chips and affects drive output when the corresponding Lisp configuration enables that guard. For example, `Motor stale` requires `*require-motor-status*`, and `Thermal` requires `*enable-thermal-stop*`.

## Telemetry

The bottom telemetry area shows:

- `Armed`: whether the controller can send drive commands.
- `Fault`: current latched fault reason.
- `State`: stop, drive, or brake.
- `Cruise`: cruise state.
- `Logic`: confirms whether the visible controller output is coming from the Lisp source runtime.
- `Slip`: current tire/slip limit percentage.
- `Caster`: current caster scrub percentage, or off for four-wheel layouts.
- `Drag`: current caster drag in pounds-force.
- `Accel`: forward acceleration in feet per second squared.
- Chart traces for left command, right command, speed, slip, and caster scrub.
- `CAN Out`: simulated VESC CAN command function, wheel, CAN ID, and value.

## Useful Test Cases

Low-grip slip test:

1. Set `Drive force` high, for example `1000 lbf`.
2. Select `Sand`, `Burning Man`, or set `Ground` to `Custom` and set `Tire grip` low, for example `0.10 g`.
3. Select `Skid Turn`.
4. Press `Run`.
5. Watch the ground surface, `Slip`, yaw rate, trail curvature, and CAN output.

Brake test:

1. Select `Brake Re-arm`.
2. Press `Run`.
3. Confirm the state changes to brake, drive output stops, then neutral re-arm is required before driving resumes.

Caster drag test:

1. Set `Drive layout` to `Two wheel rear` or `Two wheel front`.
2. Select `Caster Turn`.
3. Press `Run`.
4. Watch the caster wheels swivel, the `Caster` and `Drag` telemetry, and the trail shape.

Fault test:

1. Select `ADC Fault`.
2. Press `Run`.
3. Confirm the fault state latches and CAN output stops/brakes.

## Troubleshooting

If the page is blank:

```sh
npm install
npm run dev -- --port 5173
```

Then refresh the browser.

If the simulator behaves strangely after changing values, press `Reset`. Several physical parameters reset the controller and vehicle pose automatically because they change the model assumptions.

If the dev server reports that the port is busy, choose another port and open that URL.
