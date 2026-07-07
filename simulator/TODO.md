# SkidCopter Simulator Next Fidelity TODO

These are the next physics/modeling upgrades after the first browser simulator.

- [x] Inertia model: add vehicle mass, rotational inertia, and command-to-force integration instead of direct command-to-speed mapping.
- [x] Acceleration limits: separate motor torque limits, traction limits, braking limits, and VESC ramp behavior.
- [x] Tire slip: model skid-steer scrub, lateral slip angle, surface friction, and traction loss under aggressive turns.
- [x] Caster drag: add unpowered caster rolling resistance, swivel lag, and scrub from front/rear caster layouts.
- [ ] Calibrated motor response: fit command-to-wheel-speed/current curves from bench logs for each VESC/motor/gear/wheel setup.
