# Control Modes Explained

This page explains the main choices in plain language.

If a term is unfamiliar, check the [glossary](glossary.md).

The short version:

- `*drive-layout*` says which wheels have motors.
- `*mix-mode*` says how the controls become left and right motor commands.
- `*input-mode*` says where the controls are connected.
- `*control-mode*` says what type of command is sent to the motor VESCs.

## Drive Layout

This setting tells the script which wheel positions are powered.

```lisp
(def *drive-layout* 'four-wheel)
```

Options:

| Setting | Use it when |
|---|---|
| `'four-wheel` | All four wheels have motors. |
| `'two-wheel-front` | Only the front wheels have motors. Rear wheels are casters. |
| `'two-wheel-rear` | Only the rear wheels have motors. Front wheels are casters. |

Caster wheel positions are ignored. The script does not send them drive commands, stop commands, or motor-status checks.

## Mix Mode

This setting tells the script how to turn operator input into motor commands.

```lisp
(def *mix-mode* 'skid-steer)
```

Options:

| Setting | What it does |
|---|---|
| `'skid-steer` | Uses throttle and steering. The left and right sides can receive different commands. |
| `'same-power` | Uses throttle only. All driven wheels receive the same command. |

Use `same-power` for a two-wheel machine with casters when the motors should not be used for steering.

## Input Mode

This setting tells the script where the control signals come from.

```lisp
(def *input-mode* 'local-adc)
```

Options:

| Setting | Meaning |
|---|---|
| `'local-adc` | Controls are wired directly to the VESC Express ADC pins. This is the simplest setup. |
| `'can-adc` | Controls are wired to another VESC, and the Express reads them over CAN. |
| `'can-ppm` | Throttle comes from a PPM receiver connected to another VESC. Steering comes from that VESC's ADC. |

For a basic build, use `local-adc`.

## Direction Mode

This setting tells the script how forward and reverse are chosen.

```lisp
(def *direction-mode* 'throttle-axis)
```

Options:

| Setting | Meaning |
|---|---|
| `'throttle-axis` | A centered throttle control chooses direction. One side of center is forward, the other is reverse. |
| `'fixed-forward` | Throttle only drives forward. |
| `'fixed-reverse` | Throttle only drives reverse. |
| `'local-gpio` | A local switch chooses forward or reverse. |
| `'local-adc` | A local voltage input chooses forward or reverse. |
| `'can-adc` | A voltage input on another VESC chooses forward or reverse. |

For a self-centering pot or joystick, use `throttle-axis`.

## Motor Command Mode

This setting tells the script what kind of command it sends to each motor VESC.

```lisp
(def *control-mode* 'current-rel)
```

Options:

| Setting | What it sends | Beginner advice |
|---|---|---|
| `'current-rel` | A fraction of the VESC current limit. | Recommended starting mode. |
| `'current` | Motor current in amps. | Useful if you want direct amp commands. |
| `'duty` | Duty-cycle command. | Use carefully; not recommended for first tests. |
| `'rpm` | Electrical RPM target. | Requires tuned speed control on each VESC. |

`current-rel` is easiest to reason about. If each motor VESC has a safe current limit, the script commands a percentage of that limit.

Example:

```lisp
(def *control-mode* 'current-rel)
(def *max-command* 0.20)
```

If a VESC is limited to `50 A`, then `0.20` is about `10 A`.

## What The Mixer Does

In `skid-steer` mode:

```text
left  = throttle + steering
right = throttle - steering
```

That allows turning by making the sides different.

In `same-power` mode:

```text
left  = throttle
right = throttle
```

Both driven sides get the same command.

The script then limits the result to the safe range, applies ramp limits, and sends commands only to the active driven wheels.

## Ramp Limits

Ramp limits prevent sudden command jumps.

```lisp
(def *accel-rate-per-sec* 0.60)
(def *decel-rate-per-sec* 0.60)
(def *reverse-rate-per-sec* 0.35)
```

What they mean:

- `accel`: how fast command can increase.
- `decel`: how fast command can return toward neutral.
- `reverse`: how fast command can pass from forward to reverse.

If the machine reacts too suddenly, lower these values.

## Enable And Arming

Even if the enable switch is on, the script waits for neutral before driving.

```lisp
(def *require-neutral-on-enable* t)
```

This helps prevent startup motion if the throttle is not centered.

In `same-power` mode, only the throttle must be neutral. In `skid-steer` mode, throttle and steering must both be neutral.

## Stop And Brake Commands

When the script is not allowed to drive, it sends a stop or brake command to active driven motors.

```lisp
(def *neutral-brake-command* 0.00)
(def *disable-brake-command* 0.08)
```

Plain meaning:

- `neutral-brake`: what to do when the control is centered.
- `disable-brake`: what to do when disabled, faulted, stale, or not armed.

For first tests, keep these low.

## Cruise Control

Cruise is off by default.

```lisp
(def *cruise-mode* 'off)
```

Cruise holds the current drive command. It is not true vehicle speed control unless you use RPM mode and tune the VESC speed loops.

Cruise cancels when:

- The enable input turns off.
- A fault happens.
- The throttle moves enough to take over.
- A cancel button is pressed, if configured.
- A direction selector changes while not neutral.

## Faults

When something is wrong, the script stops output and prints a reason in the Lisp console.

Example:

```text
skid-fault input
```

Common reasons:

| Fault | Meaning |
|---|---|
| `input` | A required input is out of range or stale. |
| `motor-stale` | Motor status messages are missing when monitoring is enabled. |
| `thermal` | A monitored motor or VESC is too hot. |
| `loop-overrun` | One script loop took too long. |

Clear the cause, center the controls, and disable/re-enable before testing again.
