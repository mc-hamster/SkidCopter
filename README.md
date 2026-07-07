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

## Optional Brake Input

The dedicated brake input is optional and off by default:

```lisp
(def *brake-mode* 'off)
```

If you enable it, pressing the brake input:

- Cancels cruise control.
- Disarms drive output.
- Sends the configured regenerative brake command to active driven motors.
- Requires neutral controls before drive power can return after brake release.

Typical GPIO brake switch setup:

```lisp
(def *brake-mode* 'local-gpio)
(def *brake-gpio-pin* 6)
(def *brake-gpio-mode* 'pin-mode-in-pu)
(def *brake-active-high* nil)
(def *brake-command* 0.12)
```

`*brake-command*` uses the same units as the other brake commands: relative current in `current-rel` mode and amps in `current` mode. Keep it low for first tests. Use `current-rel` or `current` mode if you want the brake input to command regenerative braking.

Regenerative braking depends on the motor VESC configuration, battery state, and system wiring. It is not a mechanical brake or a replacement for an E-stop.

## Default ESP32-S3-DevKitC-1 Pin Assignments

These defaults assume an ESP32-S3-DevKitC-1 running VESC Express firmware, plus a separate 3.3 V logic CAN transceiver. GPIO numbers below are the ESP32-S3 GPIO labels on the DevKitC headers.

The assignments intentionally avoid ESP32-S3 strapping pins, native USB pins, UART0 console pins, JTAG pins, flash/PSRAM pins, and the onboard RGB LED pin.

| Use | Script setting | ESP32-S3 pin | Default status | Why this pin was chosen |
|---|---|---:|---|---|
| Throttle analog input | `*throttle-adc-channel* 0` | GPIO1 / ADC1_CH0 | Active with `*input-mode* 'local-adc` | First ADC1 channel, no DevKitC boot, USB, UART0, JTAG, flash, or LED conflict. |
| Steering analog input | `*steer-adc-channel* 1` | GPIO2 / ADC1_CH1 | Active with `*input-mode* 'local-adc` | Second ADC1 channel, adjacent to GPIO1, and similarly free of common board conflicts. |
| CAN transmit | `*can-tx-pin* 16` | GPIO16 | Active | DevKitC/VESC Express S3 CAN default, exposed on J1, not a strapping or debug pin. Connect to CAN transceiver TXD. |
| CAN receive | `*can-rx-pin* 17` | GPIO17 | Active | Adjacent to GPIO16 on J1 and used with the same VESC Express S3 CAN default. Connect to CAN transceiver RXD. |
| Optional brake switch | `*brake-gpio-pin* 6` | GPIO6 | Unused until `*brake-mode*` is `'local-gpio` | Safe low-speed input with internal pull-up support, grouped with other switch inputs on J1. |
| Optional cruise cancel | `*cruise-cancel-gpio-pin* 7` | GPIO7 | Unused until `*cruise-cancel-mode*` is `'local-gpio` | Safe low-speed input next to the brake input, useful for active-low buttons to ground. |
| Optional cruise request | `*cruise-gpio-pin* 8` | GPIO8 | Unused until `*cruise-mode*` is `'local-gpio` | Safe low-speed input, grouped with the other operator switches. |
| Optional direction switch | `*direction-gpio-pin* 9` | GPIO9 | Unused while `*direction-mode*` is `'throttle-axis` | Safe active-low switch input for builds with a one-direction throttle pedal. |
| Optional enable switch | `*enable-gpio-pin* 10` | GPIO10 | Unused while `*enable-mode*` is `'always` | Safe active-low switch input with pull-up support, kept near the other operator switches. |
| Dash ready LED, green | `*status-ready-led-pin* 11` | GPIO11 | Active | Contiguous spare low-speed output for the dash LED that shows drive ready or waiting-to-arm state. Do not share with external FSPI/SPI devices. |
| Dash inhibit LED, amber | `*status-inhibit-led-pin* 12` | GPIO12 | Active | Contiguous spare low-speed output for disabled or operator-attention states. Do not share with external FSPI/SPI devices. |
| Dash fault LED, red | `*status-fault-led-pin* 13` | GPIO13 | Active | Contiguous spare low-speed output for brake-active and latched-fault states. Do not share with external FSPI/SPI devices. |
| Optional heartbeat output | `*heartbeat-gpio-pin* 15` | GPIO15 | Unused until `*heartbeat-enable*` is `t` | Clear spare output on J1, away from boot, USB, UART0, JTAG, flash, and LED conflicts. |

Wire switch inputs as active-low by default:

```text
ESP32-S3 GPIO ---- switch or button ---- GND
```

Recommended dash LED colors and meanings:

| LED | Recommended color | Off | On | Flashing |
|---|---|---|---|---|
| Ready | Green | Drive is not ready, or another LED has priority. | Drive is armed and commands can be sent. | Enable is on and checks are OK, but the script is waiting for neutral arming. |
| Inhibit | Amber | No operator-attention inhibit is active. | Enable input is off. | Enable is on, but drive is inhibited by a non-fault state such as direction-change lock. |
| Fault / brake | Red | No brake input or latched script fault is active. | Brake input is active. | Script fault is latched; fix the cause, center controls, and cycle enable to clear. |

Red has priority over the other dash LEDs. If a fault is latched, the ready and inhibit LEDs stay off and the red LED flashes.

Leave `3.3 V`, `GND`, `5 V`, and `RST/EN` for power and reset only. ESP32-S3 GPIOs are not 5 V tolerant.

Unassigned DevKitC header pins:

| ESP32-S3 pin | Capability | Default guidance |
|---:|---|---|
| GPIO0 | Digital I/O, RTC GPIO, boot strapping pin | Leave unassigned. The DevKitC BOOT button and download mode depend on this pin. |
| GPIO3 | Digital I/O, RTC GPIO, TOUCH3, ADC1_CH2, strapping pin | Leave unassigned by default. It can read analog voltage, but boot strapping makes it easy to create startup problems. |
| GPIO4 | Digital I/O, RTC GPIO, TOUCH4, ADC1_CH3 | Good spare analog or digital input if you need one more local ADC selector. |
| GPIO5 | Digital I/O, RTC GPIO, TOUCH5, ADC1_CH4 | Good spare analog or digital input if you need one more local ADC selector. |
| GPIO14 | Digital I/O, RTC GPIO, TOUCH14, ADC2_CH3, FSPI alternate functions | Usable as spare low-speed GPIO if not used for external SPI/FSPI. |
| GPIO18 | Digital I/O, RTC GPIO, ADC2_CH7, UART1 RX alternate function | Good spare digital I/O or UART pin when not needed by another peripheral. |
| GPIO19 | Digital I/O, RTC GPIO, ADC2_CH8, USB_D- | Leave unassigned if using the native USB port or USB Serial/JTAG. |
| GPIO20 | Digital I/O, RTC GPIO, ADC2_CH9, USB_D+ | Leave unassigned if using the native USB port or USB Serial/JTAG. |
| GPIO21 | Digital I/O, RTC GPIO | Good clean spare GPIO for simple inputs or outputs. |
| GPIO35 | Digital I/O, SPI flash/PSRAM function on some modules | Avoid for portable DevKitC wiring; unavailable on some Octal flash/PSRAM variants. |
| GPIO36 | Digital I/O, SPI flash/PSRAM function on some modules | Avoid for portable DevKitC wiring; unavailable on some Octal flash/PSRAM variants. |
| GPIO37 | Digital I/O, SPI flash/PSRAM function on some modules | Avoid for portable DevKitC wiring; unavailable on some Octal flash/PSRAM variants. |
| GPIO38 | Digital I/O, onboard RGB LED on DevKitC-1 v1.1 | Leave for the onboard RGB LED unless you intentionally remove that use. |
| GPIO39 | Digital I/O, JTAG MTCK | Avoid unless JTAG is disabled and you do not need hardware debugging. |
| GPIO40 | Digital I/O, JTAG MTDO | Avoid unless JTAG is disabled and you do not need hardware debugging. |
| GPIO41 | Digital I/O, JTAG MTDI | Avoid unless JTAG is disabled and you do not need hardware debugging. |
| GPIO42 | Digital I/O, JTAG MTMS | Avoid unless JTAG is disabled and you do not need hardware debugging. |
| GPIO43 | Digital I/O, UART0 TX | Leave for serial console/programming unless you intentionally move the console. |
| GPIO44 | Digital I/O, UART0 RX | Leave for serial console/programming unless you intentionally move the console. |
| GPIO45 | Digital I/O, strapping pin | Leave unassigned. Wrong startup level can affect boot configuration. |
| GPIO46 | Digital I/O, strapping pin | Leave unassigned. Wrong startup level can affect boot/download behavior. |
| GPIO47 | Digital I/O, SPI clock alternate function | Usable spare GPIO after checking your exact DevKitC variant and attached peripherals. |
| GPIO48 | Digital I/O, onboard RGB LED on initial DevKitC-1 revisions | Avoid unless you have verified your board revision and are not using the onboard RGB LED. |

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
- [simulator](simulator): browser-based vehicle simulator for software-side control, motion, CAN output, and telemetry checks.

## Browser Simulator

The `simulator/` app runs a local browser-based digital twin. It shows the vehicle on a 3D test pad, lets you tune vehicle dimensions and physics values in American units, and displays simulated CAN output and telemetry.

The simulator is useful for software development and scenario testing, but it does not replace VESC Tool checks, wheels-off-ground bench testing, or hardware safety validation. The control logic is loaded from `src/skid-steer.lisp` directly in the browser; the simulator stubs the VESC LispBM hardware functions such as ADC, GPIO, CAN input, CAN output, and timing.

To start it:

```sh
cd simulator
npm install
npm run dev -- --port 5173
```

Then open:

```text
http://127.0.0.1:5173/
```

To package the simulator for the static site at `https://www.casler.org/skidcopter`, run:

```sh
make simulator-zip
```

This creates `simulator/skidcopter-static.zip`, which should be unarchived directly into the host directory served as `/skidcopter`. See [simulator/README.md](simulator/README.md) for details.

## Basic Setup Flow

1. Wire the VESC Express, CAN transceiver, driven VESC motor controllers, controls, enable switch, and optional brake input. See [docs/wiring-esp32-s3.md](docs/wiring-esp32-s3.md).
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
- ESP32-S3-DevKitC-1 user guide and header pinout: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/
- ESP32-S3 GPIO restrictions and functions: https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/gpio.html

## License

This project is licensed under the GNU General Public License version 3. See [LICENSE](LICENSE).

This software is provided without warranty. Use it at your own risk.
