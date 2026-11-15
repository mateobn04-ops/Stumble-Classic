import * as THREE from 'three';
import { MapId } from './types';
import {
  createCheckerTexture,
  createChevronTexture,
  createHazardStripeTexture,
  createTrackGridTexture,
} from './textures';

export interface StaticPlatform {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  slippery?: boolean;
  conveyorZ?: number;
  bounceY?: number;
  slopeRise?: number; // If > 0, top surface slopes from y (at z+d/2) up to y+slopeRise (at z-d/2)
}

export interface MovingPlatform {
  mesh: THREE.Object3D;
  baseX: number;
  baseY: number;
  baseZ: number;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  ampX: number;
  ampY: number;
  ampZ: number;
  speed: number;
  phase: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  isPushWall?: boolean;
}

export interface SpinnerHazard {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  armLength: number; // half-span from center
  armRadius: number;
  armCount: number; // 2 = single bar, 4 = X-cross
  angularSpeed: number;
  angle: number;
  knockForce: number;
}

export interface HammerHazard {
  pivot: THREE.Group;
  pivotX: number;
  pivotY: number;
  pivotZ: number;
  armLen: number;
  headRadius: number;
  swingAxis: 'x' | 'z';
  ampAngle: number;
  speed: number;
  phase: number;
  headWorldPos: THREE.Vector3;
}

export interface BumperHazard {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  bounceForce: number;
  pulse: number;
}

export interface RollingBall {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vz: number;
  vx: number;
  radius: number;
  startZ: number;
  endZ: number;
  startY: number;
  slopePerMeter: number;
}

export interface HexTile {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  radius: number;
  layer: number;
  state: 'solid' | 'shaking' | 'fallen';
  timer: number;
  baseColor: number;
}

export interface DashBlock {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  vz: number;
  breakable: boolean;
  broken: boolean;
  baseX?: number;
  oscAmpX?: number;
  oscSpeed?: number;
  recycleSpan?: number;
}

export interface DashLaser {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  halfW: number;
  radius: number;
  vz: number;
  lethal: boolean;
  recycleSpan: number;
}

export interface LaserBeam {
  pivot: THREE.Group;
  y: number;
  length: number;
  radius: number;
  angle: number;
  angularSpeed: number;
}

export interface CheckpointZone {
  z: number;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
}

export interface LevelInstance {
  group: THREE.Group;
  platforms: StaticPlatform[];
  movers: MovingPlatform[];
  spinners: SpinnerHazard[];
  hammers: HammerHazard[];
  bumpers: BumperHazard[];
  balls: RollingBall[];
  hexTiles: HexTile[];
  dashBlocks: DashBlock[];
  dashLasers: DashLaser[];
  laserBeams: LaserBeam[];
  checkpoints: CheckpointZone[];
  waypoints: THREE.Vector3[];
  finishZ: number;
  finishY: number;
  fallLimitY: number;
  spawnBounds: { minX: number; maxX: number; z: number; y: number };
  skyColor: number;
  isBlockDash?: boolean;
  isLaserTracer?: boolean;
  dispose: () => void;
}

function addBoxMesh(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  castShadow = false,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y - h / 2, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createSkyDecorations(sceneGroup: THREE.Group): THREE.Group[] {
  const clouds: THREE.Group[] = [];
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
  });
  const puffGeo = new THREE.SphereGeometry(1, 12, 10);

  for (let i = 0; i < 18; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + (i % 3);
    for (let p = 0; p < puffs; p++) {
      const m = new THREE.Mesh(puffGeo, cloudMat);
      const s = 2.2 + ((p * 1.3 + i) % 2.4);
      m.scale.set(s * 1.3, s * 0.72, s);
      m.position.set((p - (puffs - 1) / 2) * 2.4, (p % 2) * 0.6, (p % 3 - 1) * 0.8);
      cloud.add(m);
    }
    const side = i % 2 === 0 ? -1 : 1;
    cloud.position.set(
      side * (26 + (i % 5) * 11),
      4 + (i % 6) * 5.5,
      10 - i * 11,
    );
    sceneGroup.add(cloud);
    clouds.push(cloud);
  }
  return clouds;
}

export function buildLevel(mapId: MapId, anisotropy: number): LevelInstance {
  const group = new THREE.Group();
  const platforms: StaticPlatform[] = [];
  const movers: MovingPlatform[] = [];
  const spinners: SpinnerHazard[] = [];
  const hammers: HammerHazard[] = [];
  const bumpers: BumperHazard[] = [];
  const balls: RollingBall[] = [];
  const hexTiles: HexTile[] = [];
  const dashBlocks: DashBlock[] = [];
  const dashLasers: DashLaser[] = [];
  const laserBeams: LaserBeam[] = [];
  const checkpoints: CheckpointZone[] = [];
  const waypoints: THREE.Vector3[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  const trackTexCyan = createTrackGridTexture(anisotropy, '#0ea5e9', '#bae6fd', 2, 4);
  const trackTexPink = createTrackGridTexture(anisotropy, '#ec4899', '#fbcfe8', 2, 3);
  const trackTexIce = createTrackGridTexture(anisotropy, '#7dd3fc', '#f0f9ff', 2, 4);
  const checkerTex = createCheckerTexture(anisotropy, '#ffffff', '#0f172a', 6, 2);
  const chevronTex = createChevronTexture(anisotropy, '#2563eb', '#facc15', 2, 3);
  const hazardTex = createHazardStripeTexture(anisotropy, '#facc15', '#ef4444', 4, 1);

  disposables.push(trackTexCyan, trackTexPink, trackTexIce, checkerTex, chevronTex, hazardTex);

  const cyanMat = new THREE.MeshStandardMaterial({ map: trackTexCyan, roughness: 0.55, metalness: 0.05 });
  const pinkMat = new THREE.MeshStandardMaterial({ map: trackTexPink, roughness: 0.5, metalness: 0.05 });
  const iceMat = new THREE.MeshStandardMaterial({ map: trackTexIce, roughness: 0.14, metalness: 0.12 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.1 });
  const whiteTrimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, metalness: 0.05 });
  const purpleMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.45, metalness: 0.1 });
  const checkerMat = new THREE.MeshStandardMaterial({ map: checkerTex, roughness: 0.45 });
  const chevronMat = new THREE.MeshStandardMaterial({ map: chevronTex, roughness: 0.4 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.35, metalness: 0.15 });
  const bounceMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.25, metalness: 0.15 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.85 });

  disposables.push(
    cyanMat, pinkMat, iceMat, yellowMat, whiteTrimMat, purpleMat,
    checkerMat, chevronMat, hazardMat, bounceMat, goldMat,
  );

  const addStatic = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    opts?: Partial<StaticPlatform>,
  ) => {
    addBoxMesh(group, x, y, z, w, h, d, mat);
    // Decorative side curb rim for classic chunky arcade look
    addBoxMesh(group, x, y - h + 0.3, z, w + 0.35, 0.35, d + 0.35, whiteTrimMat);
    platforms.push({ x, y, z, w, h, d, ...opts });
  };

  const addSpinner = (
    x: number,
    y: number,
    z: number,
    armLength: number,
    armCount: number,
    angularSpeed: number,
    armRadius = 0.42,
    knockForce = 15,
  ) => {
    const sg = new THREE.Group();
    sg.position.set(x, y, z);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.05, 1.3, 18),
      purpleMat,
    );
    hub.position.y = 0.45;
    hub.castShadow = true;
    sg.add(hub);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), goldMat);
    cap.position.y = 1.05;
    sg.add(cap);

    const barGeo = new THREE.CylinderGeometry(armRadius, armRadius, armLength * 2, 12);
    barGeo.rotateZ(Math.PI / 2);

    const bar1 = new THREE.Mesh(barGeo, hazardMat);
    bar1.position.y = 0.65;
    bar1.castShadow = true;
    sg.add(bar1);

    if (armCount === 4) {
      const bar2 = new THREE.Mesh(barGeo, hazardMat);
      bar2.position.y = 0.65;
      bar2.rotation.y = Math.PI / 2;
      bar2.castShadow = true;
      sg.add(bar2);
    }

    group.add(sg);
    spinners.push({
      group: sg,
      x,
      y: y + 0.65,
      z,
      armLength,
      armRadius,
      armCount,
      angularSpeed,
      angle: 0,
      knockForce,
    });
  };

  const addBumper = (
    x: number,
    y: number,
    z: number,
    radius = 1.25,
    bounceForce = 16,
  ) => {
    const bg = new THREE.Group();
    bg.position.set(x, y, z);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 1.08, 1.3, 20),
      bounceMat,
    );
    base.position.y = 0.65;
    base.castShadow = true;
    bg.add(base);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.98, 0.14, 10, 24),
      yellowMat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.25;
    bg.add(ring);

    group.add(bg);
    bumpers.push({
      mesh: bg,
      x,
      y,
      z,
      radius,
      height: 1.4,
      bounceForce,
      pulse: 0,
    });
  };

  const addHammer = (
    pivotX: number,
    pivotY: number,
    pivotZ: number,
    armLen: number,
    swingAxis: 'x' | 'z',
    ampAngle: number,
    speed: number,
    phase = 0,
  ) => {
    const pivot = new THREE.Group();
    pivot.position.set(pivotX, pivotY, pivotZ);

    // Overhead support beam
    const support = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), purpleMat);
    pivot.add(support);

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, armLen, 10),
      whiteTrimMat,
    );
    shaft.position.y = -armLen / 2;
    pivot.add(shaft);

    const head = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 2.2, 16),
      hazardMat,
    );
    head.rotation.z = swingAxis === 'z' ? 0 : Math.PI / 2;
    head.rotation.x = swingAxis === 'z' ? Math.PI / 2 : 0;
    head.position.y = -armLen;
    head.castShadow = true;
    pivot.add(head);

    group.add(pivot);
    hammers.push({
      pivot,
      pivotX,
      pivotY,
      pivotZ,
      armLen,
      headRadius: 1.15,
      swingAxis,
      ampAngle,
      speed,
      phase,
      headWorldPos: new THREE.Vector3(pivotX, pivotY - armLen, pivotZ),
    });
  };

  const addMover = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    ampX: number,
    ampY: number,
    ampZ: number,
    speed: number,
    phase: number,
    isPushWall = false,
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y - (isPushWall ? -h / 2 : h / 2), z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    movers.push({
      mesh,
      baseX: x,
      baseY: isPushWall ? y + h / 2 : y,
      baseZ: z,
      x,
      y: isPushWall ? y + h / 2 : y,
      z,
      w,
      h,
      d,
      ampX,
      ampY,
      ampZ,
      speed,
      phase,
      prevX: x,
      prevY: isPushWall ? y + h / 2 : y,
      prevZ: z,
      isPushWall,
    });
  };

  const addFinishArch = (z: number, y: number, width: number) => {
    // Checkered finish platform
    addStatic(0, y, z - 6, width, 1.4, 14, checkerMat);
    // Twin golden pillars + banner arch
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.65, 6.5, 14),
        goldMat,
      );
      pillar.position.set(side * (width / 2 - 1), y + 3.25, z);
      pillar.castShadow = true;
      group.add(pillar);
    }
    const archBeam = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.8, 1.4, 1.1),
      purpleMat,
    );
    archBeam.position.set(0, y + 6.5, z);
    archBeam.castShadow = true;
    group.add(archBeam);

    const crownOrb = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), goldMat);
    crownOrb.position.set(0, y + 8.3, z);
    group.add(crownOrb);
  };

  // =========================================================================
  // MAP 1: CIRCUITO CAOS (Classic Race Course)
  // =========================================================================
  if (mapId === 'circuito_caos') {
    // Start deck
    addStatic(0, 0, -9, 18, 1.6, 28, cyanMat);
    addBumper(-4.5, 0, -10, 1.35, 16);
    addBumper(4.5, 0, -10, 1.35, 16);
    addBumper(0, 0, -16, 1.35, 16);
    addSpinner(0, 0, -20, 7.8, 2, 1.65, 0.42, 15);

    checkpoints.push({ z: 2, spawnX: 0, spawnY: 1, spawnZ: 0 });
    waypoints.push(new THREE.Vector3(0, 0, -12), new THREE.Vector3(-4, 0, -21));

    // Twin Rotating Turntable Arena + Middle Safety Bridge
    addStatic(0, 0, -37, 22, 1.5, 24, pinkMat);
    addSpinner(-5.2, 0, -37, 5.2, 4, 1.45, 0.4, 15);
    addSpinner(5.2, 0, -37, 5.2, 4, -1.45, 0.4, 15);
    waypoints.push(new THREE.Vector3(-4.5, 0, -37), new THREE.Vector3(0, 0, -49));

    // Checkpoint 1 Deck
    addStatic(0, 0, -52, 16, 1.5, 8, yellowMat);
    checkpoints.push({ z: -49, spawnX: 0, spawnY: 1, spawnZ: -52 });

    // Stepping Islands + Moving Ferry Platforms over the void!
    addStatic(-4.5, 0, -61, 5.5, 1.2, 6, cyanMat);
    addStatic(4.5, 0, -61, 5.5, 1.2, 6, cyanMat);
    addMover(0, 0, -69, 6.2, 1.2, 5.5, pinkMat, 4.5, 0, 0, 1.3, 0);
    addStatic(-4.5, 0, -77, 5.5, 1.2, 6, cyanMat);
    addStatic(4.5, 0, -77, 5.5, 1.2, 6, cyanMat);
    waypoints.push(
      new THREE.Vector3(-4.5, 0, -61),
      new THREE.Vector3(0, 0, -69),
      new THREE.Vector3(4.5, 0, -77),
    );

    // Speed Chevron Ramp Approach + Checkpoint 2
    addStatic(0, 0, -88, 14, 1.5, 12, chevronMat, { conveyorZ: -4.5 });
    checkpoints.push({ z: -83, spawnX: 0, spawnY: 1, spawnZ: -86 });

    // Gauntlet Inclined Ramp (z: -94 to -130, y rises 0 -> 5.5)
    const rampLen = 36;
    const rampRise = 5.5;
    const rampGeo = new THREE.BoxGeometry(14, 1.5, rampLen);
    const rampMesh = new THREE.Mesh(rampGeo, pinkMat);
    const rampAngle = Math.atan2(rampRise, rampLen);
    rampMesh.position.set(0, rampRise / 2 - 0.75, -94 - rampLen / 2);
    rampMesh.rotation.x = rampAngle;
    rampMesh.receiveShadow = true;
    group.add(rampMesh);
    platforms.push({
      x: 0,
      y: 0,
      z: -94 - rampLen / 2,
      w: 14,
      h: 1.5,
      d: rampLen,
      slopeRise: rampRise,
    });

    // Swinging Hammers over the ramp
    addHammer(0, 7.6, -106, 5.2, 'z', 0.95, 2.1, 0);
    addHammer(0, 9.6, -119, 5.2, 'z', 0.95, 2.1, Math.PI);

    // Rolling Candy Boulders tumbling down the ramp!
    const ballGeo = new THREE.SphereGeometry(1.15, 16, 14);
    for (let i = 0; i < 4; i++) {
      const bm = new THREE.Mesh(ballGeo, i % 2 === 0 ? bounceMat : goldMat);
      bm.castShadow = true;
      group.add(bm);
      const startZ = -130;
      const endZ = -94;
      const laneX = (i - 1.5) * 3.1;
      const frac = i / 4;
      const curZ = THREE.MathUtils.lerp(startZ, endZ, frac);
      const slopePerMeter = rampRise / rampLen;
      const curY = (endZ - curZ) * slopePerMeter + 1.15;
      bm.position.set(laneX, curY, curZ);
      balls.push({
        mesh: bm,
        x: laneX,
        y: curY,
        z: curZ,
        vz: 11 + (i % 2) * 2.5,
        vx: 0,
        radius: 1.15,
        startZ,
        endZ,
        startY: rampRise + 1.15,
        slopePerMeter,
      });
    }

    waypoints.push(
      new THREE.Vector3(0, 2.5, -108),
      new THREE.Vector3(0, 4.5, -124),
      new THREE.Vector3(0, 5.5, -136),
    );

    addFinishArch(-131, 5.5, 16);

    return {
      group,
      platforms,
      movers,
      spinners,
      hammers,
      bumpers,
      balls,
      hexTiles,
      dashBlocks,
      dashLasers,
      laserBeams,
      checkpoints,
      waypoints,
      finishZ: -133,
      finishY: 5.5,
      fallLimitY: -12,
      spawnBounds: { minX: -7.5, maxX: 7.5, z: 2, y: 0.6 },
      skyColor: 0x38bdf8,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // =========================================================================
  // MAP 2: CIMA HELADA (Icy Heights & Pivot Push)
  // =========================================================================
  if (mapId === 'cima_helada') {
    // Icy Start + Sliding Push Walls
    addStatic(0, 0, -11, 16, 1.5, 30, iceMat, { slippery: true });
    addMover(0, 0, -9, 5.5, 2.2, 2.0, hazardMat, 5.0, 0, 0, 2.0, 0, true);
    addMover(0, 0, -17, 5.5, 2.2, 2.0, hazardMat, 5.0, 0, 0, 2.0, Math.PI, true);
    addMover(0, 0, -23, 4.5, 2.2, 2.0, hazardMat, 5.5, 0, 0, 2.3, 1.2, true);

    checkpoints.push({ z: 2, spawnX: 0, spawnY: 1, spawnZ: 0 });
    waypoints.push(new THREE.Vector3(0, 0, -12), new THREE.Vector3(0, 0, -25));

    // Three Rotating Turnstile Islands
    addStatic(0, 0, -34, 12, 1.4, 12, pinkMat);
    addSpinner(0, 0, -34, 5.6, 4, 1.55, 0.42, 16);

    addStatic(-5, 0, -48, 10, 1.4, 10, cyanMat);
    addStatic(5, 0, -48, 10, 1.4, 10, cyanMat);
    addSpinner(-5, 0, -48, 4.6, 4, -1.7, 0.4, 16);
    addSpinner(5, 0, -48, 4.6, 4, 1.7, 0.4, 16);

    addStatic(0, 0, -61, 12, 1.4, 10, yellowMat);
    checkpoints.push({ z: -57, spawnX: 0, spawnY: 1, spawnZ: -60 });
    waypoints.push(
      new THREE.Vector3(0, 0, -34),
      new THREE.Vector3(5, 0, -48),
      new THREE.Vector3(0, 0, -61),
    );

    // Bouncy Jump Pads up to High Ice Skybridge!
    addStatic(0, 0, -71, 14, 1.4, 6, bounceMat, { bounceY: 17 });
    addStatic(0, 3.5, -88, 13, 1.5, 22, iceMat, { slippery: true });
    checkpoints.push({ z: -79, spawnX: 0, spawnY: 4.5, spawnZ: -81 });

    // Dual Overhead Hammers on High Ice Bridge
    addHammer(-2.8, 9.2, -86, 4.9, 'z', 0.9, 2.3, 0);
    addHammer(2.8, 9.2, -93, 4.9, 'z', 0.9, 2.3, Math.PI);

    // Moving Platforms & Plancha Dive Gap to Finish
    addMover(-3.5, 3.5, -106, 5.5, 1.3, 7, cyanMat, 0, 0, 3.0, 1.6, 0);
    addMover(3.5, 3.5, -106, 5.5, 1.3, 7, pinkMat, 0, 0, 3.0, 1.6, Math.PI);
    addStatic(0, 3.5, -120, 12, 1.5, 10, chevronMat, { conveyorZ: -4.0 });

    waypoints.push(
      new THREE.Vector3(0, 0.2, -71),
      new THREE.Vector3(0, 4.0, -88),
      new THREE.Vector3(-3.5, 4.0, -106),
      new THREE.Vector3(0, 4.0, -120),
      new THREE.Vector3(0, 4.0, -132),
    );

    // Gap from z:-125 to z:-129 -> jump + dive to finish!
    addFinishArch(-129.5, 3.5, 16);

    return {
      group,
      platforms,
      movers,
      spinners,
      hammers,
      bumpers,
      balls,
      hexTiles,
      dashBlocks,
      dashLasers,
      laserBeams,
      checkpoints,
      waypoints,
      finishZ: -131.5,
      finishY: 3.5,
      fallLimitY: -12,
      spawnBounds: { minX: -6.5, maxX: 6.5, z: 2, y: 0.6 },
      skyColor: 0x0284c7,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // =========================================================================
  // MAP 3: HEXÁGONOS CLÁSICOS (3-Tier Honey Drop Survival!)
  // =========================================================================
  if (mapId === 'hexagonos') {
    const hexRadius = 1.95;
    const hexGeo = new THREE.CylinderGeometry(hexRadius * 0.94, hexRadius * 0.88, 0.55, 6);
    disposables.push(hexGeo);

    const layers = [
      { y: 11, rings: 3, color: 0xfacc15 },
      { y: 5.5, rings: 4, color: 0xf97316 },
      { y: 0, rings: 4, color: 0x06b6d4 },
    ];

    const dx = hexRadius * 1.78;
    const dz = hexRadius * 1.54;

    layers.forEach((layerCfg, layerIdx) => {
      for (let q = -layerCfg.rings; q <= layerCfg.rings; q++) {
        for (let r = -layerCfg.rings; r <= layerCfg.rings; r++) {
          if (Math.abs(q + r) > layerCfg.rings) continue;
          const hx = (q + r * 0.5) * dx;
          const hz = r * dz;
          const mat = new THREE.MeshStandardMaterial({
            color: layerCfg.color,
            roughness: 0.38,
            metalness: 0.1,
          });
          disposables.push(mat);
          const tileMesh = new THREE.Mesh(hexGeo, mat);
          tileMesh.position.set(hx, layerCfg.y - 0.275, hz);
          tileMesh.receiveShadow = true;
          tileMesh.castShadow = true;
          group.add(tileMesh);
          hexTiles.push({
            mesh: tileMesh,
            x: hx,
            y: layerCfg.y,
            z: hz,
            radius: hexRadius * 0.94,
            layer: layerIdx,
            state: 'solid',
            timer: 0,
            baseColor: layerCfg.color,
          });
        }
      }
    });

    return {
      group,
      platforms,
      movers,
      spinners,
      hammers,
      bumpers,
      balls,
      hexTiles,
      dashBlocks,
      dashLasers,
      laserBeams,
      checkpoints,
      waypoints,
      finishZ: -999,
      finishY: 0,
      fallLimitY: -8,
      spawnBounds: { minX: -5, maxX: 5, z: 0, y: 11.6 },
      skyColor: 0x1d4ed8,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // =========================================================================
  // MAP 4 (0.56): BLOCK DASH (Hard Multi-Tier Waves + Lethal Red Lasers!)
  // =========================================================================
  if (mapId === 'block_dash') {
    const neonFloorMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.35,
      metalness: 0.2,
    });
    const neonRimMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.5,
      roughness: 0.25,
    });
    const solidBlockMat = new THREE.MeshStandardMaterial({
      color: 0x9333ea,
      emissive: 0x581c87,
      emissiveIntensity: 0.4,
      roughness: 0.28,
    });
    const highBlockMat = new THREE.MeshStandardMaterial({
      color: 0x6d28d9,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.45,
      roughness: 0.28,
    });
    const movingBlockMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0e7490,
      emissiveIntensity: 0.5,
      roughness: 0.25,
    });
    const crackBlockMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0x9f1239,
      emissiveIntensity: 0.5,
      roughness: 0.4,
    });
    const lethalLaserMat = new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      emissive: 0xef4444,
      emissiveIntensity: 1.4,
      roughness: 0.1,
    });
    const emitterMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0xdc2626,
      emissiveIntensity: 0.45,
      roughness: 0.35,
    });
    disposables.push(
      neonFloorMat,
      neonRimMat,
      solidBlockMat,
      highBlockMat,
      movingBlockMat,
      crackBlockMat,
      lethalLaserMat,
      emitterMat,
    );

    // Arena platform
    addBoxMesh(group, 0, 0, 0, 18, 1.8, 22, neonFloorMat);
    addBoxMesh(group, 0, -1.5, 0, 18.6, 0.4, 22.6, neonRimMat);
    platforms.push({ x: 0, y: 0, z: 0, w: 18, h: 1.8, d: 22 });

    // Side neon rails
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 22), neonRimMat);
      rail.position.set(side * 9.1, 0.4, 0);
      group.add(rail);
    }

    const blockGeo = new THREE.BoxGeometry(3.2, 1.55, 1.85);
    const emitterGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.7, 10);
    disposables.push(blockGeo, emitterGeo);

    const waveSpeed = 9.6;
    const recycleSpan = 96;

    // 8 Hard Staggered Waves:
    // 0 = gap, 1 = 1-high block, 2 = 2-high towering wall (unjumpable),
    // 'B' = breakable block (dive/punch), 'M' = sliding side-to-side block
    type CellType = 0 | 1 | 2 | 'B' | 'M';
    const hardWaves: Array<{ z: number; cells: [CellType, CellType, CellType, CellType, CellType] }> = [
      { z: -20, cells: [2, 1, 0, 2, 1] },
      { z: -31, cells: [2, 2, 'B', 2, 2] },
      { z: -41, cells: [1, 2, 1, 2, 0] },
      { z: -52, cells: ['M', 0, 2, 0, 'M'] },
      { z: -63, cells: [2, 'B', 2, 'B', 2] },
      { z: -74, cells: [1, 1, 2, 1, 1] },
      { z: -85, cells: [2, 2, 1, 'B', 2] },
      { z: -96, cells: [0, 2, 'M', 2, 0] },
    ];

    const spawnDashBlock = (
      bx: number,
      by: number,
      bz: number,
      breakable: boolean,
      mat: THREE.Material,
      oscAmpX?: number,
      oscSpeed?: number,
    ) => {
      const mesh = new THREE.Mesh(blockGeo, mat);
      mesh.position.set(bx, by, bz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      dashBlocks.push({
        mesh,
        x: bx,
        y: by,
        z: bz,
        w: 3.2,
        h: 1.55,
        d: 1.85,
        vz: waveSpeed,
        breakable,
        broken: false,
        baseX: bx,
        oscAmpX,
        oscSpeed,
        recycleSpan,
      });
    };

    for (const wave of hardWaves) {
      wave.cells.forEach((cell, colIdx) => {
        if (cell === 0) return;
        const bx = (colIdx - 2) * 3.4;
        if (cell === 1) {
          spawnDashBlock(bx, 0.8, wave.z, false, solidBlockMat);
        } else if (cell === 2) {
          spawnDashBlock(bx, 0.8, wave.z, false, solidBlockMat);
          spawnDashBlock(bx, 2.38, wave.z, false, highBlockMat);
        } else if (cell === 'B') {
          spawnDashBlock(bx, 0.8, wave.z, true, crackBlockMat);
        } else if (cell === 'M') {
          spawnDashBlock(bx, 0.8, wave.z, false, movingBlockMat, 2.6, 2.7);
        }
      });
    }

    const addLethalLaser = (
      lx: number,
      ly: number,
      lz: number,
      halfW: number,
      radius: number,
      vz: number,
    ) => {
      const laserGroup = new THREE.Group();
      laserGroup.position.set(lx, ly, lz);
      const beamGeo = new THREE.CylinderGeometry(radius, radius, halfW * 2, 12);
      disposables.push(beamGeo);
      const beamMesh = new THREE.Mesh(beamGeo, lethalLaserMat);
      beamMesh.rotation.z = Math.PI / 2;
      laserGroup.add(beamMesh);

      for (const side of [-1, 1]) {
        const cap = new THREE.Mesh(emitterGeo, emitterMat);
        cap.rotation.z = Math.PI / 2;
        cap.position.x = side * halfW;
        laserGroup.add(cap);
      }

      group.add(laserGroup);
      dashLasers.push({
        mesh: laserGroup,
        x: lx,
        y: ly,
        z: lz,
        halfW,
        radius,
        vz,
        lethal: true,
        recycleSpan,
      });
    };

    // Moving Lethal Lasers interleaved with the block waves!
    // 1. Low jumpable full-track laser
    addLethalLaser(0, 0.62, -25.5, 8.9, 0.22, waveSpeed);
    // 2. High anti-jump laser (standing is safe, jumping hits & kills!)
    addLethalLaser(0, 2.04, -46.5, 8.9, 0.24, waveSpeed);
    // 3. Low jumpable full-track laser
    addLethalLaser(0, 0.62, -68.5, 8.9, 0.22, waveSpeed);
    // 4. Double Window Laser Gate (low + high, jump through the middle!)
    addLethalLaser(0, 0.58, -90.5, 8.9, 0.21, waveSpeed);
    addLethalLaser(0, 2.38, -90.5, 8.9, 0.22, waveSpeed);
    // 5. Rear Arena Edge Lethal Laser Barrier (touching the back edge kills instantly!)
    addLethalLaser(0, 0.75, 10.65, 9.0, 0.26, 0);

    return {
      group,
      platforms,
      movers,
      spinners,
      hammers,
      bumpers,
      balls,
      hexTiles,
      dashBlocks,
      dashLasers,
      laserBeams,
      checkpoints,
      waypoints,
      finishZ: -999,
      finishY: 0,
      fallLimitY: -9,
      spawnBounds: { minX: -6.5, maxX: 6.5, z: 2.5, y: 0.6 },
      skyColor: 0x0f0728,
      isBlockDash: true,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // =========================================================================
  // MAP 5 (0.56): LASER TRACER (Circular Arena + Sweeping Red Laser Beams!)
  // =========================================================================
  if (mapId === 'laser_tracer') {
    const arenaMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.25,
    });
    const laserMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.1,
      roughness: 0.15,
    });
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
    });
    disposables.push(arenaMat, laserMat, ringMat);

    // Circular disk modeled cleanly with bounding box + visual cylinder
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 11.8, 1.6, 36), arenaMat);
    disk.position.set(0, -0.8, 0);
    disk.receiveShadow = true;
    group.add(disk);
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(11.5, 0.22, 10, 48), ringMat);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = 0.05;
    group.add(outerRing);
    platforms.push({ x: 0, y: 0, z: 0, w: 20, h: 1.6, d: 20 });

    // Center emitter pylon
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.8, 16), purpleMat);
    pylon.position.set(0, 0.9, 0);
    group.add(pylon);

    // 3 Laser Beams at jumpable height (low, mid, counter-rotating)
    const beamConfigs = [
      { y: 0.55, speed: 1.35, angle: 0 },
      { y: 0.62, speed: -1.15, angle: Math.PI / 2 },
      { y: 1.75, speed: 1.65, angle: Math.PI / 4 },
    ];
    for (const cfg of beamConfigs) {
      const pivot = new THREE.Group();
      pivot.position.set(0, cfg.y, 0);
      const beamMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 22, 10),
        laserMat,
      );
      beamMesh.rotation.z = Math.PI / 2;
      pivot.add(beamMesh);
      pivot.rotation.y = cfg.angle;
      group.add(pivot);
      laserBeams.push({
        pivot,
        y: cfg.y,
        length: 11,
        radius: 0.28,
        angle: cfg.angle,
        angularSpeed: cfg.speed,
      });
    }

    return {
      group,
      platforms,
      movers,
      spinners,
      hammers,
      bumpers,
      balls,
      hexTiles,
      dashBlocks,
      dashLasers,
      laserBeams,
      checkpoints,
      waypoints,
      finishZ: -999,
      finishY: 0,
      fallLimitY: -9,
      spawnBounds: { minX: -6, maxX: 6, z: 4, y: 0.6 },
      skyColor: 0x090d1f,
      isLaserTracer: true,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // =========================================================================
  // MAP 6 (0.56): LAVA LAND (Volcanic Islands & Bouncy Geysers!)
  // =========================================================================
  if (mapId === 'lava_land') {
    const magmaMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0xdc2626,
      emissiveIntensity: 0.85,
      roughness: 0.4,
    });
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x44403c,
      roughness: 0.85,
    });
    disposables.push(magmaMat, rockMat);

    // Glowing lava sea below
    const lavaSea = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), magmaMat);
    lavaSea.rotation.x = -Math.PI / 2;
    lavaSea.position.y = -4.2;
    group.add(lavaSea);

    // Central Rock Island + 6 surrounding stepping islands + bouncy magma geysers
    addStatic(0, 0, 0, 10, 1.8, 10, rockMat);
    const islandCoords: Array<[number, number, number]> = [
      [-9, 0.5, -5],
      [9, 0.5, -5],
      [-9, 0.5, 6],
      [9, 0.5, 6],
      [0, 1.2, -11],
      [0, 1.2, 11],
    ];
    for (const [ix, iy, iz] of islandCoords) {
      addStatic(ix, iy, iz, 6.2, 1.5, 6.2, rockMat);
    }
    // Bouncy magma geyser pads
    addStatic(-5.5, 0.2, 0, 3.2, 0.9, 3.2, bounceMat, { bounceY: 16.5 });
    addStatic(5.5, 0.2, 0, 3.2, 0.9, 3.2, bounceMat, { bounceY: 16.5 });
    // Moving magma bridges + central spinner
    addMover(0, 0.8, -5.5, 4.5, 1.0, 4.0, yellowMat, 4.5, 0, 0, 1.3, 0);
    addSpinner(0, 0, 0, 4.6, 2, 1.35, 0.36, 14);

    return {
      group,
      platforms,
      movers,
      spinners,
      hammers,
      bumpers,
      balls,
      hexTiles,
      dashBlocks,
      dashLasers,
      laserBeams,
      checkpoints,
      waypoints,
      finishZ: -999,
      finishY: 0,
      fallLimitY: -4.0,
      spawnBounds: { minX: -4, maxX: 4, z: 2, y: 0.6 },
      skyColor: 0x450a0a,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // =========================================================================
  // MAP 7 (0.56): SUPER SLIDE (Waterpark Downhill Turbo Race!)
  // =========================================================================
  if (mapId === 'super_slide') {
    const waterSlideMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.14,
      metalness: 0.15,
    });
    disposables.push(waterSlideMat);

    // High Start Deck
    addStatic(0, 8, -7, 16, 1.6, 20, cyanMat, { conveyorZ: -5.5, slippery: true });
    checkpoints.push({ z: 2, spawnX: 0, spawnY: 9, spawnZ: 0 });
    waypoints.push(new THREE.Vector3(0, 8, -14));

    // Downhill Turbo Slide (z: -17 to -67, drops y from 8 -> 1)
    const slideLen = 50;
    const slideDrop = -7;
    const slideGeo = new THREE.BoxGeometry(14, 1.5, slideLen);
    const slideMesh = new THREE.Mesh(slideGeo, waterSlideMat);
    slideMesh.position.set(0, 8 + slideDrop / 2 - 0.75, -17 - slideLen / 2);
    slideMesh.rotation.x = Math.atan2(slideDrop, slideLen);
    slideMesh.receiveShadow = true;
    group.add(slideMesh);
    disposables.push(slideGeo);
    platforms.push({
      x: 0,
      y: 8,
      z: -17 - slideLen / 2,
      w: 14,
      h: 1.5,
      d: slideLen,
      slopeRise: slideDrop,
      conveyorZ: -6.5,
      slippery: true,
    });
    addBumper(-3.5, 6.2, -32, 1.2, 15);
    addBumper(3.5, 4.5, -48, 1.2, 15);
    waypoints.push(new THREE.Vector3(0, 5, -38), new THREE.Vector3(0, 2, -62));

    // Mid Splash Pool Deck + Checkpoint
    addStatic(0, 1, -76, 16, 1.5, 18, chevronMat, { conveyorZ: -6.0 });
    addSpinner(0, 1, -76, 6.8, 2, 1.7, 0.4, 15);
    checkpoints.push({ z: -69, spawnX: 0, spawnY: 2, spawnZ: -72 });
    waypoints.push(new THREE.Vector3(0, 1, -82));

    // Bouncy Ring Launch over Pool Gap to Finish!
    addStatic(0, 1, -91, 12, 1.3, 6, bounceMat, { bounceY: 16.5 });
    addStatic(0, 2.2, -107, 14, 1.4, 14, pinkMat, { conveyorZ: -5.0 });
    addSpinner(0, 2.2, -107, 5.5, 4, -1.5, 0.38, 14);
    waypoints.push(new THREE.Vector3(0, 2.2, -107), new THREE.Vector3(0, 2.2, -124));

    addFinishArch(-121, 2.2, 16);

    return {
      group,
      platforms,
      movers,
      spinners,
      hammers,
      bumpers,
      balls,
      hexTiles,
      dashBlocks,
      dashLasers,
      laserBeams,
      checkpoints,
      waypoints,
      finishZ: -123,
      finishY: 2.2,
      fallLimitY: -12,
      spawnBounds: { minX: -6.5, maxX: 6.5, z: 1, y: 8.6 },
      skyColor: 0x0ea5e9,
      dispose: () => disposables.forEach((d) => d.dispose()),
    };
  }

  // =========================================================================
  // MAP 8 (0.56): CANNON CLIMB (Uphill Boulder & Cannonball Gauntlet!)
  // =========================================================================
  addStatic(0, 0, -9, 16, 1.6, 22, yellowMat);
  addMover(0, 0, -12, 5.2, 2.2, 1.8, hazardMat, 4.8, 0, 0, 2.1, 0, true);
  checkpoints.push({ z: 2, spawnX: 0, spawnY: 1, spawnZ: 0 });
  waypoints.push(new THREE.Vector3(0, 0, -16));

  // Steep Ramp Climb (z: -20 to -68, y rises 0 -> 7.5)
  const climbLen = 48;
  const climbRise = 7.5;
  const climbGeo = new THREE.BoxGeometry(15, 1.5, climbLen);
  const climbMesh = new THREE.Mesh(climbGeo, pinkMat);
  climbMesh.position.set(0, climbRise / 2 - 0.75, -20 - climbLen / 2);
  climbMesh.rotation.x = Math.atan2(climbRise, climbLen);
  climbMesh.receiveShadow = true;
  group.add(climbMesh);
  disposables.push(climbGeo);
  platforms.push({
    x: 0,
    y: 0,
    z: -20 - climbLen / 2,
    w: 15,
    h: 1.5,
    d: climbLen,
    slopeRise: climbRise,
  });

  // 5 Giant Rolling Cannonballs tumbling down the climb!
  const cannonGeo = new THREE.SphereGeometry(1.3, 16, 14);
  const cannonMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.3,
    metalness: 0.65,
  });
  disposables.push(cannonGeo, cannonMat);
  for (let i = 0; i < 5; i++) {
    const bm = new THREE.Mesh(cannonGeo, cannonMat);
    bm.castShadow = true;
    group.add(bm);
    const startZ = -68;
    const endZ = -20;
    const laneX = (i - 2) * 2.7;
    const frac = i / 5;
    const curZ = THREE.MathUtils.lerp(startZ, endZ, frac);
    const slopePerMeter = climbRise / climbLen;
    const curY = (endZ - curZ) * slopePerMeter + 1.3;
    bm.position.set(laneX, curY, curZ);
    balls.push({
      mesh: bm,
      x: laneX,
      y: curY,
      z: curZ,
      vz: 12.5 + (i % 2) * 2.5,
      vx: 0,
      radius: 1.3,
      startZ,
      endZ,
      startY: climbRise + 1.3,
      slopePerMeter,
    });
  }
  waypoints.push(new THREE.Vector3(0, 3.5, -42), new THREE.Vector3(0, 7.5, -70));

  // Upper Ridge + Hammers + Bounce Pad to Summit Finish
  addStatic(0, 7.5, -78, 16, 1.5, 20, cyanMat);
  checkpoints.push({ z: -70, spawnX: 0, spawnY: 8.5, spawnZ: -74 });
  addHammer(-3.2, 13.5, -78, 5.1, 'z', 0.95, 2.2, 0);
  addHammer(3.2, 13.5, -84, 5.1, 'z', 0.95, 2.2, Math.PI);

  addStatic(0, 7.5, -94, 14, 1.4, 8, bounceMat, { bounceY: 16 });
  addMover(0, 9.5, -108, 7, 1.3, 8, yellowMat, 3.8, 0, 0, 1.4, 0);
  waypoints.push(
    new THREE.Vector3(0, 7.5, -94),
    new THREE.Vector3(0, 9.5, -108),
    new THREE.Vector3(0, 9.5, -124),
  );

  addFinishArch(-120, 9.5, 16);

  return {
    group,
    platforms,
    movers,
    spinners,
    hammers,
    bumpers,
    balls,
    hexTiles,
    dashBlocks,
    dashLasers,
    laserBeams,
    checkpoints,
    waypoints,
    finishZ: -122,
    finishY: 9.5,
    fallLimitY: -12,
    spawnBounds: { minX: -6.5, maxX: 6.5, z: 2, y: 0.6 },
    skyColor: 0x38bdf8,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
