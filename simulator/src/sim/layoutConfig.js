// SPDX-License-Identifier: GPL-3.0-only

export function isFrontTwoWheelLayout(driveLayout) {
  return driveLayout === "two-wheel-front";
}

export function isRearTwoWheelLayout(driveLayout) {
  return driveLayout === "two-wheel-rear";
}

export function isPositionedTwoWheelLayout(driveLayout) {
  return isFrontTwoWheelLayout(driveLayout) || isRearTwoWheelLayout(driveLayout);
}

export function lispConfigForSimulator(config) {
  if (isFrontTwoWheelLayout(config.driveLayout)) {
    return {
      ...config,
      driveLayout: "two-wheel",
      leftId: config.leftFrontId,
      rightId: config.rightFrontId,
      leftSign: config.leftFrontSign,
      rightSign: config.rightFrontSign,
      leftScale: config.leftFrontScale,
      rightScale: config.rightFrontScale,
    };
  }

  if (isRearTwoWheelLayout(config.driveLayout)) {
    return {
      ...config,
      driveLayout: "two-wheel",
      leftId: config.leftRearId,
      rightId: config.rightRearId,
      leftSign: config.leftRearSign,
      rightSign: config.rightRearSign,
      leftScale: config.leftRearScale,
      rightScale: config.rightRearScale,
    };
  }

  return config;
}

export function wheelNameForGenericSide(driveLayout, side) {
  if (isFrontTwoWheelLayout(driveLayout)) {
    return side === "left" ? "left-front" : "right-front";
  }

  if (isRearTwoWheelLayout(driveLayout)) {
    return side === "left" ? "left-rear" : "right-rear";
  }

  return side;
}
