import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { lispConfigForSimulator, wheelNameForGenericSide } from "../simulator/src/sim/layoutConfig.js";
import { LispRuntime, lispSymbol, parseLisp, symbolName } from "../simulator/src/sim/lispRuntime.js";
import { createInitialVehicleState, stepVehicle } from "../simulator/src/sim/vehiclePhysics.js";

const SOURCE_PATH = new URL("../src/skid-steer.lisp", import.meta.url);
const SOURCE = readFileSync(SOURCE_PATH, "utf8");

const IDS = {
  left: 31,
  right: 41,
  leftFront: 11,
  leftRear: 12,
  rightFront: 21,
  rightRear: 22,
};

const BASE_CONFIG = {
  statusLedEnable: false,
  heartbeatEnable: false,
  enableMode: "always",
  brakeMode: "off",
  cruiseMode: "off",
  cruiseCancelMode: "off",
  selectorDebounceSec: 0,
  armNeutralSec: 0,
  throttleDeadband: 0,
  steerDeadband: 0,
  throttleExpo: 0,
  steerExpo: 0,
  steerDerateEnable: false,
  accelRatePerSec: 100,
  decelRatePerSec: 100,
  reverseRatePerSec: 100,
  loopPeriodSec: 0.02,
  commandOffDelaySec: 0.08,
  leftId: IDS.left,
  rightId: IDS.right,
  leftFrontId: IDS.leftFront,
  leftRearId: IDS.leftRear,
  rightFrontId: IDS.rightFront,
  rightRearId: IDS.rightRear,
};

const DEFAULT_INPUT = {
  throttle: 0,
  steer: 0,
  enable: true,
  brake: false,
  cruiseRequest: false,
  cruiseCancel: false,
  adcFault: false,
  steerAdcFault: false,
  staleCan: false,
  thermalFault: false,
  motorStatusStale: false,
  directionReverse: false,
};

const LAYOUTS = {
  "four-wheel": {
    active: ["leftFront", "leftRear", "rightFront", "rightRear"],
    inactive: [],
  },
  "two-wheel": {
    active: ["left", "right"],
    inactive: ["leftFront", "leftRear", "rightFront", "rightRear"],
  },
};

const MIX_MODES = ["skid-steer", "same-power"];

function config(overrides = {}) {
  return { ...BASE_CONFIG, ...overrides };
}

function makeRuntime(overrides = {}, source = SOURCE) {
  return new LispRuntime(source, config(overrides));
}

function makeHarness(overrides = {}, source = SOURCE) {
  const cfg = config(overrides);
  const runtime = new LispRuntime(source, cfg);
  let time = 0;

  return {
    runtime,
    cfg,
    step(input = {}, stepConfig = {}, delta = cfg.loopPeriodSec ?? 0.02) {
      time += delta;
      const nextConfig = { ...cfg, ...stepConfig };
      return runtime.step({ ...DEFAULT_INPUT, ...input }, nextConfig, time);
    },
    setTime(nextTime) {
      time = nextTime;
    },
    get time() {
      return time;
    },
  };
}

function arm(harness, input = {}) {
  const delta = Math.max((harness.cfg.armNeutralSec ?? 0) + 0.02, harness.cfg.loopPeriodSec ?? 0.02);
  const snapshot = harness.step({ throttle: 0, steer: 0, ...input }, {}, delta);
  assert.equal(harness.runtime.getBoolean("*armed*"), true, "controller should arm from neutral");
  return snapshot;
}

function call(runtime, name, ...args) {
  return runtime.evaluate([lispSymbol(name), ...args]);
}

function bool(value) {
  return value !== null && value !== false && value !== undefined;
}

function activeWheelNames(layout) {
  return LAYOUTS[layout].active;
}

function inactiveWheelNames(layout) {
  return LAYOUTS[layout].inactive;
}

function idsFor(names) {
  return names.map((name) => IDS[name]);
}

function commandIds(commands) {
  return commands.map((command) => command.id).sort((a, b) => a - b);
}

function activeIdsForLayout(layout) {
  return idsFor(activeWheelNames(layout)).sort((a, b) => a - b);
}

function inactiveIdsForLayout(layout) {
  return idsFor(inactiveWheelNames(layout)).sort((a, b) => a - b);
}

function byId(commands, id) {
  return commands.find((command) => command.id === id);
}

function commandsById(commands) {
  return new Map(commands.map((command) => [command.id, command]));
}

function approx(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

function approxCommand(command, expectedValue, expectedFn = "canset-current-rel") {
  assert.equal(command.fn, expectedFn);
  approx(command.value, expectedValue);
}

function assertOnlyActiveIds(commands, layout) {
  assert.deepEqual(commandIds(commands), activeIdsForLayout(layout));
}

function assertAllCommands(commands, expectedFn, expectedValue) {
  assert.ok(commands.length > 0, "expected at least one CAN command");
  for (const command of commands) {
    assert.equal(command.fn, expectedFn);
    approx(command.value, expectedValue);
  }
}

function assertNoInactiveIds(commands, layout) {
  const inactive = new Set(inactiveIdsForLayout(layout));
  for (const command of commands) {
    assert.equal(inactive.has(command.id), false, `inactive id ${command.id} received a command`);
  }
}

function configErrorReason(runtime) {
  const line = runtime.prints.find((entry) => entry.startsWith("(skid-config-error"));
  return line ?? "";
}

function startupLine(runtime) {
  return runtime.prints.find((entry) => entry.startsWith("(skid-start")) ?? "";
}

function faultPrints(runtime) {
  return runtime.prints.filter((entry) => entry.startsWith("(skid-fault"));
}

function symbol(value) {
  return symbolName(value);
}

function assertActiveWheelPredicates(runtime, layout) {
  const expected = {
    left: activeWheelNames(layout).includes("left"),
    right: activeWheelNames(layout).includes("right"),
    leftFront: activeWheelNames(layout).includes("leftFront"),
    leftRear: activeWheelNames(layout).includes("leftRear"),
    rightFront: activeWheelNames(layout).includes("rightFront"),
    rightRear: activeWheelNames(layout).includes("rightRear"),
  };

  assert.equal(bool(call(runtime, "drive-left")), expected.left);
  assert.equal(bool(call(runtime, "drive-right")), expected.right);
  assert.equal(bool(call(runtime, "drive-left-front")), expected.leftFront);
  assert.equal(bool(call(runtime, "drive-left-rear")), expected.leftRear);
  assert.equal(bool(call(runtime, "drive-right-front")), expected.rightFront);
  assert.equal(bool(call(runtime, "drive-right-rear")), expected.rightRear);
}

function lastValueByPin(writes) {
  const map = new Map();
  for (const write of writes) {
    map.set(write.pin, write.value);
  }
  return map;
}

function assertLedState(writes, { ready, inhibit, fault }, activeHigh = true) {
  const values = lastValueByPin(writes);
  const active = (pin) => (activeHigh ? values.get(pin) === 1 : values.get(pin) === 0);
  assert.equal(active(11), ready, "ready LED state");
  assert.equal(active(12), inhibit, "inhibit LED state");
  assert.equal(active(13), fault, "fault LED state");
}

function assertLeftRightCommands(runtime, left, right) {
  approx(runtime.getNumber("*left-command*"), left);
  approx(runtime.getNumber("*right-command*"), right);
}

function assertFaultReason(runtime, reason) {
  assert.equal(symbol(runtime.getValue("*fault-reason*")), reason);
}

function assertLastPrintMatches(runtime, pattern) {
  assert.match(runtime.prints.at(-1) ?? "", pattern);
}

test("static checker and parser accept the Lisp source", () => {
  execFileSync("python3", ["tools/lispbm_static_check.py", "src/skid-steer.lisp"], {
    cwd: new URL("..", import.meta.url),
    stdio: "pipe",
  });

  const forms = parseLisp(SOURCE);
  assert.ok(forms.length > 100);
});

test("default runtime load prints skid-start", () => {
  const runtime = new LispRuntime(SOURCE);
  assert.match(startupLine(runtime), /^\(skid-start SkidCopter /);
  assert.ok(runtime.loopBody, "main loop is captured");
});

test("invalid startup config prints skid-config-error and safe-output loop sends stops", () => {
  const harness = makeHarness({ maxCommand: 0 });
  assert.match(configErrorReason(harness.runtime), /reason command-config/);

  const snapshot = harness.step();
  assertOnlyActiveIds(snapshot.canOut, "four-wheel");
  assertAllCommands(snapshot.canOut, "canset-brake-rel", 0.08);
});

for (const layout of Object.keys(LAYOUTS)) {
  for (const mixMode of MIX_MODES) {
    test(`${layout} ${mixMode} sends drive commands only to active wheels`, () => {
      const harness = makeHarness({ driveLayout: layout, mixMode });
      assertActiveWheelPredicates(harness.runtime, layout);
      arm(harness);

      const input = mixMode === "skid-steer"
        ? { throttle: 0.4, steer: 0.2 }
        : { throttle: 0.4, steer: 0.9 };
      const snapshot = harness.step(input);

      assertOnlyActiveIds(snapshot.canOut, layout);
      assertNoInactiveIds(snapshot.canOut, layout);

      if (mixMode === "skid-steer") {
        approx(harness.runtime.getNumber("*mix-left*"), 0.6);
        approx(harness.runtime.getNumber("*mix-right*"), 0.2);
        for (const name of activeWheelNames(layout)) {
          const side = name.startsWith("left") ? 0.6 : 0.2;
          approxCommand(byId(snapshot.canOut, IDS[name]), side * 0.2);
        }
      } else {
        approx(harness.runtime.getNumber("*mix-left*"), 0.4);
        approx(harness.runtime.getNumber("*mix-right*"), 0.4);
        for (const command of snapshot.canOut) {
          approxCommand(command, 0.08);
        }
      }
    });
  }
}

test("skid-steer mix normalizes over-range left/right commands", () => {
  const harness = makeHarness({ mixMode: "skid-steer" });
  arm(harness);
  harness.step({ throttle: 0.8, steer: 0.8 });

  approx(harness.runtime.getNumber("*mix-left*"), 1.0);
  approx(harness.runtime.getNumber("*mix-right*"), 0.0);
});

test("steer derate scales steering authority by throttle and mode", () => {
  let runtime = makeRuntime({
    steerDerateEnable: true,
    steerDerateStartCommand: 0.4,
    steerDerateMinScale: 0.5,
  });
  approx(call(runtime, "steer-derate-scale", 0.2), 1.0);
  approx(call(runtime, "steer-derate-scale", 0.7), 0.75);
  approx(call(runtime, "steer-derate-scale", 1.0), 0.5);

  runtime = makeRuntime({ steerDerateEnable: false });
  approx(call(runtime, "steer-derate-scale", 1.0), 1.0);

  runtime = makeRuntime({ mixMode: "same-power", steerDerateEnable: true });
  approx(call(runtime, "steer-derate-scale", 1.0), 1.0);
});

for (const layout of Object.keys(LAYOUTS)) {
  test(`${layout} stop, neutral brake, and operator brake only affect active wheels`, () => {
    const neutral = makeHarness({
      driveLayout: layout,
      neutralBrakeCommand: 0.04,
      neutralCommandDeadband: 0.2,
    });
    let snapshot = neutral.step({ throttle: 0.05 });
    assertOnlyActiveIds(snapshot.canOut, layout);
    assertAllCommands(snapshot.canOut, "canset-brake-rel", 0.04);

    const disabled = makeHarness({ driveLayout: layout, enableMode: "local-gpio" });
    snapshot = disabled.step({ enable: false });
    assertOnlyActiveIds(snapshot.canOut, layout);
    assertAllCommands(snapshot.canOut, "canset-brake-rel", 0.08);

    const brake = makeHarness({ driveLayout: layout, brakeMode: "local-gpio" });
    snapshot = brake.step({ brake: true });
    assertOnlyActiveIds(snapshot.canOut, layout);
    assertAllCommands(snapshot.canOut, "canset-brake-rel", 0.12);
  });
}

test("two-wheel layout ignores inactive four-wheel ID, sign, status, and thermal failures", () => {
  const harness = makeHarness({
    driveLayout: "two-wheel",
    leftFrontId: IDS.left,
    leftFrontSign: 0,
    leftFrontScale: 3,
    requireMotorStatus: true,
    enableThermalStop: true,
  });
  assert.match(startupLine(harness.runtime), /^\(skid-start /);
  harness.step({
    motorStatusStale: [IDS.leftFront, IDS.leftRear, IDS.rightFront, IDS.rightRear],
    thermalFault: [IDS.leftFront, IDS.leftRear, IDS.rightFront, IDS.rightRear],
  });
  assert.equal(harness.runtime.getBoolean("*fault-latched*"), false);

  const activeStale = makeHarness({ driveLayout: "two-wheel", requireMotorStatus: true });
  activeStale.step({ motorStatusStale: [IDS.left] });
  assert.equal(symbol(activeStale.runtime.getValue("*fault-reason*")), "motor-stale-left");

  const activeThermal = makeHarness({ driveLayout: "two-wheel", enableThermalStop: true });
  activeThermal.step({ thermalFault: [IDS.right] });
  assert.equal(symbol(activeThermal.runtime.getValue("*fault-reason*")), "fet-temp-right");
});

test("two-wheel layout applies generic signs and trims", () => {
  const harness = makeHarness({
    driveLayout: "two-wheel",
    leftSign: -1,
    rightScale: 0.5,
  });
  arm(harness);

  const commands = commandsById(harness.step({ throttle: 0.5 }).canOut);
  approxCommand(commands.get(IDS.left), -0.1);
  approxCommand(commands.get(IDS.right), 0.05);
});

test("simulator maps positioned two-wheel layouts to generic Lisp config", () => {
  const front = lispConfigForSimulator({
    ...BASE_CONFIG,
    driveLayout: "two-wheel-front",
    leftFrontId: 101,
    rightFrontId: 102,
    leftFrontSign: -1,
    rightFrontSign: 1,
    leftFrontScale: 0.8,
    rightFrontScale: 0.9,
  });
  assert.equal(front.driveLayout, "two-wheel");
  assert.equal(front.leftId, 101);
  assert.equal(front.rightId, 102);
  assert.equal(front.leftSign, -1);
  assert.equal(front.rightSign, 1);
  assert.equal(front.leftScale, 0.8);
  assert.equal(front.rightScale, 0.9);
  assert.equal(wheelNameForGenericSide("two-wheel-front", "left"), "left-front");
  assert.equal(wheelNameForGenericSide("two-wheel-front", "right"), "right-front");

  const rear = lispConfigForSimulator({
    ...BASE_CONFIG,
    driveLayout: "two-wheel-rear",
    leftRearId: 201,
    rightRearId: 202,
    leftRearSign: 1,
    rightRearSign: -1,
    leftRearScale: 1.1,
    rightRearScale: 1.2,
  });
  assert.equal(rear.driveLayout, "two-wheel");
  assert.equal(rear.leftId, 201);
  assert.equal(rear.rightId, 202);
  assert.equal(rear.leftSign, 1);
  assert.equal(rear.rightSign, -1);
  assert.equal(rear.leftScale, 1.1);
  assert.equal(rear.rightScale, 1.2);
  assert.equal(wheelNameForGenericSide("two-wheel-rear", "left"), "left-rear");
  assert.equal(wheelNameForGenericSide("two-wheel-rear", "right"), "right-rear");
});

test("simulator physics keeps positioned two-wheel caster placement", () => {
  const physicsConfig = {
    driveLayout: "two-wheel-front",
    reverseScale: 0.6,
    maxSpeedMps: 4.4,
    massKg: 180,
    driveForceN: 520,
    brakeForceN: 900,
    trackWidthM: 1.28,
    wheelbaseM: 1.72,
    casterSwivelRateRadPerSec: 5,
    casterRollingDragN: 35,
    casterScrubForceN: 220,
    tireFrictionG: 0.85,
    slipResponsePerSec: 3.5,
  };
  const telemetry = { state: "drive", leftCommand: 0.4, rightCommand: 0.1 };

  const frontDrive = stepVehicle(createInitialVehicleState(), telemetry, physicsConfig, 0.1);
  assert.equal(frontDrive.casterAxle, "rear");

  const rearDrive = stepVehicle(
    createInitialVehicleState(),
    telemetry,
    { ...physicsConfig, driveLayout: "two-wheel-rear" },
    0.1
  );
  assert.equal(rearDrive.casterAxle, "front");
});

test("control modes call the expected CAN functions", () => {
  const cases = [
    ["current-rel", 0.2, "canset-current-rel", 0.1],
    ["current", 10, "canset-current", 5],
    ["duty", 0.2, "canset-duty", 0.1],
    ["rpm", 1000, "canset-rpm", 500],
  ];

  for (const [controlMode, maxCommand, expectedFn, expectedValue] of cases) {
    const harness = makeHarness({ controlMode, maxCommand });
    arm(harness);
    const snapshot = harness.step({ throttle: 0.5 });
    assertOnlyActiveIds(snapshot.canOut, "four-wheel");
    assertAllCommands(snapshot.canOut, expectedFn, expectedValue);
  }
});

test("brake command functions depend on control mode", () => {
  const cases = [
    ["current-rel", 0.2, 0.12, "canset-brake-rel", 0.12],
    ["current", 10, 3.2, "canset-brake", 3.2],
    ["duty", 0.2, 0.12, "canset-duty", 0],
    ["rpm", 1000, 50, "canset-rpm", 0],
  ];

  for (const [controlMode, maxCommand, brakeCommand, expectedFn, expectedValue] of cases) {
    const harness = makeHarness({ controlMode, maxCommand, brakeMode: "local-gpio", brakeCommand });
    const snapshot = harness.step({ brake: true });
    assertOnlyActiveIds(snapshot.canOut, "four-wheel");
    assertAllCommands(snapshot.canOut, expectedFn, expectedValue);
  }
});

test("max command, wheel signs, trims, reverse scale, neutral deadband, and clamp behavior", () => {
  let harness = makeHarness({
    leftFrontSign: -1,
    leftRearScale: 0.5,
    rightFrontScale: 1.5,
    maxCommand: 0.2,
  });
  arm(harness);
  let commands = commandsById(harness.step({ throttle: 0.5 }).canOut);
  approxCommand(commands.get(IDS.leftFront), -0.1);
  approxCommand(commands.get(IDS.leftRear), 0.05);
  approxCommand(commands.get(IDS.rightFront), 0.15);
  approxCommand(commands.get(IDS.rightRear), 0.1);

  harness = makeHarness({ reverseScale: 0.6, maxCommand: 0.2 });
  arm(harness);
  commands = commandsById(harness.step({ throttle: -0.5 }).canOut);
  for (const command of commands.values()) {
    approxCommand(command, -0.06);
  }

  harness = makeHarness({ neutralCommandDeadband: 0.2, neutralBrakeCommand: 0.07 });
  arm(harness);
  commands = commandsById(harness.step({ throttle: 0.1 }).canOut);
  for (const command of commands.values()) {
    approxCommand(command, 0.07, "canset-brake-rel");
  }

  const direct = makeRuntime({ controlMode: "current-rel" });
  call(direct, "send-drive-command", 44, 2);
  approxCommand(direct.canOut.at(-1), 1);
});

test("slew rates limit accel, decel, reverse, and independent skid-steer sides", () => {
  let harness = makeHarness({
    accelRatePerSec: 1,
    decelRatePerSec: 2,
    reverseRatePerSec: 0.5,
  });
  arm(harness);
  harness.step({ throttle: 1 });
  assertLeftRightCommands(harness.runtime, 0.02, 0.02);
  harness.step({ throttle: 1 });
  assertLeftRightCommands(harness.runtime, 0.04, 0.04);

  harness.runtime.global.set("*left-command*", 0.5);
  harness.runtime.global.set("*right-command*", 0.5);
  harness.step({ throttle: 0 });
  assertLeftRightCommands(harness.runtime, 0.46, 0.46);

  harness.runtime.global.set("*left-command*", 0.2);
  harness.runtime.global.set("*right-command*", 0.2);
  harness.step({ throttle: -1 });
  assertLeftRightCommands(harness.runtime, 0.19, 0.19);

  harness = makeHarness({
    mixMode: "skid-steer",
    accelRatePerSec: 1,
    decelRatePerSec: 2,
    reverseRatePerSec: 0.5,
  });
  arm(harness);
  harness.step({ throttle: 0.2, steer: 0.5 });
  assertLeftRightCommands(harness.runtime, 0.02, -0.02);

  harness.runtime.global.set("*left-command*", 0.5);
  harness.runtime.global.set("*right-command*", -0.5);
  harness.step({ throttle: 0.2, steer: 0 });
  assertLeftRightCommands(harness.runtime, 0.46, -0.49);
});

test("neutral command deadband uses a strict less-than boundary", () => {
  const harness = makeHarness({ neutralCommandDeadband: 0.1, neutralBrakeCommand: 0.07 });
  arm(harness);

  let commands = harness.step({ throttle: 0.099 }).canOut;
  assertAllCommands(commands, "canset-brake-rel", 0.07);

  commands = harness.step({ throttle: 0.1 }).canOut;
  assertAllCommands(commands, "canset-current-rel", 0.02);
});

test("local-adc, can-adc, and can-ppm input modes drive through the Lisp input paths", () => {
  for (const inputMode of ["local-adc", "can-adc", "can-ppm"]) {
    const harness = makeHarness({ inputMode });
    harness.step({ throttle: 0.5, steer: 0.25 });
    assert.equal(harness.runtime.getBoolean("*sample-input-ok*"), true);
    approx(harness.runtime.getNumber("*sample-drive-throttle*"), 0.5);
    approx(harness.runtime.getNumber("*sample-steer*"), 0.25);
  }
});

test("same-power mode does not require or fault on the steering input", () => {
  let harness = makeHarness({ mixMode: "same-power" });
  arm(harness);
  harness.step({ throttle: 0.4, steer: 1, steerAdcFault: true });
  assert.equal(harness.runtime.getBoolean("*sample-input-ok*"), true);
  assert.equal(harness.runtime.getBoolean("*fault-latched*"), false);
  approx(harness.runtime.getNumber("*sample-steer*"), 0);
  approx(harness.runtime.getNumber("*mix-left*"), 0.4);
  approx(harness.runtime.getNumber("*mix-right*"), 0.4);

  harness = makeHarness({ mixMode: "skid-steer" });
  harness.step({ throttle: 0, steer: 0, steerAdcFault: true });
  assert.equal(symbol(harness.runtime.getValue("*fault-reason*")), "steer-range");
});

test("deadband, expo, inversion, and ADC range fault are observable in sampled inputs", () => {
  let harness = makeHarness({ throttleDeadband: 0.2, armNeutralThrottle: 0.3 });
  harness.step({ throttle: 0.1 });
  approx(harness.runtime.getNumber("*sample-throttle*"), 0);
  harness.step({ throttle: 0.6 });
  approx(harness.runtime.getNumber("*sample-throttle*"), 0.5);

  harness = makeHarness({ throttleExpo: 1 });
  harness.step({ throttle: 0.5 });
  approx(harness.runtime.getNumber("*sample-throttle*"), 0.125);

  harness = makeHarness({ invertThrottle: true, invertSteer: true });
  harness.step({ throttle: 0.5, steer: 0.25 });
  approx(harness.runtime.getNumber("*sample-throttle*"), -0.5);
  approx(harness.runtime.getNumber("*sample-steer*"), -0.25);

  harness = makeHarness();
  harness.step({ adcFault: true });
  assert.equal(symbol(harness.runtime.getValue("*fault-reason*")), "throttle-range");
  assert.match(faultPrints(harness.runtime).at(-1), /skid-fault throttle-range/);
});

test("direction modes produce expected drive-throttle signs", () => {
  const cases = [
    [{ directionMode: "throttle-axis" }, { throttle: -0.5 }, -0.5, 1],
    [{ directionMode: "fixed-forward" }, { throttle: -0.5 }, 0.5, 1],
    [{ directionMode: "fixed-reverse" }, { throttle: 0.5 }, -0.5, -1],
    [{ directionMode: "local-gpio" }, { throttle: 0.5, directionReverse: true }, -0.5, -1],
    [{ directionMode: "local-adc" }, { throttle: 0.5, directionReverse: true }, -0.5, -1],
    [{ directionMode: "can-adc" }, { throttle: 0.5, directionReverse: true }, -0.5, -1],
  ];

  for (const [overrides, input, expectedThrottle, expectedSign] of cases) {
    const harness = makeHarness(overrides);
    harness.step(input);
    approx(harness.runtime.getNumber("*sample-drive-throttle*"), expectedThrottle);
    approx(harness.runtime.getNumber("*sample-direction-sign*"), expectedSign);
  }
});

test("selector debounce delays non-safety edges while safety edges apply immediately", () => {
  let harness = makeHarness({
    enableMode: "local-gpio",
    selectorDebounceSec: 0.05,
  });
  harness.step({ enable: false }, {}, 0.02);
  harness.step({ enable: true }, {}, 0.02);
  assert.equal(harness.runtime.getBoolean("*armed*"), false);
  harness.step({ enable: true }, {}, 0.05);
  assert.equal(harness.runtime.getBoolean("*armed*"), false);
  harness.step({ enable: true }, {}, 0.001);
  assert.equal(harness.runtime.getBoolean("*armed*"), true);
  harness.step({ enable: false }, {}, 0.02);
  assert.equal(harness.runtime.getBoolean("*armed*"), false);

  harness = makeHarness({ brakeMode: "local-gpio", selectorDebounceSec: 0.05 });
  arm(harness);
  let snapshot = harness.step({ brake: true }, {}, 0.02);
  assert.equal(harness.runtime.getBoolean("*sample-brake-active*"), true);
  assertAllCommands(snapshot.canOut, "canset-brake-rel", 0.12);
  harness.step({ brake: false }, {}, 0.02);
  assert.equal(harness.runtime.getBoolean("*sample-brake-active*"), true);
  harness.step({ brake: false }, {}, 0.051);
  assert.equal(harness.runtime.getBoolean("*sample-brake-active*"), false);

  harness = makeHarness({
    cruiseCancelMode: "local-gpio",
    selectorDebounceSec: 0.05,
  });
  arm(harness);
  harness.runtime.global.set("*cruise-active*", true);
  harness.runtime.global.set("*cruise-command*", 0.4);
  harness.step({ cruiseCancel: true }, {}, 0.02);
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);

  harness = makeHarness({ directionMode: "local-gpio", selectorDebounceSec: 0.05 });
  harness.step({ directionReverse: false }, {}, 0.02);
  harness.step({ directionReverse: true }, {}, 0.02);
  approx(harness.runtime.getNumber("*sample-direction-sign*"), 1);
  harness.step({ directionReverse: true }, {}, 0.051);
  approx(harness.runtime.getNumber("*sample-direction-sign*"), -1);
});

test("ADC selector hysteresis holds direction, enable, brake, and cruise states", () => {
  let harness = makeHarness({
    directionMode: "local-adc",
    selectorDebounceSec: 0.001,
    selectorAdcHysteresisV: 0.1,
  });
  harness.step({ directionVoltage: 1.7 });
  approx(harness.runtime.getNumber("*sample-direction-sign*"), -1);
  harness.step({ directionVoltage: 1.45 });
  approx(harness.runtime.getNumber("*sample-direction-sign*"), -1);
  harness.step({ directionVoltage: 1.39 });
  approx(harness.runtime.getNumber("*sample-direction-sign*"), -1);
  harness.step({ directionVoltage: 1.39 });
  approx(harness.runtime.getNumber("*sample-direction-sign*"), 1);

  harness = makeHarness({
    directionMode: "local-adc",
    selectorDebounceSec: 0.001,
    selectorAdcHysteresisV: 0.1,
  });
  harness.step({ directionVoltage: 1.3 });
  approx(harness.runtime.getNumber("*sample-direction-sign*"), 1);
  harness.step({ directionVoltage: 1.55 });
  approx(harness.runtime.getNumber("*sample-direction-sign*"), 1);
  harness.step({ directionVoltage: 1.61 });
  approx(harness.runtime.getNumber("*sample-direction-sign*"), 1);
  harness.step({ directionVoltage: 1.61 });
  approx(harness.runtime.getNumber("*sample-direction-sign*"), -1);

  harness = makeHarness({
    enableMode: "local-adc",
    selectorDebounceSec: 0,
    selectorAdcHysteresisV: 0.1,
  });
  harness.step({ enableVoltage: 1.3 });
  assert.equal(harness.runtime.getBoolean("*sample-enabled*"), false);
  harness.step({ enableVoltage: 1.55 });
  assert.equal(harness.runtime.getBoolean("*sample-enabled*"), false);
  harness.step({ enableVoltage: 1.61 });
  assert.equal(harness.runtime.getBoolean("*sample-enabled*"), true);
  harness.step({ enableVoltage: 1.45 });
  assert.equal(harness.runtime.getBoolean("*sample-enabled*"), false);

  harness = makeHarness({
    brakeMode: "local-adc",
    selectorDebounceSec: 0,
    selectorAdcHysteresisV: 0.1,
  });
  arm(harness);
  harness.step({ brakeVoltage: 1.7 });
  assert.equal(harness.runtime.getBoolean("*sample-brake-active*"), true);
  harness.step({ brakeVoltage: 1.45 });
  assert.equal(harness.runtime.getBoolean("*sample-brake-active*"), true);
  harness.step({ brakeVoltage: 1.39 });
  assert.equal(harness.runtime.getBoolean("*sample-brake-active*"), false);

  harness = makeHarness({
    cruiseMode: "local-adc",
    selectorDebounceSec: 0.001,
    selectorAdcHysteresisV: 0.1,
  });
  harness.step({ cruiseVoltage: 1.3 });
  assert.equal(harness.runtime.getBoolean("*cruise-db-state*"), false);
  harness.step({ cruiseVoltage: 1.55 });
  assert.equal(harness.runtime.getBoolean("*cruise-db-state*"), false);
  harness.step({ cruiseVoltage: 1.61 });
  assert.equal(harness.runtime.getBoolean("*cruise-db-state*"), false);
  harness.step({ cruiseVoltage: 1.61 });
  assert.equal(harness.runtime.getBoolean("*cruise-db-state*"), true);
  harness.step({ cruiseVoltage: 1.45 });
  assert.equal(harness.runtime.getBoolean("*cruise-db-state*"), true);
  harness.step({ cruiseVoltage: 1.39 });
  assert.equal(harness.runtime.getBoolean("*cruise-db-state*"), true);
  harness.step({ cruiseVoltage: 1.39 });
  assert.equal(harness.runtime.getBoolean("*cruise-db-state*"), false);
});

test("direction selector change while moving disarms, locks, stops, cancels cruise, and clears at neutral", () => {
  const harness = makeHarness({
    directionMode: "local-gpio",
    cruiseMode: "local-gpio",
    cruiseLatchMode: "toggle",
    cruiseCancelOnThrottle: false,
  });
  arm(harness);
  harness.step({ throttle: 0.4, cruiseRequest: true });
  assert.equal(harness.runtime.getBoolean("*armed*"), true);
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), true);

  const stopped = harness.step({ throttle: 0.4, directionReverse: true, cruiseRequest: false });
  assert.equal(harness.runtime.getBoolean("*armed*"), false);
  assert.equal(harness.runtime.getBoolean("*direction-lock*"), true);
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);
  assertAllCommands(stopped.canOut, "canset-brake-rel", 0.08);

  harness.step({ throttle: 0, steer: 0, directionReverse: true });
  assert.equal(harness.runtime.getBoolean("*direction-lock*"), false);
});

test("neutral arming delay, non-neutral startup inhibit, and no-neutral-required mode", () => {
  let harness = makeHarness({ armNeutralSec: 0.1 });
  harness.step({ throttle: 0 }, {}, 0.02);
  assert.equal(harness.runtime.getBoolean("*armed*"), false);
  harness.step({ throttle: 0 }, {}, 0.11);
  assert.equal(harness.runtime.getBoolean("*armed*"), true);

  harness = makeHarness({ armNeutralSec: 0.05 });
  harness.step({ throttle: 0.5 }, {}, 0.02);
  assert.equal(harness.runtime.getBoolean("*armed*"), false);
  harness.step({ throttle: 0 }, {}, 0.02);
  assert.equal(harness.runtime.getBoolean("*armed*"), false);
  harness.step({ throttle: 0 }, {}, 0.06);
  assert.equal(harness.runtime.getBoolean("*armed*"), true);

  harness = makeHarness({ requireNeutralOnEnable: false });
  harness.step({ throttle: 0.5 });
  assert.equal(harness.runtime.getBoolean("*armed*"), true);
});

test("enable modes gate arming and CAN-backed enable stale faults", () => {
  let harness = makeHarness({ enableMode: "always" });
  harness.step({ enable: false });
  assert.equal(harness.runtime.getBoolean("*armed*"), true);

  for (const enableMode of ["local-gpio", "local-adc", "can-adc"]) {
    harness = makeHarness({ enableMode });
    harness.step({ enable: false });
    assert.equal(harness.runtime.getBoolean("*armed*"), false);
    harness.step({ enable: true });
    assert.equal(harness.runtime.getBoolean("*armed*"), true);
  }

  harness = makeHarness({ enableMode: "can-adc" });
  harness.step({ staleCan: true });
  assert.equal(symbol(harness.runtime.getValue("*fault-reason*")), "enable-can-stale");
});

test("brake modes disarm, send operator brake, and require neutral re-arm", () => {
  let harness = makeHarness({ brakeMode: "off" });
  arm(harness);
  harness.step({ throttle: 0.4, brake: true });
  assert.equal(harness.runtime.getBoolean("*armed*"), true);
  assertAllCommands(harness.runtime.canOut, "canset-current-rel", 0.08);

  for (const brakeMode of ["local-gpio", "local-adc", "can-adc"]) {
    harness = makeHarness({ brakeMode, armNeutralSec: 0.05 });
    arm(harness);
    harness.step({ throttle: 0.4 });
    assert.equal(harness.runtime.getBoolean("*armed*"), true);
    let snapshot = harness.step({ throttle: 0.4, brake: true });
    assert.equal(harness.runtime.getBoolean("*armed*"), false);
    assertAllCommands(snapshot.canOut, "canset-brake-rel", 0.12);

    snapshot = harness.step({ throttle: 0.4, brake: false }, {}, 0.02);
    assert.equal(harness.runtime.getBoolean("*armed*"), false);
    assertAllCommands(snapshot.canOut, "canset-brake-rel", 0.08);

    harness.step({ throttle: 0, brake: false }, {}, 0.02);
    harness.step({ throttle: 0, brake: false }, {}, 0.06);
    assert.equal(harness.runtime.getBoolean("*armed*"), true);
  }

  harness = makeHarness({ brakeMode: "can-adc" });
  harness.step({ staleCan: true });
  assert.equal(symbol(harness.runtime.getValue("*fault-reason*")), "brake-can-stale");
});

test("active-high GPIO and ADC selectors produce expected logical behavior", () => {
  let harness = makeHarness({ enableMode: "local-gpio", enableActiveHigh: true });
  harness.step({ enable: false });
  assert.equal(harness.runtime.getBoolean("*sample-enabled*"), false);
  harness.step({ enable: true });
  assert.equal(harness.runtime.getBoolean("*sample-enabled*"), true);
  assert.equal(harness.runtime.getBoolean("*armed*"), true);

  harness = makeHarness({ brakeMode: "local-gpio", brakeActiveHigh: true });
  arm(harness);
  harness.step({ brake: true });
  assert.equal(harness.runtime.getBoolean("*sample-brake-active*"), true);

  harness = makeHarness({ directionMode: "local-gpio", directionReverseActiveHigh: true });
  harness.step({ directionReverse: true });
  approx(harness.runtime.getNumber("*sample-direction-sign*"), -1);

  harness = makeHarness({
    cruiseMode: "local-gpio",
    cruiseLatchMode: "toggle",
    cruiseActiveHigh: true,
  });
  arm(harness);
  harness.step({ throttle: 0.4, cruiseRequest: true });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), true);

  harness = makeHarness({
    cruiseCancelMode: "local-gpio",
    cruiseCancelActiveHigh: true,
  });
  arm(harness);
  harness.runtime.global.set("*cruise-active*", true);
  harness.runtime.global.set("*cruise-command*", 0.4);
  harness.step({ cruiseCancel: true });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);

  harness = makeHarness({ enableMode: "local-adc", enableAdcActiveHigh: true });
  harness.step({ enableVoltage: 2.2 });
  assert.equal(harness.runtime.getBoolean("*sample-enabled*"), true);

  harness = makeHarness({ brakeMode: "local-adc", brakeAdcActiveHigh: true });
  arm(harness);
  harness.step({ brakeVoltage: 2.2 });
  assert.equal(harness.runtime.getBoolean("*sample-brake-active*"), true);

  harness = makeHarness({ directionMode: "local-adc", directionAdcActiveHigh: true });
  harness.step({ directionVoltage: 2.2 });
  approx(harness.runtime.getNumber("*sample-direction-sign*"), -1);

  harness = makeHarness({
    cruiseMode: "local-adc",
    cruiseLatchMode: "toggle",
    cruiseAdcActiveHigh: true,
  });
  arm(harness);
  harness.step({ throttle: 0.4, cruiseVoltage: 2.2 });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), true);

  harness = makeHarness({
    cruiseCancelMode: "local-adc",
    cruiseCancelAdcActiveHigh: true,
  });
  arm(harness);
  harness.runtime.global.set("*cruise-active*", true);
  harness.runtime.global.set("*cruise-command*", 0.4);
  harness.step({ cruiseCancelVoltage: 2.2 });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);
});

test("cruise off, toggle, hold, threshold, and cancel paths", () => {
  let harness = makeHarness({ cruiseMode: "off" });
  arm(harness);
  harness.step({ throttle: 0.4, cruiseRequest: true });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);

  harness = makeHarness({ cruiseMode: "local-gpio", cruiseLatchMode: "toggle", cruiseCancelOnThrottle: false });
  arm(harness);
  harness.step({ throttle: 0.4, cruiseRequest: true });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), true);
  approx(harness.runtime.getNumber("*cruise-command*"), 0.4);
  harness.step({ throttle: 0, cruiseRequest: false });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), true);
  harness.step({ throttle: 0, cruiseRequest: true });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);

  harness = makeHarness({ cruiseMode: "local-gpio", cruiseLatchMode: "hold" });
  arm(harness);
  harness.step({ throttle: 0.4, cruiseRequest: true });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), true);
  harness.step({ throttle: 0.4, cruiseRequest: false });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);

  harness = makeHarness({ cruiseMode: "local-gpio", cruiseLatchMode: "toggle" });
  arm(harness);
  harness.step({ throttle: 0.05, cruiseRequest: true });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);

  harness = makeHarness({ cruiseMode: "local-gpio", cruiseLatchMode: "toggle" });
  arm(harness);
  harness.step({ throttle: 0.4, cruiseRequest: true });
  harness.step({ throttle: 0.9, cruiseRequest: false });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);

  harness = makeHarness({
    cruiseMode: "local-gpio",
    cruiseCancelMode: "local-gpio",
    cruiseLatchMode: "toggle",
    cruiseCancelOnThrottle: false,
  });
  arm(harness);
  harness.step({ throttle: 0.4, cruiseRequest: true });
  harness.step({ throttle: 0.4, cruiseRequest: false, cruiseCancel: true });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);

  harness = makeHarness({
    cruiseMode: "local-gpio",
    cruiseLatchMode: "toggle",
    cruiseCancelOnThrottle: false,
    brakeMode: "local-gpio",
  });
  arm(harness);
  harness.step({ throttle: 0.4, cruiseRequest: true });
  harness.step({ throttle: 0.4, cruiseRequest: false, brake: true });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);

  harness = makeHarness({ cruiseMode: "local-gpio", cruiseLatchMode: "toggle", cruiseCancelOnThrottle: false });
  arm(harness);
  harness.step({ throttle: 0.4, cruiseRequest: true });
  harness.step({ throttle: 0.4, cruiseRequest: false, adcFault: true });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);

  harness = makeHarness({
    cruiseMode: "local-gpio",
    cruiseLatchMode: "toggle",
    cruiseCancelOnThrottle: false,
    enableMode: "local-gpio",
  });
  arm(harness, { enable: true });
  harness.step({ throttle: 0.4, cruiseRequest: true, enable: true });
  harness.step({ throttle: 0.4, cruiseRequest: false, enable: false });
  assert.equal(harness.runtime.getBoolean("*cruise-active*"), false);
});

test("faults latch, print reasons, and clear according to enable mode", () => {
  let harness = makeHarness({ inputMode: "can-adc" });
  harness.step({ staleCan: true });
  assert.equal(symbol(harness.runtime.getValue("*fault-reason*")), "input-can-stale");

  harness = makeHarness({ directionMode: "can-adc" });
  harness.step({ staleCan: true });
  assert.equal(symbol(harness.runtime.getValue("*fault-reason*")), "direction-can-stale");

  harness = makeHarness({ cruiseMode: "can-adc" });
  harness.step({ staleCan: true });
  assert.equal(symbol(harness.runtime.getValue("*fault-reason*")), "cruise-can-stale");

  harness = makeHarness({ cruiseCancelMode: "can-adc" });
  harness.step({ staleCan: true });
  assert.equal(symbol(harness.runtime.getValue("*fault-reason*")), "cruise-cancel-can-stale");

  harness = makeHarness({ enableMode: "local-gpio" });
  harness.step({ adcFault: true, enable: true });
  assert.equal(harness.runtime.getBoolean("*fault-latched*"), true);
  assert.match(faultPrints(harness.runtime).at(-1), /skid-fault throttle-range/);
  harness.step({ adcFault: false, throttle: 0, enable: true });
  assert.equal(harness.runtime.getBoolean("*fault-latched*"), true);
  harness.step({ adcFault: false, throttle: 0, enable: false });
  assert.equal(harness.runtime.getBoolean("*fault-latched*"), false);
  assert.match(faultPrints(harness.runtime).at(-1), /skid-fault-clear/);

  harness = makeHarness({ enableMode: "always" });
  harness.step({ adcFault: true });
  assert.equal(harness.runtime.getBoolean("*fault-latched*"), true);
  harness.step({ adcFault: false, throttle: 0 });
  assert.equal(harness.runtime.getBoolean("*fault-latched*"), false);
});

test("current fault reason follows documented priority order", () => {
  let runtime = makeRuntime();
  runtime.global.set("*sample-input-fault*", lispSymbol("throttle-range"));
  assert.equal(symbol(call(runtime, "current-fault-reason", false, false, false, false, false, false, false)), "throttle-range");

  runtime = makeRuntime();
  assert.equal(symbol(call(runtime, "current-fault-reason", true, false, false, false, false, false, false)), "direction-can-stale");
  assert.equal(symbol(call(runtime, "current-fault-reason", true, true, false, false, false, false, false)), "enable-can-stale");

  runtime = makeRuntime({ cruiseMode: "can-adc" });
  assert.equal(symbol(call(runtime, "current-fault-reason", true, true, true, false, false, false, false)), "cruise-can-stale");

  runtime = makeRuntime();
  assert.equal(symbol(call(runtime, "current-fault-reason", true, true, true, true, false, false, false)), "brake-can-stale");

  runtime = makeRuntime();
  runtime.global.set("*sample-motor-fault*", lispSymbol("motor-stale-left-front"));
  assert.equal(symbol(call(runtime, "current-fault-reason", true, true, true, true, true, false, false)), "motor-stale-left-front");

  runtime = makeRuntime();
  runtime.global.set("*sample-thermal-fault*", lispSymbol("fet-temp-left-front"));
  assert.equal(symbol(call(runtime, "current-fault-reason", true, true, true, true, true, true, false)), "fet-temp-left-front");
});

test("stale, thermal, neutral, and deadband boundaries use Lisp comparison semantics", () => {
  let harness = makeHarness({ inputMode: "can-adc", inputStaleSec: 0.25 });
  harness.step({ can6Age: 0.249 });
  assert.equal(harness.runtime.getBoolean("*fault-latched*"), false);
  harness = makeHarness({ inputMode: "can-adc", inputStaleSec: 0.25 });
  harness.step({ can6Age: 0.25 });
  assertFaultReason(harness.runtime, "input-can-stale");

  harness = makeHarness({ requireMotorStatus: true, motorStatusStaleSec: 0.5 });
  harness.step({ motorStatusAge: 0.499 });
  assert.equal(harness.runtime.getBoolean("*fault-latched*"), false);
  harness = makeHarness({ requireMotorStatus: true, motorStatusStaleSec: 0.5 });
  harness.step({ motorStatusAge: 0.5 });
  assertFaultReason(harness.runtime, "motor-stale-left-front");

  harness = makeHarness({ enableThermalStop: true, maxFetTempC: 42.1 });
  harness.step({ fetTempC: 42 });
  assert.equal(harness.runtime.getBoolean("*fault-latched*"), false);
  harness = makeHarness({ enableThermalStop: true, maxFetTempC: 42 });
  harness.step({ fetTempC: 42 });
  assertFaultReason(harness.runtime, "fet-temp-left-front");

  harness = makeHarness({ armNeutralThrottle: 0.1, armNeutralSec: 0 });
  harness.step({ throttle: 0.1 }, {}, 0.02);
  assert.equal(harness.runtime.getBoolean("*armed*"), false);
  harness.step({ throttle: 0.099 }, {}, 0.02);
  assert.equal(harness.runtime.getBoolean("*armed*"), true);

  harness = makeHarness({ throttleDeadband: 0.2, armNeutralThrottle: 0.3 });
  harness.step({ throttle: 0.2 });
  approx(harness.runtime.getNumber("*sample-throttle*"), 0);
  harness.step({ throttle: 0.2001 });
  assert.ok(harness.runtime.getNumber("*sample-throttle*") > 0);
});

test("loop watchdog latches loop-overrun and emits safe outputs", () => {
  const runtime = makeRuntime({ enableLoopWatchdog: true, loopOverrunSec: 0.05 });
  runtime.currentTime = 1;
  runtime.global.set("*loop-start*", 0);

  call(runtime, "check-loop-overrun");

  assert.equal(symbol(runtime.getValue("*fault-reason*")), "loop-overrun");
  assert.equal(runtime.getBoolean("*armed*"), false);
  assertOnlyActiveIds(runtime.canOut, "four-wheel");
  assertAllCommands(runtime.canOut, "canset-brake-rel", 0.08);
});

test("heartbeat modes toggle only when allowed", () => {
  let harness = makeHarness({
    heartbeatEnable: true,
    heartbeatGpioPin: 15,
    heartbeatPeriodSec: 0.01,
    heartbeatMode: "alive",
    enableMode: "local-gpio",
  });
  let snapshot = harness.step({ enable: false }, {}, 0.02);
  assert.deepEqual(snapshot.gpioWrites.filter((write) => write.pin === 15).at(-1), { pin: 15, value: 1 });

  harness = makeHarness({ heartbeatEnable: true, heartbeatPeriodSec: 0.01, heartbeatMode: "no-fault" });
  snapshot = harness.step({ adcFault: true }, {}, 0.02);
  assert.equal(snapshot.gpioWrites.some((write) => write.pin === 15 && write.value === 1), false);

  harness = makeHarness({
    heartbeatEnable: true,
    heartbeatPeriodSec: 0.01,
    heartbeatMode: "safe-to-drive",
    enableMode: "local-gpio",
  });
  snapshot = harness.step({ enable: false }, {}, 0.02);
  assert.equal(snapshot.gpioWrites.some((write) => write.pin === 15 && write.value === 1), false);
  snapshot = harness.step({ enable: true }, {}, 0.02);
  assert.deepEqual(snapshot.gpioWrites.filter((write) => write.pin === 15).at(-1), { pin: 15, value: 1 });

  harness = makeHarness({
    heartbeatEnable: true,
    heartbeatPeriodSec: 0.01,
    heartbeatMode: "armed-only",
    armNeutralSec: 0.1,
  });
  snapshot = harness.step({ throttle: 0 }, {}, 0.02);
  assert.equal(snapshot.gpioWrites.some((write) => write.pin === 15 && write.value === 1), false);
  snapshot = harness.step({ throttle: 0 }, {}, 0.11);
  assert.deepEqual(snapshot.gpioWrites.filter((write) => write.pin === 15).at(-1), { pin: 15, value: 1 });
});

test("status LEDs cover stopped, waiting, armed, inhibited, brake, fault, and active-low output", () => {
  let harness = makeHarness({ statusLedEnable: true, enableMode: "local-gpio" });
  let snapshot = harness.step({ enable: false });
  assertLedState(snapshot.gpioWrites, { ready: false, inhibit: true, fault: false });

  harness = makeHarness({
    statusLedEnable: true,
    armNeutralSec: 10,
    statusLedFlashPeriodSec: 0.01,
  });
  snapshot = harness.step({ throttle: 0 }, {}, 0.02);
  assertLedState(snapshot.gpioWrites, { ready: true, inhibit: false, fault: false });

  harness = makeHarness({ statusLedEnable: true });
  snapshot = harness.step({ throttle: 0 });
  assertLedState(snapshot.gpioWrites, { ready: true, inhibit: false, fault: false });

  harness = makeHarness({
    statusLedEnable: true,
    directionMode: "local-gpio",
    statusLedFlashPeriodSec: 0.01,
  });
  arm(harness);
  harness.step({ throttle: 0.4 }, {}, 0.02);
  snapshot = harness.step({ throttle: 0.4, directionReverse: true }, {}, 0.02);
  assertLedState(snapshot.gpioWrites, { ready: false, inhibit: true, fault: false });

  harness = makeHarness({ statusLedEnable: true, brakeMode: "local-gpio" });
  snapshot = harness.step({ brake: true });
  assertLedState(snapshot.gpioWrites, { ready: false, inhibit: false, fault: true });

  harness = makeHarness({ statusLedEnable: true, statusLedFlashPeriodSec: 0.01 });
  snapshot = harness.step({ adcFault: true }, {}, 0.02);
  assertLedState(snapshot.gpioWrites, { ready: false, inhibit: false, fault: true });

  harness = makeHarness({
    statusLedEnable: true,
    statusLedActiveHigh: false,
    enableMode: "local-gpio",
  });
  snapshot = harness.step({ enable: false });
  assertLedState(snapshot.gpioWrites, { ready: false, inhibit: true, fault: false }, false);
});

test("config-error loop only drives safe outputs when their config is valid", () => {
  let harness = makeHarness({ driveLayout: "bogus" });
  assert.match(configErrorReason(harness.runtime), /reason drive-layout/);
  let snapshot = harness.step();
  assert.deepEqual(snapshot.canOut, []);

  harness = makeHarness({
    maxCommand: 0,
    statusLedEnable: true,
    statusLedFlashPeriodSec: 0.01,
  });
  assert.match(configErrorReason(harness.runtime), /reason command-config/);
  snapshot = harness.step({}, {}, 0.02);
  assertOnlyActiveIds(snapshot.canOut, "four-wheel");
  assertAllCommands(snapshot.canOut, "canset-brake-rel", 0.08);
  assertLedState(snapshot.gpioWrites, { ready: false, inhibit: true, fault: true });

  harness = makeHarness({
    maxCommand: 0,
    statusLedEnable: true,
    statusReadyLedPin: 11,
    statusInhibitLedPin: 11,
  });
  snapshot = harness.step({}, {}, 0.02);
  assert.deepEqual(snapshot.gpioWrites, []);
});

test("periodic status logging follows print-status configuration", () => {
  let harness = makeHarness({ printStatus: false, statusPrintPeriodSec: 0.01 });
  arm(harness);
  harness.step({ throttle: 0.4 }, {}, 0.02);
  assert.equal(harness.runtime.prints.some((entry) => entry.startsWith("(skid ")), false);

  harness = makeHarness({ printStatus: true, statusPrintPeriodSec: 0.01 });
  arm(harness);
  harness.step({ throttle: 0.4, steer: 0.1 }, {}, 0.02);
  assertLastPrintMatches(harness.runtime, /^\(skid drive armed t fault nil reason none dir-lock nil cruise nil thr 0\.4 steer 0\.1 left 0\.5 right 0\.30000000000000004\)$/);
});

test("startup config validation reports each config-check reason", () => {
  const cases = [
    ["control-mode", { controlMode: "bogus" }],
    ["drive-layout", { driveLayout: "bogus" }],
    ["mix-mode", { mixMode: "bogus" }],
    ["input-mode", { inputMode: "bogus" }],
    ["direction-mode", { directionMode: "bogus" }],
    ["enable-mode", { enableMode: "bogus" }],
    ["brake-mode", { brakeMode: "bogus" }],
    ["cruise-mode", { cruiseMode: "bogus" }],
    ["cruise-cancel-mode", { cruiseCancelMode: "bogus" }],
    ["cruise-latch-mode", { cruiseMode: "local-gpio", cruiseLatchMode: "bogus" }],
    ["heartbeat-mode", { heartbeatMode: "bogus" }],
    ["can-pins", { canTxPin: 16, canRxPin: 16 }],
    ["motor-can-ids", { leftRearId: IDS.leftFront }],
    ["wheel-signs", { leftFrontSign: 0 }],
    ["wheel-trims", { leftFrontScale: 3 }],
    ["analog-calibration", { throttleCenterV: 0.4 }],
    ["selector-config", { directionMode: "local-adc", directionAdcThresholdV: 0.01 }],
    ["adc-channel-conflict", { directionMode: "local-adc", directionAdcChannel: 0 }],
    ["gpio-pin-conflict", { enableMode: "local-gpio", brakeMode: "local-gpio", brakeGpioPin: 10 }],
    ["command-config", { maxCommand: 0 }],
    ["timing-config", { armNeutralSec: -1 }],
    ["monitoring-config", { maxFetTempC: 0 }],
    ["safety-config", { statusLedEnable: true, statusReadyLedPin: 11, statusInhibitLedPin: 11 }],
  ];

  for (const [expectedReason, overrides] of cases) {
    const runtime = makeRuntime(overrides);
    assert.match(
      configErrorReason(runtime),
      new RegExp(`reason ${expectedReason}`),
      `expected ${expectedReason} from ${JSON.stringify(overrides)}, got ${configErrorReason(runtime)}`
    );
  }
});

test("two-wheel startup config validates generic settings only", () => {
  let runtime = makeRuntime({
    driveLayout: "two-wheel",
    leftFrontId: 0,
    leftFrontSign: 0,
    leftFrontScale: 3,
  });
  assert.match(startupLine(runtime), /^\(skid-start /);
  assert.equal(configErrorReason(runtime), "");

  runtime = makeRuntime({ driveLayout: "two-wheel", rightId: IDS.left });
  assert.match(configErrorReason(runtime), /reason motor-can-ids/);

  runtime = makeRuntime({ driveLayout: "two-wheel", leftSign: 0 });
  assert.match(configErrorReason(runtime), /reason wheel-signs/);

  runtime = makeRuntime({ driveLayout: "two-wheel", leftScale: 3 });
  assert.match(configErrorReason(runtime), /reason wheel-trims/);
});
