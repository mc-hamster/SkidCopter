# ESP32-S3 Wiring Guide

This page explains the wiring at a practical level. Disconnect the battery pack while wiring. Verify every wire with a meter before applying motor power.

If a term is unfamiliar, check the [glossary](glossary.md).

## What Gets Connected

A typical system looks like this:

```text
controls -> VESC Express ESP32-S3 -> CAN transceiver -> CAN bus -> motor VESCs
```

The VESC Express reads your controls. The motor VESCs drive the motors. The CAN bus lets the Express send commands to the motor VESCs.

## Important Safety Wiring

Do not rely on this script as the only stop method.

Use real hardware safety parts:

- A battery fuse or breaker.
- A physical disconnect.
- A hardware E-stop.
- A contactor or drive-enable chain where appropriate.

The script can stop sending commands, but hardware must still be able to remove power or disable motion.

## CAN Bus Wiring

The ESP32-S3 has a CAN controller, but it does not directly connect to CANH/CANL. You need a CAN transceiver.

Use a 3.3 V logic CAN transceiver such as:

- SN65HVD230 or SN65HVD232.
- TJA1051 with 3.3 V IO.
- MCP2562 with VIO tied to 3.3 V.

Default VESC Express ESP32-S3 CAN pins:

| ESP32-S3 pin | Connect to |
|---|---|
| GPIO16, CAN TX | CAN transceiver TXD |
| GPIO17, CAN RX | CAN transceiver RXD |
| 3.3 V | transceiver VCC or VIO if supported |
| GND | transceiver GND and VESC signal ground |
| transceiver CANH | VESC CANH |
| transceiver CANL | VESC CANL |

Basic layout:

```text
VESC Express GPIO16/GPIO17
        |
        v
CAN transceiver
        |
        v
twisted CANH/CANL pair
        |-- driven motor VESC 1
        |-- driven motor VESC 2
        |-- optional driven motor VESC 3
        |-- optional driven motor VESC 4
```

CAN rules:

- Use twisted pair for CANH and CANL.
- Put a 120 ohm terminator at each physical end of the CAN bus.
- Do not use more than two terminators total.
- Set every device to the same CAN baud rate, normally `500 kbit/s`.
- Give every motor VESC a unique CAN ID.

## Motor VESC Wiring

Each driven motor VESC needs:

- Battery wiring sized for the current.
- Motor phase wires.
- CANH and CANL connected to the shared CAN bus.
- Signal ground shared with the Express/transceiver unless the CAN transceiver is isolated.
- A unique CAN ID matching the script.

For rear drive with front casters:

```lisp
(def *drive-layout* 'two-wheel-rear)
(def *left-rear-id* 12)
(def *right-rear-id* 22)
```

For front drive with rear casters:

```lisp
(def *drive-layout* 'two-wheel-front)
(def *left-front-id* 11)
(def *right-front-id* 21)
```

Caster wheels do not need motor VESCs.

## Local Analog Controls

Use this for the simplest setup:

```lisp
(def *input-mode* 'local-adc)
```

A potentiometer or joystick axis is wired like this:

```text
3.3 V ---- pot end
GND  ---- pot other end
wiper ---- ESP32-S3 ADC input
```

Do not feed more than `3.3 V` into an ESP32-S3 ADC pin.

Common ADC mapping:

| Script ADC channel | Typical ESP32-S3 GPIO |
|---:|---:|
| `0` | GPIO1 |
| `1` | GPIO2 |
| `2` | GPIO3 |
| `3` | GPIO4 |
| `4` | GPIO5 |

Check your exact board pinout before wiring.

## Two-Axis Skid-Steer Controls

For a joystick or two pots:

- Throttle wiper to ADC channel `0`.
- Steering wiper to ADC channel `1`.
- Pot ends to `3.3 V` and `GND`.

Script settings:

```lisp
(def *mix-mode* 'skid-steer)
(def *input-mode* 'local-adc)
(def *throttle-adc-channel* 0)
(def *steer-adc-channel* 1)
```

## One Centered 10k Pot, Same-Power Mode

For the single-pot mode:

- Center is neutral.
- One direction is forward.
- The other direction is reverse.
- Both driven motors receive the same command.

Wire the self-centering 10k pot:

```text
3.3 V ---- pot end
GND  ---- pot other end
wiper ---- ADC channel 0
```

Script settings:

```lisp
(def *drive-layout* 'two-wheel-rear)
(def *mix-mode* 'same-power)
(def *input-mode* 'local-adc)
(def *direction-mode* 'throttle-axis)
(def *throttle-adc-channel* 0)
(def *throttle-min-v* 0.05)
(def *throttle-center-v* 1.65)
(def *throttle-max-v* 3.25)
(def *throttle-deadband* 0.08)
```

Use `'two-wheel-front` if the rear wheels are casters.

If the vehicle creeps when the pot is released, increase `*throttle-deadband*`.

## Enable Switch

An enable switch lets the script know whether driving is allowed. It is not the same as a hardware E-stop.

Recommended simple wiring:

```text
ESP32-S3 GPIO ---- switch ---- GND
```

Script settings:

```lisp
(def *enable-mode* 'local-gpio)
(def *enable-gpio-pin* 10)
(def *enable-gpio-mode* 'pin-mode-in-pu)
(def *enable-active-high* nil)
```

With this wiring:

- Open switch means disabled.
- Closed switch to ground means enabled.
- The script still waits for neutral controls before driving.

## Direction Switch

You usually do not need a direction switch with a centered throttle. Use `throttle-axis` instead.

If you have a one-direction throttle pedal and need a forward/reverse switch:

```text
ESP32-S3 GPIO ---- switch ---- GND
```

Script settings:

```lisp
(def *direction-mode* 'local-gpio)
(def *direction-gpio-pin* 9)
(def *direction-gpio-mode* 'pin-mode-in-pu)
(def *direction-reverse-active-high* nil)
```

With those settings:

- Switch open means forward.
- Switch closed to ground means reverse.

Changing direction while moving will stop the script and require neutral before arming again.

## Cruise Buttons

Cruise is off by default. Leave it off for first testing.

If you add cruise later, use a momentary button wired to ground:

```text
ESP32-S3 GPIO8 ---- button ---- GND
```

Script example:

```lisp
(def *cruise-mode* 'local-gpio)
(def *cruise-latch-mode* 'hold)
(def *cruise-gpio-pin* 8)
(def *cruise-gpio-mode* 'pin-mode-in-pu)
(def *cruise-active-high* nil)
```

A separate cancel button can be wired the same way:

```lisp
(def *cruise-cancel-mode* 'local-gpio)
(def *cruise-cancel-gpio-pin* 7)
(def *cruise-cancel-gpio-mode* 'pin-mode-in-pu)
(def *cruise-cancel-active-high* nil)
```

## Optional Heartbeat Output

The heartbeat output is for an external safety controller or monitor. It toggles while the script is running and no script fault is latched.

Do not drive a contactor coil directly from an ESP32-S3 GPIO.

Example:

```lisp
(def *heartbeat-enable* t)
(def *heartbeat-gpio-pin* 15)
(def *heartbeat-period-sec* 0.50)
```

Choose a GPIO that is not already used by CAN, ADC, enable, direction, cruise, boot pins, flash, or onboard hardware.

## CAN-Based Inputs

The simplest setup is local ADC. Use CAN-based inputs only if you have a reason to put the controls on another VESC.

For `can-adc`:

- Wire controls to another VESC.
- Put that VESC on the same CAN bus.
- Set `*input-can-id*` to that VESC's CAN ID.
- Configure that VESC to broadcast status message 6.

For `can-ppm`:

- PPM throttle comes from the input VESC.
- Steering still comes from an ADC on the input VESC.
- Status message 6 must be enabled.
