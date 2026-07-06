# SkidCopter VESC Express Vehicle Controller

This project is a VESC Express LispBM script for controlling a vehicle from one ESP32-S3 VESC Express board. The Express reads your controls, calculates motor commands, and sends those commands over CAN to the driven VESC motor controllers.

## Who This Is For

This project is for builders who need one VESC Express board to coordinate two or four VESC motor controllers over CAN.

Common use cases:

- Burning Man, parade, festival, and large kinetic art vehicles.
- Robotics platforms, rover bases, and utility robots.
- Rideable prototypes and experimental off-road electric vehicles.
- Low-speed carts, material-moving platforms, and shop-built machines.
- Research, education, and test vehicles where the builder controls the whole system.

This project is not meant to be a road-legal vehicle controller, a safety-certified industrial controller, or the only safety system on a machine that can injure people. Use real hardware safety parts.

It can run these common layouts:

- Four driven wheels, skid-steer style.
- Two driven wheels plus two caster wheels, skid-steer style.
- Two driven wheels plus two caster wheels, both motors always given the same power from one self-centering throttle pot.

## Read This First

This script is not a replacement for real machine safety hardware. For a large or heavy machine, use a hardware E-stop, fuse or breaker, contactor or drive-enable circuit, and proper guards. The script can stop sending motor commands, but it cannot make an unsafe wiring or mechanical design safe.

Use this software entirely at your own risk. Vehicles, robots, and motor systems can cause property damage, injury, or death if they are built, configured, tested, or operated incorrectly. The author and contributors are not responsible or liable for anything that happens from using, modifying, wiring, testing, or operating this software.

Start with the wheels off the ground, low current limits, and a physical power disconnect within reach.

## Startup Safety

Yes, the script has a startup safe-state procedure. It is enabled by default.

```lisp
(def *require-neutral-on-enable* t)
(def *arm-neutral-sec* 0.75)
(def *arm-neutral-throttle* 0.08)
(def *arm-neutral-steer* 0.08)
```

At power-up, the script starts unarmed and sends stop/brake commands. It will not drive until:

- Required control inputs are valid.
- The enable input allows driving, unless `*enable-mode*` is `'always`.
- There is no latched fault.
- The throttle is neutral for `*arm-neutral-sec*`.
- The steering control is also neutral for `*arm-neutral-sec*` when using `'skid-steer` mode.

In `'same-power` mode, only the throttle must be neutral because steering is not used.

If the throttle, joystick, or pot powers up away from neutral, the script stays unarmed until the control returns to neutral and stays there for the arming delay.

For a real machine, use an enable switch instead of leaving enable mode at `'always`:

```lisp
(def *enable-mode* 'local-gpio)
```

The enable switch is still not a hardware E-stop. It is only an input to the script.

## Main Choices

You only need to make a few big choices before editing the script.

### 1. Which wheels are powered?

Set `*drive-layout*`:

```lisp
(def *drive-layout* 'four-wheel)
```

Options:

- `'four-wheel`: all four wheel positions have motors.
- `'two-wheel-front`: only the front left and front right wheels have motors. Rear wheels are casters.
- `'two-wheel-rear`: only the rear left and rear right wheels have motors. Front wheels are casters.

### 2. How should the motors be controlled?

Set `*mix-mode*`:

```lisp
(def *mix-mode* 'skid-steer)
```

Options:

- `'skid-steer`: throttle and steering are mixed into left-side and right-side commands.
- `'same-power`: one throttle control drives all powered wheels with the same command.

Use `'same-power` for the self-centering 10k potentiometer setup where center is neutral, one direction is forward, and the other is reverse.

### 3. What motor command type should be sent?

The recommended default is:

```lisp
(def *control-mode* 'current-rel)
(def *max-command* 0.20)
```

This means the script commands a percentage of each VESC's configured current limit. For example, if a motor VESC is limited to `50 A`, then `0.20` means about `10 A`.

Other modes are available, but start with `current-rel` unless you have a clear reason not to.

## Files

- [src/skid-steer.lisp](src/skid-steer.lisp): the script you upload to the VESC Express.
- [docs/configuration.md](docs/configuration.md): step-by-step setup examples.
- [docs/wiring-esp32-s3.md](docs/wiring-esp32-s3.md): how to wire CAN, motors, controls, switches, and heartbeat.
- [docs/bench-test.md](docs/bench-test.md): first power-up and wheels-off-ground test checklist.
- [docs/control-interfaces.md](docs/control-interfaces.md): plain-language explanation of each control mode.
- [docs/safety.md](docs/safety.md): what the script checks and what still needs hardware safety.
- [docs/performance.md](docs/performance.md): loop rate and CAN traffic notes.
- [docs/glossary.md](docs/glossary.md): short definitions for terms used in the docs.
- [tools/lispbm_static_check.py](tools/lispbm_static_check.py): local syntax sanity checker.

## Basic Setup Flow

1. Wire the VESC Express, CAN transceiver, driven VESC motor controllers, controls, and enable switch. See [docs/wiring-esp32-s3.md](docs/wiring-esp32-s3.md).
2. Configure each motor VESC by itself in VESC Tool first. Set current limits, voltage limits, temperature limits, CAN ID, and CAN baud rate.
3. Edit the top settings in [src/skid-steer.lisp](src/skid-steer.lisp).
4. Run:

```sh
make check
```

5. Upload the script in VESC Tool using the LispBM editor.
6. Do the full [bench test](docs/bench-test.md) with the wheels off the ground.
7. Only after the bench test passes, test on the ground at very low power.

## Uploading the Script

In VESC Tool:

1. Connect to the VESC Express.
2. Open the LispBM editor.
3. Load or paste `src/skid-steer.lisp`.
4. Upload/write the script.
5. Watch the Lisp console for a line starting with `skid-start`.

The script is stored on the VESC Express and starts again after reboot.

## Local Check

Run this before uploading:

```sh
make check
```

This catches unbalanced parentheses, unterminated strings, and non-ASCII characters. It does not prove the script is safe or correctly configured. You still need VESC Tool testing and wheels-off-ground testing.

## Upstream References

- VESC Express source and ESP32-S3 CAN defaults: https://github.com/vedderb/vesc_express
- VESC LispBM docs: https://github.com/vedderb/bldc/blob/master/lispBM/README.md
- VESC package notes: https://github.com/vedderb/vesc_pkg

## License

This project is licensed under the GNU General Public License version 3. See [LICENSE](LICENSE).

This software is provided without warranty. Use it at your own risk.
