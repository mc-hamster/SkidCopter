; SkidCopter skid-steer controller for VESC Express on ESP32-S3.
; SPDX-License-Identifier: GPL-3.0-only
;
; Upload this file to VESC Tool -> LispBM on the VESC Express. Edit the
; configuration block below before uploading.

; ----------------------------
; Vehicle and CAN configuration
; ----------------------------

(def *vehicle-name* "SkidCopter")

; ESP32-S3-DevKitC-1 default CAN transceiver pins.
; CAN TX goes to the transceiver TXD pin; CAN RX goes to transceiver RXD.
(def *can-tx-pin* 16)
(def *can-rx-pin* 17)

; Motor controller CAN IDs. Configure the driven motor VESCs to match these IDs.
(def *left-front-id* 11)
(def *left-rear-id* 12)
(def *right-front-id* 21)
(def *right-rear-id* 22)

; Drive layouts:
;   'four-wheel      - all four motor positions are driven.
;   'two-wheel-front - only left-front and right-front are driven; rear wheels are casters.
;   'two-wheel-rear  - only left-rear and right-rear are driven; front wheels are casters.
; Inactive caster positions receive no CAN commands and are ignored by optional
; motor status/thermal checks.
(def *drive-layout* 'four-wheel)

; Mix modes:
;   'skid-steer - throttle and steering mix into independent left/right commands.
;   'same-power - throttle only; every driven wheel receives the same command.
(def *mix-mode* 'skid-steer)

; Per-wheel direction signs. Lift the vehicle and change signs until positive
; throttle makes every driven wheel rotate in the vehicle-forward direction.
(def *left-front-sign* 1.0)
(def *left-rear-sign* 1.0)
(def *right-front-sign* 1.0)
(def *right-rear-sign* 1.0)

; Per-wheel output trims. Keep these at 1.0 until bench testing shows that one
; wheel needs a small correction after motor setup and wheel direction are right.
(def *left-front-scale* 1.0)
(def *left-rear-scale* 1.0)
(def *right-front-scale* 1.0)
(def *right-rear-scale* 1.0)

; ----------------------------
; Input configuration
; ----------------------------

; Supported input modes:
;   'local-adc  - throttle and steering are local VESC Express ADC voltages.
;   'can-adc    - throttle and steering are ADC values from one CAN VESC.
;   'can-ppm    - throttle is PPM from one CAN VESC, steering is ADC from it.
(def *input-mode* 'local-adc)

; Direction modes:
;   'throttle-axis  - throttle axis is bipolar; forward and reverse come from it.
;   'fixed-forward  - throttle magnitude always drives forward.
;   'fixed-reverse  - throttle magnitude always drives reverse.
;   'local-gpio     - GPIO direction selector; active means reverse.
;   'local-adc      - local ADC direction selector; threshold active means reverse.
;   'can-adc        - CAN ADC direction selector; threshold active means reverse.
(def *direction-mode* 'throttle-axis)

; Local ADC channels. On common ESP32-S3 VESC Express firmware these are
; ADC1_CH0..ADC1_CH4, normally GPIO1..GPIO5. GPIO3/ADC1_CH2 is a strapping
; pin on ESP32-S3-DevKitC-1, so leave channel 2 unused unless you understand
; the boot constraints.
(def *throttle-adc-channel* 0)
(def *steer-adc-channel* 1)

; CAN input source for 'can-adc and 'can-ppm. Status message 6 must be enabled
; on this VESC for canget-ppm/canget-adc to be fresh.
(def *input-can-id* 30)
(def *can-throttle-adc-channel* 0)
(def *can-steer-adc-channel* 1)
(def *input-stale-sec* 0.25)

; Analog calibration. Centered joystick defaults are 0.50 V to 2.80 V with
; 1.65 V center. Use VESC Tool's realtime ADC view to measure your controls.
(def *throttle-min-v* 0.50)
(def *throttle-center-v* 1.65)
(def *throttle-max-v* 2.80)
(def *steer-min-v* 0.50)
(def *steer-center-v* 1.65)
(def *steer-max-v* 2.80)

(def *invert-throttle* nil)
(def *invert-steer* nil)
(def *throttle-deadband* 0.06)
(def *steer-deadband* 0.06)
(def *adc-fault-margin-v* 0.20)

; Debounce switch-like inputs and add hysteresis to threshold ADC selectors.
; Safety-inhibit edges still apply immediately: enable-off, brake-on, and
; cruise-cancel-on do not wait for the debounce timer.
(def *selector-debounce-sec* 0.04)
(def *selector-adc-hysteresis-v* 0.10)

; Expo is a 0.0 to 1.0 blend between linear and cubic response.
(def *throttle-expo* 0.20)
(def *steer-expo* 0.15)

; Direction selector inputs. Defaults are active-low GPIO with pull-up, matching
; a simple switch wired from GPIO to GND.
(def *direction-gpio-pin* 9)
(def *direction-gpio-mode* 'pin-mode-in-pu)
(def *direction-reverse-active-high* nil)
(def *direction-adc-channel* 3)
(def *direction-adc-threshold-v* 1.50)
(def *direction-adc-active-high* t)
(def *can-direction-adc-channel* 3)

; ----------------------------
; Arming and enable input
; ----------------------------

; Supported enable modes:
;   'always     - script can arm whenever controls are neutral.
;   'local-gpio - local GPIO switch.
;   'local-adc  - local ADC threshold switch.
;   'can-adc    - ADC threshold switch from the CAN input VESC.
(def *enable-mode* 'always)

; For a normally-open kill/enable switch, wire GPIO to GND and use
; pin-mode-in-pu with active-high nil.
(def *enable-gpio-pin* 10)
(def *enable-gpio-mode* 'pin-mode-in-pu)
(def *enable-active-high* nil)

(def *enable-adc-channel* 4)
(def *enable-adc-threshold-v* 1.50)
(def *enable-adc-active-high* t)
(def *can-enable-adc-channel* 2)

(def *require-neutral-on-enable* t)
(def *arm-neutral-sec* 0.75)
(def *arm-neutral-throttle* 0.08)
(def *arm-neutral-steer* 0.08)

; If direction comes from a selector, changing it while moving stops the vehicle
; and requires neutral controls before the script can arm again.
(def *direction-neutral-lock* t)
(def *direction-change-command-threshold* 0.02)

; ----------------------------
; Cruise control
; ----------------------------

; Cruise holds the current normalized drive command. It is not closed-loop speed
; control unless *control-mode* is 'rpm and the motor VESC speed loops are tuned.
; Steering stays live while cruise is active.
;
; Supported cruise modes:
;   'off        - disabled.
;   'local-gpio - request cruise with a GPIO input.
;   'local-adc  - request cruise with a local ADC threshold.
;   'can-adc    - request cruise with a CAN ADC threshold.
(def *cruise-mode* 'off)

; 'toggle latches on a rising edge and drops on the next rising edge.
; 'hold runs cruise only while the request input is active.
(def *cruise-latch-mode* 'toggle)

(def *cruise-gpio-pin* 8)
(def *cruise-gpio-mode* 'pin-mode-in-pu)
(def *cruise-active-high* nil)
(def *cruise-adc-channel* 4)
(def *cruise-adc-threshold-v* 1.50)
(def *cruise-adc-active-high* t)
(def *can-cruise-adc-channel* 4)
(def *cruise-min-command* 0.10)

; Optional dedicated cruise cancel input. Disable/cutout always cancels cruise.
(def *cruise-cancel-mode* 'off)
(def *cruise-cancel-gpio-pin* 7)
(def *cruise-cancel-gpio-mode* 'pin-mode-in-pu)
(def *cruise-cancel-active-high* nil)
(def *cruise-cancel-adc-channel* 4)
(def *cruise-cancel-adc-threshold-v* 1.50)
(def *cruise-cancel-adc-active-high* t)
(def *can-cruise-cancel-adc-channel* 4)

; Throttle movement cancels cruise so the operator can take over.
(def *cruise-cancel-on-throttle* t)
(def *cruise-throttle-cancel-delta* 0.20)

; ----------------------------
; Brake input
; ----------------------------

; Dedicated operator brake input. When active, drive power is disabled, cruise
; is cancelled, the script disarms, and active driven motors receive
; *brake-command* as a regenerative brake command. Releasing brake requires
; neutral controls before the script can arm again.
;
; Supported brake modes:
;   'off        - no dedicated brake input.
;   'local-gpio - local GPIO brake switch.
;   'local-adc  - local ADC threshold brake input.
;   'can-adc    - ADC threshold brake input from the CAN input VESC.
(def *brake-mode* 'off)

; Defaults are active-low GPIO with pull-up, matching a simple switch wired
; from GPIO to GND. Choose a GPIO that is not already used by another input.
(def *brake-gpio-pin* 6)
(def *brake-gpio-mode* 'pin-mode-in-pu)
(def *brake-active-high* nil)

(def *brake-adc-channel* 4)
(def *brake-adc-threshold-v* 1.50)
(def *brake-adc-active-high* t)
(def *can-brake-adc-channel* 4)

; ----------------------------
; Motor command configuration
; ----------------------------

; Supported control modes:
;   'current-rel - recommended. Command is fraction of each VESC current limit.
;   'current     - command is motor current in amps.
;   'duty        - command is duty cycle fraction.
;   'rpm         - command is electrical RPM target.
(def *control-mode* 'current-rel)

; Interpreted by *control-mode*. Safe default for 'current-rel is 20%.
(def *max-command* 0.20)
(def *reverse-scale* 0.60)
(def *throttle-scale* 1.0)
(def *steer-scale* 1.0)

; Normalized command slew rates per second.
(def *accel-rate-per-sec* 1.00)
(def *decel-rate-per-sec* 2.50)
(def *reverse-rate-per-sec* 1.00)

; Command loop. Keep below the motor App Settings -> General timeout.
(def *loop-period-sec* 0.02)
(def *command-off-delay-sec* 0.08)

; Brake command is relative current in 'current-rel mode and amps in 'current
; mode. For 'duty and 'rpm the script sends 0 instead. *brake-command* is used
; only by the optional dedicated brake input.
(def *neutral-brake-command* 0.00)
(def *disable-brake-command* 0.08)
(def *brake-command* 0.12)
(def *neutral-command-deadband* 0.03)

; Optional status guards. Enable only after motor CAN status messages are
; configured on every active driven VESC.
(def *require-motor-status* nil)
(def *motor-status-stale-sec* 0.50)
(def *enable-thermal-stop* nil)
(def *max-fet-temp-c* 80.0)
(def *max-motor-temp-c* 90.0)

; Script processing watchdog. This catches long stalls without requiring any
; extra wiring. Tune lower only after measuring on hardware.
(def *enable-loop-watchdog* t)
(def *loop-overrun-sec* 0.05)

; Optional heartbeat output for an external safety relay or safety controller.
; Leave disabled unless the GPIO is wired and monitored externally.
(def *heartbeat-enable* nil)
(def *heartbeat-gpio-pin* 15)
(def *heartbeat-period-sec* 0.50)

; Dash status LEDs. Recommended colors are green on the ready LED, amber on
; the inhibit LED, and red on the fault LED. The default pins are spare
; low-speed GPIOs on the ESP32-S3-DevKitC-1 header.
(def *status-led-enable* t)
(def *status-ready-led-pin* 11)
(def *status-inhibit-led-pin* 12)
(def *status-fault-led-pin* 13)
(def *status-led-active-high* t)
(def *status-led-flash-period-sec* 0.50)

; Keep status printing off for lowest jitter. Enable during bench tuning if you
; want one Lisp console status line per *status-print-period-sec*.
(def *print-status* nil)
(def *status-print-period-sec* 1.0)

; ----------------------------
; Runtime state
; ----------------------------

(def *armed* nil)
(def *fault-latched* nil)
(def *fault-reason* 'none)
(def *config-error* 'none)
(def *direction-lock* nil)
(def *last-direction-sign* 1.0)
(def *cruise-active* nil)
(def *cruise-command* 0.0)
(def *cruise-request-last* nil)
(def *neutral-since* (systime))
(def *left-command* 0.0)
(def *right-command* 0.0)
(def *last-log* (systime))
(def *loop-start* (systime))
(def *heartbeat-state* 0)
(def *last-heartbeat* (systime))
(def *status-led-flash-state* 0)
(def *last-status-led-flash* (systime))

(def *enable-db-init* nil)
(def *enable-db-state* nil)
(def *enable-db-pending* nil)
(def *enable-db-since* (systime))
(def *brake-db-init* nil)
(def *brake-db-state* nil)
(def *brake-db-pending* nil)
(def *brake-db-since* (systime))
(def *direction-db-init* nil)
(def *direction-db-state* nil)
(def *direction-db-pending* nil)
(def *direction-db-since* (systime))
(def *cruise-db-init* nil)
(def *cruise-db-state* nil)
(def *cruise-db-pending* nil)
(def *cruise-db-since* (systime))
(def *cruise-cancel-db-init* nil)
(def *cruise-cancel-db-state* nil)
(def *cruise-cancel-db-pending* nil)
(def *cruise-cancel-db-since* (systime))

; Hot-loop scratch state. Keeping these as globals avoids avoidable consing and
; duplicate extension calls in the 50 Hz control loop.
(def *can6-fresh* t)
(def *can6-age* 0.0)
(def *sample-input-ok* nil)
(def *sample-direction-ok* t)
(def *sample-throttle* 0.0)
(def *sample-steer* 0.0)
(def *sample-direction-sign* 1.0)
(def *sample-drive-throttle* 0.0)
(def *sample-throttle-v* 0.0)
(def *sample-steer-v* 0.0)
(def *mix-left* 0.0)
(def *mix-right* 0.0)
(def *mix-magnitude* 0.0)

; ----------------------------
; Utility functions
; ----------------------------

(defun clamp (x lo hi)
    (if (< x lo) lo (if (> x hi) hi x)))

(defun max2 (a b)
    (if (> a b) a b))

(defun maybe-invert (x inv)
    (if inv (- 0.0 x) x))

(defun apply-deadband (x db)
    (let ((ax (abs x)))
        (if (< ax db)
            0.0
            (let ((scaled (/ (- ax db) (- 1.0 db))))
                (if (< x 0.0) (- 0.0 scaled) scaled)))))

(defun apply-expo (x expo)
    (+ (* x (- 1.0 expo)) (* x x x expo)))

(defun shape-axis (x db expo inv)
    (maybe-invert (apply-expo (apply-deadband (clamp x -1.0 1.0) db) expo) inv))

(defun analog-bipolar (v lo center hi db expo inv)
    (let (
        (pos-span (- hi center))
        (neg-span (- center lo))
        (raw (if (>= v center)
                 (if (> pos-span 0.01) (/ (- v center) pos-span) 0.0)
                 (if (> neg-span 0.01) (/ (- v center) neg-span) 0.0))))
        (shape-axis raw db expo inv)))

(defun analog-in-range (v lo hi)
    (and (> v (- lo *adc-fault-margin-v*)) (< v (+ hi *adc-fault-margin-v*))))

(defun apply-reverse-scale (x)
    (if (< x 0.0) (* x *reverse-scale*) x))

(defun steering-needed ()
    (eq *mix-mode* 'skid-steer))

(defun drive-left-front ()
    (or (eq *drive-layout* 'four-wheel) (eq *drive-layout* 'two-wheel-front)))

(defun drive-left-rear ()
    (or (eq *drive-layout* 'four-wheel) (eq *drive-layout* 'two-wheel-rear)))

(defun drive-right-front ()
    (or (eq *drive-layout* 'four-wheel) (eq *drive-layout* 'two-wheel-front)))

(defun drive-right-rear ()
    (or (eq *drive-layout* 'four-wheel) (eq *drive-layout* 'two-wheel-rear)))

(defun opposite-sign (a b)
    (or
        (and (> a 0.0) (< b 0.0))
        (and (< a 0.0) (> b 0.0))))

(defun slew (current target dt)
    (let (
        (delta (- target current))
        (rate (if (opposite-sign current target)
                  *reverse-rate-per-sec*
                  (if (< (abs target) (abs current)) *decel-rate-per-sec* *accel-rate-per-sec*)))
        (step (* rate dt)))
        (if (> delta step)
            (+ current step)
            (if (< delta (- 0.0 step))
                (- current step)
                target))))

; ----------------------------
; Input and arming
; ----------------------------

(defun read-throttle ()
    (if (eq *input-mode* 'local-adc)
        (analog-bipolar
            (get-adc *throttle-adc-channel*)
            *throttle-min-v* *throttle-center-v* *throttle-max-v*
            *throttle-deadband* *throttle-expo* *invert-throttle*)
        (if (eq *input-mode* 'can-adc)
            (analog-bipolar
                (canget-adc *input-can-id* *can-throttle-adc-channel*)
                *throttle-min-v* *throttle-center-v* *throttle-max-v*
                *throttle-deadband* *throttle-expo* *invert-throttle*)
            (if (eq *input-mode* 'can-ppm)
                (shape-axis
                    (canget-ppm *input-can-id*)
                    *throttle-deadband* *throttle-expo* *invert-throttle*)
                0.0))))

(defun read-steer ()
    (if (eq *input-mode* 'local-adc)
        (analog-bipolar
            (get-adc *steer-adc-channel*)
            *steer-min-v* *steer-center-v* *steer-max-v*
            *steer-deadband* *steer-expo* *invert-steer*)
        (if (eq *input-mode* 'can-adc)
            (analog-bipolar
                (canget-adc *input-can-id* *can-steer-adc-channel*)
                *steer-min-v* *steer-center-v* *steer-max-v*
                *steer-deadband* *steer-expo* *invert-steer*)
            (if (eq *input-mode* 'can-ppm)
                (analog-bipolar
                    (canget-adc *input-can-id* *can-steer-adc-channel*)
                    *steer-min-v* *steer-center-v* *steer-max-v*
                    *steer-deadband* *steer-expo* *invert-steer*)
                0.0))))

(defun selector-active (value threshold active-high)
    (if active-high (> value threshold) (< value threshold)))

(defun selector-active-hysteresis (value threshold active-high current init)
    (if (not init)
        (selector-active value threshold active-high)
        (if active-high
            (if current
                (> value (- threshold *selector-adc-hysteresis-v*))
                (> value (+ threshold *selector-adc-hysteresis-v*)))
            (if current
                (< value (+ threshold *selector-adc-hysteresis-v*))
                (< value (- threshold *selector-adc-hysteresis-v*))))))

(defun debounce-enable (raw)
    (if (or (not (> *selector-debounce-sec* 0.0)) (not raw))
        (progn
            (setq *enable-db-init* t)
            (setq *enable-db-state* raw)
            (setq *enable-db-pending* raw)
            (setq *enable-db-since* (systime))
            *enable-db-state*)
        (if (not *enable-db-init*)
            (progn
                (setq *enable-db-init* t)
                (setq *enable-db-state* raw)
                (setq *enable-db-pending* raw)
                (setq *enable-db-since* (systime))
                *enable-db-state*)
            (if (eq raw *enable-db-state*)
                (progn
                    (setq *enable-db-pending* raw)
                    (setq *enable-db-since* (systime))
                    *enable-db-state*)
                (if (eq raw *enable-db-pending*)
                    (if (> (secs-since *enable-db-since*) *selector-debounce-sec*)
                        (progn
                            (setq *enable-db-state* raw)
                            *enable-db-state*)
                        *enable-db-state*)
                    (progn
                        (setq *enable-db-pending* raw)
                        (setq *enable-db-since* (systime))
                        *enable-db-state*))))))

(defun debounce-brake (raw)
    (if (or (not (> *selector-debounce-sec* 0.0)) raw)
        (progn
            (setq *brake-db-init* t)
            (setq *brake-db-state* raw)
            (setq *brake-db-pending* raw)
            (setq *brake-db-since* (systime))
            *brake-db-state*)
        (if (not *brake-db-init*)
            (progn
                (setq *brake-db-init* t)
                (setq *brake-db-state* raw)
                (setq *brake-db-pending* raw)
                (setq *brake-db-since* (systime))
                *brake-db-state*)
            (if (eq raw *brake-db-state*)
                (progn
                    (setq *brake-db-pending* raw)
                    (setq *brake-db-since* (systime))
                    *brake-db-state*)
                (if (eq raw *brake-db-pending*)
                    (if (> (secs-since *brake-db-since*) *selector-debounce-sec*)
                        (progn
                            (setq *brake-db-state* raw)
                            *brake-db-state*)
                        *brake-db-state*)
                    (progn
                        (setq *brake-db-pending* raw)
                        (setq *brake-db-since* (systime))
                        *brake-db-state*))))))

(defun debounce-direction (raw)
    (if (not (> *selector-debounce-sec* 0.0))
        raw
        (if (not *direction-db-init*)
            (progn
                (setq *direction-db-init* t)
                (setq *direction-db-state* raw)
                (setq *direction-db-pending* raw)
                (setq *direction-db-since* (systime))
                *direction-db-state*)
            (if (eq raw *direction-db-state*)
                (progn
                    (setq *direction-db-pending* raw)
                    (setq *direction-db-since* (systime))
                    *direction-db-state*)
                (if (eq raw *direction-db-pending*)
                    (if (> (secs-since *direction-db-since*) *selector-debounce-sec*)
                        (progn
                            (setq *direction-db-state* raw)
                            *direction-db-state*)
                        *direction-db-state*)
                    (progn
                        (setq *direction-db-pending* raw)
                        (setq *direction-db-since* (systime))
                        *direction-db-state*))))))

(defun debounce-cruise-request (raw)
    (if (not (> *selector-debounce-sec* 0.0))
        raw
        (if (not *cruise-db-init*)
            (progn
                (setq *cruise-db-init* t)
                (setq *cruise-db-state* raw)
                (setq *cruise-db-pending* raw)
                (setq *cruise-db-since* (systime))
                *cruise-db-state*)
            (if (eq raw *cruise-db-state*)
                (progn
                    (setq *cruise-db-pending* raw)
                    (setq *cruise-db-since* (systime))
                    *cruise-db-state*)
                (if (eq raw *cruise-db-pending*)
                    (if (> (secs-since *cruise-db-since*) *selector-debounce-sec*)
                        (progn
                            (setq *cruise-db-state* raw)
                            *cruise-db-state*)
                        *cruise-db-state*)
                    (progn
                        (setq *cruise-db-pending* raw)
                        (setq *cruise-db-since* (systime))
                        *cruise-db-state*))))))

(defun debounce-cruise-cancel (raw)
    (if (or (not (> *selector-debounce-sec* 0.0)) raw)
        (progn
            (setq *cruise-cancel-db-init* t)
            (setq *cruise-cancel-db-state* raw)
            (setq *cruise-cancel-db-pending* raw)
            (setq *cruise-cancel-db-since* (systime))
            *cruise-cancel-db-state*)
        (if (not *cruise-cancel-db-init*)
            (progn
                (setq *cruise-cancel-db-init* t)
                (setq *cruise-cancel-db-state* raw)
                (setq *cruise-cancel-db-pending* raw)
                (setq *cruise-cancel-db-since* (systime))
                *cruise-cancel-db-state*)
            (if (eq raw *cruise-cancel-db-state*)
                (progn
                    (setq *cruise-cancel-db-pending* raw)
                    (setq *cruise-cancel-db-since* (systime))
                    *cruise-cancel-db-state*)
                (if (eq raw *cruise-cancel-db-pending*)
                    (if (> (secs-since *cruise-cancel-db-since*) *selector-debounce-sec*)
                        (progn
                            (setq *cruise-cancel-db-state* raw)
                            *cruise-cancel-db-state*)
                        *cruise-cancel-db-state*)
                    (progn
                        (setq *cruise-cancel-db-pending* raw)
                        (setq *cruise-cancel-db-since* (systime))
                        *cruise-cancel-db-state*))))))

(defun needs-can6 ()
    (or
        (not (eq *input-mode* 'local-adc))
        (eq *direction-mode* 'can-adc)
        (eq *enable-mode* 'can-adc)
        (eq *brake-mode* 'can-adc)
        (eq *cruise-mode* 'can-adc)
        (eq *cruise-cancel-mode* 'can-adc)))

(defun sample-can6 ()
    (if (needs-can6)
        (progn
            (setq *can6-age* (can-msg-age *input-can-id* 6))
            (setq *can6-fresh* (and *can6-age* (< *can6-age* *input-stale-sec*))))
        (setq *can6-fresh* t)))

(defun read-direction-reverse ()
    (if (eq *direction-mode* 'local-gpio)
        (let ((pin-state (gpio-read *direction-gpio-pin*)))
            (debounce-direction
                (if *direction-reverse-active-high* (= pin-state 1) (= pin-state 0))))
        (if (eq *direction-mode* 'local-adc)
            (debounce-direction
                (selector-active-hysteresis
                    (get-adc *direction-adc-channel*)
                    *direction-adc-threshold-v*
                    *direction-adc-active-high*
                    *direction-db-state*
                    *direction-db-init*))
            (if (eq *direction-mode* 'can-adc)
                (debounce-direction
                    (selector-active-hysteresis
                        (canget-adc *input-can-id* *can-direction-adc-channel*)
                        *direction-adc-threshold-v*
                        *direction-adc-active-high*
                        *direction-db-state*
                        *direction-db-init*))
                nil))))

(defun read-direction-sign ()
    (if (eq *direction-mode* 'fixed-reverse)
        -1.0
        (if (or (eq *direction-mode* 'throttle-axis) (eq *direction-mode* 'fixed-forward))
            1.0
            (if (read-direction-reverse) -1.0 1.0))))

(defun read-drive-throttle ()
    (let ((axis (read-throttle)))
        (if (eq *direction-mode* 'throttle-axis)
            axis
            (* (abs axis) (read-direction-sign)))))

(defun direction-fresh ()
    (if (eq *direction-mode* 'can-adc)
        *can6-fresh*
        t))

(defun direction-selector-mode ()
    (or
        (eq *direction-mode* 'local-gpio)
        (eq *direction-mode* 'local-adc)
        (eq *direction-mode* 'can-adc)))

(defun sample-control-inputs ()
    (progn
        (setq *sample-input-ok* nil)
        (setq *sample-direction-ok* (direction-fresh))
        (if (eq *input-mode* 'local-adc)
            (progn
                (setq *sample-throttle-v* (get-adc *throttle-adc-channel*))
                (setq *sample-throttle*
                    (analog-bipolar
                        *sample-throttle-v*
                        *throttle-min-v* *throttle-center-v* *throttle-max-v*
                        *throttle-deadband* *throttle-expo* *invert-throttle*))
                (if (steering-needed)
                    (progn
                        (setq *sample-steer-v* (get-adc *steer-adc-channel*))
                        (setq *sample-steer*
                            (analog-bipolar
                                *sample-steer-v*
                                *steer-min-v* *steer-center-v* *steer-max-v*
                                *steer-deadband* *steer-expo* *invert-steer*)))
                    (progn
                        (setq *sample-steer-v* *steer-center-v*)
                        (setq *sample-steer* 0.0)))
                (setq *sample-input-ok*
                    (and
                        (analog-in-range *sample-throttle-v* *throttle-min-v* *throttle-max-v*)
                        (or
                            (not (steering-needed))
                            (analog-in-range *sample-steer-v* *steer-min-v* *steer-max-v*)))))
            (if (eq *input-mode* 'can-adc)
                (progn
                    (setq *sample-throttle-v* (canget-adc *input-can-id* *can-throttle-adc-channel*))
                    (setq *sample-throttle*
                        (analog-bipolar
                            *sample-throttle-v*
                            *throttle-min-v* *throttle-center-v* *throttle-max-v*
                            *throttle-deadband* *throttle-expo* *invert-throttle*))
                    (if (steering-needed)
                        (progn
                            (setq *sample-steer-v* (canget-adc *input-can-id* *can-steer-adc-channel*))
                            (setq *sample-steer*
                                (analog-bipolar
                                    *sample-steer-v*
                                    *steer-min-v* *steer-center-v* *steer-max-v*
                                    *steer-deadband* *steer-expo* *invert-steer*)))
                        (progn
                            (setq *sample-steer-v* *steer-center-v*)
                            (setq *sample-steer* 0.0)))
                    (setq *sample-input-ok*
                        (and
                            *can6-fresh*
                            (analog-in-range *sample-throttle-v* *throttle-min-v* *throttle-max-v*)
                            (or
                                (not (steering-needed))
                                (analog-in-range *sample-steer-v* *steer-min-v* *steer-max-v*)))))
                (if (eq *input-mode* 'can-ppm)
                    (progn
                        (setq *sample-throttle*
                            (shape-axis
                                (canget-ppm *input-can-id*)
                                *throttle-deadband* *throttle-expo* *invert-throttle*))
                        (if (steering-needed)
                            (progn
                                (setq *sample-steer-v* (canget-adc *input-can-id* *can-steer-adc-channel*))
                                (setq *sample-steer*
                                    (analog-bipolar
                                        *sample-steer-v*
                                        *steer-min-v* *steer-center-v* *steer-max-v*
                                        *steer-deadband* *steer-expo* *invert-steer*)))
                            (progn
                                (setq *sample-steer-v* *steer-center-v*)
                                (setq *sample-steer* 0.0)))
                        (setq *sample-input-ok*
                            (and
                                *can6-fresh*
                                (or
                                    (not (steering-needed))
                                    (analog-in-range *sample-steer-v* *steer-min-v* *steer-max-v*)))))
                    nil)))
        (setq *sample-direction-sign*
            (if *sample-direction-ok*
                (read-direction-sign)
                *last-direction-sign*))
        (setq *sample-drive-throttle*
            (if (and *sample-input-ok* *sample-direction-ok*)
                (if (eq *direction-mode* 'throttle-axis)
                    *sample-throttle*
                    (* (abs *sample-throttle*) *sample-direction-sign*))
                0.0))))

(defun input-fresh ()
    (let ((can-ok (if (eq *input-mode* 'local-adc)
                      t
                      (let ((age (can-msg-age *input-can-id* 6)))
                          (and age (< age *input-stale-sec*))))))
        (and
            can-ok
            (if (eq *input-mode* 'local-adc)
                (and
                    (analog-in-range (get-adc *throttle-adc-channel*) *throttle-min-v* *throttle-max-v*)
                    (or
                        (not (steering-needed))
                        (analog-in-range (get-adc *steer-adc-channel*) *steer-min-v* *steer-max-v*)))
                (if (eq *input-mode* 'can-adc)
                    (and
                        (analog-in-range (canget-adc *input-can-id* *can-throttle-adc-channel*) *throttle-min-v* *throttle-max-v*)
                        (or
                            (not (steering-needed))
                            (analog-in-range (canget-adc *input-can-id* *can-steer-adc-channel*) *steer-min-v* *steer-max-v*)))
                    (if (eq *input-mode* 'can-ppm)
                        (or
                            (not (steering-needed))
                            (analog-in-range (canget-adc *input-can-id* *can-steer-adc-channel*) *steer-min-v* *steer-max-v*))
                        nil))))))

(defun enable-fresh ()
    (if (eq *enable-mode* 'can-adc)
        *can6-fresh*
        t))

(defun brake-fresh ()
    (if (eq *brake-mode* 'can-adc)
        *can6-fresh*
        t))

(defun read-brake ()
    (if (eq *brake-mode* 'off)
        nil
        (if (eq *brake-mode* 'local-gpio)
            (let ((pin-state (gpio-read *brake-gpio-pin*)))
                (debounce-brake
                    (if *brake-active-high* (= pin-state 1) (= pin-state 0))))
            (if (eq *brake-mode* 'local-adc)
                (debounce-brake
                    (selector-active-hysteresis
                        (get-adc *brake-adc-channel*)
                        *brake-adc-threshold-v*
                        *brake-adc-active-high*
                        *brake-db-state*
                        *brake-db-init*))
                (if (eq *brake-mode* 'can-adc)
                    (debounce-brake
                        (selector-active-hysteresis
                            (canget-adc *input-can-id* *can-brake-adc-channel*)
                            *brake-adc-threshold-v*
                            *brake-adc-active-high*
                            *brake-db-state*
                            *brake-db-init*))
                    nil)))))

(defun read-cruise-request ()
    (if (eq *cruise-mode* 'off)
        nil
        (if (eq *cruise-mode* 'local-gpio)
            (let ((pin-state (gpio-read *cruise-gpio-pin*)))
                (debounce-cruise-request
                    (if *cruise-active-high* (= pin-state 1) (= pin-state 0))))
            (if (eq *cruise-mode* 'local-adc)
                (debounce-cruise-request
                    (selector-active-hysteresis
                        (get-adc *cruise-adc-channel*)
                        *cruise-adc-threshold-v*
                        *cruise-adc-active-high*
                        *cruise-db-state*
                        *cruise-db-init*))
                (if (eq *cruise-mode* 'can-adc)
                    (debounce-cruise-request
                        (selector-active-hysteresis
                            (canget-adc *input-can-id* *can-cruise-adc-channel*)
                            *cruise-adc-threshold-v*
                            *cruise-adc-active-high*
                            *cruise-db-state*
                            *cruise-db-init*))
                    nil)))))

(defun read-cruise-cancel ()
    (if (eq *cruise-cancel-mode* 'off)
        nil
        (if (eq *cruise-cancel-mode* 'local-gpio)
            (let ((pin-state (gpio-read *cruise-cancel-gpio-pin*)))
                (debounce-cruise-cancel
                    (if *cruise-cancel-active-high* (= pin-state 1) (= pin-state 0))))
            (if (eq *cruise-cancel-mode* 'local-adc)
                (debounce-cruise-cancel
                    (selector-active-hysteresis
                        (get-adc *cruise-cancel-adc-channel*)
                        *cruise-cancel-adc-threshold-v*
                        *cruise-cancel-adc-active-high*
                        *cruise-cancel-db-state*
                        *cruise-cancel-db-init*))
                (if (eq *cruise-cancel-mode* 'can-adc)
                    (debounce-cruise-cancel
                        (selector-active-hysteresis
                            (canget-adc *input-can-id* *can-cruise-cancel-adc-channel*)
                            *cruise-cancel-adc-threshold-v*
                            *cruise-cancel-adc-active-high*
                            *cruise-cancel-db-state*
                            *cruise-cancel-db-init*))
                    nil)))))

(defun cruise-fresh ()
    (if (or (eq *cruise-mode* 'can-adc) (eq *cruise-cancel-mode* 'can-adc))
        *can6-fresh*
        t))

(defun read-enable ()
    (if (eq *enable-mode* 'always)
        t
        (if (eq *enable-mode* 'local-gpio)
            (let ((pin-state (gpio-read *enable-gpio-pin*)))
                (debounce-enable
                    (if *enable-active-high* (= pin-state 1) (= pin-state 0))))
            (if (eq *enable-mode* 'local-adc)
                (let ((v (get-adc *enable-adc-channel*)))
                    (debounce-enable
                        (selector-active-hysteresis
                            v
                            *enable-adc-threshold-v*
                            *enable-adc-active-high*
                            *enable-db-state*
                            *enable-db-init*)))
                (if (eq *enable-mode* 'can-adc)
                    (let ((v (canget-adc *input-can-id* *can-enable-adc-channel*)))
                        (debounce-enable
                            (selector-active-hysteresis
                                v
                                *enable-adc-threshold-v*
                                *enable-adc-active-high*
                                *enable-db-state*
                                *enable-db-init*)))
                    nil)))))

(defun neutral-inputs (throttle steer)
    (and
        (< (abs throttle) *arm-neutral-throttle*)
        (or
            (not (steering-needed))
            (< (abs steer) *arm-neutral-steer*))))

(defun disarm ()
    (progn
        (setq *armed* nil)
        (setq *cruise-active* nil)
        (setq *neutral-since* (systime))))

(defun latch-fault (reason)
    (if *fault-latched*
        nil
        (progn
            (setq *fault-latched* t)
            (setq *fault-reason* reason)
            (setq *cruise-active* nil)
            (print (list 'skid-fault reason)))))

(defun current-fault-reason (fresh direction-ok enable-ok cruise-ok brake-ok status-ok temp-ok)
    (if (not fresh)
        'input
        (if (not direction-ok)
            'direction-stale
            (if (not enable-ok)
                'enable-stale
                (if (not cruise-ok)
                    'cruise-stale
                    (if (not brake-ok)
                        'brake-stale
                        (if (not status-ok)
                            'motor-stale
                            (if (not temp-ok)
                                'thermal
                                nil))))))))

(defun clear-fault-if-safe (enabled throttle steer fault-now)
    (if (and
            *fault-latched*
            (not fault-now)
            (neutral-inputs throttle steer)
            (or (not enabled) (eq *enable-mode* 'always)))
        (progn
            (setq *fault-latched* nil)
            (setq *fault-reason* 'none)
            (print (list 'skid-fault-clear)))
        nil))

(defun wheel-commands-neutral ()
    (and
        (< (abs *left-command*) *direction-change-command-threshold*)
        (< (abs *right-command*) *direction-change-command-threshold*)))

(defun update-direction-lock ()
    (if (and *direction-neutral-lock* (direction-selector-mode) *sample-direction-ok*)
        (if (= *sample-direction-sign* *last-direction-sign*)
            (if (and *direction-lock* (neutral-inputs *sample-throttle* *sample-steer*))
                (setq *direction-lock* nil)
                nil)
            (if (and
                    (neutral-inputs *sample-throttle* *sample-steer*)
                    (wheel-commands-neutral))
                (progn
                    (setq *last-direction-sign* *sample-direction-sign*)
                    (setq *direction-lock* nil))
                (progn
                    (setq *direction-lock* t)
                    (setq *last-direction-sign* *sample-direction-sign*)
                    (setq *cruise-active* nil)
                    (disarm))))
        (progn
            (setq *direction-lock* nil)
            (setq *last-direction-sign* *sample-direction-sign*))))

(defun update-arm (enabled throttle steer)
    (if (not enabled)
        (progn (disarm) nil)
        (if *require-neutral-on-enable*
            (if *armed*
                t
                (if (neutral-inputs throttle steer)
                    (if (> (secs-since *neutral-since*) *arm-neutral-sec*)
                        (progn (setq *armed* t) t)
                        nil)
                    (progn (setq *neutral-since* (systime)) nil)))
            (progn (setq *armed* t) t))))

(defun update-cruise (safe drive-throttle)
    (let (
        (request (read-cruise-request))
        (cancel (read-cruise-cancel))
        (request-edge nil)
        (cruise-safe (and safe *armed*))
        (out drive-throttle))
        (progn
            (setq request-edge (and request (not *cruise-request-last*)))
            (setq *cruise-request-last* request)
            (if (not cruise-safe)
                (setq *cruise-active* nil)
                nil)
            (if cancel
                (setq *cruise-active* nil)
                nil)
            (if (and *cruise-active* *cruise-cancel-on-throttle*
                     (> (abs (- drive-throttle *cruise-command*)) *cruise-throttle-cancel-delta*))
                (setq *cruise-active* nil)
                nil)
            (if (and cruise-safe (not cancel) (not (eq *cruise-mode* 'off)))
                (if (eq *cruise-latch-mode* 'hold)
                    (if request
                        (if (and (not *cruise-active*) (> (abs drive-throttle) *cruise-min-command*))
                            (progn
                                (setq *cruise-command* drive-throttle)
                                (setq *cruise-active* t))
                            nil)
                        (setq *cruise-active* nil))
                    (if (and (eq *cruise-latch-mode* 'toggle) request-edge)
                        (if *cruise-active*
                            (setq *cruise-active* nil)
                            (if (> (abs drive-throttle) *cruise-min-command*)
                                (progn
                                    (setq *cruise-command* drive-throttle)
                                    (setq *cruise-active* t))
                                nil))
                        nil))
                nil)
            (if *cruise-active*
                (setq out *cruise-command*)
                (setq out drive-throttle))
            out)))

; ----------------------------
; Mixing, safety, and output
; ----------------------------

(defun calc-mix (throttle steer)
    (progn
        (if (eq *mix-mode* 'same-power)
            (progn
                (setq *mix-left* (* throttle *throttle-scale*))
                (setq *mix-right* (* throttle *throttle-scale*)))
            (progn
                (setq *mix-left* (+ (* throttle *throttle-scale*) (* steer *steer-scale*)))
                (setq *mix-right* (- (* throttle *throttle-scale*) (* steer *steer-scale*)))))
        (setq *mix-magnitude* (max2 (abs *mix-left*) (abs *mix-right*)))
        (if (> *mix-magnitude* 1.0)
            (progn
                (setq *mix-left* (/ *mix-left* *mix-magnitude*))
                (setq *mix-right* (/ *mix-right* *mix-magnitude*)))
            nil)))

(defun msg-fresh (id msg stale-sec)
    (let ((age (can-msg-age id msg)))
        (and age (< age stale-sec))))

(defun active-msg-fresh (active id msg)
    (or (not active) (msg-fresh id msg *motor-status-stale-sec*)))

(defun motors-fresh ()
    (or
        (not *require-motor-status*)
        (and
            (active-msg-fresh (drive-left-front) *left-front-id* 1)
            (active-msg-fresh (drive-left-rear) *left-rear-id* 1)
            (active-msg-fresh (drive-right-front) *right-front-id* 1)
            (active-msg-fresh (drive-right-rear) *right-rear-id* 1))))

(defun motor-temp-ok (id)
    (and
        (msg-fresh id 4 *motor-status-stale-sec*)
        (< (canget-temp-fet id) *max-fet-temp-c*)
        (< (canget-temp-motor id) *max-motor-temp-c*)))

(defun active-motor-temp-ok (active id)
    (or (not active) (motor-temp-ok id)))

(defun thermal-ok ()
    (or
        (not *enable-thermal-stop*)
        (and
            (active-motor-temp-ok (drive-left-front) *left-front-id*)
            (active-motor-temp-ok (drive-left-rear) *left-rear-id*)
            (active-motor-temp-ok (drive-right-front) *right-front-id*)
            (active-motor-temp-ok (drive-right-rear) *right-rear-id*))))

(defun send-drive-command (id value)
    (if (eq *control-mode* 'current-rel)
        (canset-current-rel id value *command-off-delay-sec*)
        (if (eq *control-mode* 'current)
            (canset-current id value *command-off-delay-sec*)
            (if (eq *control-mode* 'duty)
                (canset-duty id value)
                (if (eq *control-mode* 'rpm)
                    (canset-rpm id value)
                    nil)))))

(defun send-brake-command (id brake)
    (if (> brake 0.0)
        (if (eq *control-mode* 'current-rel)
            (canset-brake-rel id brake)
            (if (eq *control-mode* 'current)
                (canset-brake id brake)
                (send-drive-command id 0.0)))
        (send-drive-command id 0.0)))

(defun send-wheel (id sign trim side-command)
    (let (
        (side (apply-reverse-scale side-command))
        (scaled (* side sign trim *max-command*)))
        (if (< (abs side) *neutral-command-deadband*)
            (send-brake-command id *neutral-brake-command*)
            (send-drive-command id scaled))))

(defun send-active-wheel (active id sign trim side-command)
    (if active
        (send-wheel id sign trim side-command)
        nil))

(defun send-active-brake (active id brake)
    (if active
        (send-brake-command id brake)
        nil))

(defun send-all (left right)
    (progn
        (send-active-wheel (drive-left-front) *left-front-id* *left-front-sign* *left-front-scale* left)
        (send-active-wheel (drive-left-rear) *left-rear-id* *left-rear-sign* *left-rear-scale* left)
        (send-active-wheel (drive-right-front) *right-front-id* *right-front-sign* *right-front-scale* right)
        (send-active-wheel (drive-right-rear) *right-rear-id* *right-rear-sign* *right-rear-scale* right)))

(defun send-stop ()
    (progn
        (send-active-brake (drive-left-front) *left-front-id* *disable-brake-command*)
        (send-active-brake (drive-left-rear) *left-rear-id* *disable-brake-command*)
        (send-active-brake (drive-right-front) *right-front-id* *disable-brake-command*)
        (send-active-brake (drive-right-rear) *right-rear-id* *disable-brake-command*)))

(defun send-operator-brake ()
    (progn
        (send-active-brake (drive-left-front) *left-front-id* *brake-command*)
        (send-active-brake (drive-left-rear) *left-rear-id* *brake-command*)
        (send-active-brake (drive-right-front) *right-front-id* *brake-command*)
        (send-active-brake (drive-right-rear) *right-rear-id* *brake-command*)))

(defun heartbeat-off ()
    (if *heartbeat-enable*
        (if (= *heartbeat-state* 0)
            nil
            (progn
                (setq *heartbeat-state* 0)
                (gpio-write *heartbeat-gpio-pin* 0)))
        nil))

(defun update-heartbeat ()
    (if *heartbeat-enable*
        (if *fault-latched*
            (heartbeat-off)
            (if (> (secs-since *last-heartbeat*) *heartbeat-period-sec*)
                (progn
                    (setq *heartbeat-state* (if (= *heartbeat-state* 0) 1 0))
                    (gpio-write *heartbeat-gpio-pin* *heartbeat-state*)
                    (setq *last-heartbeat* (systime)))
                nil))
        nil))

(defun status-led-level (on)
    (if *status-led-active-high*
        (if on 1 0)
        (if on 0 1)))

(defun update-status-led-flash ()
    (if (> (secs-since *last-status-led-flash*) *status-led-flash-period-sec*)
        (progn
            (setq *status-led-flash-state* (if (= *status-led-flash-state* 0) 1 0))
            (setq *last-status-led-flash* (systime)))
        nil))

(defun write-status-led (pin mode)
    (if (eq mode 'on)
        (gpio-write pin (status-led-level t))
        (if (eq mode 'flash)
            (gpio-write pin (status-led-level (= *status-led-flash-state* 1)))
            (gpio-write pin (status-led-level nil)))))

(defun update-status-leds (enabled safe brake-active)
    (if *status-led-enable*
        (let (
            (ready-mode 'off)
            (inhibit-mode 'off)
            (fault-mode 'off))
            (progn
                (update-status-led-flash)
                (if *fault-latched*
                    (setq fault-mode 'flash)
                    (if brake-active
                        (setq fault-mode 'on)
                        nil))
                (if (or *fault-latched* brake-active)
                    nil
                    (progn
                        (if *armed*
                            (setq ready-mode 'on)
                            (if (and enabled safe)
                                (setq ready-mode 'flash)
                                nil))
                        (if (not enabled)
                            (setq inhibit-mode 'on)
                            (if (and enabled (not safe))
                                (setq inhibit-mode 'flash)
                                nil))))
                (write-status-led *status-ready-led-pin* ready-mode)
                (write-status-led *status-inhibit-led-pin* inhibit-mode)
                (write-status-led *status-fault-led-pin* fault-mode)))
        nil))

(defun check-loop-overrun ()
    (if (and *enable-loop-watchdog* (> (secs-since *loop-start*) *loop-overrun-sec*))
        (progn
            (latch-fault 'loop-overrun)
            (disarm)
            (setq *left-command* 0.0)
            (setq *right-command* 0.0)
            (send-stop)
            (heartbeat-off))
        nil))

(defun maybe-log (state throttle steer left right)
    (if (and *print-status* (> (secs-since *last-log*) *status-print-period-sec*))
        (progn
            (print (list 'skid state 'armed *armed* 'fault *fault-latched*
                         'reason *fault-reason*
                         'dir-lock *direction-lock*
                         'cruise *cruise-active*
                         'thr throttle 'steer steer 'left left 'right right))
            (setq *last-log* (systime)))
        nil))

(defun valid-control-mode ()
    (or
        (eq *control-mode* 'current-rel)
        (eq *control-mode* 'current)
        (eq *control-mode* 'duty)
        (eq *control-mode* 'rpm)))

(defun valid-drive-layout ()
    (or
        (eq *drive-layout* 'four-wheel)
        (eq *drive-layout* 'two-wheel-front)
        (eq *drive-layout* 'two-wheel-rear)))

(defun valid-mix-mode ()
    (or
        (eq *mix-mode* 'skid-steer)
        (eq *mix-mode* 'same-power)))

(defun valid-input-mode ()
    (or
        (eq *input-mode* 'local-adc)
        (eq *input-mode* 'can-adc)
        (eq *input-mode* 'can-ppm)))

(defun valid-direction-mode ()
    (or
        (eq *direction-mode* 'throttle-axis)
        (eq *direction-mode* 'fixed-forward)
        (eq *direction-mode* 'fixed-reverse)
        (eq *direction-mode* 'local-gpio)
        (eq *direction-mode* 'local-adc)
        (eq *direction-mode* 'can-adc)))

(defun valid-enable-mode ()
    (or
        (eq *enable-mode* 'always)
        (eq *enable-mode* 'local-gpio)
        (eq *enable-mode* 'local-adc)
        (eq *enable-mode* 'can-adc)))

(defun valid-brake-mode ()
    (or
        (eq *brake-mode* 'off)
        (eq *brake-mode* 'local-gpio)
        (eq *brake-mode* 'local-adc)
        (eq *brake-mode* 'can-adc)))

(defun valid-cruise-mode ()
    (or
        (eq *cruise-mode* 'off)
        (eq *cruise-mode* 'local-gpio)
        (eq *cruise-mode* 'local-adc)
        (eq *cruise-mode* 'can-adc)))

(defun valid-cruise-cancel-mode ()
    (or
        (eq *cruise-cancel-mode* 'off)
        (eq *cruise-cancel-mode* 'local-gpio)
        (eq *cruise-cancel-mode* 'local-adc)
        (eq *cruise-cancel-mode* 'can-adc)))

(defun valid-cruise-latch-mode ()
    (or
        (eq *cruise-latch-mode* 'toggle)
        (eq *cruise-latch-mode* 'hold)))

(defun config-check (reason ok)
    (if ok
        t
        (progn
            (if (eq *config-error* 'none)
                (setq *config-error* reason)
                nil)
            nil)))

(defun unit-range (x)
    (and (>= x 0.0) (<= x 1.0)))

(defun positive-unit-range (x)
    (and (> x 0.0) (<= x 1.0)))

(defun trim-range (x)
    (and (> x 0.0) (<= x 2.0)))

(defun adc-voltage-valid (v)
    (and (>= v 0.0) (<= v 3.3)))

(defun adc-calibration-valid (lo center hi)
    (and
        (adc-voltage-valid lo)
        (adc-voltage-valid center)
        (adc-voltage-valid hi)
        (< lo center)
        (< center hi)
        (> (- hi lo) 0.10)))

(defun selector-threshold-valid (threshold)
    (and
        (adc-voltage-valid threshold)
        (> threshold *selector-adc-hysteresis-v*)
        (< threshold (- 3.3 *selector-adc-hysteresis-v*))))

(defun valid-analog-config ()
    (and
        (adc-calibration-valid *throttle-min-v* *throttle-center-v* *throttle-max-v*)
        (or
            (not (steering-needed))
            (adc-calibration-valid *steer-min-v* *steer-center-v* *steer-max-v*))
        (>= *adc-fault-margin-v* 0.0)
        (< *adc-fault-margin-v* 1.0)
        (unit-range *throttle-expo*)
        (unit-range *steer-expo*)
        (>= *throttle-deadband* 0.0)
        (< *throttle-deadband* 1.0)
        (>= *steer-deadband* 0.0)
        (< *steer-deadband* 1.0)
        (< *throttle-deadband* *arm-neutral-throttle*)
        (or
            (not (steering-needed))
            (< *steer-deadband* *arm-neutral-steer*))))

(defun valid-selector-config ()
    (and
        (>= *selector-debounce-sec* 0.0)
        (>= *selector-adc-hysteresis-v* 0.0)
        (< *selector-adc-hysteresis-v* 1.0)
        (or (not (eq *direction-mode* 'local-adc)) (selector-threshold-valid *direction-adc-threshold-v*))
        (or (not (eq *direction-mode* 'can-adc)) (selector-threshold-valid *direction-adc-threshold-v*))
        (or (not (eq *enable-mode* 'local-adc)) (selector-threshold-valid *enable-adc-threshold-v*))
        (or (not (eq *enable-mode* 'can-adc)) (selector-threshold-valid *enable-adc-threshold-v*))
        (or (not (eq *brake-mode* 'local-adc)) (selector-threshold-valid *brake-adc-threshold-v*))
        (or (not (eq *brake-mode* 'can-adc)) (selector-threshold-valid *brake-adc-threshold-v*))
        (or (not (eq *cruise-mode* 'local-adc)) (selector-threshold-valid *cruise-adc-threshold-v*))
        (or (not (eq *cruise-mode* 'can-adc)) (selector-threshold-valid *cruise-adc-threshold-v*))
        (or (not (eq *cruise-cancel-mode* 'local-adc)) (selector-threshold-valid *cruise-cancel-adc-threshold-v*))
        (or (not (eq *cruise-cancel-mode* 'can-adc)) (selector-threshold-valid *cruise-cancel-adc-threshold-v*))))

(defun valid-gpio-input-mode (mode)
    (or
        (eq mode 'pin-mode-in)
        (eq mode 'pin-mode-in-pu)
        (eq mode 'pin-mode-in-pd)))

(defun active-gpio-pin-valid (active pin)
    (or
        (not active)
        (and
            (>= pin 0)
            (not (= pin *can-tx-pin*))
            (not (= pin *can-rx-pin*)))))

(defun active-gpio-pair-free (active-a pin-a active-b pin-b)
    (or
        (not active-a)
        (not active-b)
        (not (= pin-a pin-b))))

(defun valid-active-gpio-pins ()
    (let (
        (enable-gpio (eq *enable-mode* 'local-gpio))
        (brake-gpio (eq *brake-mode* 'local-gpio))
        (direction-gpio (eq *direction-mode* 'local-gpio))
        (cruise-gpio (eq *cruise-mode* 'local-gpio))
        (cancel-gpio (eq *cruise-cancel-mode* 'local-gpio))
        (heartbeat-gpio *heartbeat-enable*))
        (and
            (active-gpio-pin-valid enable-gpio *enable-gpio-pin*)
            (active-gpio-pin-valid brake-gpio *brake-gpio-pin*)
            (active-gpio-pin-valid direction-gpio *direction-gpio-pin*)
            (active-gpio-pin-valid cruise-gpio *cruise-gpio-pin*)
            (active-gpio-pin-valid cancel-gpio *cruise-cancel-gpio-pin*)
            (active-gpio-pin-valid heartbeat-gpio *heartbeat-gpio-pin*)
            (or (not enable-gpio) (valid-gpio-input-mode *enable-gpio-mode*))
            (or (not brake-gpio) (valid-gpio-input-mode *brake-gpio-mode*))
            (or (not direction-gpio) (valid-gpio-input-mode *direction-gpio-mode*))
            (or (not cruise-gpio) (valid-gpio-input-mode *cruise-gpio-mode*))
            (or (not cancel-gpio) (valid-gpio-input-mode *cruise-cancel-gpio-mode*))
            (active-gpio-pair-free enable-gpio *enable-gpio-pin* brake-gpio *brake-gpio-pin*)
            (active-gpio-pair-free enable-gpio *enable-gpio-pin* direction-gpio *direction-gpio-pin*)
            (active-gpio-pair-free enable-gpio *enable-gpio-pin* cruise-gpio *cruise-gpio-pin*)
            (active-gpio-pair-free enable-gpio *enable-gpio-pin* cancel-gpio *cruise-cancel-gpio-pin*)
            (active-gpio-pair-free enable-gpio *enable-gpio-pin* heartbeat-gpio *heartbeat-gpio-pin*)
            (active-gpio-pair-free brake-gpio *brake-gpio-pin* direction-gpio *direction-gpio-pin*)
            (active-gpio-pair-free brake-gpio *brake-gpio-pin* cruise-gpio *cruise-gpio-pin*)
            (active-gpio-pair-free brake-gpio *brake-gpio-pin* cancel-gpio *cruise-cancel-gpio-pin*)
            (active-gpio-pair-free brake-gpio *brake-gpio-pin* heartbeat-gpio *heartbeat-gpio-pin*)
            (active-gpio-pair-free direction-gpio *direction-gpio-pin* cruise-gpio *cruise-gpio-pin*)
            (active-gpio-pair-free direction-gpio *direction-gpio-pin* cancel-gpio *cruise-cancel-gpio-pin*)
            (active-gpio-pair-free direction-gpio *direction-gpio-pin* heartbeat-gpio *heartbeat-gpio-pin*)
            (active-gpio-pair-free cruise-gpio *cruise-gpio-pin* cancel-gpio *cruise-cancel-gpio-pin*)
            (active-gpio-pair-free cruise-gpio *cruise-gpio-pin* heartbeat-gpio *heartbeat-gpio-pin*)
            (active-gpio-pair-free cancel-gpio *cruise-cancel-gpio-pin* heartbeat-gpio *heartbeat-gpio-pin*))))

(defun active-adc-channel-valid (active channel)
    (or (not active) (>= channel 0)))

(defun active-adc-pair-free (active-a channel-a active-b channel-b)
    (or
        (not active-a)
        (not active-b)
        (not (= channel-a channel-b))))

(defun valid-local-adc-channels ()
    (let (
        (throttle-adc (eq *input-mode* 'local-adc))
        (steer-adc (and (eq *input-mode* 'local-adc) (steering-needed)))
        (direction-adc (eq *direction-mode* 'local-adc))
        (enable-adc (eq *enable-mode* 'local-adc))
        (brake-adc (eq *brake-mode* 'local-adc))
        (cruise-adc (eq *cruise-mode* 'local-adc))
        (cancel-adc (eq *cruise-cancel-mode* 'local-adc)))
        (and
            (active-adc-channel-valid throttle-adc *throttle-adc-channel*)
            (active-adc-channel-valid steer-adc *steer-adc-channel*)
            (active-adc-channel-valid direction-adc *direction-adc-channel*)
            (active-adc-channel-valid enable-adc *enable-adc-channel*)
            (active-adc-channel-valid brake-adc *brake-adc-channel*)
            (active-adc-channel-valid cruise-adc *cruise-adc-channel*)
            (active-adc-channel-valid cancel-adc *cruise-cancel-adc-channel*)
            (active-adc-pair-free throttle-adc *throttle-adc-channel* steer-adc *steer-adc-channel*)
            (active-adc-pair-free throttle-adc *throttle-adc-channel* direction-adc *direction-adc-channel*)
            (active-adc-pair-free throttle-adc *throttle-adc-channel* enable-adc *enable-adc-channel*)
            (active-adc-pair-free throttle-adc *throttle-adc-channel* brake-adc *brake-adc-channel*)
            (active-adc-pair-free throttle-adc *throttle-adc-channel* cruise-adc *cruise-adc-channel*)
            (active-adc-pair-free throttle-adc *throttle-adc-channel* cancel-adc *cruise-cancel-adc-channel*)
            (active-adc-pair-free steer-adc *steer-adc-channel* direction-adc *direction-adc-channel*)
            (active-adc-pair-free steer-adc *steer-adc-channel* enable-adc *enable-adc-channel*)
            (active-adc-pair-free steer-adc *steer-adc-channel* brake-adc *brake-adc-channel*)
            (active-adc-pair-free steer-adc *steer-adc-channel* cruise-adc *cruise-adc-channel*)
            (active-adc-pair-free steer-adc *steer-adc-channel* cancel-adc *cruise-cancel-adc-channel*)
            (active-adc-pair-free direction-adc *direction-adc-channel* enable-adc *enable-adc-channel*)
            (active-adc-pair-free direction-adc *direction-adc-channel* brake-adc *brake-adc-channel*)
            (active-adc-pair-free direction-adc *direction-adc-channel* cruise-adc *cruise-adc-channel*)
            (active-adc-pair-free direction-adc *direction-adc-channel* cancel-adc *cruise-cancel-adc-channel*)
            (active-adc-pair-free enable-adc *enable-adc-channel* brake-adc *brake-adc-channel*)
            (active-adc-pair-free enable-adc *enable-adc-channel* cruise-adc *cruise-adc-channel*)
            (active-adc-pair-free enable-adc *enable-adc-channel* cancel-adc *cruise-cancel-adc-channel*)
            (active-adc-pair-free brake-adc *brake-adc-channel* cruise-adc *cruise-adc-channel*)
            (active-adc-pair-free brake-adc *brake-adc-channel* cancel-adc *cruise-cancel-adc-channel*)
            (active-adc-pair-free cruise-adc *cruise-adc-channel* cancel-adc *cruise-cancel-adc-channel*))))

(defun valid-can-adc-channels ()
    (let (
        (throttle-adc (eq *input-mode* 'can-adc))
        (steer-adc (and (steering-needed) (or (eq *input-mode* 'can-adc) (eq *input-mode* 'can-ppm))))
        (direction-adc (eq *direction-mode* 'can-adc))
        (enable-adc (eq *enable-mode* 'can-adc))
        (brake-adc (eq *brake-mode* 'can-adc))
        (cruise-adc (eq *cruise-mode* 'can-adc))
        (cancel-adc (eq *cruise-cancel-mode* 'can-adc)))
        (and
            (active-adc-channel-valid throttle-adc *can-throttle-adc-channel*)
            (active-adc-channel-valid steer-adc *can-steer-adc-channel*)
            (active-adc-channel-valid direction-adc *can-direction-adc-channel*)
            (active-adc-channel-valid enable-adc *can-enable-adc-channel*)
            (active-adc-channel-valid brake-adc *can-brake-adc-channel*)
            (active-adc-channel-valid cruise-adc *can-cruise-adc-channel*)
            (active-adc-channel-valid cancel-adc *can-cruise-cancel-adc-channel*)
            (active-adc-pair-free throttle-adc *can-throttle-adc-channel* steer-adc *can-steer-adc-channel*)
            (active-adc-pair-free throttle-adc *can-throttle-adc-channel* direction-adc *can-direction-adc-channel*)
            (active-adc-pair-free throttle-adc *can-throttle-adc-channel* enable-adc *can-enable-adc-channel*)
            (active-adc-pair-free throttle-adc *can-throttle-adc-channel* brake-adc *can-brake-adc-channel*)
            (active-adc-pair-free throttle-adc *can-throttle-adc-channel* cruise-adc *can-cruise-adc-channel*)
            (active-adc-pair-free throttle-adc *can-throttle-adc-channel* cancel-adc *can-cruise-cancel-adc-channel*)
            (active-adc-pair-free steer-adc *can-steer-adc-channel* direction-adc *can-direction-adc-channel*)
            (active-adc-pair-free steer-adc *can-steer-adc-channel* enable-adc *can-enable-adc-channel*)
            (active-adc-pair-free steer-adc *can-steer-adc-channel* brake-adc *can-brake-adc-channel*)
            (active-adc-pair-free steer-adc *can-steer-adc-channel* cruise-adc *can-cruise-adc-channel*)
            (active-adc-pair-free steer-adc *can-steer-adc-channel* cancel-adc *can-cruise-cancel-adc-channel*)
            (active-adc-pair-free direction-adc *can-direction-adc-channel* enable-adc *can-enable-adc-channel*)
            (active-adc-pair-free direction-adc *can-direction-adc-channel* brake-adc *can-brake-adc-channel*)
            (active-adc-pair-free direction-adc *can-direction-adc-channel* cruise-adc *can-cruise-adc-channel*)
            (active-adc-pair-free direction-adc *can-direction-adc-channel* cancel-adc *can-cruise-cancel-adc-channel*)
            (active-adc-pair-free enable-adc *can-enable-adc-channel* brake-adc *can-brake-adc-channel*)
            (active-adc-pair-free enable-adc *can-enable-adc-channel* cruise-adc *can-cruise-adc-channel*)
            (active-adc-pair-free enable-adc *can-enable-adc-channel* cancel-adc *can-cruise-cancel-adc-channel*)
            (active-adc-pair-free brake-adc *can-brake-adc-channel* cruise-adc *can-cruise-adc-channel*)
            (active-adc-pair-free brake-adc *can-brake-adc-channel* cancel-adc *can-cruise-cancel-adc-channel*)
            (active-adc-pair-free cruise-adc *can-cruise-adc-channel* cancel-adc *can-cruise-cancel-adc-channel*))))

(defun valid-adc-channels ()
    (and
        (valid-local-adc-channels)
        (valid-can-adc-channels)))

(defun active-motor-id-valid (active id)
    (or (not active) (> id 0)))

(defun active-motor-id-free (active-a id-a active-b id-b)
    (or
        (not active-a)
        (not active-b)
        (not (= id-a id-b))))

(defun active-motor-ids-valid ()
    (and
        (active-motor-id-valid (drive-left-front) *left-front-id*)
        (active-motor-id-valid (drive-left-rear) *left-rear-id*)
        (active-motor-id-valid (drive-right-front) *right-front-id*)
        (active-motor-id-valid (drive-right-rear) *right-rear-id*)
        (active-motor-id-free (drive-left-front) *left-front-id* (drive-left-rear) *left-rear-id*)
        (active-motor-id-free (drive-left-front) *left-front-id* (drive-right-front) *right-front-id*)
        (active-motor-id-free (drive-left-front) *left-front-id* (drive-right-rear) *right-rear-id*)
        (active-motor-id-free (drive-left-rear) *left-rear-id* (drive-right-front) *right-front-id*)
        (active-motor-id-free (drive-left-rear) *left-rear-id* (drive-right-rear) *right-rear-id*)
        (active-motor-id-free (drive-right-front) *right-front-id* (drive-right-rear) *right-rear-id*)))

(defun wheel-trims-valid ()
    (and
        (trim-range *left-front-scale*)
        (trim-range *left-rear-scale*)
        (trim-range *right-front-scale*)
        (trim-range *right-rear-scale*)))

(defun can-pins-valid ()
    (or
        (and
            (>= *can-tx-pin* 0)
            (>= *can-rx-pin* 0)
            (not (= *can-tx-pin* *can-rx-pin*)))
        (and
            (< *can-tx-pin* 0)
            (< *can-rx-pin* 0))))

(defun relative-command-mode ()
    (or
        (eq *control-mode* 'current-rel)
        (eq *control-mode* 'duty)))

(defun brake-command-range-valid ()
    (and
        (>= *neutral-brake-command* 0.0)
        (>= *disable-brake-command* 0.0)
        (>= *brake-command* 0.0)
        (or
            (not (eq *control-mode* 'current-rel))
            (and
                (<= *neutral-brake-command* 1.0)
                (<= *disable-brake-command* 1.0)
                (<= *brake-command* 1.0)))))

(defun command-config-valid ()
    (and
        (> *max-command* 0.0)
        (or (not (relative-command-mode)) (<= *max-command* 1.0))
        (unit-range *reverse-scale*)
        (>= *throttle-scale* 0.0)
        (<= *throttle-scale* 2.0)
        (>= *steer-scale* 0.0)
        (<= *steer-scale* 2.0)
        (> *accel-rate-per-sec* 0.0)
        (> *decel-rate-per-sec* 0.0)
        (> *reverse-rate-per-sec* 0.0)
        (> *loop-period-sec* 0.0)
        (>= *command-off-delay-sec* (* 2.0 *loop-period-sec*))
        (brake-command-range-valid)
        (>= *neutral-command-deadband* 0.0)
        (< *neutral-command-deadband* 1.0)))

(defun timing-config-valid ()
    (and
        (>= *arm-neutral-sec* 0.0)
        (positive-unit-range *arm-neutral-throttle*)
        (positive-unit-range *arm-neutral-steer*)
        (> *direction-change-command-threshold* 0.0)
        (> *loop-overrun-sec* *loop-period-sec*)
        (> *heartbeat-period-sec* 0.0)
        (> *status-print-period-sec* 0.0)
        (or (not *status-led-enable*) (> *status-led-flash-period-sec* 0.0))
        (> *input-stale-sec* 0.0)
        (> *motor-status-stale-sec* 0.0)))

(defun monitoring-config-valid ()
    (and
        (> *max-fet-temp-c* 0.0)
        (> *max-motor-temp-c* 0.0)))

(defun status-led-pin-free (pin)
    (and
        (not (= pin *can-tx-pin*))
        (not (= pin *can-rx-pin*))
        (or (not (eq *enable-mode* 'local-gpio)) (not (= pin *enable-gpio-pin*)))
        (or (not (eq *brake-mode* 'local-gpio)) (not (= pin *brake-gpio-pin*)))
        (or (not (eq *direction-mode* 'local-gpio)) (not (= pin *direction-gpio-pin*)))
        (or (not (eq *cruise-mode* 'local-gpio)) (not (= pin *cruise-gpio-pin*)))
        (or (not (eq *cruise-cancel-mode* 'local-gpio)) (not (= pin *cruise-cancel-gpio-pin*)))
        (or (not *heartbeat-enable*) (not (= pin *heartbeat-gpio-pin*)))))

(defun status-led-pins-valid ()
    (or
        (not *status-led-enable*)
        (and
            (>= *status-ready-led-pin* 0)
            (>= *status-inhibit-led-pin* 0)
            (>= *status-fault-led-pin* 0)
            (not (= *status-ready-led-pin* *status-inhibit-led-pin*))
            (not (= *status-ready-led-pin* *status-fault-led-pin*))
            (not (= *status-inhibit-led-pin* *status-fault-led-pin*))
            (status-led-pin-free *status-ready-led-pin*)
            (status-led-pin-free *status-inhibit-led-pin*)
            (status-led-pin-free *status-fault-led-pin*))))

(defun valid-safety-config ()
    (and
        (> *direction-change-command-threshold* 0.0)
        (> *loop-overrun-sec* 0.0)
        (> *heartbeat-period-sec* 0.0)
        (or (not *status-led-enable*) (> *status-led-flash-period-sec* 0.0))
        (>= *brake-command* 0.0)
        (or (not (eq *brake-mode* 'local-gpio)) (>= *brake-gpio-pin* 0))
        (or (not *heartbeat-enable*) (>= *heartbeat-gpio-pin* 0))
        (status-led-pins-valid)))

(defun valid-startup-config ()
    (progn
        (setq *config-error* 'none)
        (and
            (config-check 'control-mode (valid-control-mode))
            (config-check 'drive-layout (valid-drive-layout))
            (config-check 'mix-mode (valid-mix-mode))
            (config-check 'input-mode (valid-input-mode))
            (config-check 'direction-mode (valid-direction-mode))
            (config-check 'enable-mode (valid-enable-mode))
            (config-check 'brake-mode (valid-brake-mode))
            (config-check 'cruise-mode (valid-cruise-mode))
            (config-check 'cruise-cancel-mode (valid-cruise-cancel-mode))
            (config-check 'cruise-latch-mode (valid-cruise-latch-mode))
            (config-check 'can-pins (can-pins-valid))
            (config-check 'motor-can-ids (active-motor-ids-valid))
            (config-check 'wheel-trims (wheel-trims-valid))
            (config-check 'analog-calibration (valid-analog-config))
            (config-check 'selector-config (valid-selector-config))
            (config-check 'adc-channel-conflict (valid-adc-channels))
            (config-check 'gpio-pin-conflict (valid-active-gpio-pins))
            (config-check 'command-config (command-config-valid))
            (config-check 'timing-config (timing-config-valid))
            (config-check 'monitoring-config (monitoring-config-valid))
            (config-check 'safety-config (valid-safety-config)))))

(defun start-can ()
    (progn
        (if (and (>= *can-tx-pin* 0) (>= *can-rx-pin* 0))
            (can-start *can-tx-pin* *can-rx-pin*)
            (can-start))
        (can-use-vesc t)))

(defun setup-enable-input ()
    (if (eq *enable-mode* 'local-gpio)
        (gpio-configure *enable-gpio-pin* *enable-gpio-mode*)
        nil))

(defun setup-brake-input ()
    (if (eq *brake-mode* 'local-gpio)
        (gpio-configure *brake-gpio-pin* *brake-gpio-mode*)
        nil))

(defun setup-direction-input ()
    (if (eq *direction-mode* 'local-gpio)
        (gpio-configure *direction-gpio-pin* *direction-gpio-mode*)
        nil))

(defun setup-cruise-inputs ()
    (progn
        (if (eq *cruise-mode* 'local-gpio)
            (gpio-configure *cruise-gpio-pin* *cruise-gpio-mode*)
            nil)
        (if (eq *cruise-cancel-mode* 'local-gpio)
            (gpio-configure *cruise-cancel-gpio-pin* *cruise-cancel-gpio-mode*)
            nil)))

(defun setup-heartbeat ()
    (if *heartbeat-enable*
        (progn
            (gpio-configure *heartbeat-gpio-pin* 'pin-mode-out)
            (gpio-write *heartbeat-gpio-pin* 0))
        nil))

(defun setup-status-leds ()
    (if *status-led-enable*
        (progn
            (gpio-configure *status-ready-led-pin* 'pin-mode-out)
            (gpio-configure *status-inhibit-led-pin* 'pin-mode-out)
            (gpio-configure *status-fault-led-pin* 'pin-mode-out)
            (write-status-led *status-ready-led-pin* 'off)
            (write-status-led *status-inhibit-led-pin* 'off)
            (write-status-led *status-fault-led-pin* 'off))
        nil))

; ----------------------------
; Startup and main loop
; ----------------------------

(trap (set-print-prefix "skid| "))
(trap (set-fw-name *vehicle-name*))

(if (valid-startup-config)
    (progn
        (start-can)
        (setup-enable-input)
        (setup-brake-input)
        (setup-direction-input)
        (setup-cruise-inputs)
        (setup-heartbeat)
        (setup-status-leds)
        (print (list 'skid-start *vehicle-name*
                     'mode *control-mode*
                     'layout *drive-layout*
                     'mix *mix-mode*
                     'input *input-mode*
                     'direction *direction-mode*
                     'brake *brake-mode*
                     'cruise *cruise-mode*
                     'heartbeat *heartbeat-enable*
                     'status-leds *status-led-enable*))
        (loopwhile t
            (progn
                (setq *loop-start* (systime))
                (sample-can6)
                (sample-control-inputs)
                (let (
                (fresh *sample-input-ok*)
                (direction-ok *sample-direction-ok*)
                (enable-ok (enable-fresh))
                (brake-ok (brake-fresh))
                (cruise-ok (cruise-fresh))
                (raw-throttle *sample-drive-throttle*)
                (throttle 0.0)
                (steer (if fresh *sample-steer* 0.0))
                (enabled (read-enable))
                (brake-active nil)
                (status-ok (motors-fresh))
                (temp-ok (thermal-ok))
                (fault-now nil)
                (safe nil)
                (armed-now nil))
                (progn
                    (update-direction-lock)
                    (setq fault-now
                        (current-fault-reason fresh direction-ok enable-ok cruise-ok brake-ok status-ok temp-ok))
                    (clear-fault-if-safe enabled *sample-throttle* steer fault-now)
                    (if fault-now (latch-fault fault-now) nil)
                    (setq brake-active (and brake-ok (read-brake)))
                    (setq safe
                        (and
                            fresh direction-ok enable-ok cruise-ok brake-ok enabled status-ok temp-ok
                            (not *direction-lock*)
                            (not *fault-latched*)))
                    (if brake-active
                        (progn
                            (disarm)
                            (setq *cruise-active* nil)
                            (setq *left-command* 0.0)
                            (setq *right-command* 0.0)
                            (send-operator-brake)
                            (maybe-log 'brake raw-throttle steer 0.0 0.0))
                        (progn
                            (setq throttle (update-cruise safe raw-throttle))
                            (setq armed-now (and safe (update-arm enabled throttle steer)))
                            (if armed-now
                                (progn
                                    (calc-mix throttle steer)
                                    (setq *left-command* (slew *left-command* *mix-left* *loop-period-sec*))
                                    (setq *right-command* (slew *right-command* *mix-right* *loop-period-sec*))
                                    (send-all *left-command* *right-command*)
                                    (maybe-log 'drive throttle steer *left-command* *right-command*))
                                (progn
                                    (if (not safe) (disarm) nil)
                                    (setq *left-command* 0.0)
                                    (setq *right-command* 0.0)
                                    (send-stop)
                                    (maybe-log 'stop throttle steer 0.0 0.0)))))
                    (check-loop-overrun)
                    (update-status-leds enabled safe brake-active)
                    (update-heartbeat)
                    (sleep *loop-period-sec*))))))
    (progn
        (print (list 'skid-config-error
                     'reason *config-error*
                     'control *control-mode*
                     'layout *drive-layout*
                     'mix *mix-mode*
                     'input *input-mode*
                     'direction *direction-mode*
                     'enable *enable-mode*
                     'brake *brake-mode*
                     'cruise *cruise-mode*
                     'cancel *cruise-cancel-mode*
                     'heartbeat *heartbeat-enable*
                     'status-leds *status-led-enable*))
        (loopwhile t (sleep 1.0))))
