# Bench Test Checklist

Do all of this with the vehicle secured and all driven wheels off the ground.

Keep a physical power disconnect within reach. Do not stand near the wheels.

If a term is unfamiliar, check the [glossary](glossary.md).

## Goal

The goal of the bench test is to prove:

- CAN communication works.
- The controls read correctly.
- The motors turn the expected direction.
- The script stops when inputs are bad.
- The ramp settings are gentle enough.
- Optional brake input cancels drive and cruise, if enabled.

Do not skip this step.

## 1. Prepare Each Motor VESC

Before using this script, configure each motor VESC by itself in VESC Tool.

For each driven motor VESC:

1. Run normal motor setup in VESC Tool.
2. Set conservative current limits.
3. Set voltage and temperature limits.
4. Set a unique CAN ID.
5. Set the same CAN baud rate on every VESC, normally `500 kbit/s`.
6. Confirm the motor can spin correctly by itself.

## 2. Start With Gentle Script Settings

In [src/skid-steer.lisp](../src/skid-steer.lisp), start low:

```lisp
(def *control-mode* 'current-rel)
(def *max-command* 0.03)
(def *neutral-brake-command* 0.00)
(def *disable-brake-command* 0.03)
(def *brake-command* 0.03)
(def *accel-rate-per-sec* 0.60)
(def *decel-rate-per-sec* 0.60)
(def *reverse-rate-per-sec* 0.35)
```

Pick your layout:

```lisp
(def *drive-layout* 'four-wheel)
```

or:

```lisp
(def *drive-layout* 'two-wheel)
```

Pick your mix mode:

```lisp
(def *mix-mode* 'skid-steer)
```

or:

```lisp
(def *mix-mode* 'same-power)
```

## 3. Run The Local Check

On the computer:

```sh
make check
```

This only checks the script text. It does not test the hardware.

## 4. Upload The Script

In VESC Tool:

1. Connect to the VESC Express.
2. Open the LispBM editor.
3. Upload or write `src/skid-steer.lisp`.
4. Watch for a console line starting with `skid-start`.

The `skid-start` line shows the selected layout, mix mode, input mode, and cruise mode.
It also shows the selected brake mode.

## 5. Check CAN Devices

In the Lisp console, run:

```lisp
(can-scan)
```

You should see every driven motor VESC CAN ID.

If a motor VESC is missing:

- Check CANH/CANL wiring.
- Check CAN termination.
- Check CAN baud rate.
- Check the motor VESC CAN ID.

## 6. Check Control Voltages

For local ADC controls, read the ADC values in the Lisp console.

For two-axis control:

```lisp
(print (list (get-adc 0) (get-adc 1)))
```

For same-power one-pot control:

```lisp
(print (get-adc 0))
```

Move the controls slowly.

Confirm:

- The voltage changes smoothly.
- The voltage never goes below `0 V`.
- The voltage never goes above `3.3 V`.
- The released control returns near `*throttle-center-v*`.
- The released control is inside the deadband.

If the released control is not stable, fix that before continuing.

## 7. First Motor Direction Test

Keep the wheels off the ground.

1. Center all required controls.
2. Enable the script.
3. Wait for the neutral arming delay.
4. Apply a very small forward command.
5. Confirm every driven wheel turns forward.

If one wheel turns backward, change that wheel sign:

```lisp
(def *left-sign* -1.0)
```

Only change the sign for the wheel that is wrong.

## 8. Steering Or Same-Power Test

For `skid-steer` mode:

1. Center throttle.
2. Apply a small right steering command.
3. The left side should move forward and the right side should move backward.
4. If steering is backwards, change:

```lisp
(def *invert-steer* t)
```

For `same-power` mode:

1. Apply a small forward command.
2. Both driven wheels should receive the same forward command.
3. Apply a small reverse command.
4. Both driven wheels should receive the same reverse command.

## 9. Ramp Test

Still on blocks:

1. Move the control quickly from neutral to forward.
2. Confirm the motors ramp up instead of jumping.
3. Release the control quickly to neutral.
4. Confirm the motors ramp down.
5. Move quickly from forward to reverse.
6. Confirm the command passes through neutral instead of instantly reversing.

If the machine reacts too suddenly, lower these:

```lisp
(def *accel-rate-per-sec* 0.40)
(def *decel-rate-per-sec* 0.40)
(def *reverse-rate-per-sec* 0.25)
```

## 10. Direction Switch Test

Only do this if you configured a separate direction switch.

1. Apply a small forward command.
2. While the wheels are moving slowly, change the direction switch.
3. The script should stop output.
4. Center the controls.
5. Wait for neutral arming.
6. Test the new direction.

Do not use the direction switch as a brake.

## 11. Optional Brake Input Test

Only do this if you configured a brake input.

Keep the wheels off the ground and keep `*brake-command*` low.

1. Center all controls.
2. Enable the script and wait for neutral arming.
3. Apply a very small forward command.
4. Press the brake input.
5. Confirm drive power stops and the active driven wheels receive braking.
6. Release the brake input while keeping controls neutral.
7. Confirm the script waits for neutral arming before drive can return.

If cruise is enabled, repeat the test with cruise active and confirm pressing brake cancels cruise.

If braking is too strong, lower:

```lisp
(def *brake-command* 0.02)
```

## 12. Fault Test

Test at least one fault before driving on the ground.

For local ADC, temporarily move or unplug a required ADC input so it goes outside the configured range.

Expected result:

```text
skid-fault input
```

The motors should stop.

To clear:

1. Fix the input.
2. Center controls.
3. Disable the enable input.
4. Re-enable and wait for neutral arming.

## 13. Optional Dash LED Test

Only do this if dash status LEDs are enabled and wired.

Keep the vehicle on blocks.

Expected states:

- Enable off, if an enable input is fitted: amber on, green off, red off.
- Enable on with neutral controls before arming completes: green flashing.
- Armed and ready: green on, amber off, red off.
- Brake input active, if fitted: red on, green off, amber off.
- Latched script fault: red flashing, green off, amber off.

If a direction switch is fitted, change direction while the wheels are still commanded and confirm amber flashes until controls return to neutral and the direction lock clears.

## 14. Optional Heartbeat Test

Only do this if heartbeat GPIO is enabled.

Use a meter, scope, or external controller input to confirm:

- The heartbeat toggles when no script fault is latched.
- The heartbeat goes low when a script fault is latched.
- The heartbeat stops if the VESC Express loses power or the script stops.

## 15. Cruise Test

Skip this until normal driving works.

If cruise is enabled:

1. Keep the vehicle on blocks.
2. Use a low `*max-command*`.
3. Apply a small command above `*cruise-min-command*`.
4. Press or hold the cruise request, depending on your cruise mode.
5. Confirm cruise cancels from throttle movement.
6. Confirm cruise cancels from the enable switch.
7. Confirm cruise cancels from the cancel button, if fitted.
8. Confirm cruise cancels from the brake input, if fitted.

## 16. First Ground Test

Only do this after all bench tests pass.

1. Use a clear open area.
2. Keep `*max-command*` low.
3. Test forward.
4. Test reverse.
5. Test stop.
6. Test steering, if using skid-steer mode.
7. Increase power slowly over multiple tests.

## Troubleshooting

| Symptom | Likely cause | What to check |
|---|---|---|
| No motor response | Not armed, wrong CAN ID, wrong layout, CAN wiring problem | `can-scan`, `*drive-layout*`, enable switch |
| One motor spins backward | Motor direction or wheel sign is wrong | That wheel's `*...-sign*` setting |
| Vehicle creeps at neutral | Pot center is off or deadband is too small | `*throttle-center-v*`, `*throttle-deadband*` |
| Stops every loop | ADC out of range or CAN input stale | ADC readings, `*adc-fault-margin-v*`, CAN status |
| Steering is backwards | Steering axis is inverted | `*invert-steer*` |
| Script never arms | Required controls are not neutral | Center voltages and deadbands |
| Script stays in brake | Brake input is active or inverted | `*brake-mode*`, `*brake-active-high*`, brake switch wiring |
| Thermal fault immediately | Status message 4 is not configured | Disable thermal check or configure status 4 |
| Cruise will not latch | Not armed or command too small | `*cruise-min-command*`, request switch |
