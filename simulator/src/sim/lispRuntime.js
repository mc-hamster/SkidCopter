const LOOP_CAPTURE = Symbol("loop-capture");

export function lispSymbol(name) {
  return { type: "symbol", name };
}

export function isLispSymbol(value) {
  return value && typeof value === "object" && value.type === "symbol";
}

export function symbolName(value) {
  return isLispSymbol(value) ? value.name : value;
}

function isTruthy(value) {
  return value !== null && value !== false && value !== undefined;
}

function stripComment(line) {
  let inString = false;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      inString = !inString;
      continue;
    }
    if (char === ";" && !inString) {
      return line.slice(0, index);
    }
  }

  return line;
}

function tokenize(source) {
  const text = source
    .split(/\r?\n/)
    .map(stripComment)
    .join("\n");
  const tokens = [];
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "(" || char === ")" || char === "'") {
      tokens.push(char);
      index += 1;
      continue;
    }
    if (char === "\"") {
      let value = "";
      index += 1;
      while (index < text.length) {
        const next = text[index];
        if (next === "\\") {
          value += text[index + 1] || "";
          index += 2;
          continue;
        }
        if (next === "\"") {
          index += 1;
          break;
        }
        value += next;
        index += 1;
      }
      tokens.push({ type: "string", value });
      continue;
    }

    let atom = "";
    while (index < text.length && !/\s|\(|\)|'/.test(text[index])) {
      atom += text[index];
      index += 1;
    }
    tokens.push(atom);
  }

  return tokens;
}

function parseAtom(token) {
  if (typeof token === "object" && token.type === "string") {
    return token.value;
  }
  if (token === "nil") {
    return null;
  }
  if (token === "t") {
    return true;
  }
  const number = Number(token);
  if (token !== "" && Number.isFinite(number)) {
    return number;
  }
  return lispSymbol(token);
}

function parseExpression(tokens) {
  if (tokens.length === 0) {
    throw new Error("Unexpected end of Lisp source");
  }

  const token = tokens.shift();
  if (token === "(") {
    const list = [];
    while (tokens.length > 0 && tokens[0] !== ")") {
      list.push(parseExpression(tokens));
    }
    if (tokens.shift() !== ")") {
      throw new Error("Unterminated Lisp list");
    }
    return list;
  }
  if (token === ")") {
    throw new Error("Unexpected ')'");
  }
  if (token === "'") {
    return [lispSymbol("quote"), parseExpression(tokens)];
  }
  return parseAtom(token);
}

export function parseLisp(source) {
  const tokens = tokenize(source);
  const forms = [];
  while (tokens.length > 0) {
    forms.push(parseExpression(tokens));
  }
  return forms;
}

class LispEnv {
  constructor(parent = null) {
    this.parent = parent;
    this.values = new Map();
  }

  define(name, value) {
    this.values.set(name, value);
    return value;
  }

  get(name) {
    if (name === "nil") {
      return null;
    }
    if (name === "t") {
      return true;
    }
    if (this.values.has(name)) {
      return this.values.get(name);
    }
    if (this.parent) {
      return this.parent.get(name);
    }
    throw new Error(`Undefined Lisp symbol ${name}`);
  }

  set(name, value) {
    if (this.values.has(name)) {
      this.values.set(name, value);
      return value;
    }
    if (this.parent) {
      return this.parent.set(name, value);
    }
    this.values.set(name, value);
    return value;
  }
}

function formatLispValue(value) {
  if (value === null || value === undefined) {
    return "nil";
  }
  if (value === true) {
    return "t";
  }
  if (value === false) {
    return "nil";
  }
  if (isLispSymbol(value)) {
    return value.name;
  }
  if (Array.isArray(value)) {
    return `(${value.map(formatLispValue).join(" ")})`;
  }
  return String(value);
}

function valueForActive(active, activeHigh) {
  if (activeHigh) {
    return active ? 3.3 : 0.0;
  }
  return active ? 0.0 : 3.3;
}

function voltageForSelector(active, threshold, activeHigh) {
  if (activeHigh) {
    return active ? threshold + 0.7 : threshold - 0.7;
  }
  return active ? threshold - 0.7 : threshold + 0.7;
}

function axisToVoltage(axis, minV, centerV, maxV) {
  const normalized = Math.min(Math.max(axis, -1), 1);
  return normalized >= 0
    ? centerV + normalized * (maxV - centerV)
    : centerV + normalized * (centerV - minV);
}

function commandRecord(fn, id, value, timeout = null, brake = false) {
  return {
    id,
    wheel: "can",
    fn,
    value: Number(value) || 0,
    timeout,
    active: true,
    brake,
  };
}

function faultApplies(value, id) {
  if (Array.isArray(value)) {
    return value.includes(id);
  }
  if (value instanceof Set) {
    return value.has(id);
  }
  if (value && typeof value === "object") {
    return Boolean(value[id] ?? value[String(id)]);
  }
  return Boolean(value);
}

function numericOverride(value, id, msg = null) {
  if (Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Map) {
    const keyed = msg === null ? value.get(id) : (value.get(`${id}:${msg}`) ?? value.get(id));
    return Number.isFinite(keyed) ? keyed : undefined;
  }
  if (value && typeof value === "object") {
    const keyed = msg === null
      ? (value[id] ?? value[String(id)])
      : (value[`${id}:${msg}`] ?? value[id] ?? value[String(id)]);
    return Number.isFinite(keyed) ? keyed : undefined;
  }
  return undefined;
}

export class LispRuntime {
  constructor(source, config = {}) {
    this.source = source;
    this.forms = parseLisp(source);
    this.global = new LispEnv();
    this.loopCondition = true;
    this.loopBody = null;
    this.currentTime = 0;
    this.hostInput = {};
    this.canOut = [];
    this.prints = [];
    this.gpioWrites = [];
    this.setupBuiltins();
    this.load(config);
  }

  setupBuiltins() {
    const define = (name, fn) => this.global.define(name, { type: "builtin", fn });

    define("+", (...args) => args.reduce((sum, value) => sum + value, 0));
    define("-", (...args) => (args.length === 1 ? -args[0] : args.slice(1).reduce((out, value) => out - value, args[0])));
    define("*", (...args) => args.reduce((out, value) => out * value, 1));
    define("/", (...args) => args.slice(1).reduce((out, value) => out / value, args[0]));
    define("abs", (value) => Math.abs(value));
    define("=", (a, b) => a === b);
    define("<", (a, b) => a < b);
    define(">", (a, b) => a > b);
    define("<=", (a, b) => a <= b);
    define(">=", (a, b) => a >= b);
    define("list", (...args) => args);
    define("print", (value) => {
      this.prints.push(formatLispValue(value));
      return value;
    });
    define("systime", () => this.currentTime);
    define("secs-since", (time) => this.currentTime - (Number(time) || 0));
    define("sleep", () => null);
    define("set-print-prefix", () => null);
    define("set-fw-name", () => null);
    define("can-start", () => null);
    define("can-use-vesc", () => null);
    define("gpio-configure", () => null);
    define("gpio-write", (pin, value) => {
      this.gpioWrites.push({ pin, value });
      return null;
    });
    define("gpio-read", (pin) => this.readGpio(pin));
    define("get-adc", (channel) => this.readLocalAdc(channel));
    define("canget-adc", (id, channel) => this.readCanAdc(id, channel));
    define("canget-ppm", () => Number(this.hostInput.throttle) || 0);
    define("can-msg-age", (id, msg) => this.canMsgAge(id, msg));
    define("canget-temp-fet", (id) => {
      const override = numericOverride(this.hostInput.fetTempC, id);
      if (override !== undefined) {
        return override;
      }
      return faultApplies(this.hostInput.thermalFault, id) ? this.getNumber("*max-fet-temp-c*") + 10 : 42;
    });
    define("canget-temp-motor", (id) => {
      const override = numericOverride(this.hostInput.motorTempC, id);
      if (override !== undefined) {
        return override;
      }
      return faultApplies(this.hostInput.thermalFault, id) ? this.getNumber("*max-motor-temp-c*") + 10 : 38;
    });
    define("canset-current-rel", (id, value, timeout) => this.pushCommand(commandRecord("canset-current-rel", id, value, timeout)));
    define("canset-current", (id, value, timeout) => this.pushCommand(commandRecord("canset-current", id, value, timeout)));
    define("canset-duty", (id, value) => this.pushCommand(commandRecord("canset-duty", id, value)));
    define("canset-rpm", (id, value) => this.pushCommand(commandRecord("canset-rpm", id, value)));
    define("canset-brake-rel", (id, value) => this.pushCommand(commandRecord("canset-brake-rel", id, value, null, value > 0)));
    define("canset-brake", (id, value) => this.pushCommand(commandRecord("canset-brake", id, value, null, value > 0)));
  }

  load(config) {
    const topLevel = [];
    for (const form of this.forms) {
      const head = Array.isArray(form) && isLispSymbol(form[0]) ? form[0].name : null;
      if (head === "def" || head === "defun") {
        this.evaluate(form, this.global);
      } else {
        topLevel.push(form);
      }
    }

    this.applyConfig(config);

    for (const form of topLevel) {
      const result = this.evaluate(form, this.global);
      if (result === LOOP_CAPTURE) {
        break;
      }
    }
  }

  applyConfig(config) {
    const symbolVars = {
      driveLayout: "*drive-layout*",
      mixMode: "*mix-mode*",
      controlMode: "*control-mode*",
      inputMode: "*input-mode*",
      directionMode: "*direction-mode*",
      directionGpioMode: "*direction-gpio-mode*",
      enableMode: "*enable-mode*",
      enableGpioMode: "*enable-gpio-mode*",
      brakeMode: "*brake-mode*",
      brakeGpioMode: "*brake-gpio-mode*",
      cruiseMode: "*cruise-mode*",
      cruiseGpioMode: "*cruise-gpio-mode*",
      cruiseCancelMode: "*cruise-cancel-mode*",
      cruiseCancelGpioMode: "*cruise-cancel-gpio-mode*",
      cruiseLatchMode: "*cruise-latch-mode*",
      heartbeatMode: "*heartbeat-mode*",
    };
    const numberVars = {
      canTxPin: "*can-tx-pin*",
      canRxPin: "*can-rx-pin*",
      leftId: "*left-id*",
      rightId: "*right-id*",
      leftFrontId: "*left-front-id*",
      leftRearId: "*left-rear-id*",
      rightFrontId: "*right-front-id*",
      rightRearId: "*right-rear-id*",
      throttleAdcChannel: "*throttle-adc-channel*",
      steerAdcChannel: "*steer-adc-channel*",
      inputCanId: "*input-can-id*",
      canThrottleAdcChannel: "*can-throttle-adc-channel*",
      canSteerAdcChannel: "*can-steer-adc-channel*",
      directionGpioPin: "*direction-gpio-pin*",
      directionAdcChannel: "*direction-adc-channel*",
      directionAdcThresholdV: "*direction-adc-threshold-v*",
      canDirectionAdcChannel: "*can-direction-adc-channel*",
      enableGpioPin: "*enable-gpio-pin*",
      enableAdcChannel: "*enable-adc-channel*",
      enableAdcThresholdV: "*enable-adc-threshold-v*",
      canEnableAdcChannel: "*can-enable-adc-channel*",
      cruiseGpioPin: "*cruise-gpio-pin*",
      cruiseAdcChannel: "*cruise-adc-channel*",
      cruiseAdcThresholdV: "*cruise-adc-threshold-v*",
      canCruiseAdcChannel: "*can-cruise-adc-channel*",
      cruiseCancelGpioPin: "*cruise-cancel-gpio-pin*",
      cruiseCancelAdcChannel: "*cruise-cancel-adc-channel*",
      cruiseCancelAdcThresholdV: "*cruise-cancel-adc-threshold-v*",
      canCruiseCancelAdcChannel: "*can-cruise-cancel-adc-channel*",
      brakeGpioPin: "*brake-gpio-pin*",
      brakeAdcChannel: "*brake-adc-channel*",
      brakeAdcThresholdV: "*brake-adc-threshold-v*",
      canBrakeAdcChannel: "*can-brake-adc-channel*",
      selectorDebounceSec: "*selector-debounce-sec*",
      selectorAdcHysteresisV: "*selector-adc-hysteresis-v*",
      leftSign: "*left-sign*",
      rightSign: "*right-sign*",
      leftFrontSign: "*left-front-sign*",
      leftRearSign: "*left-rear-sign*",
      rightFrontSign: "*right-front-sign*",
      rightRearSign: "*right-rear-sign*",
      leftScale: "*left-scale*",
      rightScale: "*right-scale*",
      leftFrontScale: "*left-front-scale*",
      leftRearScale: "*left-rear-scale*",
      rightFrontScale: "*right-front-scale*",
      rightRearScale: "*right-rear-scale*",
      maxCommand: "*max-command*",
      reverseScale: "*reverse-scale*",
      throttleScale: "*throttle-scale*",
      steerScale: "*steer-scale*",
      steerDerateStartCommand: "*steer-derate-start-command*",
      steerDerateMinScale: "*steer-derate-min-scale*",
      accelRatePerSec: "*accel-rate-per-sec*",
      decelRatePerSec: "*decel-rate-per-sec*",
      reverseRatePerSec: "*reverse-rate-per-sec*",
      loopPeriodSec: "*loop-period-sec*",
      commandOffDelaySec: "*command-off-delay-sec*",
      neutralBrakeCommand: "*neutral-brake-command*",
      disableBrakeCommand: "*disable-brake-command*",
      brakeCommand: "*brake-command*",
      neutralCommandDeadband: "*neutral-command-deadband*",
      armNeutralSec: "*arm-neutral-sec*",
      armNeutralThrottle: "*arm-neutral-throttle*",
      armNeutralSteer: "*arm-neutral-steer*",
      directionChangeCommandThreshold: "*direction-change-command-threshold*",
      cruiseMinCommand: "*cruise-min-command*",
      cruiseThrottleCancelDelta: "*cruise-throttle-cancel-delta*",
      throttleMinV: "*throttle-min-v*",
      throttleCenterV: "*throttle-center-v*",
      throttleMaxV: "*throttle-max-v*",
      steerMinV: "*steer-min-v*",
      steerCenterV: "*steer-center-v*",
      steerMaxV: "*steer-max-v*",
      throttleDeadband: "*throttle-deadband*",
      steerDeadband: "*steer-deadband*",
      throttleExpo: "*throttle-expo*",
      steerExpo: "*steer-expo*",
      adcFaultMarginV: "*adc-fault-margin-v*",
      inputStaleSec: "*input-stale-sec*",
      motorStatusStaleSec: "*motor-status-stale-sec*",
      maxFetTempC: "*max-fet-temp-c*",
      maxMotorTempC: "*max-motor-temp-c*",
      loopOverrunSec: "*loop-overrun-sec*",
      heartbeatGpioPin: "*heartbeat-gpio-pin*",
      heartbeatPeriodSec: "*heartbeat-period-sec*",
      statusReadyLedPin: "*status-ready-led-pin*",
      statusInhibitLedPin: "*status-inhibit-led-pin*",
      statusFaultLedPin: "*status-fault-led-pin*",
      statusLedFlashPeriodSec: "*status-led-flash-period-sec*",
      statusPrintPeriodSec: "*status-print-period-sec*",
    };
    const booleanVars = {
      invertThrottle: "*invert-throttle*",
      invertSteer: "*invert-steer*",
      directionReverseActiveHigh: "*direction-reverse-active-high*",
      directionAdcActiveHigh: "*direction-adc-active-high*",
      requireNeutralOnEnable: "*require-neutral-on-enable*",
      directionNeutralLock: "*direction-neutral-lock*",
      enableActiveHigh: "*enable-active-high*",
      enableAdcActiveHigh: "*enable-adc-active-high*",
      brakeActiveHigh: "*brake-active-high*",
      brakeAdcActiveHigh: "*brake-adc-active-high*",
      cruiseActiveHigh: "*cruise-active-high*",
      cruiseAdcActiveHigh: "*cruise-adc-active-high*",
      cruiseCancelActiveHigh: "*cruise-cancel-active-high*",
      cruiseCancelAdcActiveHigh: "*cruise-cancel-adc-active-high*",
      cruiseCancelOnThrottle: "*cruise-cancel-on-throttle*",
      requireMotorStatus: "*require-motor-status*",
      enableThermalStop: "*enable-thermal-stop*",
      steerDerateEnable: "*steer-derate-enable*",
      enableLoopWatchdog: "*enable-loop-watchdog*",
      heartbeatEnable: "*heartbeat-enable*",
      statusLedEnable: "*status-led-enable*",
      statusLedActiveHigh: "*status-led-active-high*",
      printStatus: "*print-status*",
    };

    for (const [key, variable] of Object.entries(symbolVars)) {
      if (config[key] !== undefined) {
        this.global.set(variable, lispSymbol(config[key]));
      }
    }
    for (const [key, variable] of Object.entries(numberVars)) {
      if (Number.isFinite(config[key])) {
        this.global.set(variable, config[key]);
      }
    }
    for (const [key, variable] of Object.entries(booleanVars)) {
      if (config[key] !== undefined) {
        this.global.set(variable, Boolean(config[key]));
      }
    }
  }

  evaluate(value, env = this.global) {
    if (isLispSymbol(value)) {
      return env.get(value.name);
    }
    if (!Array.isArray(value)) {
      return value;
    }
    if (value.length === 0) {
      return null;
    }

    const head = value[0];
    if (!isLispSymbol(head)) {
      const fn = this.evaluate(head, env);
      return this.applyFunction(fn, value.slice(1).map((arg) => this.evaluate(arg, env)));
    }

    const name = head.name;
    switch (name) {
      case "quote":
        return value[1];
      case "def": {
        const variable = value[1].name;
        return this.global.define(variable, this.evaluate(value[2], env));
      }
      case "defun": {
        const functionName = value[1].name;
        const params = value[2].map((param) => param.name);
        const body = value.slice(3);
        return this.global.define(functionName, { type: "lambda", params, body, env });
      }
      case "setq": {
        const variable = value[1].name;
        return env.set(variable, this.evaluate(value[2], env));
      }
      case "let": {
        const local = new LispEnv(env);
        for (const binding of value[1]) {
          local.define(binding[0].name, this.evaluate(binding[1], local));
        }
        return this.evaluateSequence(value.slice(2), local);
      }
      case "if":
        return isTruthy(this.evaluate(value[1], env))
          ? this.evaluate(value[2], env)
          : value.length > 3
            ? this.evaluate(value[3], env)
            : null;
      case "progn":
        return this.evaluateSequence(value.slice(1), env);
      case "and": {
        let result = true;
        for (const expression of value.slice(1)) {
          result = this.evaluate(expression, env);
          if (!isTruthy(result)) {
            return null;
          }
        }
        return result;
      }
      case "or":
        for (const expression of value.slice(1)) {
          const result = this.evaluate(expression, env);
          if (isTruthy(result)) {
            return result;
          }
        }
        return null;
      case "not":
        return isTruthy(this.evaluate(value[1], env)) ? null : true;
      case "eq": {
        const left = this.evaluate(value[1], env);
        const right = this.evaluate(value[2], env);
        return symbolName(left) === symbolName(right);
      }
      case "trap":
        try {
          return this.evaluate(value[1], env);
        } catch {
          return null;
        }
      case "loopwhile":
        this.loopCondition = value[1];
        this.loopBody = value.slice(2);
        return LOOP_CAPTURE;
      default: {
        const fn = env.get(name);
        return this.applyFunction(fn, value.slice(1).map((arg) => this.evaluate(arg, env)));
      }
    }
  }

  evaluateSequence(forms, env) {
    let result = null;
    for (const form of forms) {
      result = this.evaluate(form, env);
      if (result === LOOP_CAPTURE) {
        return result;
      }
    }
    return result;
  }

  applyFunction(fn, args) {
    if (fn?.type === "builtin") {
      return fn.fn(...args);
    }
    if (fn?.type === "lambda") {
      const local = new LispEnv(fn.env);
      fn.params.forEach((param, index) => {
        local.define(param, args[index] ?? null);
      });
      return this.evaluateSequence(fn.body, local);
    }
    throw new Error(`Cannot call Lisp value ${formatLispValue(fn)}`);
  }

  step(input, config, time) {
    this.hostInput = input || {};
    this.currentTime = time;
    this.canOut = [];
    this.gpioWrites = [];
    this.applyConfig(config || {});

    if (!this.loopBody) {
      throw new Error("Lisp script did not install a control loop");
    }
    if (isTruthy(this.evaluate(this.loopCondition, this.global))) {
      this.evaluateSequence(this.loopBody, this.global);
    }

    return this.snapshot();
  }

  snapshot() {
    return {
      globals: this.global.values,
      canOut: this.canOut.map((command) => ({ ...command })),
      prints: this.prints.slice(),
      gpioWrites: this.gpioWrites.slice(),
    };
  }

  pushCommand(command) {
    this.canOut.push(command);
    return null;
  }

  getValue(name) {
    return this.global.get(name);
  }

  getNumber(name) {
    const value = this.getValue(name);
    return Number(value) || 0;
  }

  getBoolean(name) {
    return isTruthy(this.getValue(name));
  }

  getSymbolName(name) {
    return symbolName(this.getValue(name));
  }

  readLocalAdc(channel) {
    return this.readAdc(channel, false);
  }

  readCanAdc(id, channel) {
    if (id !== this.getNumber("*input-can-id*")) {
      return 0;
    }
    return this.readAdc(channel, true);
  }

  readAdc(channel, canBacked) {
    const input = this.hostInput;
    const throttleChannel = canBacked ? this.getNumber("*can-throttle-adc-channel*") : this.getNumber("*throttle-adc-channel*");
    const steerChannel = canBacked ? this.getNumber("*can-steer-adc-channel*") : this.getNumber("*steer-adc-channel*");
    const directionChannel = canBacked ? this.getNumber("*can-direction-adc-channel*") : this.getNumber("*direction-adc-channel*");
    const enableChannel = canBacked ? this.getNumber("*can-enable-adc-channel*") : this.getNumber("*enable-adc-channel*");
    const brakeChannel = canBacked ? this.getNumber("*can-brake-adc-channel*") : this.getNumber("*brake-adc-channel*");
    const cruiseChannel = canBacked ? this.getNumber("*can-cruise-adc-channel*") : this.getNumber("*cruise-adc-channel*");
    const cruiseCancelChannel = canBacked
      ? this.getNumber("*can-cruise-cancel-adc-channel*")
      : this.getNumber("*cruise-cancel-adc-channel*");
    const directionMode = this.getSymbolName("*direction-mode*");
    const enableMode = this.getSymbolName("*enable-mode*");
    const brakeMode = this.getSymbolName("*brake-mode*");
    const cruiseMode = this.getSymbolName("*cruise-mode*");
    const cruiseCancelMode = this.getSymbolName("*cruise-cancel-mode*");

    if (channel === throttleChannel) {
      if (Number.isFinite(input.throttleVoltage)) {
        return input.throttleVoltage;
      }
      if (input.adcFault) {
        return this.getNumber("*throttle-max-v*") + this.getNumber("*adc-fault-margin-v*") + 0.4;
      }
      return axisToVoltage(
        Number(input.throttle) || 0,
        this.getNumber("*throttle-min-v*"),
        this.getNumber("*throttle-center-v*"),
        this.getNumber("*throttle-max-v*")
      );
    }
    if (channel === steerChannel) {
      if (Number.isFinite(input.steerVoltage)) {
        return input.steerVoltage;
      }
      if (input.steerAdcFault) {
        return this.getNumber("*steer-max-v*") + this.getNumber("*adc-fault-margin-v*") + 0.4;
      }
      return axisToVoltage(
        Number(input.steer) || 0,
        this.getNumber("*steer-min-v*"),
        this.getNumber("*steer-center-v*"),
        this.getNumber("*steer-max-v*")
      );
    }
    if (channel === directionChannel && ((!canBacked && directionMode === "local-adc") || (canBacked && directionMode === "can-adc"))) {
      if (Number.isFinite(input.directionVoltage)) {
        return input.directionVoltage;
      }
      return voltageForSelector(
        Boolean(input.directionReverse),
        this.getNumber("*direction-adc-threshold-v*"),
        this.getBoolean("*direction-adc-active-high*")
      );
    }
    if (channel === enableChannel && ((!canBacked && enableMode === "local-adc") || (canBacked && enableMode === "can-adc"))) {
      if (Number.isFinite(input.enableVoltage)) {
        return input.enableVoltage;
      }
      return voltageForSelector(Boolean(input.enable), this.getNumber("*enable-adc-threshold-v*"), this.getBoolean("*enable-adc-active-high*"));
    }
    if (channel === brakeChannel && ((!canBacked && brakeMode === "local-adc") || (canBacked && brakeMode === "can-adc"))) {
      if (Number.isFinite(input.brakeVoltage)) {
        return input.brakeVoltage;
      }
      return voltageForSelector(Boolean(input.brake), this.getNumber("*brake-adc-threshold-v*"), this.getBoolean("*brake-adc-active-high*"));
    }
    if (channel === cruiseChannel && ((!canBacked && cruiseMode === "local-adc") || (canBacked && cruiseMode === "can-adc"))) {
      if (Number.isFinite(input.cruiseVoltage)) {
        return input.cruiseVoltage;
      }
      return voltageForSelector(
        Boolean(input.cruiseRequest),
        this.getNumber("*cruise-adc-threshold-v*"),
        this.getBoolean("*cruise-adc-active-high*")
      );
    }
    if (
      channel === cruiseCancelChannel &&
      ((!canBacked && cruiseCancelMode === "local-adc") || (canBacked && cruiseCancelMode === "can-adc"))
    ) {
      if (Number.isFinite(input.cruiseCancelVoltage)) {
        return input.cruiseCancelVoltage;
      }
      return voltageForSelector(
        Boolean(input.cruiseCancel),
        this.getNumber("*cruise-cancel-adc-threshold-v*"),
        this.getBoolean("*cruise-cancel-adc-active-high*")
      );
    }
    return 0;
  }

  readGpio(pin) {
    const input = this.hostInput;
    if (pin === this.getNumber("*enable-gpio-pin*")) {
      return valueForActive(Boolean(input.enable), this.getBoolean("*enable-active-high*")) > 1 ? 1 : 0;
    }
    if (pin === this.getNumber("*brake-gpio-pin*")) {
      return valueForActive(Boolean(input.brake), this.getBoolean("*brake-active-high*")) > 1 ? 1 : 0;
    }
    if (pin === this.getNumber("*cruise-gpio-pin*")) {
      return valueForActive(Boolean(input.cruiseRequest), this.getBoolean("*cruise-active-high*")) > 1 ? 1 : 0;
    }
    if (pin === this.getNumber("*cruise-cancel-gpio-pin*")) {
      return valueForActive(Boolean(input.cruiseCancel), this.getBoolean("*cruise-cancel-active-high*")) > 1 ? 1 : 0;
    }
    if (pin === this.getNumber("*direction-gpio-pin*")) {
      return valueForActive(Boolean(input.directionReverse), this.getBoolean("*direction-reverse-active-high*")) > 1 ? 1 : 0;
    }
    return 1;
  }

  canMsgAge(id, msg) {
    const input = this.hostInput;
    if (id === this.getNumber("*input-can-id*") && msg === 6) {
      if (Number.isFinite(input.can6Age)) {
        return input.can6Age;
      }
      return input.staleCan ? this.getNumber("*input-stale-sec*") + 0.1 : 0.01;
    }
    const statusAge = numericOverride(input.motorStatusAge, id, msg);
    if ((msg === 1 || msg === 4) && statusAge !== undefined) {
      return statusAge;
    }
    if ((msg === 1 || msg === 4) && faultApplies(input.motorStatusStale, id)) {
      return this.getNumber("*motor-status-stale-sec*") + 0.1;
    }
    return 0.01;
  }
}
