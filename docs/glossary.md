# Glossary

Short definitions for terms used in this project.

## ADC

Analog-to-digital converter. This is how the ESP32-S3 reads a voltage from a joystick, potentiometer, pedal, or switch circuit.

In this project, ADC values are voltage readings such as `0.5 V`, `1.65 V`, or `3.2 V`.

## CAN

Controller Area Network. This is the two-wire communication bus used by the VESC Express to talk to the motor VESCs.

CAN uses two signal wires called `CANH` and `CANL`. It also needs proper termination and matching baud rates on all devices.

## CAN ID

The address of one VESC on the CAN bus. Each driven motor controller must have a different CAN ID.

Example:

```lisp
(def *left-front-id* 11)
```

## Caster

A free-rolling wheel with no motor. Shopping cart front wheels are a familiar example.

If a wheel is a caster, this script does not send it motor commands.

## Current

Motor current. More current usually means more torque. Current control is usually a safer starting point than duty or speed control.

## Duty

A duty-cycle command to the VESC. It is not raw motor phase PWM from the ESP32-S3. The VESC still controls the motor internally.

## ERPM / RPM

Motor electrical speed. VESC often reports electrical RPM, not wheel RPM. The relationship depends on motor pole count and gearing.

Use RPM mode only after the VESC speed control loop is tuned.

## LispBM

The Lisp scripting language built into VESC firmware. This project is written in LispBM so it can run directly on the VESC Express.

## Neutral

The no-command position of your controls.

For a centered joystick or self-centering pot, neutral is the middle voltage.

## Regenerative Braking

Braking through the motor controller by commanding braking current. Depending on the VESC setup and battery state, some energy may return to the battery. It is not the same as a mechanical brake.

## Skid Steer

A steering style where the left side and right side can be commanded differently. To turn, one side moves faster than the other, or one side moves forward while the other moves backward.

## Same Power

This project's simple two-motor mode where both driven wheels receive the same command. It does not steer by changing left and right motor speeds.

## VESC Express

The ESP32-S3 control board running the LispBM script. It reads controls and sends CAN commands.

## Motor VESC

The VESC motor controller connected to a motor. This is the device that actually drives motor current.
