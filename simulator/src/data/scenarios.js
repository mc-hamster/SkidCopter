const HOLD = "hold";

export const scenarios = [
  {
    id: "manual",
    name: "Manual",
    description: "Use the live controls.",
    duration: 0,
    events: [],
  },
  {
    id: "arm-ramp-stop",
    name: "Arm, Ramp, Stop",
    description: "Neutral arming, forward ramp, release to neutral.",
    duration: 8,
    events: [
      { at: 0.0, throttle: 0, steer: 0, enable: false, brake: false },
      { at: 0.4, throttle: 0, steer: 0, enable: true, brake: false },
      { at: 1.25, throttle: 0, steer: 0, enable: true, brake: false },
      { at: 1.8, throttle: 0.55, steer: 0, enable: true, brake: false },
      { at: 4.4, throttle: 0.55, steer: 0, enable: true, brake: false },
      { at: 5.4, throttle: 0, steer: 0, enable: true, brake: false },
      { at: 7.2, throttle: 0, steer: 0, enable: false, brake: false },
    ],
  },
  {
    id: "skid-turn",
    name: "Skid Turn",
    description: "Forward command with a right steering sweep.",
    duration: 9,
    events: [
      { at: 0.0, throttle: 0, steer: 0, enable: false, brake: false },
      { at: 0.4, throttle: 0, steer: 0, enable: true, brake: false },
      { at: 1.25, throttle: 0, steer: 0, enable: true, brake: false },
      { at: 1.8, throttle: 0.45, steer: 0, enable: true, brake: false },
      { at: 3.0, throttle: 0.45, steer: 0.6, enable: true, brake: false },
      { at: 5.7, throttle: 0.45, steer: -0.35, enable: true, brake: false },
      { at: 7.4, throttle: 0, steer: 0, enable: true, brake: false },
    ],
  },
  {
    id: "caster-turn",
    name: "Caster Turn",
    description: "Low-speed S-turn for caster swivel lag and scrub.",
    duration: 10,
    events: [
      { at: 0.0, throttle: 0, steer: 0, enable: false, brake: false },
      { at: 0.4, throttle: 0, steer: 0, enable: true, brake: false },
      { at: 1.25, throttle: 0, steer: 0, enable: true, brake: false },
      { at: 1.8, throttle: 0.32, steer: 0.52, enable: true, brake: false },
      { at: 3.7, throttle: 0.32, steer: -0.52, enable: true, brake: false },
      { at: 5.9, throttle: 0.28, steer: 0.42, enable: true, brake: false },
      { at: 7.4, throttle: 0.2, steer: 0, enable: true, brake: false },
      { at: 8.6, throttle: 0, steer: 0, enable: true, brake: false },
    ],
  },
  {
    id: "brake-rearm",
    name: "Brake Re-arm",
    description: "Apply brake while driving, then require neutral before re-arm.",
    duration: 10,
    events: [
      { at: 0.0, throttle: 0, steer: 0, enable: false, brake: false },
      { at: 0.4, throttle: 0, steer: 0, enable: true, brake: false },
      { at: 1.25, throttle: 0, steer: 0, enable: true, brake: false },
      { at: 1.8, throttle: 0.5, steer: 0.1, enable: true, brake: false },
      { at: 3.6, throttle: 0.5, steer: 0.1, enable: true, brake: true },
      { at: 4.4, throttle: 0.5, steer: 0.1, enable: true, brake: false },
      { at: 5.2, throttle: 0, steer: 0, enable: true, brake: false },
      { at: 6.3, throttle: 0.35, steer: -0.2, enable: true, brake: false },
      { at: 8.5, throttle: 0, steer: 0, enable: false, brake: false },
    ],
  },
  {
    id: "fault-input",
    name: "ADC Fault",
    description: "Inject a bad input range while moving.",
    duration: 8,
    events: [
      { at: 0.0, throttle: 0, steer: 0, enable: false, brake: false, adcFault: false },
      { at: 0.4, throttle: 0, steer: 0, enable: true, brake: false, adcFault: false },
      { at: 1.25, throttle: 0, steer: 0, enable: true, brake: false, adcFault: false },
      { at: 1.8, throttle: 0.5, steer: 0, enable: true, brake: false, adcFault: false },
      { at: 3.4, throttle: 0.5, steer: 0, enable: true, brake: false, adcFault: true },
      { at: 4.6, throttle: 0, steer: 0, enable: true, brake: false, adcFault: false },
      { at: 5.4, throttle: 0, steer: 0, enable: false, brake: false, adcFault: false },
      { at: 6.2, throttle: 0, steer: 0, enable: true, brake: false, adcFault: false },
    ],
  },
];

const defaults = {
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

export function getScenario(id) {
  return scenarios.find((scenario) => scenario.id === id) || scenarios[0];
}

export function sampleScenario(id, time) {
  const scenario = getScenario(id);

  if (scenario.id === "manual" || scenario.events.length === 0) {
    return null;
  }

  const wrappedTime = scenario.duration > 0 ? time % scenario.duration : time;
  let before = scenario.events[0];
  let after = null;

  for (let i = 0; i < scenario.events.length; i += 1) {
    const event = scenario.events[i];
    if (event.at <= wrappedTime) {
      before = event;
    } else {
      after = event;
      break;
    }
  }

  const result = { ...defaults, ...before };
  if (!after) {
    return result;
  }

  const span = Math.max(after.at - before.at, 0.0001);
  const alpha = Math.min(Math.max((wrappedTime - before.at) / span, 0), 1);
  for (const key of ["throttle", "steer"]) {
    if (before[key] !== undefined && after[key] !== undefined && after[key] !== HOLD) {
      result[key] = before[key] + (after[key] - before[key]) * alpha;
    }
  }

  return result;
}
