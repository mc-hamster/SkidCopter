# Safety Guide

This script helps the vehicle stop in many software fault cases. It is not a safety-rated controller.

For a large or heavy machine, you still need hardware safety systems.

If a term is unfamiliar, check the [glossary](glossary.md).

## What The Script Can Do

The script can:

- Refuse to drive until controls are neutral.
- Stop when a required input is out of range.
- Stop when CAN input data is too old.
- Stop when optional motor status messages are missing.
- Stop when optional temperature checks report too hot.
- Stop if the script loop takes too long.
- Stop when a direction switch changes while moving.
- Turn an optional heartbeat output off during a script fault.

These are useful checks, but they do not replace a real E-stop.

## What Hardware Must Do

Hardware should be able to stop the machine even if:

- The ESP32-S3 crashes.
- The script is wrong.
- CAN wiring fails.
- A VESC fails.
- A throttle wire breaks.
- A contactor welds shut.

Use appropriate hardware such as:

- Emergency stop buttons.
- Fuse or breaker.
- Main contactor.
- Precharge circuit if needed.
- Mechanical brake if the machine can roll.
- Guards around pinch points and rotating parts.

## Neutral Before Arm

The script waits for neutral before it drives.

This helps prevent startup motion if the throttle is not centered.

Settings:

```lisp
(def *require-neutral-on-enable* t)
(def *arm-neutral-sec* 0.75)
```

In `same-power` mode, only throttle must be neutral. In `skid-steer` mode, throttle and steering must be neutral.

## Direction Change Lock

If you use a separate forward/reverse switch, the script blocks direction changes while moving.

If the switch changes while the machine is moving:

1. Output stops.
2. Cruise cancels.
3. The script disarms.
4. You must return controls to neutral before it arms again.

Settings:

```lisp
(def *direction-neutral-lock* t)
(def *direction-change-command-threshold* 0.02)
```

## Fault Messages

When the script stops because of a fault, it prints a reason.

Example:

```text
skid-fault input
```

Common faults:

| Fault | Plain meaning |
|---|---|
| `input` | A required control input is missing, stale, or out of voltage range. |
| `direction-stale` | CAN direction input is too old. |
| `enable-stale` | CAN enable input is too old. |
| `cruise-stale` | CAN cruise input is too old. |
| `motor-stale` | Optional motor status monitoring is enabled but status is missing. |
| `thermal` | Optional temperature monitoring saw a hot motor or VESC. |
| `loop-overrun` | One script loop took too long. |

To clear a fault:

1. Fix the cause.
2. Center the controls.
3. Turn the enable input off.
4. Turn it back on and wait for neutral arming.

If `*enable-mode*` is `'always`, there is no enable switch to cycle, so the script clears after the cause is fixed and controls are neutral.

## Loop Watchdog

The loop watchdog checks whether the script took too long to run one pass.

Settings:

```lisp
(def *enable-loop-watchdog* t)
(def *loop-overrun-sec* 0.05)
```

The default threshold is intentionally loose. Tune only after bench testing.

## Heartbeat Output

The optional heartbeat output is a GPIO signal that toggles while the script is alive and has no latched fault.

Settings:

```lisp
(def *heartbeat-enable* nil)
(def *heartbeat-gpio-pin* -1)
(def *heartbeat-period-sec* 0.50)
```

Use heartbeat only as an input to another safety device or supervisory controller. Do not drive a contactor coil directly from the ESP32-S3 GPIO.

## Cruise Warning

Cruise control should stay off during first testing.

If you enable cruise on a large machine:

- Prefer `hold` mode over `toggle` mode.
- Add a dedicated cancel button.
- Keep throttle takeover cancellation enabled.
- Test every cancel method on blocks.

## Minimum Test List

Before anyone drives or stands near the machine, test:

- Enable switch disables motion.
- Hardware E-stop disables motion.
- Throttle out-of-range stops motion.
- CAN disconnect stops motion if using CAN input.
- Direction change while moving stops motion.
- Watchdog test stops motion.
- Heartbeat drops low on fault if heartbeat is used.
