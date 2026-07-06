# Performance Guide

This script runs as LispBM on the ESP32-S3 VESC Express. It is intended for human-operated vehicle controls, not high-speed motor-control loops.

The VESC motor controllers still do the fast motor control. This script sends higher-level commands such as current, duty, or RPM target.

If a term is unfamiliar, check the [glossary](glossary.md).

## Default Speed

Default loop period:

```lisp
(def *loop-period-sec* 0.02)
```

That means `50 Hz`, or 50 command updates per second.

For a hand-operated vehicle, `50 Hz` is a reasonable starting point.

## What Uses Time

The slow parts are usually:

- Sending CAN commands.
- Reading optional CAN status messages.
- Printing to the Lisp console.

The math for throttle, steering, ramps, and safety checks is small.

## Two-Wheel vs Four-Wheel CAN Traffic

The script sends one command per driven motor each loop.

At `50 Hz`:

- Two driven motors means about 100 drive commands per second.
- Four driven motors means about 200 drive commands per second.

That is normally fine on a correctly wired `500 kbit/s` CAN bus.

## Settings For Smooth Runtime

Recommended normal settings:

```lisp
(def *loop-period-sec* 0.02)
(def *print-status* nil)
(def *brake-mode* 'off)
(def *require-motor-status* nil)
(def *enable-thermal-stop* nil)
```

Why:

- Console printing can add timing jitter.
- Brake input is skipped when `*brake-mode*` is `'off`.
- Optional motor status checks add CAN reads.
- Optional thermal checks add CAN reads.

Enable printing and extra checks during testing only after the basic system works.

## Should You Run Faster?

Do not start faster than `50 Hz`.

You can try `100 Hz` later, but it doubles CAN command traffic. Only try it after:

- Bench tests pass.
- CAN wiring is reliable.
- Motor VESC timeouts do not trip.
- The vehicle drives smoothly at `50 Hz`.

## Same-Power Mode

`same-power` mode is slightly simpler than skid-steer mode:

- It reads only throttle.
- It skips steering.
- It sends the same target to both driven sides.

The difference is small, but it reduces input reads and configuration work.

## How To Measure

The local command:

```sh
make check
```

only checks script text. It does not measure real runtime performance.

To check real behavior:

1. Put the vehicle on blocks.
2. Keep `*max-command*` low.
3. Watch VESC Tool realtime data.
4. Confirm motor VESC timeouts do not happen.
5. Confirm command response is smooth.
6. Turn off `*print-status*` before real driving.

## What Not To Remove

Do not remove these to make the script faster:

- Neutral-before-arm.
- ADC range checks.
- CAN stale checks.
- Command timeout.
- Slew/ramp limits.
- Fault handling.

Those checks are cheap compared with CAN traffic and are important for safety.
