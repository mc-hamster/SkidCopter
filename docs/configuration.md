# Configuration Guide

This file explains the settings at the top of [src/skid-steer.lisp](../src/skid-steer.lisp). You edit those settings before uploading the script to the VESC Express.

Start with one of the examples below, then tune slowly with the wheels off the ground.

If a term is unfamiliar, check the [glossary](glossary.md).

## Example A: Four-Wheel Skid Steer

Use this when all four wheels have motors and the vehicle turns by driving the left and right sides differently.

```lisp
(def *drive-layout* 'four-wheel)
(def *mix-mode* 'skid-steer)
(def *input-mode* 'local-adc)
(def *direction-mode* 'throttle-axis)

(def *left-front-id* 11)
(def *left-rear-id* 12)
(def *right-front-id* 21)
(def *right-rear-id* 22)
```

Controls:

- Throttle on ADC channel `0`.
- Steering on ADC channel `1`.
- Centered throttle means stop.
- Forward throttle drives forward.
- Reverse throttle drives backward.

## Example B: Two Driven Wheels With Casters, Skid Steer

Use this when only two wheels have motors, but you still want left/right steering by changing the two motor speeds.

Rear drive with front casters:

```lisp
(def *drive-layout* 'two-wheel-rear)
(def *mix-mode* 'skid-steer)
(def *input-mode* 'local-adc)
(def *direction-mode* 'throttle-axis)

(def *left-rear-id* 12)
(def *right-rear-id* 22)
```

Front drive with rear casters:

```lisp
(def *drive-layout* 'two-wheel-front)
(def *mix-mode* 'skid-steer)
(def *left-front-id* 11)
(def *right-front-id* 21)
```

## Example C: Two Driven Wheels, Same Power, One Centered Pot

Use this when two wheels have motors, two wheels are casters, and both motor wheels should always receive the same command.

This is the best match for a self-centering 10k potentiometer where:

- Center is neutral.
- One direction is forward.
- The other direction is reverse.

Rear drive with front casters:

```lisp
(def *drive-layout* 'two-wheel-rear)
(def *mix-mode* 'same-power)
(def *input-mode* 'local-adc)
(def *direction-mode* 'throttle-axis)

(def *left-rear-id* 12)
(def *right-rear-id* 22)
(def *throttle-adc-channel* 0)
```

In `same-power` mode, the steering ADC is not used.

## Potentiometer Calibration

Every joystick, pedal, or pot is a little different. Measure the voltage at minimum, center, and maximum.

For a centered 10k pot wired between `3.3 V` and `GND`, a starting point is:

```lisp
(def *throttle-min-v* 0.05)
(def *throttle-center-v* 1.65)
(def *throttle-max-v* 3.25)
(def *throttle-deadband* 0.08)
```

What these mean:

- `*throttle-min-v*`: voltage at full reverse.
- `*throttle-center-v*`: voltage when the pot is released.
- `*throttle-max-v*`: voltage at full forward.
- `*throttle-deadband*`: the no-movement zone around center.

If the machine creeps when the pot is released, increase `*throttle-deadband*`.

For a two-axis joystick, also set steering:

```lisp
(def *steer-min-v* 0.50)
(def *steer-center-v* 1.65)
(def *steer-max-v* 2.80)
(def *steer-deadband* 0.06)
```

If a control works backward, flip it:

```lisp
(def *invert-throttle* t)
(def *invert-steer* t)
```

## Motor Command Strength

Start low. This matters more than almost any other setting during first tests.

Recommended first bench value:

```lisp
(def *control-mode* 'current-rel)
(def *max-command* 0.03)
```

`current-rel` means "use a fraction of the current limit already configured in each motor VESC."

Example: if a motor VESC is limited to `50 A`, then:

- `0.03` is about `1.5 A`.
- `0.20` is about `10 A`.

Do not raise `*max-command*` until the wheels-off-ground test passes.

## Ramp Rates

Ramp rates stop the script from jumping instantly to the new command when the operator moves the control quickly.

Good starting values:

```lisp
(def *accel-rate-per-sec* 0.60)
(def *decel-rate-per-sec* 0.60)
(def *reverse-rate-per-sec* 0.35)
```

Plain meaning:

- `*accel-rate-per-sec*`: how quickly power is allowed to increase.
- `*decel-rate-per-sec*`: how quickly power is allowed to return to neutral.
- `*reverse-rate-per-sec*`: how quickly it can pass from forward to reverse or reverse to forward.

Lower numbers are gentler. Higher numbers respond faster.

## Wheel Direction

If one motor spins backward, change that wheel's sign.

```lisp
(def *left-front-sign* 1.0)
(def *left-rear-sign* 1.0)
(def *right-front-sign* 1.0)
(def *right-rear-sign* 1.0)
```

Change `1.0` to `-1.0` for any driven wheel that spins the wrong way.

Only test this with the vehicle on blocks.

## Enable Switch

For early bench testing, this works:

```lisp
(def *enable-mode* 'always)
```

For a real machine, use a switch:

```lisp
(def *enable-mode* 'local-gpio)
(def *enable-gpio-pin* 10)
(def *enable-gpio-mode* 'pin-mode-in-pu)
(def *enable-active-high* nil)
```

The script still requires neutral controls before it arms:

```lisp
(def *require-neutral-on-enable* t)
(def *arm-neutral-sec* 0.75)
```

## Optional Brake Input

The brake input is off unless you enable it:

```lisp
(def *brake-mode* 'off)
```

Options:

- `'off`: no brake input is read or configured.
- `'local-gpio`: brake switch wired to the VESC Express.
- `'local-adc`: brake threshold input wired to the VESC Express.
- `'can-adc`: brake threshold input from the CAN input VESC.

For a simple active-low brake switch:

```lisp
(def *brake-mode* 'local-gpio)
(def *brake-gpio-pin* 6)
(def *brake-gpio-mode* 'pin-mode-in-pu)
(def *brake-active-high* nil)
(def *brake-command* 0.12)
```

When the brake input is active, the script cancels cruise, disarms drive output, and sends the brake command to the active driven motors. When the brake is released, controls must return to neutral before the script can arm again.

For first tests, keep `*brake-command*` low. Use `current-rel` or `current` mode if you want this input to command regenerative braking.

## Direction Selector

Most centered throttle controls do not need a direction switch. The throttle axis itself chooses forward or reverse:

```lisp
(def *direction-mode* 'throttle-axis)
```

Use a direction switch only when your throttle is one-directional, like a pedal:

```lisp
(def *direction-mode* 'local-gpio)
(def *direction-gpio-pin* 9)
(def *direction-gpio-mode* 'pin-mode-in-pu)
(def *direction-reverse-active-high* nil)
```

If the direction switch changes while the machine is moving, the script stops and requires neutral before arming again.

## Cruise Control

Cruise is off by default:

```lisp
(def *cruise-mode* 'off)
```

If you enable it, start with hold-to-run behavior:

```lisp
(def *cruise-mode* 'local-gpio)
(def *cruise-latch-mode* 'hold)
```

Cruise cancels when:

- The enable input turns off.
- The brake input is active.
- A fault happens.
- CAN input becomes stale.
- The throttle moves enough to take over.
- The optional cancel input is pressed.

For a large machine, keep cruise disabled until normal driving is fully tested.

## Optional Monitoring

These add extra checks, but only enable them after CAN status messages are configured on the motor VESCs:

```lisp
(def *require-motor-status* t)
(def *enable-thermal-stop* t)
```

If these are enabled before the motor VESCs broadcast the right status messages, the script will stop because it cannot prove the motors are fresh and below temperature limits.

## Runtime Logging

For normal driving, leave console printing off:

```lisp
(def *print-status* nil)
```

For bench testing, you can turn it on:

```lisp
(def *print-status* t)
```

Printing is useful while testing, but it can add timing jitter.

## CAN Pins

For the ESP32-S3-DevKitC-1 default wiring, use:

```lisp
(def *can-tx-pin* 16)
(def *can-rx-pin* 17)
```

Wire these to a 3.3 V logic CAN transceiver:

- CAN TX GPIO16 to transceiver TXD.
- CAN RX GPIO17 to transceiver RXD.

Only change these if your hardware or firmware uses different CAN pins.
