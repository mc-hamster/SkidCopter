import {
  AlertTriangle,
  CircleStop,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Route,
  SlidersHorizontal,
  StepForward,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { getScenario, sampleScenario, scenarios } from "./data/scenarios";
import { GROUND_SURFACE_CUSTOM_ID, getGroundSurface, groundSurfaces } from "./data/groundSurfaces";
import { defaultControlInput, defaultVehicleConfig, SkidController } from "./sim/skidController";
import { createInitialVehicleState, stepVehicle } from "./sim/vehiclePhysics";

const TODO_ITEMS = [
  { label: "Inertia model", done: true },
  { label: "Acceleration limits", done: true },
  { label: "Tire slip", done: true },
  { label: "Caster drag", done: false },
  { label: "Calibrated motor response", done: false },
];

const FT_TO_M = 0.3048;
const M_TO_FT = 1 / FT_TO_M;
const M_TO_IN = 39.3700787402;
const IN_TO_M = 1 / M_TO_IN;
const KG_TO_LB = 2.2046226218;
const LB_TO_KG = 1 / KG_TO_LB;
const N_TO_LBF = 0.2248089431;
const LBF_TO_N = 1 / N_TO_LBF;
const MPS_TO_MPH = 2.2369362921;
const MPH_TO_MPS = 1 / MPS_TO_MPH;
const MPS2_TO_FTPS2 = M_TO_FT;
const TEST_PAD_SIZE_FT = 160;
const TEST_PAD_SIZE_M = TEST_PAD_SIZE_FT * FT_TO_M;
const GROUND_TEXTURE_SIZE = 512;

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return value.toFixed(digits);
}

function metersToFeet(value) {
  return value * M_TO_FT;
}

function metersToInches(value) {
  return value * M_TO_IN;
}

function kilogramsToPounds(value) {
  return value * KG_TO_LB;
}

function newtonsToPoundsForce(value) {
  return value * N_TO_LBF;
}

function metersPerSecondToMph(value) {
  return value * MPS_TO_MPH;
}

function metersPerSecondSquaredToFeet(value) {
  return value * MPS2_TO_FTPS2;
}

function classNames(...parts) {
  return parts.filter(Boolean).join(" ");
}

function createSeededRandom(seedText) {
  let seed = 0;
  for (let index = 0; index < seedText.length; index += 1) {
    seed = (seed * 31 + seedText.charCodeAt(index)) >>> 0;
  }

  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function scatterTexture(ctx, rng, count, colors, alphaRange, sizeRange) {
  for (let index = 0; index < count; index += 1) {
    ctx.globalAlpha = alphaRange[0] + rng() * (alphaRange[1] - alphaRange[0]);
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    const size = sizeRange[0] + rng() * (sizeRange[1] - sizeRange[0]);
    ctx.fillRect(rng() * GROUND_TEXTURE_SIZE, rng() * GROUND_TEXTURE_SIZE, size, size);
  }
  ctx.globalAlpha = 1;
}

function createGroundSurfaceTexture(surface) {
  const canvas = document.createElement("canvas");
  canvas.width = GROUND_TEXTURE_SIZE;
  canvas.height = GROUND_TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  const rng = createSeededRandom(surface.id);

  if (surface.visual.texture === "sand") {
    ctx.fillStyle = "#b99b63";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    scatterTexture(ctx, rng, 2200, ["#cfb77a", "#8e7144", "#e0c98d"], [0.18, 0.42], [1, 3.5]);
    ctx.strokeStyle = "rgba(255, 236, 177, 0.18)";
    ctx.lineWidth = 2;
    for (let row = -40; row < canvas.height + 40; row += 42) {
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 18) {
        const y = row + Math.sin(x * 0.035 + rng() * 0.4) * 7;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  } else if (surface.visual.texture === "playa") {
    ctx.fillStyle = "#b9b19d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    scatterTexture(ctx, rng, 1800, ["#d4cfbd", "#8c8578", "#c8bfab"], [0.14, 0.35], [1, 3]);
    ctx.lineCap = "round";
    for (let crack = 0; crack < 24; crack += 1) {
      let x = rng() * canvas.width;
      let y = rng() * canvas.height;
      ctx.strokeStyle = "rgba(75, 68, 56, 0.34)";
      ctx.lineWidth = 0.8 + rng() * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let step = 0; step < 5 + Math.floor(rng() * 4); step += 1) {
        x += (rng() - 0.5) * 58;
        y += (rng() - 0.5) * 58;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (surface.visual.texture === "grass") {
    ctx.fillStyle = "#244b2d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    scatterTexture(ctx, rng, 1800, ["#356f3d", "#1d3924", "#5e9c55"], [0.16, 0.38], [1, 4]);
    ctx.lineCap = "round";
    for (let blade = 0; blade < 1400; blade += 1) {
      const x = rng() * canvas.width;
      const y = rng() * canvas.height;
      const length = 4 + rng() * 10;
      const tilt = (rng() - 0.5) * 5;
      ctx.strokeStyle = rng() > 0.45 ? "rgba(112, 169, 93, 0.32)" : "rgba(20, 48, 26, 0.36)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + tilt, y - length);
      ctx.stroke();
    }
  } else if (surface.visual.texture === "asphalt") {
    ctx.fillStyle = "#20262a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    scatterTexture(ctx, rng, 3200, ["#31393e", "#111518", "#6f7b80", "#4e5b62"], [0.12, 0.4], [0.8, 2.7]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let seam = 0; seam < 7; seam += 1) {
      const y = rng() * canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y + (rng() - 0.5) * 18);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#0b1218";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    scatterTexture(ctx, rng, 1200, ["#152331", "#233747", "#0a0f14"], [0.12, 0.32], [1, 3]);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(9, 9);
  texture.anisotropy = 4;
  return texture;
}

function createInitialFrame(config, controller, input) {
  const telemetry = controller.step(input, config, 0, 0);
  return {
    telemetry,
    vehicleState: createInitialVehicleState(),
    input,
    history: [],
  };
}

function VehicleScene({ config, frame, followCamera }) {
  const mountRef = useRef(null);
  const frameRef = useRef(frame);
  const configRef = useRef(config);
  const followRef = useRef(followCamera);
  const modelRef = useRef(null);
  const trailRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    followRef.current = followCamera;
  }, [followCamera]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e12);
    scene.fog = new THREE.Fog(0x0a0e12, 18, 42);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 140);
    camera.position.set(4.6, 4.1, -6.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.4, 0);
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 3;
    controls.maxDistance = 18;

    const hemi = new THREE.HemisphereLight(0xd9f2ff, 0x182027, 1.3);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(5, 8, -6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x4ed5ff, 0.65);
    fillLight.position.set(-6, 3, 5);
    scene.add(fillLight);

    let floorTexture = null;
    let minorGrid = null;
    let majorGrid = null;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(TEST_PAD_SIZE_M, TEST_PAD_SIZE_M),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.02 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.012;
    scene.add(floor);

    function disposeGrid(grid) {
      if (!grid) {
        return;
      }
      grid.geometry.dispose();
      if (Array.isArray(grid.material)) {
        grid.material.forEach((material) => material.dispose());
      } else {
        grid.material.dispose();
      }
    }

    function makeGrid(divisions, centerColor, lineColor, y, opacity) {
      const grid = new THREE.GridHelper(TEST_PAD_SIZE_M, divisions, centerColor, lineColor);
      grid.position.y = y;
      grid.material.transparent = true;
      grid.material.opacity = opacity;
      grid.material.depthWrite = false;
      scene.add(grid);
      return grid;
    }

    function applyGroundSurface(surfaceId) {
      const surface = getGroundSurface(surfaceId);
      const visual = surface.visual;

      if (floorTexture) {
        floorTexture.dispose();
      }
      floorTexture = createGroundSurfaceTexture(surface);
      floor.material.map = floorTexture;
      floor.material.roughness = visual.roughness;
      floor.material.needsUpdate = true;

      if (minorGrid) {
        scene.remove(minorGrid);
        disposeGrid(minorGrid);
      }
      if (majorGrid) {
        scene.remove(majorGrid);
        disposeGrid(majorGrid);
      }

      minorGrid = makeGrid(
        TEST_PAD_SIZE_FT / 5,
        visual.minorGridCenterColor,
        visual.minorGridLineColor,
        0.004,
        visual.gridOpacity * 0.82
      );
      majorGrid = makeGrid(
        TEST_PAD_SIZE_FT / 10,
        visual.majorGridCenterColor,
        visual.majorGridLineColor,
        0.008,
        visual.gridOpacity
      );
    }

    applyGroundSurface(configRef.current.groundSurface);

    const axisMat = new THREE.LineBasicMaterial({ color: 0x43d9ff, transparent: true, opacity: 0.5 });
    const axisGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-TEST_PAD_SIZE_M * 0.5, 0.02, 0),
      new THREE.Vector3(TEST_PAD_SIZE_M * 0.5, 0.02, 0),
      new THREE.Vector3(0, 0.02, -TEST_PAD_SIZE_M * 0.5),
      new THREE.Vector3(0, 0.02, TEST_PAD_SIZE_M * 0.5),
    ]);
    scene.add(new THREE.LineSegments(axisGeom, axisMat));

    trailRef.current = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x43d9ff, transparent: true, opacity: 0.86 })
    );
    trailRef.current.frustumCulled = false;
    scene.add(trailRef.current);

    function buildVehicleModel(nextConfig, activeWheels) {
      if (modelRef.current) {
        scene.remove(modelRef.current.group);
      }

      const group = new THREE.Group();
      const wheelRadius = Math.max(nextConfig.wheelDiameterM * 0.5, 0.05);
      const wheelWidth = Math.max(nextConfig.trackWidthM * 0.12, 0.12);
      const bodyWidth = Math.max(nextConfig.trackWidthM - wheelWidth * 0.9, 0.45);
      const bodyLength = Math.max(nextConfig.wheelbaseM * 0.88, 0.75);
      const bodyHeight = Math.max(wheelRadius * 0.85, 0.22);
      const wheelX = nextConfig.trackWidthM * 0.5;
      const wheelZ = nextConfig.wheelbaseM * 0.5;
      const wheelY = wheelRadius;

      const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength),
        new THREE.MeshStandardMaterial({ color: 0x202b34, roughness: 0.42, metalness: 0.22 })
      );
      chassis.position.y = wheelRadius + bodyHeight * 0.44;
      group.add(chassis);

      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(bodyWidth * 0.92, bodyHeight * 0.24, bodyLength * 0.92),
        new THREE.MeshStandardMaterial({ color: 0x2b3944, roughness: 0.5, metalness: 0.25 })
      );
      deck.position.y = chassis.position.y + bodyHeight * 0.58;
      group.add(deck);

      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(bodyWidth * 0.18, bodyLength * 0.16, 4),
        new THREE.MeshStandardMaterial({ color: 0x43d9ff, roughness: 0.35, metalness: 0.1 })
      );
      nose.rotation.y = Math.PI * 0.25;
      nose.position.set(0, deck.position.y + bodyHeight * 0.2, bodyLength * 0.55);
      group.add(nose);

      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f151b, roughness: 0.74, metalness: 0.08 });
      const inactiveWheelMat = new THREE.MeshStandardMaterial({
        color: 0x29313a,
        roughness: 0.78,
        metalness: 0.02,
      });
      const hubMat = new THREE.MeshStandardMaterial({ color: 0x93a4af, roughness: 0.36, metalness: 0.45 });
      const accentMat = new THREE.MeshBasicMaterial({ color: 0x43d9ff });
      const wheels = {};

      const wheelDefs = [
        ["leftFront", -wheelX, wheelZ, "left"],
        ["leftRear", -wheelX, -wheelZ, "left"],
        ["rightFront", wheelX, wheelZ, "right"],
        ["rightRear", wheelX, -wheelZ, "right"],
      ];

      for (const [key, x, z, side] of wheelDefs) {
        const pivot = new THREE.Group();
        pivot.position.set(x, wheelY, z);
        const powered = activeWheels[key];

        const tire = new THREE.Mesh(
          new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 28),
          powered ? wheelMat : inactiveWheelMat
        );
        tire.rotation.z = Math.PI / 2;
        pivot.add(tire);

        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(wheelRadius * 0.44, wheelRadius * 0.44, wheelWidth * 1.04, 20),
          hubMat
        );
        hub.rotation.z = Math.PI / 2;
        pivot.add(hub);

        if (powered) {
          const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(wheelRadius * 1.4, 0.012, 0.025),
            accentMat
          );
          stripe.position.x = side === "left" ? -wheelWidth * 0.52 : wheelWidth * 0.52;
          pivot.add(stripe);
        }

        group.add(pivot);
        wheels[key] = pivot;
      }

      scene.add(group);
      modelRef.current = { group, wheels };
    }

    buildVehicleModel(configRef.current, frameRef.current.telemetry.activeWheels);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(Math.max(rect.width, 1), Math.max(rect.height, 1), false);
      camera.aspect = Math.max(rect.width, 1) / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let raf = 0;
    const animate = () => {
      const latestFrame = frameRef.current;
      const latestConfig = configRef.current;
      const vehicle = latestFrame.vehicleState;

      if (modelRef.current) {
        const { group, wheels } = modelRef.current;
        group.position.set(vehicle.x, 0, vehicle.z);
        group.rotation.y = vehicle.heading;
        wheels.leftFront.rotation.x = vehicle.leftWheelAngle;
        wheels.leftRear.rotation.x = vehicle.leftWheelAngle;
        wheels.rightFront.rotation.x = vehicle.rightWheelAngle;
        wheels.rightRear.rotation.x = vehicle.rightWheelAngle;
      }

      if (trailRef.current) {
        const points = vehicle.trail.map((point) => new THREE.Vector3(point.x, 0.04, point.z));
        trailRef.current.geometry.dispose();
        trailRef.current.geometry = new THREE.BufferGeometry().setFromPoints(points);
      }

      if (followRef.current) {
        const behind = new THREE.Vector3(
          vehicle.x - Math.sin(vehicle.heading) * 5,
          3.2,
          vehicle.z - Math.cos(vehicle.heading) * 5
        );
        const target = new THREE.Vector3(
          vehicle.x + Math.sin(vehicle.heading) * latestConfig.wheelbaseM * 0.3,
          0.55,
          vehicle.z + Math.cos(vehicle.heading) * latestConfig.wheelbaseM * 0.3
        );
        camera.position.lerp(behind, 0.08);
        controls.target.lerp(target, 0.1);
      }

      controls.update();
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };

    animate();

    const rebuild = () => buildVehicleModel(configRef.current, frameRef.current.telemetry.activeWheels);
    mount.__rebuildVehicle = rebuild;
    mount.__setGroundSurface = applyGroundSurface;

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      controls.dispose();
      if (floorTexture) {
        floorTexture.dispose();
      }
      disposeGrid(minorGrid);
      disposeGrid(majorGrid);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      delete mount.__rebuildVehicle;
      delete mount.__setGroundSurface;
    };
  }, []);

  useEffect(() => {
    if (mountRef.current?.__rebuildVehicle) {
      mountRef.current.__rebuildVehicle();
    }
  }, [
    config.driveLayout,
    config.wheelDiameterM,
    config.trackWidthM,
    config.wheelbaseM,
  ]);

  useEffect(() => {
    if (mountRef.current?.__setGroundSurface) {
      mountRef.current.__setGroundSurface(config.groundSurface);
    }
  }, [config.groundSurface]);

  const groundSurface = getGroundSurface(config.groundSurface);

  return (
    <div className="scene-shell">
      <div ref={mountRef} className="scene-canvas" />
      <div className="scene-overlay scene-overlay-top">
        <div>
          <span className="scene-title">3D Test Pad</span>
          <span className="scene-subtitle">
            {groundSurface.label} - 5 ft grid - grip {formatNumber(config.tireFrictionG, 2)} g
          </span>
        </div>
        <div className="scene-readouts">
          <span>{formatNumber(metersPerSecondToMph(frame.vehicleState.speedMps))} mph</span>
          <span>{formatNumber((frame.vehicleState.yawRateRad * 180) / Math.PI, 1)} deg/s</span>
          <span>{formatNumber(metersToFeet(frame.vehicleState.distanceM), 1)} ft</span>
          <span>slip {formatNumber(frame.vehicleState.slipRatio * 100, 0)}%</span>
        </div>
      </div>
      <div className="scene-overlay scene-overlay-bottom">
        <span>x {formatNumber(metersToFeet(frame.vehicleState.x), 1)} ft</span>
        <span>z {formatNumber(metersToFeet(frame.vehicleState.z), 1)} ft</span>
        <span>heading {formatNumber((frame.vehicleState.heading * 180) / Math.PI, 1)} deg</span>
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({ label, value, unit, min, max, step, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="number-row">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <em>{unit}</em>
      </div>
    </label>
  );
}

function ConvertedNumberField({
  label,
  siValue,
  unit,
  min,
  max,
  step,
  digits = 1,
  toDisplay,
  fromDisplay,
  onChange,
}) {
  return (
    <NumberField
      label={label}
      value={formatNumber(toDisplay(siValue), digits)}
      unit={unit}
      min={min}
      max={max}
      step={step}
      onChange={(displayValue) => onChange(fromDisplay(displayValue))}
    />
  );
}

function SliderField({ label, value, min = -1, max = 1, step = 0.01, onChange, disabled }) {
  return (
    <label className={classNames("field", disabled && "disabled-field")}>
      <span>
        {label}
        <strong>{formatNumber(value, 2)}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ToggleButton({ active, onClick, children, tone = "default", disabled }) {
  return (
    <button
      type="button"
      className={classNames("toggle-button", active && "active", tone)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function VehiclePanel({ config, setConfig }) {
  const update = (patch) => setConfig((current) => ({ ...current, ...patch }));
  const updateGroundSurface = (groundSurface) => {
    const surface = getGroundSurface(groundSurface);
    update({
      groundSurface,
      ...(surface.tireFrictionG == null ? {} : { tireFrictionG: surface.tireFrictionG }),
    });
  };
  const updateTireGrip = (tireFrictionG) => {
    update({ groundSurface: GROUND_SURFACE_CUSTOM_ID, tireFrictionG });
  };

  return (
    <aside className="side-panel left-panel">
      <div className="panel-heading">
        <SlidersHorizontal size={17} />
        <h2>Vehicle</h2>
      </div>

      <div className="panel-section">
        <SelectField
          label="Drive layout"
          value={config.driveLayout}
          onChange={(driveLayout) => update({ driveLayout })}
          options={[
            { value: "four-wheel", label: "Four wheel" },
            { value: "two-wheel-front", label: "Two wheel front" },
            { value: "two-wheel-rear", label: "Two wheel rear" },
          ]}
        />
        <SelectField
          label="Mix mode"
          value={config.mixMode}
          onChange={(mixMode) => update({ mixMode })}
          options={[
            { value: "skid-steer", label: "Skid steer" },
            { value: "same-power", label: "Same power" },
          ]}
        />
        <SelectField
          label="Control mode"
          value={config.controlMode}
          onChange={(controlMode) => update({ controlMode })}
          options={[
            { value: "current-rel", label: "Current relative" },
            { value: "current", label: "Current amps" },
            { value: "duty", label: "Duty" },
            { value: "rpm", label: "RPM" },
          ]}
        />
      </div>

      <div className="panel-section grid-two">
        <ConvertedNumberField
          label="Wheel diameter"
          siValue={config.wheelDiameterM}
          unit="in"
          min="2"
          max="80"
          step="0.1"
          toDisplay={metersToInches}
          fromDisplay={(value) => value * IN_TO_M}
          onChange={(wheelDiameterM) => update({ wheelDiameterM })}
        />
        <ConvertedNumberField
          label="Track width"
          siValue={config.trackWidthM}
          unit="ft"
          min="0.7"
          max="16"
          step="0.1"
          toDisplay={metersToFeet}
          fromDisplay={(value) => value * FT_TO_M}
          onChange={(trackWidthM) => update({ trackWidthM })}
        />
        <ConvertedNumberField
          label="Wheelbase"
          siValue={config.wheelbaseM}
          unit="ft"
          min="0.7"
          max="20"
          step="0.1"
          toDisplay={metersToFeet}
          fromDisplay={(value) => value * FT_TO_M}
          onChange={(wheelbaseM) => update({ wheelbaseM })}
        />
        <ConvertedNumberField
          label="Mass"
          siValue={config.massKg}
          unit="lb"
          min="2"
          max="11000"
          step="1"
          digits={0}
          toDisplay={kilogramsToPounds}
          fromDisplay={(value) => value * LB_TO_KG}
          onChange={(massKg) => update({ massKg })}
        />
      </div>

      <div className="panel-section">
        <SelectField
          label="Ground"
          value={config.groundSurface}
          onChange={updateGroundSurface}
          options={groundSurfaces.map((surface) => ({
            value: surface.id,
            label:
              surface.tireFrictionG == null
                ? surface.label
                : `${surface.label} (${formatNumber(surface.tireFrictionG, 2)} g)`,
          }))}
        />
        <ConvertedNumberField
          label="Max speed"
          siValue={config.maxSpeedMps}
          unit="mph"
          min="0.2"
          max="55"
          step="0.1"
          toDisplay={metersPerSecondToMph}
          fromDisplay={(value) => value * MPH_TO_MPS}
          onChange={(maxSpeedMps) => update({ maxSpeedMps })}
        />
        <NumberField
          label="Max command"
          value={config.maxCommand}
          unit="cmd"
          min="0"
          max="1"
          step="0.01"
          onChange={(maxCommand) => update({ maxCommand })}
        />
        <div className="grid-two nested-grid">
          <ConvertedNumberField
            label="Drive force"
            siValue={config.driveForceN}
            unit="lbf"
            min="5"
            max="2000"
            step="5"
            digits={0}
            toDisplay={newtonsToPoundsForce}
            fromDisplay={(value) => value * LBF_TO_N}
            onChange={(driveForceN) => update({ driveForceN })}
          />
          <ConvertedNumberField
            label="Brake force"
            siValue={config.brakeForceN}
            unit="lbf"
            min="5"
            max="3000"
            step="5"
            digits={0}
            toDisplay={newtonsToPoundsForce}
            fromDisplay={(value) => value * LBF_TO_N}
            onChange={(brakeForceN) => update({ brakeForceN })}
          />
        </div>
        <NumberField
          label="Tire grip"
          value={formatNumber(config.tireFrictionG, 2)}
          unit="g"
          min="0.1"
          max="1.5"
          step="0.05"
          onChange={updateTireGrip}
        />
        <SliderField
          label="Accel rate"
          min={0.05}
          max={4}
          step={0.05}
          value={config.accelRatePerSec}
          onChange={(accelRatePerSec) => update({ accelRatePerSec })}
        />
        <SliderField
          label="Decel rate"
          min={0.05}
          max={5}
          step={0.05}
          value={config.decelRatePerSec}
          onChange={(decelRatePerSec) => update({ decelRatePerSec })}
        />
      </div>
    </aside>
  );
}

function ControlsPanel({ playback, setPlayback, manualInput, setManualInput, liveInput, frame, config, setConfig }) {
  const scenario = getScenario(playback.scenario);
  const scenarioDriven = playback.scenario !== "manual";
  const visibleInput = scenarioDriven ? liveInput : manualInput;
  const patchInput = (patch) => setManualInput((current) => ({ ...current, ...patch }));

  return (
    <aside className="side-panel right-panel">
      <div className="panel-heading">
        <Gauge size={17} />
        <h2>Controls</h2>
      </div>

      <div className="panel-section">
        <SelectField
          label="Scenario"
          value={playback.scenario}
          onChange={(nextScenario) => setPlayback((current) => ({ ...current, scenario: nextScenario }))}
          options={scenarios.map((item) => ({ value: item.id, label: item.name }))}
        />
        <p className="scenario-description">{scenario.description}</p>
      </div>

      <div className="panel-section">
        <SliderField
          label="Throttle"
          value={visibleInput.throttle}
          onChange={(throttle) => patchInput({ throttle })}
          disabled={scenarioDriven}
        />
        <SliderField
          label="Steer"
          value={visibleInput.steer}
          onChange={(steer) => patchInput({ steer })}
          disabled={scenarioDriven || config.mixMode === "same-power"}
        />
        <div className="button-grid">
          <ToggleButton
            active={visibleInput.enable}
            onClick={() => patchInput({ enable: !manualInput.enable })}
            tone="enable"
            disabled={scenarioDriven}
          >
            Enable
          </ToggleButton>
          <ToggleButton
            active={visibleInput.brake}
            onClick={() => patchInput({ brake: !manualInput.brake })}
            tone="brake"
            disabled={scenarioDriven}
          >
            <CircleStop size={14} />
            Brake
          </ToggleButton>
        </div>
        <div className="button-grid">
          <ToggleButton
            active={visibleInput.cruiseRequest}
            onClick={() => patchInput({ cruiseRequest: !manualInput.cruiseRequest })}
            disabled={scenarioDriven || config.cruiseMode === "off"}
          >
            Cruise
          </ToggleButton>
          <ToggleButton
            active={visibleInput.cruiseCancel}
            onClick={() => patchInput({ cruiseCancel: !manualInput.cruiseCancel })}
            disabled={scenarioDriven || config.cruiseMode === "off"}
          >
            Cancel
          </ToggleButton>
        </div>
      </div>

      <div className="panel-section">
        <SelectField
          label="Enable mode"
          value={config.enableMode}
          onChange={(enableMode) => setConfig((current) => ({ ...current, enableMode }))}
          options={[
            { value: "local-gpio", label: "Local GPIO" },
            { value: "always", label: "Always" },
          ]}
        />
        <SelectField
          label="Brake mode"
          value={config.brakeMode}
          onChange={(brakeMode) => setConfig((current) => ({ ...current, brakeMode }))}
          options={[
            { value: "off", label: "Off" },
            { value: "local-gpio", label: "Local GPIO" },
            { value: "local-adc", label: "Local ADC" },
            { value: "can-adc", label: "CAN ADC" },
          ]}
        />
        <SelectField
          label="Cruise mode"
          value={config.cruiseMode}
          onChange={(cruiseMode) => setConfig((current) => ({ ...current, cruiseMode }))}
          options={[
            { value: "off", label: "Off" },
            { value: "local-gpio", label: "Local GPIO" },
          ]}
        />
      </div>

      <div className="panel-section fault-section">
        <div className="section-label">
          <AlertTriangle size={14} />
          Fault injectors
        </div>
        <div className="button-grid">
          <ToggleButton
            active={visibleInput.adcFault}
            onClick={() => patchInput({ adcFault: !manualInput.adcFault })}
            tone="fault"
            disabled={scenarioDriven}
          >
            ADC
          </ToggleButton>
          <ToggleButton
            active={visibleInput.thermalFault}
            onClick={() => patchInput({ thermalFault: !manualInput.thermalFault })}
            tone="fault"
            disabled={scenarioDriven}
          >
            Thermal
          </ToggleButton>
          <ToggleButton
            active={visibleInput.motorStatusStale}
            onClick={() => patchInput({ motorStatusStale: !manualInput.motorStatusStale })}
            tone="fault"
            disabled={scenarioDriven}
          >
            Motor stale
          </ToggleButton>
          <ToggleButton
            active={visibleInput.staleCan}
            onClick={() => patchInput({ staleCan: !manualInput.staleCan })}
            tone="fault"
            disabled={scenarioDriven}
          >
            CAN stale
          </ToggleButton>
        </div>
      </div>

      <div className="panel-section todo-section">
        <div className="section-label">
          <Route size={14} />
          Next fidelity TODO
        </div>
        <ul>
          {TODO_ITEMS.map((item) => (
            <li key={item.label} className={item.done ? "done" : undefined}>
              <input type="checkbox" readOnly checked={item.done} />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel-section compact-readout">
        <span>ADC throttle {formatNumber(frame.telemetry.sample.throttleVoltage, 2)} V</span>
        <span>ADC steer {formatNumber(frame.telemetry.sample.steerVoltage, 2)} V</span>
      </div>
    </aside>
  );
}

function StatusChip({ label, value, tone }) {
  return (
    <div className={classNames("status-chip", tone)}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TelemetryChart({ history }) {
  const width = 900;
  const height = 108;
  const samples = history.slice(-180);
  const makePath = (selector, scale = 1) => {
    if (samples.length < 2) {
      return "";
    }
    return samples
      .map((sample, index) => {
        const x = (index / (samples.length - 1)) * width;
        const rawValue = selector(sample);
        const value = Number.isFinite(rawValue) ? rawValue : 0;
        const y = height * 0.5 - value * scale * height * 0.42;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  };

  return (
    <svg className="telemetry-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Telemetry chart">
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} className="chart-axis" />
      <path d={makePath((sample) => sample.leftCommand)} className="chart-line left" />
      <path d={makePath((sample) => sample.rightCommand)} className="chart-line right" />
      <path d={makePath((sample) => sample.speedMps, 0.18)} className="chart-line speed" />
      <path d={makePath((sample) => sample.slipRatio)} className="chart-line slip" />
    </svg>
  );
}

function TelemetryPanel({ frame }) {
  const telemetry = frame.telemetry;
  const faultTone = telemetry.faultLatched ? "fault" : "quiet";

  return (
    <section className="telemetry-panel">
      <div className="telemetry-header">
        <div className="panel-heading">
          <Zap size={17} />
          <h2>Telemetry</h2>
        </div>
        <div className="status-row">
          <StatusChip label="Armed" value={telemetry.armed ? "yes" : "no"} tone={telemetry.armed ? "ok" : "quiet"} />
          <StatusChip label="Fault" value={telemetry.faultReason} tone={faultTone} />
          <StatusChip label="State" value={telemetry.state} tone={telemetry.state === "drive" ? "ok" : "quiet"} />
          <StatusChip label="Cruise" value={telemetry.cruiseActive ? "on" : "off"} tone={telemetry.cruiseActive ? "warn" : "quiet"} />
          <StatusChip label="Logic" value={telemetry.lispDirect ? "Lisp" : "error"} tone={telemetry.lispDirect ? "ok" : "fault"} />
          <StatusChip
            label="Slip"
            value={`${formatNumber(frame.vehicleState.slipRatio * 100, 0)}%`}
            tone={frame.vehicleState.tractionLimited ? "warn" : "quiet"}
          />
          <StatusChip
            label="Accel"
            value={`${formatNumber(metersPerSecondSquaredToFeet(frame.vehicleState.accelerationMps2), 1)} ft/s2`}
            tone="quiet"
          />
        </div>
      </div>

      <div className="telemetry-content">
        <div className="chart-wrap">
          <TelemetryChart history={frame.history} />
          <div className="chart-legend">
            <span className="legend-left">left command</span>
            <span className="legend-right">right command</span>
            <span className="legend-speed">speed</span>
            <span className="legend-slip">slip</span>
          </div>
        </div>
        <div className="can-panel">
          <h3>CAN Out</h3>
          <div className="can-list">
            {telemetry.canOut.map((command) => (
              <div className="can-row" key={`${command.id}-${command.wheel}`}>
                <span>{command.id}</span>
                <strong>{command.wheel}</strong>
                <em>{command.fn}</em>
                <b>{formatNumber(command.value, 3)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [config, setConfig] = useState(defaultVehicleConfig);
  const [manualInput, setManualInput] = useState({ ...defaultControlInput, enable: false });
  const [playback, setPlayback] = useState({ running: false, scenario: "manual", speed: 1 });
  const [followCamera, setFollowCamera] = useState(true);

  const controllerRef = useRef(new SkidController(config));
  const simTimeRef = useRef(0);
  const vehicleRef = useRef(createInitialVehicleState());
  const manualInputRef = useRef(manualInput);
  const configRef = useRef(config);
  const playbackRef = useRef(playback);
  const [frame, setFrame] = useState(() => createInitialFrame(config, controllerRef.current, manualInput));

  useEffect(() => {
    manualInputRef.current = manualInput;
  }, [manualInput]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    playbackRef.current = playback;
  }, [playback]);

  const resetSimulation = useCallback(() => {
    controllerRef.current = new SkidController(configRef.current);
    simTimeRef.current = 0;
    vehicleRef.current = createInitialVehicleState();
    const input = playbackRef.current.scenario === "manual"
      ? manualInputRef.current
      : sampleScenario(playbackRef.current.scenario, 0) || manualInputRef.current;
    const telemetry = controllerRef.current.step(input, configRef.current, 0, 0);
    setFrame({
      telemetry,
      vehicleState: vehicleRef.current,
      input,
      history: [],
    });
  }, []);

  const advanceSimulation = useCallback((dt) => {
    const currentConfig = configRef.current;
    simTimeRef.current += dt;
    const scenarioInput =
      playbackRef.current.scenario === "manual"
        ? null
        : sampleScenario(playbackRef.current.scenario, simTimeRef.current);
    const input = scenarioInput || manualInputRef.current;
    const telemetry = controllerRef.current.step(input, currentConfig, dt, simTimeRef.current);
    vehicleRef.current = stepVehicle(vehicleRef.current, telemetry, currentConfig, dt);

    setFrame((currentFrame) => {
      const nextSample = {
        time: simTimeRef.current,
        leftCommand: telemetry.leftCommand,
        rightCommand: telemetry.rightCommand,
        speedMps: vehicleRef.current.speedMps,
        yawRateRad: vehicleRef.current.yawRateRad,
        slipRatio: vehicleRef.current.slipRatio,
        accelerationMps2: vehicleRef.current.accelerationMps2,
        throttle: telemetry.throttle,
        steer: telemetry.steer,
        armed: telemetry.armed,
        fault: telemetry.faultLatched,
      };
      return {
        telemetry,
        vehicleState: vehicleRef.current,
        input,
        history: [...currentFrame.history.slice(-240), nextSample],
      };
    });
  }, []);

  useEffect(() => {
    let raf = 0;
    let previous = performance.now();

    const tick = (now) => {
      const rawDt = Math.min((now - previous) / 1000, 0.06);
      previous = now;

      if (playbackRef.current.running) {
        advanceSimulation(rawDt * playbackRef.current.speed);
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [advanceSimulation]);

  useEffect(() => {
    resetSimulation();
  }, [
    config.driveLayout,
    config.mixMode,
    config.controlMode,
    config.inputMode,
    config.directionMode,
    config.enableMode,
    config.brakeMode,
    config.cruiseMode,
    config.cruiseCancelMode,
    config.cruiseLatchMode,
    config.wheelDiameterM,
    config.trackWidthM,
    config.wheelbaseM,
    config.massKg,
    config.maxSpeedMps,
    config.driveForceN,
    config.brakeForceN,
    config.tireFrictionG,
    resetSimulation,
  ]);

  const speedOptions = useMemo(
    () => [
      { value: 0.25, label: "0.25x" },
      { value: 0.5, label: "0.5x" },
      { value: 1, label: "1x" },
      { value: 2, label: "2x" },
      { value: 4, label: "4x" },
    ],
    []
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">SC</div>
          <div>
            <h1>SkidCopter Simulator</h1>
            <span>LispBM source direct vehicle operation</span>
          </div>
        </div>

        <div className="transport">
          <button
            type="button"
            className="primary-action"
            onClick={() => setPlayback((current) => ({ ...current, running: !current.running }))}
          >
            {playback.running ? <Pause size={16} /> : <Play size={16} />}
            {playback.running ? "Pause" : "Run"}
          </button>
          <button type="button" onClick={() => advanceSimulation(config.loopPeriodSec)}>
            <StepForward size={16} />
            Step
          </button>
          <button type="button" onClick={resetSimulation}>
            <RotateCcw size={16} />
            Reset
          </button>
          <label className="speed-select">
            <span>Speed</span>
            <select
              value={playback.speed}
              onChange={(event) => setPlayback((current) => ({ ...current, speed: Number(event.target.value) }))}
            >
              {speedOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <ToggleButton active={followCamera} onClick={() => setFollowCamera((current) => !current)}>
            Follow camera
          </ToggleButton>
        </div>
      </header>

      <main className="workspace">
        <VehiclePanel config={config} setConfig={setConfig} />
        <section className="center-stage">
          <VehicleScene config={config} frame={frame} followCamera={followCamera} />
        </section>
        <ControlsPanel
          playback={playback}
          setPlayback={setPlayback}
          manualInput={manualInput}
          setManualInput={setManualInput}
          liveInput={frame.input}
          frame={frame}
          config={config}
          setConfig={setConfig}
        />
      </main>

      <TelemetryPanel frame={frame} />
    </div>
  );
}

export default App;
