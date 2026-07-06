export function createInitialVehicleState() {
  return {
    x: 0,
    z: 0,
    heading: 0,
    leftWheelAngle: 0,
    rightWheelAngle: 0,
    leftSpeedMps: 0,
    rightSpeedMps: 0,
    lateralSlipMps: 0,
    speedMps: 0,
    yawRateRad: 0,
    accelerationMps2: 0,
    slipRatio: 0,
    slipAngleDeg: 0,
    tractionLimited: false,
    distanceM: 0,
    trail: [{ x: 0, z: 0 }],
  };
}

const GRAVITY_MPS2 = 9.80665;
const FULL_TURN_RAD = Math.PI * 2;

function applyReverseScale(value, config) {
  return value < 0 ? value * config.reverseScale : value;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function moveToward(current, target, maxDelta) {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) {
    return target;
  }
  return current + Math.sign(delta) * maxDelta;
}

function normalizeHeadingRad(value) {
  return ((value % FULL_TURN_RAD) + FULL_TURN_RAD) % FULL_TURN_RAD;
}

function speedLimit(current, target, config, dt) {
  const massKg = Math.max(config.massKg, 1);
  const driveAccelMps2 = Math.max(config.driveForceN, 1) / massKg;
  const brakeAccelMps2 = Math.max(config.brakeForceN, 1) / massKg;
  const slowing = Math.abs(target) < Math.abs(current) || current * target < 0;
  const accelLimit = slowing ? brakeAccelMps2 : driveAccelMps2;

  return moveToward(current, target, accelLimit * dt);
}

export function stepVehicle(previous, telemetry, config, dt) {
  const leftSide = telemetry.state === "drive" ? applyReverseScale(telemetry.leftCommand, config) : 0;
  const rightSide = telemetry.state === "drive" ? applyReverseScale(telemetry.rightCommand, config) : 0;

  const targetLeftSpeed = leftSide * config.maxSpeedMps;
  const targetRightSpeed = rightSide * config.maxSpeedMps;
  const leftSpeed = speedLimit(previous.leftSpeedMps, targetLeftSpeed, config, dt);
  const rightSpeed = speedLimit(previous.rightSpeedMps, targetRightSpeed, config, dt);
  const idealForwardSpeedMps = (leftSpeed + rightSpeed) * 0.5;
  const idealYawRateRad = (rightSpeed - leftSpeed) / Math.max(config.trackWidthM, 0.1);
  const tireFrictionG = Math.max(config.tireFrictionG, 0.05);
  const maxLateralAccelMps2 = tireFrictionG * GRAVITY_MPS2;
  const lateralAccelDemandMps2 = Math.abs(idealForwardSpeedMps * idealYawRateRad);
  const lateralSlipRatio =
    lateralAccelDemandMps2 > maxLateralAccelMps2
      ? (lateralAccelDemandMps2 - maxLateralAccelMps2) / lateralAccelDemandMps2
      : 0;
  const scrubDemandMps = Math.abs(rightSpeed - leftSpeed) * 0.5;
  const maxScrubMps = Math.max(tireFrictionG * 2.2, 0.1);
  const scrubSlipRatio =
    scrubDemandMps > maxScrubMps ? (scrubDemandMps - maxScrubMps) / scrubDemandMps : 0;
  const slipRatio = clamp(Math.max(lateralSlipRatio, scrubSlipRatio), 0, 0.95);
  const slipLimitedYawRateRad = idealYawRateRad * (1 - slipRatio * 0.7);
  const yawInertiaKgm2 =
    (Math.max(config.massKg, 1) * (config.trackWidthM * config.trackWidthM + config.wheelbaseM * config.wheelbaseM)) / 12;
  const yawAccelLimitRad = (Math.max(config.driveForceN, config.brakeForceN, 1) * config.trackWidthM) / Math.max(yawInertiaKgm2, 0.01);
  const yawRateRad = moveToward(previous.yawRateRad, slipLimitedYawRateRad, yawAccelLimitRad * dt);
  const lateralSlipTargetMps =
    -Math.sign(idealYawRateRad || previous.yawRateRad || 0) *
    Math.sign(idealForwardSpeedMps || 1) *
    Math.abs(idealForwardSpeedMps) *
    slipRatio *
    0.55;
  const slipResponse = Math.max(config.slipResponsePerSec, 0.1);
  const lateralSlipMps = moveToward(
    previous.lateralSlipMps,
    lateralSlipTargetMps,
    Math.max(Math.abs(lateralSlipTargetMps - previous.lateralSlipMps), 0.2) *
      clamp(dt * slipResponse, 0, 1)
  );
  const speedMps = idealForwardSpeedMps * (1 - slipRatio * 0.15);
  const heading = normalizeHeadingRad(previous.heading + yawRateRad * dt);
  const forwardX = Math.sin(heading);
  const forwardZ = Math.cos(heading);
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);
  const x = previous.x + (forwardX * speedMps + rightX * lateralSlipMps) * dt;
  const z = previous.z + (forwardZ * speedMps + rightZ * lateralSlipMps) * dt;
  const wheelRadius = Math.max(config.wheelDiameterM * 0.5, 0.01);
  const leftWheelAngle = previous.leftWheelAngle + (leftSpeed / wheelRadius) * dt;
  const rightWheelAngle = previous.rightWheelAngle + (rightSpeed / wheelRadius) * dt;
  const groundSpeedMps = Math.hypot(speedMps, lateralSlipMps);
  const accelerationMps2 = dt > 0 ? (speedMps - previous.speedMps) / dt : 0;
  const slipAngleDeg =
    (Math.atan2(lateralSlipMps, Math.max(Math.abs(speedMps), 0.01)) * 180) / Math.PI;
  const distanceM = previous.distanceM + groundSpeedMps * dt;
  const trail = previous.trail.slice(-220);
  const last = trail[trail.length - 1];

  if (!last || Math.hypot(x - last.x, z - last.z) > 0.08) {
    trail.push({ x, z });
  }

  return {
    x,
    z,
    heading,
    leftWheelAngle,
    rightWheelAngle,
    leftSpeedMps: leftSpeed,
    rightSpeedMps: rightSpeed,
    lateralSlipMps,
    speedMps,
    yawRateRad,
    accelerationMps2,
    slipRatio,
    slipAngleDeg,
    tractionLimited: slipRatio > 0.01,
    distanceM,
    trail,
  };
}
