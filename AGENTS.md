# Agent Instructions

## Project Snapshot

SkidCopter is a safety-adjacent vehicle controller project. The primary artifact is
`src/skid-steer.lisp`, a VESC Express LispBM script for controlling two- or
four-motor skid-steer vehicles over CAN. The `simulator/` directory contains a
Vite/React/Three.js browser simulator that loads the Lisp source directly and
uses a JavaScript Lisp runtime to test controller behavior.

Treat controller changes as hardware-facing changes. The simulator and tests are
useful software checks, but they do not prove that a real vehicle is safe.

## Repository Layout

- `src/skid-steer.lisp`: controller script uploaded to VESC Tool.
- `tests/lisp-controller.test.mjs`: Node test suite that parses and executes the
  Lisp controller through the simulator runtime.
- `tools/lispbm_static_check.py`: lightweight syntax and ASCII checker for
  LispBM source.
- `docs/`: hardware setup, configuration, safety, performance, and bench-test
  documentation.
- `simulator/`: browser simulator built with Vite, React, Three.js, and
  `lucide-react`.
- `Makefile`: root-level check and packaging helpers.

## Commands

Run the root checks before finishing controller or simulator-runtime changes:

```sh
make check
```

Equivalent individual commands:

```sh
python3 tools/lispbm_static_check.py src/skid-steer.lisp
node --test tests/lisp-controller.test.mjs
```

For simulator UI or bundling changes:

```sh
cd simulator
npm install
npm run build
npm audit --audit-level=moderate
```

To run the simulator locally:

```sh
cd simulator
npm run dev -- --port 5173
```

To build the static simulator zip:

```sh
make simulator-zip
```

## Editing Rules

- Check `git status --short` before editing. The repository may contain user
  changes; do not revert or rewrite work you did not make.
- Keep edits narrowly scoped. Avoid broad refactors when fixing controller
  behavior, simulator behavior, or docs.
- Use ASCII in `src/skid-steer.lisp`; the static checker rejects non-ASCII
  characters.
- Preserve SPDX license headers in source files and add an appropriate SPDX
  header to new source files.
- Keep `package-lock.json` in sync with `simulator/package.json` when changing
  simulator dependencies.
- Do not commit generated artifacts such as `simulator/node_modules/`,
  `simulator/dist/`, or `simulator/skidcopter-static.zip`.

## Controller Guidance

- LispBM is not full Common Lisp. Follow the simple existing style in
  `src/skid-steer.lisp` and avoid introducing unsupported language features.
- Do not weaken startup arming, neutral-before-arm, enable, brake, stale-input,
  thermal, motor-status, loop-watchdog, or fault-latching behavior without a
  clear reason, tests, and documentation updates.
- Keep command limits, ramp rates, brake commands, drive layouts, CAN IDs, GPIO
  pins, and input modes aligned across `src/skid-steer.lisp`, `README.md`, and
  the relevant files in `docs/`.
- When changing user-visible safety behavior, update `docs/safety.md` and
  `docs/bench-test.md` as needed.
- When changing configuration defaults, update `docs/configuration.md`,
  `README.md`, and simulator defaults or labels if they expose that setting.

## Simulator Guidance

- The simulator imports `../src/skid-steer.lisp` as raw source in
  `simulator/src/sim/skidController.js`. Keep the default extraction and config
  mapping consistent with new Lisp `def` settings.
- `simulator/src/sim/lispRuntime.js` is a constrained runtime for this project,
  not a general Lisp implementation. Add runtime features only when the
  controller source actually needs them, and cover them with Node tests.
- Simulator UI presents vehicle dimensions in American units while simulation
  math uses SI units internally. Preserve that split unless changing the
  product decision everywhere.
- For physics changes, keep `simulator/src/sim/vehiclePhysics.js`,
  `simulator/src/data/scenarios.js`, `simulator/README.md`, and related tests in
  agreement.
- Use existing React patterns in `simulator/src/App.jsx`. Prefer small helper
  functions and component-local state over adding new app-wide abstractions.

## Testing Expectations

- Add or update `tests/lisp-controller.test.mjs` for controller behavior changes,
  especially arming, brake, cruise, direction lock, fault, CAN output, status
  LED, and layout behavior.
- Add parser/runtime tests when `simulator/src/sim/lispRuntime.js` changes.
- Run `make check` after controller, runtime, or test changes.
- Run `npm run build` from `simulator/` after simulator UI, Three.js, CSS, or
  bundling changes.
- If a check cannot be run, report the exact command and the reason.

## Documentation Tone

Docs should stay practical and plain-spoken. This project is for builders, so
prefer concrete setup steps, measured values, and explicit safety warnings over
abstract descriptions. Do not imply that software checks replace hardware
E-stops, fuses or breakers, contactors, mechanical brakes, guards, VESC Tool
setup, or wheels-off-ground bench testing.
