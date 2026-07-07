import skidSteerSource from "../../../src/skid-steer.lisp?raw";
import { LispRuntime, isLispSymbol, lispSymbol, parseLisp, symbolName } from "./lispRuntime";

function literalDefault(expression) {
  if (Array.isArray(expression)) {
    const head = expression[0];
    if (isLispSymbol(head) && head.name === "quote") {
      return symbolName(expression[1]);
    }
    return undefined;
  }
  if (isLispSymbol(expression)) {
    return expression.name;
  }
  return expression;
}

function extractScriptDefaults(source) {
  const defaults = new Map();
  for (const form of parseLisp(source)) {
    if (!Array.isArray(form) || !isLispSymbol(form[0]) || form[0].name !== "def") {
      continue;
    }
    const variable = form[1];
    if (!isLispSymbol(variable)) {
      continue;
    }
    const value = literalDefault(form[2]);
    if (value !== undefined) {
      defaults.set(variable.name, value);
    }
  }
  return defaults;
}

const scriptDefaults = extractScriptDefaults(skidSteerSource);

function def(name, fallback) {
  return scriptDefaults.has(name) ? scriptDefaults.get(name) : fallback;
}

export const defaultVehicleConfig = {
  groundSurface: "asphalt",
  driveLayout: def("*drive-layout*", "four-wheel"),
  mixMode: def("*mix-mode*", "skid-steer"),
  controlMode: def("*control-mode*", "current-rel"),
  inputMode: def("*input-mode*", "local-adc"),
  directionMode: def("*direction-mode*", "throttle-axis"),
  enableMode: def("*enable-mode*", "always"),
  brakeMode: "local-gpio",
  cruiseMode: def("*cruise-mode*", "off"),
  cruiseCancelMode: def("*cruise-cancel-mode*", "off"),
  cruiseLatchMode: def("*cruise-latch-mode*", "toggle"),
  heartbeatMode: def("*heartbeat-mode*", "safe-to-drive"),
  wheelDiameterM: 0.52,
  trackWidthM: 1.28,
  wheelbaseM: 1.72,
  massKg: 180,
  maxSpeedMps: 4.4704,
  driveForceN: 520,
  brakeForceN: 900,
  tireFrictionG: 0.85,
  slipResponsePerSec: 3.5,
  casterRollingDragN: 35,
  casterScrubForceN: 220,
  casterSwivelRateRadPerSec: 5,
  maxCommand: def("*max-command*", 0.2),
  reverseScale: def("*reverse-scale*", 0.6),
  throttleScale: def("*throttle-scale*", 1),
  steerScale: def("*steer-scale*", 1),
  steerDerateEnable: def("*steer-derate-enable*", true),
  steerDerateStartCommand: def("*steer-derate-start-command*", 0.4),
  steerDerateMinScale: def("*steer-derate-min-scale*", 0.5),
  accelRatePerSec: def("*accel-rate-per-sec*", 1),
  decelRatePerSec: def("*decel-rate-per-sec*", 2.5),
  reverseRatePerSec: def("*reverse-rate-per-sec*", 1),
  loopPeriodSec: def("*loop-period-sec*", 0.02),
  commandOffDelaySec: def("*command-off-delay-sec*", 0.08),
  neutralBrakeCommand: def("*neutral-brake-command*", 0),
  disableBrakeCommand: def("*disable-brake-command*", 0.08),
  brakeCommand: def("*brake-command*", 0.12),
  neutralCommandDeadband: def("*neutral-command-deadband*", 0.03),
  requireNeutralOnEnable: def("*require-neutral-on-enable*", true),
  armNeutralSec: def("*arm-neutral-sec*", 0.75),
  armNeutralThrottle: def("*arm-neutral-throttle*", 0.08),
  armNeutralSteer: def("*arm-neutral-steer*", 0.08),
  cruiseMinCommand: def("*cruise-min-command*", 0.1),
  cruiseCancelOnThrottle: def("*cruise-cancel-on-throttle*", true),
  cruiseThrottleCancelDelta: def("*cruise-throttle-cancel-delta*", 0.2),
  throttleMinV: def("*throttle-min-v*", 0.5),
  throttleCenterV: def("*throttle-center-v*", 1.65),
  throttleMaxV: def("*throttle-max-v*", 2.8),
  steerMinV: def("*steer-min-v*", 0.5),
  steerCenterV: def("*steer-center-v*", 1.65),
  steerMaxV: def("*steer-max-v*", 2.8),
  throttleDeadband: def("*throttle-deadband*", 0.06),
  steerDeadband: def("*steer-deadband*", 0.06),
  throttleExpo: def("*throttle-expo*", 0.2),
  steerExpo: def("*steer-expo*", 0.15),
  adcFaultMarginV: def("*adc-fault-margin-v*", 0.2),
  inputStaleSec: def("*input-stale-sec*", 0.25),
  requireMotorStatus: def("*require-motor-status*", false),
  motorStatusStaleSec: def("*motor-status-stale-sec*", 0.5),
  enableThermalStop: def("*enable-thermal-stop*", false),
  maxFetTempC: def("*max-fet-temp-c*", 80),
  maxMotorTempC: def("*max-motor-temp-c*", 90),
  heartbeatEnable: def("*heartbeat-enable*", false),
  heartbeatPeriodSec: def("*heartbeat-period-sec*", 0.5),
  statusLedEnable: def("*status-led-enable*", true),
  statusReadyLedPin: def("*status-ready-led-pin*", 11),
  statusInhibitLedPin: def("*status-inhibit-led-pin*", 12),
  statusFaultLedPin: def("*status-fault-led-pin*", 13),
  statusLedActiveHigh: def("*status-led-active-high*", true),
  statusLedFlashPeriodSec: def("*status-led-flash-period-sec*", 0.5),
  leftFrontId: def("*left-front-id*", 11),
  leftRearId: def("*left-rear-id*", 12),
  rightFrontId: def("*right-front-id*", 21),
  rightRearId: def("*right-rear-id*", 22),
  leftFrontSign: def("*left-front-sign*", 1),
  leftRearSign: def("*left-rear-sign*", 1),
  rightFrontSign: def("*right-front-sign*", 1),
  rightRearSign: def("*right-rear-sign*", 1),
  leftFrontScale: def("*left-front-scale*", 1),
  leftRearScale: def("*left-rear-scale*", 1),
  rightFrontScale: def("*right-front-scale*", 1),
  rightRearScale: def("*right-rear-scale*", 1),
};

export const defaultControlInput = {
  throttle: 0,
  steer: 0,
  enable: false,
  brake: false,
  cruiseRequest: false,
  cruiseCancel: false,
  adcFault: false,
  staleCan: false,
  thermalFault: false,
  motorStatusStale: false,
  directionReverse: false,
};

function lispBool(value) {
  return value !== null && value !== false && value !== undefined;
}

function readOptional(runtime, form, fallback = null) {
  try {
    return runtime.evaluate(form);
  } catch {
    return fallback;
  }
}

function activeWheels(runtime) {
  return {
    leftFront: lispBool(readOptional(runtime, [lispSymbol("drive-left-front")], true)),
    leftRear: lispBool(readOptional(runtime, [lispSymbol("drive-left-rear")], true)),
    rightFront: lispBool(readOptional(runtime, [lispSymbol("drive-right-front")], true)),
    rightRear: lispBool(readOptional(runtime, [lispSymbol("drive-right-rear")], true)),
  };
}

function wheelNameForId(runtime, id) {
  const wheels = [
    ["left-front", "*left-front-id*"],
    ["left-rear", "*left-rear-id*"],
    ["right-front", "*right-front-id*"],
    ["right-rear", "*right-rear-id*"],
  ];
  const match = wheels.find(([, variable]) => runtime.getNumber(variable) === id);
  return match ? match[0] : "can";
}

function normalizeCommands(runtime, commands) {
  return commands.map((command) => ({
    ...command,
    wheel: wheelNameForId(runtime, command.id),
  }));
}

function faultReasonFromValue(reason) {
  return symbolName(reason) || "none";
}

function faultReason(runtime) {
  return faultReasonFromValue(runtime.getValue("*fault-reason*"));
}

function statusLights(runtime, gpioWrites) {
  const enabled = runtime.getBoolean("*status-led-enable*");
  const activeHigh = runtime.getBoolean("*status-led-active-high*");
  const lastValueByPin = new Map();
  for (const write of gpioWrites) {
    lastValueByPin.set(write.pin, write.value);
  }

  const lightForPin = (key, label, pinVariable) => {
    const pin = runtime.getNumber(pinVariable);
    const value = lastValueByPin.get(pin);
    const active = enabled && value !== undefined && (activeHigh ? value === 1 : value === 0);
    return { key, label, pin, active };
  };

  return {
    enabled,
    activeHigh,
    lights: [
      lightForPin("ready", "Ready", "*status-ready-led-pin*"),
      lightForPin("inhibit", "Inhibit", "*status-inhibit-led-pin*"),
      lightForPin("fault", "Fault", "*status-fault-led-pin*"),
    ],
  };
}

function controllerState(runtime, brakeActive) {
  if (brakeActive) {
    return "brake";
  }
  if (runtime.getBoolean("*armed*")) {
    return "drive";
  }
  return "stop";
}

export class SkidController {
  constructor(config = defaultVehicleConfig) {
    this.reset(config);
  }

  reset(config = defaultVehicleConfig) {
    this.runtime = new LispRuntime(skidSteerSource, config);
  }

  step(input, config, dt, time) {
    if (!this.runtime) {
      this.reset(config);
    }

    const snapshot = this.runtime.step(input, config, time);
    const runtime = this.runtime;
    const sample = {
      inputOk: runtime.getBoolean("*sample-input-ok*"),
      throttle: runtime.getNumber("*sample-throttle*"),
      steer: runtime.getNumber("*sample-steer*"),
      driveThrottle: runtime.getNumber("*sample-drive-throttle*"),
      throttleVoltage: runtime.getNumber("*sample-throttle-v*"),
      steerVoltage: runtime.getNumber("*sample-steer-v*"),
      directionOk: runtime.getBoolean("*sample-direction-ok*"),
      directionSign: runtime.getNumber("*sample-direction-sign*"),
      directionRawSign: runtime.getNumber("*sample-direction-raw-sign*"),
      inputFault: faultReasonFromValue(runtime.getValue("*sample-input-fault*")),
      steerDerate: runtime.getNumber("*sample-steer-derate*"),
    };
    const enabled = runtime.getBoolean("*sample-enabled*");
    const brakeActive = runtime.getBoolean("*sample-brake-active*");
    const safe = runtime.getBoolean("*sample-safe*");
    const cruiseActive = runtime.getBoolean("*cruise-active*");
    const throttle = cruiseActive ? runtime.getNumber("*cruise-command*") : sample.driveThrottle;

    return {
      state: controllerState(runtime, brakeActive),
      source: "../src/skid-steer.lisp",
      lispDirect: true,
      time,
      dt,
      armed: runtime.getBoolean("*armed*"),
      faultLatched: runtime.getBoolean("*fault-latched*"),
      faultReason: faultReason(runtime),
      directionLock: runtime.getBoolean("*direction-lock*"),
      cruiseActive,
      sample,
      enabled,
      brakeActive,
      safe,
      throttle,
      steer: sample.steer,
      leftCommand: runtime.getNumber("*left-command*"),
      rightCommand: runtime.getNumber("*right-command*"),
      mixLeft: runtime.getNumber("*mix-left*"),
      mixRight: runtime.getNumber("*mix-right*"),
      canOut: normalizeCommands(runtime, snapshot.canOut),
      statusLights: statusLights(runtime, snapshot.gpioWrites),
      activeWheels: activeWheels(runtime),
      prints: snapshot.prints,
    };
  }
}
