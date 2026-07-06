export const GROUND_SURFACE_CUSTOM_ID = "custom";

export const groundSurfaces = [
  {
    id: "asphalt",
    label: "Asphalt",
    tireFrictionG: 0.85,
    visual: {
      texture: "asphalt",
      roughness: 0.9,
      minorGridCenterColor: 0x78909c,
      minorGridLineColor: 0x54666f,
      majorGridCenterColor: 0xd1e6ee,
      majorGridLineColor: 0x8aa4b1,
      gridOpacity: 0.86,
    },
  },
  {
    id: "sand",
    label: "Sand",
    tireFrictionG: 0.3,
    visual: {
      texture: "sand",
      roughness: 0.98,
      minorGridCenterColor: 0x6c5b3f,
      minorGridLineColor: 0x8b754e,
      majorGridCenterColor: 0x2a2a2a,
      majorGridLineColor: 0x4f4028,
      gridOpacity: 0.8,
    },
  },
  {
    id: "burning-man",
    label: "Burning Man",
    tireFrictionG: 0.38,
    visual: {
      texture: "playa",
      roughness: 1,
      minorGridCenterColor: 0x635f55,
      minorGridLineColor: 0x888070,
      majorGridCenterColor: 0x252525,
      majorGridLineColor: 0x514b42,
      gridOpacity: 0.82,
    },
  },
  {
    id: "grass",
    label: "Grass",
    tireFrictionG: 0.45,
    visual: {
      texture: "grass",
      roughness: 0.94,
      minorGridCenterColor: 0x8ed0a3,
      minorGridLineColor: 0x5d8f67,
      majorGridCenterColor: 0xe2f6d7,
      majorGridLineColor: 0xa7d08e,
      gridOpacity: 0.84,
    },
  },
  {
    id: GROUND_SURFACE_CUSTOM_ID,
    label: "Custom",
    tireFrictionG: null,
    visual: {
      texture: "custom",
      roughness: 0.86,
      minorGridCenterColor: 0x36505f,
      minorGridLineColor: 0x253743,
      majorGridCenterColor: 0x668da0,
      majorGridLineColor: 0x3f5967,
      gridOpacity: 0.88,
    },
  },
];

export function getGroundSurface(id) {
  return groundSurfaces.find((surface) => surface.id === id) || groundSurfaces[0];
}
