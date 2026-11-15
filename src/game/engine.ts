import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  EmoteConfig,
  EmoteId,
  FootstepConfig,
  FootstepId,
  GameMode,
  GamePhase,
  HudState,
  MapId,
  MissionMetric,
  PartyConfig,
  SkinConfig,
  SkinId,
  VictoryAnimId,
  WBadgeColor,
} from './types';
import {
  ALL_MAP_IDS,
  BOT_NAMES,
  CLASSIC_SKINS,
  EMOTES_CATALOG,
  FOOTSTEPS_CATALOG,
  MAPS_META,
  TOURNAMENT_STAGES,
} from './skins';
import { SoundEngine, soundManager } from './audio';
import { createContactShadowTexture } from './textures';
import {
  animateLobbyVictory,
  animateRig,
  CharacterRig,
  createStumblerModel,
  getEmoteBubbleTexture,
  getNameTagTexture,
  setRigInvisible,
} from './characterModel';
import {
  buildLevel,
  createSkyDecorations,
  LevelInstance,
} from './levels';

// Pre-allocated math helpers (zero GC in tick loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _dummy = new THREE.Object3D();

interface Contestant {
  id: number;
  name: string;
  isPlayer: boolean;
  skin: SkinConfig;
  rig: CharacterRig;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  grounded: boolean;
  coyoteTimer: number;
  diving: boolean;
  diveTimer: number;
  diveCooldown: number;
  stunTimer: number;
  animTime: number;
  checkpointIdx: number;
  qualified: boolean;
  eliminated: boolean;
  fallWhistlePlayed: boolean;
  rank: number | null;
  // 0.56 Emotes & Status
  activeEmote: EmoteId | null;
  activeEmoteTimer: number;
  bubbleTimer: number;
  shieldTimer: number;
  invisTimer: number;
  footstepTimer: number;
  // AI properties
  aiSkill: number;
  aiLaneOffset: number;
  aiWaypointIdx: number;
  aiJumpCooldown: number;
  aiEmoteCooldown: number;
  aiHexTargetX: number;
  aiHexTargetZ: number;
  aiHexDecisionTimer: number;
}

interface BananaHazard {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  ownerId: number;
  life: number;
}

interface BallProjectile {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ownerId: number;
  life: number;
}

interface ParticleItem {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudState) => void;
  onTournamentCrown: (winnerName: string, playerWon: boolean, isFullTournament: boolean) => void;
  onRoundReward?: (qualified: boolean, wonCrown: boolean, isTournament: boolean) => void;
  onMissionProgress?: (metric: MissionMetric, amount?: number) => void;
  onWebglError?: () => void;
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class StumbleGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  public sound: SoundEngine;

  private isSoftwareGl: boolean;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private shadowTex!: THREE.CanvasTexture;
  private keyLight!: THREE.DirectionalLight;

  private frameId = 0;
  private disposed = false;
  private lastTimestamp = 0;
  private elapsedTotal = 0;

  // Clouds & Lobby
  private decorGroup = new THREE.Group();
  private clouds: THREE.Group[] = [];
  private lobbyGroup = new THREE.Group();
  private lobbyRig: CharacterRig | null = null;
  private lobbyOrbitYaw = 0;

  // Match state
  private phase: GamePhase = 'lobby';
  private currentMode: GameMode = 'tournament';
  private tournamentQueue: MapId[] = ['circuito_caos', 'cima_helada', 'hexagonos'];
  private roundIndex = 0;
  private currentMapId: MapId = 'circuito_caos';
  private level: LevelInstance | null = null;
  private contestants: Contestant[] = [];
  private player: Contestant | null = null;
  private qualifyCount = 0;
  private qualifyTarget = 16;
  private phaseTimer = 0;
  private matchElapsed = 0;
  private playerQualifiedTimer = 0;
  private lastCountdownNum = -1;
  private winnerName = '';
  private feedText = '';
  private feedTimer = 0;
  private hudSyncTimer = 0;

  // Camera
  private camYaw = 0;
  private camPitch = 0.38;
  private camDist = 11.5;
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Inputs
  private keys = new Set<string>();
  private jumpQueued = false;
  private diveQueued = false;
  private touchMoveX = 0;
  private touchMoveY = 0;

  // Particles
  private particleMesh!: THREE.InstancedMesh;
  private particles: ParticleItem[] = [];
  private readonly maxParticles = 140;

  // Player Preferences & 0.56 Loadout
  private playerSkin: SkinConfig = CLASSIC_SKINS[0];
  private playerName = 'Tú';
  private playerHasW = false;
  private playerWColor: WBadgeColor = 'rainbow';
  private playerEmotes: EmoteConfig[] = EMOTES_CATALOG.slice(0, 4);
  private playerFootstep: FootstepConfig = FOOTSTEPS_CATALOG[0];
  private playerVictoryAnim: VictoryAnimId = 'baile_clasico';

  // Active Match Emote Rules & Party Settings
  private activeParty: PartyConfig | null = null;
  private matchEmotesEnabled = true;
  private matchAllowedEmoteIds: Set<EmoteId> = new Set(EMOTES_CATALOG.map((e) => e.id));
  private emoteCooldowns: Record<string, number> = {};
  private bananaHazards: BananaHazard[] = [];
  private ballProjectiles: BallProjectile[] = [];
  private lobbyVictoryPreviewTimer = 0;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.sound = soundManager;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.initScene();
    this.initParticles();
    this.buildLobbyScene();
    this.bindEvents();

    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
    this.emitHud();
  }

  private initScene(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x38bdf8);
    this.scene.fog = new THREE.Fog(0x38bdf8, 65, 195);

    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.2, 320);
    this.camera.position.set(0, 4, 8);

    // Studio Environment Map (RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Warm key light + cool Hemisphere fill
    const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x1d4ed8, 0.85);
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(0xfff7ed, 1.45);
    this.keyLight.position.set(22, 38, 18);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.width = 1024;
    this.keyLight.shadow.mapSize.height = 1024;
    this.keyLight.shadow.camera.near = 2;
    this.keyLight.shadow.camera.far = 110;
    const d = 32;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.shadowTex = createContactShadowTexture();

    this.scene.add(this.decorGroup);
    this.clouds = createSkyDecorations(this.decorGroup);
    this.scene.add(this.lobbyGroup);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private initParticles(): void {
    const geo = new THREE.SphereGeometry(0.18, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(geo, mat, this.maxParticles);
    this.particleMesh.frustumCulled = false;

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 0,
        color: new THREE.Color(0xffffff),
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, this.particles[i].color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
    this.scene.add(this.particleMesh);
  }

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 5,
    scale = 1,
  ): void {
    let spawned = 0;
    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.4 + Math.random() * 0.7) * speed;
        p.vx = Math.cos(ang) * spd;
        p.vy = (0.4 + Math.random() * 0.8) * speed;
        p.vz = Math.sin(ang) * spd;
        p.life = 0;
        p.maxLife = 0.35 + Math.random() * 0.35;
        p.scale = scale * (0.7 + Math.random() * 0.6);
        p.color.setHex(colorHex);
        spawned++;
      }
    }
  }

  private buildLobbyScene(): void {
    this.clearLobbyRig();
    while (this.lobbyGroup.children.length > 0) {
      this.lobbyGroup.remove(this.lobbyGroup.children[0]);
    }
    this.decorGroup.visible = false;

    // Iconic 2020 Stumble Guys bright cyan-to-sky studio floor gradient!
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 512;
    bgCanvas.height = 512;
    const ctx = bgCanvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
    grad.addColorStop(0, '#7de7ff');
    grad.addColorStop(0.42, '#22b8f0');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    const floorTex = new THREE.CanvasTexture(bgCanvas);
    floorTex.colorSpace = THREE.SRGBColorSpace;

    const studioFloor = new THREE.Mesh(
      new THREE.CircleGeometry(18, 48),
      new THREE.MeshBasicMaterial({ map: floorTex }),
    );
    studioFloor.rotation.x = -Math.PI / 2;
    studioFloor.position.y = 0;
    this.lobbyGroup.add(studioFloor);

    this.lobbyRig = createStumblerModel(this.playerSkin, this.shadowTex);
    this.lobbyRig.root.position.set(0, 0, 0);
    this.lobbyRig.root.rotation.y = Math.PI + this.lobbyOrbitYaw;
    this.lobbyGroup.add(this.lobbyRig.root);

    this.scene.background = new THREE.Color(0x0284c7);
    (this.scene.fog as THREE.Fog).color.setHex(0x0284c7);
  }

  private clearLobbyRig(): void {
    if (this.lobbyRig) {
      this.lobbyGroup.remove(this.lobbyRig.root);
      this.lobbyRig = null;
    }
  }

  public setPlayerCustomization(
    skinId: SkinId,
    name: string,
    equippedEmotes?: EmoteId[],
    footstepId?: FootstepId,
    victoryAnimId?: VictoryAnimId,
    hasW?: boolean,
    wColor?: WBadgeColor,
  ): void {
    const found = CLASSIC_SKINS.find((s) => s.id === skinId);
    if (found) {
      this.playerSkin = found;
    }
    this.playerName = name.trim() || 'Tú';
    if (typeof hasW === 'boolean') {
      this.playerHasW = hasW;
    }
    if (wColor) {
      this.playerWColor = wColor;
    }
    if (equippedEmotes && equippedEmotes.length > 0) {
      this.playerEmotes = equippedEmotes
        .map((id) => EMOTES_CATALOG.find((e) => e.id === id))
        .filter((e): e is EmoteConfig => Boolean(e));
    }
    if (footstepId) {
      const f = FOOTSTEPS_CATALOG.find((x) => x.id === footstepId);
      if (f) this.playerFootstep = f;
    }
    if (victoryAnimId && victoryAnimId !== this.playerVictoryAnim) {
      this.playerVictoryAnim = victoryAnimId;
      this.lobbyVictoryPreviewTimer = 2.4;
    }
    if (this.player) {
      this.player.name = this.playerName;
      const nameMat = this.player.rig.nameSprite.material as THREE.SpriteMaterial;
      nameMat.map = getNameTagTexture(
        this.player.name,
        true,
        this.playerHasW,
        this.playerWColor,
      );
      nameMat.needsUpdate = true;
    }
    if (this.phase === 'lobby') {
      this.buildLobbyScene();
    }
  }

  public returnToLobby(): void {
    this.sound.stopMusic();
    this.cleanupLevel();
    this.phase = 'lobby';
    this.lobbyGroup.visible = true;
    this.buildLobbyScene();
    this.emitHud();
  }

  public startGame(mode: GameMode): void {
    this.sound.unlock();
    this.activeParty = null;
    this.currentMode = mode;
    this.matchEmotesEnabled = true;
    this.matchAllowedEmoteIds = new Set(EMOTES_CATALOG.map((e) => e.id));

    if (mode === 'tournament') {
      // 6-phase Stumble 0.56 tournament:
      // 1: Fase de grupos (32->24), 2: Dieciseisavos (24->16), 3: Octavos (16->8),
      // 4: Cuartos (8->4), 5: Semifinales (4->2), 6: La Final (2->1)
      const pickNot = (pool: MapId[], exclude: MapId[]): MapId => {
        const filtered = pool.filter((m) => !exclude.includes(m));
        const src = filtered.length > 0 ? filtered : pool;
        return src[Math.floor(Math.random() * src.length)];
      };
      const r1 = pickNot(['circuito_caos', 'super_slide'], []);
      const r2 = pickNot(['super_slide', 'cannon_climb', 'cima_helada'], [r1]);
      const r3 = pickNot(['cima_helada', 'cannon_climb', 'lava_land', 'circuito_caos'], [r2]);
      const r4 = pickNot(['block_dash', 'laser_tracer', 'lava_land', 'cannon_climb'], [r3]);
      const r5 = pickNot(['hexagonos', 'block_dash', 'laser_tracer', 'lava_land'], [r4]);
      const r6 = pickNot(['block_dash', 'laser_tracer', 'hexagonos', 'lava_land'], [r5]);
      this.tournamentQueue = [r1, r2, r3, r4, r5, r6];
      this.roundIndex = 0;
    } else if (mode === 'party') {
      this.tournamentQueue = ['circuito_caos', 'block_dash', 'hexagonos'];
      this.roundIndex = 0;
    } else {
      this.tournamentQueue = [mode];
      this.roundIndex = 0;
    }
    this.startRound(this.tournamentQueue[this.roundIndex]);
  }

  public startPartyMatch(party: PartyConfig): void {
    this.sound.unlock();
    this.activeParty = party;
    this.currentMode = 'party';

    if (party.partyType === 'normal') {
      const shuffled = [...ALL_MAP_IDS].sort(() => Math.random() - 0.5);
      this.tournamentQueue = [shuffled[0], shuffled[1], shuffled[2]];
      this.matchEmotesEnabled = true;
      this.matchAllowedEmoteIds = new Set(EMOTES_CATALOG.map((e) => e.id));
    } else {
      this.tournamentQueue = party.selectedMaps.slice(0, party.roundCount);
      if (party.emoteRule === 'none') {
        this.matchEmotesEnabled = false;
        this.matchAllowedEmoteIds = new Set();
      } else if (party.emoteRule === 'all') {
        this.matchEmotesEnabled = true;
        this.matchAllowedEmoteIds = new Set(EMOTES_CATALOG.map((e) => e.id));
      } else {
        this.matchEmotesEnabled = party.allowedEmotes.length > 0;
        this.matchAllowedEmoteIds = new Set(party.allowedEmotes);
      }
    }

    this.roundIndex = 0;
    this.startRound(this.tournamentQueue[0]);
  }

  public nextTournamentRound(): void {
    if (this.roundIndex + 1 < this.tournamentQueue.length) {
      this.roundIndex++;
      this.startRound(this.tournamentQueue[this.roundIndex]);
    } else {
      this.returnToLobby();
    }
  }

  private cleanupLevel(): void {
    if (this.level) {
      this.scene.remove(this.level.group);
      this.level.dispose();
      this.level = null;
    }
    for (const c of this.contestants) {
      this.scene.remove(c.rig.root);
    }
    for (const bh of this.bananaHazards) {
      this.scene.remove(bh.mesh);
    }
    for (const bp of this.ballProjectiles) {
      this.scene.remove(bp.mesh);
    }
    this.bananaHazards = [];
    this.ballProjectiles = [];
    this.contestants = [];
    this.player = null;
  }

  private startRound(mapId: MapId): void {
    this.cleanupLevel();
    this.lobbyGroup.visible = false;
    this.decorGroup.visible = true;

    this.currentMapId = mapId;
    const anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.level = buildLevel(mapId, anisotropy);
    this.scene.add(this.level.group);

    this.scene.background = new THREE.Color(this.level.skyColor);
    (this.scene.fog as THREE.Fog).color.setHex(this.level.skyColor);

    const meta = MAPS_META[mapId];
    let totalCount = 32;
    let targetQualify = 16;

    if (this.currentMode === 'tournament') {
      const stage = TOURNAMENT_STAGES[this.roundIndex] || TOURNAMENT_STAGES[TOURNAMENT_STAGES.length - 1];
      totalCount = stage.totalPlayers;
      targetQualify = stage.qualifyCount;
    } else if (this.activeParty && this.activeParty.partyType === 'custom') {
      const cap = Math.max(2, Math.min(32, this.activeParty.maxPlayers));
      if (this.roundIndex === 0) totalCount = cap;
      else if (this.roundIndex === 1) totalCount = Math.max(2, Math.ceil(cap * 0.6));
      else totalCount = Math.max(2, Math.ceil(cap * 0.35));
      targetQualify =
        meta.type === 'survival'
          ? 1
          : this.roundIndex + 1 >= this.tournamentQueue.length
            ? 1
            : Math.min(totalCount - 1, Math.max(1, Math.floor(totalCount / 2)));
    } else if (this.currentMode === 'party') {
      if (this.roundIndex === 0) totalCount = 32;
      else if (this.roundIndex === 1) totalCount = 16;
      else totalCount = 8;
      targetQualify =
        meta.type === 'survival'
          ? 1
          : Math.min(totalCount - 1, Math.max(1, Math.floor(totalCount / 2)));
    } else {
      totalCount = meta.type === 'survival' ? 14 : 24;
      targetQualify = meta.type === 'survival' ? 1 : Math.max(4, Math.floor(totalCount / 2));
    }

    this.qualifyTarget = targetQualify;
    this.qualifyCount = 0;
    this.matchElapsed = 0;
    this.playerQualifiedTimer = 0;
    this.winnerName = '';
    this.feedText = '';
    this.feedTimer = 0;
    this.emoteCooldowns = {};

    // Spawn Player + Party Friends + Bots
    const shuffledNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const partyBots = this.activeParty
      ? this.activeParty.members.filter((m) => !m.isHost)
      : [];
    const bounds = this.level.spawnBounds;

    for (let i = 0; i < totalCount; i++) {
      const isPlayer = i === 0;
      const friendMember = !isPlayer && i - 1 < partyBots.length ? partyBots[i - 1] : null;
      const skin = isPlayer
        ? this.playerSkin
        : friendMember
          ? CLASSIC_SKINS.find((s) => s.id === friendMember.skinId) || CLASSIC_SKINS[i % CLASSIC_SKINS.length]
          : CLASSIC_SKINS[i % CLASSIC_SKINS.length];
      const rig = createStumblerModel(skin, this.shadowTex);
      const contestantName = isPlayer
        ? this.playerName
        : friendMember
          ? friendMember.name
          : shuffledNames[i % shuffledNames.length];
      const nameMat = rig.nameSprite.material as THREE.SpriteMaterial;
      nameMat.map = getNameTagTexture(
        contestantName,
        isPlayer,
        isPlayer && this.playerHasW,
        this.playerWColor,
      );
      nameMat.depthTest = !isPlayer;
      nameMat.needsUpdate = true;
      rig.nameSprite.renderOrder = isPlayer ? 12 : 1;
      rig.nameSprite.visible = true;
      this.scene.add(rig.root);

      let sx = 0;
      let sz = bounds.z;
      const sy = bounds.y;

      if (meta.type === 'survival') {
        const angle = (i / totalCount) * Math.PI * 2;
        const rad = this.level.isBlockDash ? 3.2 : 2.6 + (i % 3) * 1.4;
        sx = Math.cos(angle) * rad;
        sz = (this.level.isBlockDash ? 3 : 0) + Math.sin(angle) * rad;
      } else {
        const cols = 8;
        const col = i % cols;
        const row = Math.floor(i / cols);
        sx = THREE.MathUtils.lerp(
          bounds.minX,
          bounds.maxX,
          col / Math.max(1, cols - 1),
        );
        sz = bounds.z + row * 1.85;
      }

      rig.root.position.set(sx, sy, sz);

      const contestant: Contestant = {
        id: i,
        name: contestantName,
        isPlayer,
        skin,
        rig,
        x: sx,
        y: sy,
        z: sz,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: 0,
        grounded: true,
        coyoteTimer: 0,
        diving: false,
        diveTimer: 0,
        diveCooldown: 0,
        stunTimer: 0,
        animTime: Math.random() * 5,
        checkpointIdx: 0,
        qualified: false,
        eliminated: false,
        fallWhistlePlayed: false,
        rank: null,
        activeEmote: null,
        activeEmoteTimer: 0,
        bubbleTimer: 0,
        shieldTimer: 0,
        invisTimer: 0,
        footstepTimer: 0,
        aiSkill: 0.72 + Math.random() * 0.34,
        aiLaneOffset: (Math.random() - 0.5) * 6.5,
        aiWaypointIdx: 0,
        aiJumpCooldown: 0.4 + Math.random() * 0.8,
        aiEmoteCooldown: 2 + Math.random() * 5,
        aiHexTargetX: sx,
        aiHexTargetZ: sz,
        aiHexDecisionTimer: 0,
      };
      this.contestants.push(contestant);
      if (isPlayer) this.player = contestant;
    }

    this.camYaw = 0;
    this.camPitch = 0.38;
    this.phase = 'intro';
    this.phaseTimer = 1.6;
    this.lastCountdownNum = -1;
    this.emitHud();
  }

  public setTouchMove(x: number, y: number): void {
    this.touchMoveX = x;
    this.touchMoveY = y;
  }

  public triggerTouchJump(): void {
    this.sound.unlock();
    this.handleJumpOrDiveAction();
  }

  public triggerTouchDive(): void {
    this.sound.unlock();
    this.diveQueued = true;
  }

  private handleJumpOrDiveAction(): void {
    if (this.phase !== 'playing' || !this.player) return;
    if (this.player.qualified || this.player.eliminated || this.player.stunTimer > 0) return;

    if (this.player.grounded || this.player.coyoteTimer > 0) {
      this.jumpQueued = true;
    } else if (!this.player.diving && this.player.diveCooldown <= 0) {
      this.diveQueued = true;
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('contextmenu', this.onContextMenu);
    dom.addEventListener('webglcontextlost', this.onContextLost);
    dom.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private unbindEvents(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('contextmenu', this.onContextMenu);
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    dom.removeEventListener('webglcontextrestored', this.onContextRestored);
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onWebglError?.();
  };

  private onContextRestored = (): void => {
    // Re-init if needed
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    if (this.phase === 'playing' && this.player && !this.player.diving && this.player.diveCooldown <= 0) {
      this.diveQueued = true;
    }
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }
    this.sound.unlock();
    const code = e.code;
    if (code === 'Space') {
      e.preventDefault();
      if (!e.repeat) {
        this.handleJumpOrDiveAction();
      }
    } else if (
      code === 'ShiftLeft' ||
      code === 'ShiftRight' ||
      code === 'KeyE'
    ) {
      if (!e.repeat && this.phase === 'playing') {
        this.diveQueued = true;
      }
    } else if (!e.repeat && this.phase === 'playing') {
      if (code === 'Digit1') this.triggerEmoteSlot(0);
      else if (code === 'Digit2') this.triggerEmoteSlot(1);
      else if (code === 'Digit3') this.triggerEmoteSlot(2);
      else if (code === 'Digit4') this.triggerEmoteSlot(3);
    }
    this.keys.add(code);
  };

  private getEffectiveEmoteSlots(): EmoteConfig[] {
    if (!this.matchEmotesEnabled) return [];
    if (this.activeParty && this.activeParty.partyType === 'custom') {
      if (this.activeParty.emoteRule === 'none') return [];
      const equippedAllowed = this.playerEmotes.filter((e) =>
        this.matchAllowedEmoteIds.has(e.id),
      );
      if (equippedAllowed.length > 0) return equippedAllowed;
      return EMOTES_CATALOG.filter((e) => this.matchAllowedEmoteIds.has(e.id)).slice(0, 4);
    }
    return this.playerEmotes;
  }

  public triggerEmoteSlot(slotIndex: number): void {
    if (this.phase !== 'playing' || !this.player || !this.matchEmotesEnabled) return;
    if (this.player.eliminated || this.player.qualified || this.player.stunTimer > 0) return;
    const slots = this.getEffectiveEmoteSlots();
    const emote = slots[slotIndex];
    if (!emote) return;
    if ((this.emoteCooldowns[emote.id] || 0) > 0) return;

    this.emoteCooldowns[emote.id] = emote.cooldownSec;
    this.executeEmote(this.player, emote);
    this.emitHud();
  }

  private executeEmote(c: Contestant, emote: EmoteConfig): void {
    // Show floating 3D emote bubble above character
    const spriteMat = c.rig.emoteSprite.material as THREE.SpriteMaterial;
    spriteMat.map = getEmoteBubbleTexture(emote.icon, emote.bubbleColor);
    spriteMat.needsUpdate = true;
    c.rig.emoteSprite.visible = true;
    c.bubbleTimer = 1.65;
    c.activeEmote = emote.id;
    c.activeEmoteTimer = 0.45;

    const dirX = -Math.sin(c.yaw);
    const dirZ = -Math.cos(c.yaw);

    if (emote.category === 'expresion') {
      if (c.isPlayer) this.sound.playEmotePop();
      return;
    }

    switch (emote.id) {
      case 'punetazo': {
        if (c.isPlayer) this.sound.playPunch();
        c.vx += dirX * 9.5;
        c.vz += dirZ * 9.5;
        this.spawnBurst(c.x + dirX * 0.9, c.y + 0.9, c.z + dirZ * 0.9, 10, 0xef4444, 6, 1.1);
        // Knock back rivals in punch arc
        for (const other of this.contestants) {
          if (other.id === c.id || other.eliminated || other.qualified) continue;
          const dx = other.x - c.x;
          const dz = other.z - c.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 2.8 && Math.abs(other.y - c.y) < 1.6) {
            if (other.shieldTimer > 0) {
              other.shieldTimer = 0;
              other.rig.shieldBubble.visible = false;
              continue;
            }
            const nx = dist > 0.01 ? dx / dist : dirX;
            const nz = dist > 0.01 ? dz / dist : dirZ;
            other.vx = nx * 16;
            other.vz = nz * 16;
            other.vy = 6.8;
            other.grounded = false;
            other.stunTimer = 0.55;
            if (other.isPlayer) this.sound.playHit();
          }
        }
        // Break nearby breakable Block Dash blocks!
        if (this.level) {
          for (const db of this.level.dashBlocks) {
            if (!db.broken && db.breakable && Math.hypot(db.x - (c.x + dirX * 1.4), db.z - (c.z + dirZ * 1.4)) < 2.8) {
              db.broken = true;
              db.mesh.visible = false;
              this.spawnBurst(db.x, db.y + 0.5, db.z, 12, 0xf43f5e, 7, 1.1);
            }
          }
        }
        break;
      }

      case 'patada': {
        if (c.isPlayer) this.sound.playKick();
        c.vx = dirX * 15.5;
        c.vz = dirZ * 15.5;
        c.vy = Math.max(c.vy, 3.8);
        this.spawnBurst(c.x, c.y + 0.6, c.z, 8, 0xf97316, 5, 1.0);
        for (const other of this.contestants) {
          if (other.id === c.id || other.eliminated || other.qualified) continue;
          const dx = other.x - (c.x + dirX * 1.1);
          const dz = other.z - (c.z + dirZ * 1.1);
          if (Math.hypot(dx, dz) < 2.3 && Math.abs(other.y - c.y) < 1.5) {
            if (other.shieldTimer > 0) {
              other.shieldTimer = 0;
              other.rig.shieldBubble.visible = false;
              continue;
            }
            other.vx = dirX * 14.5;
            other.vz = dirZ * 14.5;
            other.vy = 6.2;
            other.grounded = false;
            other.stunTimer = 0.5;
          }
        }
        break;
      }

      case 'abrazo': {
        if (c.isPlayer) this.sound.playHug();
        let nearest: Contestant | null = null;
        let bestDist = 3.1;
        for (const other of this.contestants) {
          if (other.id === c.id || other.eliminated || other.qualified) continue;
          const d = Math.hypot(other.x - c.x, other.z - c.z);
          if (d < bestDist && Math.abs(other.y - c.y) < 1.4) {
            bestDist = d;
            nearest = other;
          }
        }
        if (nearest) {
          if (nearest.shieldTimer > 0) {
            nearest.shieldTimer = 0;
            nearest.rig.shieldBubble.visible = false;
          } else {
            nearest.x = c.x + dirX * 0.85;
            nearest.z = c.z + dirZ * 0.85;
            nearest.vx = 0;
            nearest.vz = 0;
            nearest.stunTimer = 0.85;
            this.spawnBurst(nearest.x, nearest.y + 1.0, nearest.z, 10, 0xec4899, 4, 1.0);
          }
        }
        break;
      }

      case 'platano': {
        if (c.isPlayer) this.sound.playBanana();
        const bananaGroup = new THREE.Group();
        const bMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
        const peel1 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.32, 6), bMat);
        peel1.position.y = 0.14;
        bananaGroup.add(peel1);
        const bx = c.x - dirX * 1.1;
        const bz = c.z - dirZ * 1.1;
        bananaGroup.position.set(bx, c.y + 0.05, bz);
        this.scene.add(bananaGroup);
        this.bananaHazards.push({
          mesh: bananaGroup,
          x: bx,
          y: c.y,
          z: bz,
          ownerId: c.id,
          life: 10.0,
        });
        break;
      }

      case 'balon': {
        if (c.isPlayer) this.sound.playBall();
        const ballMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 14, 12),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
        );
        const sx = c.x + dirX * 1.1;
        const sy = c.y + 0.8;
        const sz = c.z + dirZ * 1.1;
        ballMesh.position.set(sx, sy, sz);
        ballMesh.castShadow = true;
        this.scene.add(ballMesh);
        this.ballProjectiles.push({
          mesh: ballMesh,
          x: sx,
          y: sy,
          z: sz,
          vx: dirX * 18,
          vy: 4.5,
          vz: dirZ * 18,
          ownerId: c.id,
          life: 4.5,
        });
        break;
      }

      case 'rayo_espada': {
        if (c.isPlayer) this.sound.playLightning();
        c.vx = dirX * 17.5;
        c.vz = dirZ * 17.5;
        this.spawnBurst(c.x, c.y + 0.8, c.z, 14, 0x22d3ee, 8, 1.2);
        for (const other of this.contestants) {
          if (other.id === c.id || other.eliminated || other.qualified) continue;
          const dx = other.x - c.x;
          const dz = other.z - c.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 3.5 && Math.abs(other.y - c.y) < 1.8) {
            if (other.shieldTimer > 0) {
              other.shieldTimer = 0;
              other.rig.shieldBubble.visible = false;
              continue;
            }
            const nx = dist > 0.01 ? dx / dist : dirX;
            const nz = dist > 0.01 ? dz / dist : dirZ;
            other.vx = nx * 13;
            other.vz = nz * 13;
            other.vy = 5.5;
            other.stunTimer = 0.6;
          }
        }
        break;
      }

      case 'invisibilidad': {
        if (c.isPlayer) this.sound.playInvis();
        c.invisTimer = 3.5;
        setRigInvisible(c.rig, true);
        this.spawnBurst(c.x, c.y + 0.8, c.z, 10, 0xa855f7, 5, 1.0);
        break;
      }

      case 'escudo': {
        if (c.isPlayer) this.sound.playShield();
        c.shieldTimer = 4.0;
        c.rig.shieldBubble.visible = true;
        this.spawnBurst(c.x, c.y + 0.8, c.z, 10, 0x38bdf8, 5, 1.0);
        break;
      }
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.sound.unlock();
    if (e.button === 2) return;
    this.isDragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    if (this.phase === 'lobby') {
      this.lobbyOrbitYaw += dx * 0.01;
    } else {
      this.camYaw -= dx * 0.0065;
      this.camPitch = THREE.MathUtils.clamp(
        this.camPitch + dy * 0.0045,
        0.15,
        0.95,
      );
    }
  };

  private onPointerUp = (): void => {
    this.isDragging = false;
  };

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(rawDt, 0.05);
    this.elapsedTotal += dt;

    // Drift background clouds
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.position.x += Math.sin(this.elapsedTotal * 0.18 + i) * dt * 0.45;
      c.position.y += Math.cos(this.elapsedTotal * 0.35 + i) * dt * 0.15;
    }

    if (this.phase === 'lobby') {
      this.updateLobby(dt);
    } else {
      this.updateMatch(dt);
    }

    this.updateParticles(dt);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private updateLobby(dt: number): void {
    if (this.lobbyRig) {
      this.lobbyRig.root.rotation.y = Math.PI + this.lobbyOrbitYaw;
      if (this.lobbyVictoryPreviewTimer > 0) {
        this.lobbyVictoryPreviewTimer -= dt;
        animateLobbyVictory(this.lobbyRig, this.playerVictoryAnim, this.elapsedTotal);
      } else {
        animateRig(this.lobbyRig, 0, true, false, false, this.elapsedTotal, dt);
      }
    }

    _camDesired.set(0, 1.38, 4.35);
    this.camera.position.lerp(_camDesired, 1 - Math.exp(-8 * dt));
    _camTarget.set(0, 0.88, 0);
    this.camera.lookAt(_camTarget);

    this.keyLight.position.set(8, 16, 12);
    this.keyLight.target.position.set(0, 0, 0);
  }

  private updateMatch(dt: number): void {
    if (!this.level) return;

    if (this.feedTimer > 0) {
      this.feedTimer -= dt;
      if (this.feedTimer <= 0) this.feedText = '';
    }

    // Phase state machine
    if (this.phase === 'intro') {
      this.phaseTimer -= dt;
      if (this.phaseTimer <= 0) {
        this.phase = 'countdown';
        this.phaseTimer = 3.0;
        this.lastCountdownNum = -1;
        this.emitHud();
      }
    } else if (this.phase === 'countdown') {
      this.phaseTimer -= dt;
      const num = Math.ceil(this.phaseTimer);
      if (num !== this.lastCountdownNum && num >= 1) {
        this.lastCountdownNum = num;
        this.sound.playCountdown(false);
        this.emitHud();
      }
      if (this.phaseTimer <= 0) {
        this.phase = 'playing';
        this.sound.playCountdown(true);
        this.sound.startMusic();
        this.emitHud();
      }
    } else if (this.phase === 'playing') {
      this.matchElapsed += dt;
    }

    // Always animate hazards so the course looks alive during intro/countdown too
    this.updateHazards(dt);

    // Cooldowns & projectiles during playing
    if (this.phase === 'playing') {
      for (const k of Object.keys(this.emoteCooldowns)) {
        if (this.emoteCooldowns[k] > 0) {
          this.emoteCooldowns[k] = Math.max(0, this.emoteCooldowns[k] - dt);
        }
      }
      this.updateEmoteProjectiles(dt);
    }

    // Physics step when playing (or subtle idle bounce during countdown)
    if (this.phase === 'playing') {
      const subSteps = dt > 0.025 ? 2 : 1;
      const subDt = dt / subSteps;
      for (let s = 0; s < subSteps; s++) {
        this.stepContestants(subDt);
        this.resolvePlayerCollisions();
      }
    } else {
      for (const c of this.contestants) {
        c.animTime += dt;
        animateRig(c.rig, 0, true, false, false, c.animTime, dt);
      }
    }

    this.updateMatchCamera(dt);

    // Sync HUD ~10x/sec
    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.1) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }
  }

  private updateHazards(dt: number): void {
    if (!this.level) return;
    const t = this.elapsedTotal;

    // Spinners
    for (const sp of this.level.spinners) {
      sp.angle += sp.angularSpeed * dt;
      sp.group.rotation.y = sp.angle;
    }

    // Moving Platforms & Push Walls
    for (const mv of this.level.movers) {
      mv.prevX = mv.x;
      mv.prevY = mv.y;
      mv.prevZ = mv.z;
      const osc = Math.sin(t * mv.speed + mv.phase);
      mv.x = mv.baseX + osc * mv.ampX;
      mv.y = mv.baseY + osc * mv.ampY;
      mv.z = mv.baseZ + osc * mv.ampZ;
      mv.mesh.position.set(
        mv.x,
        mv.isPushWall ? mv.y : mv.y - mv.h / 2,
        mv.z,
      );
    }

    // Swinging Hammers
    for (const hm of this.level.hammers) {
      const ang = Math.sin(t * hm.speed + hm.phase) * hm.ampAngle;
      if (hm.swingAxis === 'z') {
        hm.pivot.rotation.z = ang;
        hm.headWorldPos.set(
          hm.pivotX + Math.sin(ang) * hm.armLen,
          hm.pivotY - Math.cos(ang) * hm.armLen,
          hm.pivotZ,
        );
      } else {
        hm.pivot.rotation.x = ang;
        hm.headWorldPos.set(
          hm.pivotX,
          hm.pivotY - Math.cos(ang) * hm.armLen,
          hm.pivotZ - Math.sin(ang) * hm.armLen,
        );
      }
    }

    // Bumper pulse decay
    for (const bmp of this.level.bumpers) {
      if (bmp.pulse > 0) {
        bmp.pulse = Math.max(0, bmp.pulse - dt * 5);
        const s = 1 + bmp.pulse * 0.25;
        bmp.mesh.scale.set(s, 1 - bmp.pulse * 0.1, s);
      }
    }

    // Rolling Candy Boulders
    if (this.phase === 'playing') {
      for (const b of this.level.balls) {
        b.z += b.vz * dt;
        b.mesh.rotation.x += (b.vz * dt) / b.radius;
        if (b.z > b.endZ) {
          b.z = b.startZ;
          b.x = (Math.random() - 0.5) * 10.5;
        }
        b.y = (b.endZ - b.z) * b.slopePerMeter + b.radius;
        b.mesh.position.set(b.x, b.y, b.z);
      }
    }

    // Hex Tiles shaking & dropping
    for (const hex of this.level.hexTiles) {
      if (hex.state === 'shaking') {
        hex.timer -= dt;
        hex.mesh.position.x = hex.x + (Math.random() - 0.5) * 0.12;
        hex.mesh.position.z = hex.z + (Math.random() - 0.5) * 0.12;
        const mat = hex.mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.setHex(0xef4444);
        mat.emissiveIntensity = 0.5;
        if (hex.timer <= 0) {
          hex.state = 'fallen';
          hex.timer = 0;
        }
      } else if (hex.state === 'fallen') {
        hex.timer += dt;
        hex.mesh.position.y -= dt * 14;
        if (hex.timer > 0.8) {
          hex.mesh.visible = false;
        }
      }
    }

    // Block Dash (0.56) Incoming Block Waves & Lethal Lasers
    if (this.phase === 'playing' && this.level.dashBlocks.length > 0) {
      const speedBoost = 1 + Math.min(0.85, this.matchElapsed * 0.022);
      for (const db of this.level.dashBlocks) {
        db.z += db.vz * speedBoost * dt;
        if (db.oscAmpX && db.oscSpeed && db.baseX !== undefined) {
          db.x = db.baseX + Math.sin(t * db.oscSpeed + db.z * 0.08) * db.oscAmpX;
        }
        if (db.z > 13) {
          db.z -= db.recycleSpan || 96;
          db.broken = false;
          db.mesh.visible = true;
        }
        db.mesh.position.set(db.x, db.y, db.z);
      }
    }

    if (this.level.dashLasers.length > 0) {
      const speedBoost = this.phase === 'playing' ? 1 + Math.min(0.85, this.matchElapsed * 0.022) : 0;
      for (const dl of this.level.dashLasers) {
        if (this.phase === 'playing' && dl.vz !== 0) {
          dl.z += dl.vz * speedBoost * dt;
          if (dl.z > 13) {
            dl.z -= dl.recycleSpan;
          }
        }
        dl.mesh.position.set(dl.x, dl.y, dl.z);
      }
    }

    // Laser Tracer (0.56) Sweeping Beams
    if (this.level.laserBeams.length > 0) {
      const speedMult = this.phase === 'playing' ? 1 + Math.min(0.85, this.matchElapsed * 0.02) : 0.4;
      for (const lb of this.level.laserBeams) {
        lb.angle += lb.angularSpeed * speedMult * dt;
        lb.pivot.rotation.y = lb.angle;
      }
    }
  }

  private updateEmoteProjectiles(dt: number): void {
    // 1. Banana Peels
    for (let i = this.bananaHazards.length - 1; i >= 0; i--) {
      const b = this.bananaHazards[i];
      b.life -= dt;
      b.mesh.rotation.y += dt * 2;
      let remove = b.life <= 0;
      if (!remove) {
        for (const c of this.contestants) {
          if (c.id === b.ownerId || c.eliminated || c.qualified || c.stunTimer > 0) continue;
          if (Math.hypot(c.x - b.x, c.z - b.z) < 0.9 && Math.abs(c.y - b.y) < 1.1) {
            if (c.shieldTimer > 0) {
              c.shieldTimer = 0;
              c.rig.shieldBubble.visible = false;
            } else {
              c.vy = 5.5;
              c.vx = (Math.random() - 0.5) * 10;
              c.vz = (Math.random() - 0.5) * 10;
              c.stunTimer = 0.75;
              if (c.isPlayer) this.sound.playSlip();
              this.spawnBurst(c.x, c.y + 0.5, c.z, 8, 0xfacc15, 5, 1.0);
            }
            remove = true;
            break;
          }
        }
      }
      if (remove) {
        this.scene.remove(b.mesh);
        this.bananaHazards.splice(i, 1);
      }
    }

    // 2. Bouncing Soccer Ball Projectiles
    for (let i = this.ballProjectiles.length - 1; i >= 0; i--) {
      const bp = this.ballProjectiles[i];
      bp.life -= dt;
      bp.vy -= 20 * dt;
      bp.x += bp.vx * dt;
      bp.y += bp.vy * dt;
      bp.z += bp.vz * dt;
      const floorH = this.getHighestGroundBelow(bp.x, bp.y, bp.z);
      if (floorH > -50 && bp.y < floorH + 0.65) {
        bp.y = floorH + 0.65;
        bp.vy = 6.5;
      }
      bp.mesh.position.set(bp.x, bp.y, bp.z);
      bp.mesh.rotation.x += dt * 10;

      let remove = bp.life <= 0 || bp.y < -15;
      if (!remove) {
        for (const c of this.contestants) {
          if (c.id === bp.ownerId || c.eliminated || c.qualified) continue;
          if (Math.hypot(c.x - bp.x, c.z - bp.z) < 1.15 && Math.abs(c.y + 0.7 - bp.y) < 1.2) {
            if (c.shieldTimer > 0) {
              c.shieldTimer = 0;
              c.rig.shieldBubble.visible = false;
            } else {
              c.vx = bp.vx * 0.75;
              c.vz = bp.vz * 0.75;
              c.vy = 7.2;
              c.stunTimer = 0.65;
              if (c.isPlayer) this.sound.playHit();
              this.spawnBurst(c.x, c.y + 0.8, c.z, 10, 0x22c55e, 6, 1.1);
            }
            remove = true;
            break;
          }
        }
      }
      if (remove) {
        this.scene.remove(bp.mesh);
        this.ballProjectiles.splice(i, 1);
      }
    }
  }

  private getFloorHeight(
    x: number,
    y: number,
    z: number,
    prevY: number,
  ): {
    found: boolean;
    floorY: number;
    slippery: boolean;
    conveyorZ: number;
    bounceY: number;
    carryX: number;
    carryY: number;
    carryZ: number;
    hexTileIndex: number;
  } {
    let bestY = -999;
    let found = false;
    let slippery = false;
    let conveyorZ = 0;
    let bounceY = 0;
    let carryX = 0;
    let carryY = 0;
    let carryZ = 0;
    let hexTileIndex = -1;

    if (!this.level) {
      return { found, floorY: bestY, slippery, conveyorZ, bounceY, carryX, carryY, carryZ, hexTileIndex };
    }

    const r = 0.36;

    // 1. Static platforms (including sloped ramps)
    for (const p of this.level.platforms) {
      if (
        x >= p.x - p.w / 2 - r &&
        x <= p.x + p.w / 2 + r &&
        z >= p.z - p.d / 2 - r &&
        z <= p.z + p.d / 2 + r
      ) {
        let topY = p.y;
        if (p.slopeRise) {
          const zStart = p.z + p.d / 2;
          const zEnd = p.z - p.d / 2;
          const t = THREE.MathUtils.clamp((zStart - z) / (zStart - zEnd), 0, 1);
          topY = p.y + t * p.slopeRise;
        }
        if (prevY >= topY - 0.65 && y <= topY + 0.35 && topY > bestY) {
          bestY = topY;
          found = true;
          slippery = Boolean(p.slippery);
          conveyorZ = p.conveyorZ || 0;
          bounceY = p.bounceY || 0;
          carryX = 0;
          carryY = 0;
          carryZ = 0;
        }
      }
    }

    // 2. Moving platforms
    for (const mv of this.level.movers) {
      if (mv.isPushWall) continue;
      if (
        x >= mv.x - mv.w / 2 - r &&
        x <= mv.x + mv.w / 2 + r &&
        z >= mv.z - mv.d / 2 - r &&
        z <= mv.z + mv.d / 2 + r
      ) {
        if (prevY >= mv.y - 0.7 && y <= mv.y + 0.4 && mv.y > bestY) {
          bestY = mv.y;
          found = true;
          slippery = false;
          conveyorZ = 0;
          bounceY = 0;
          carryX = mv.x - mv.prevX;
          carryY = mv.y - mv.prevY;
          carryZ = mv.z - mv.prevZ;
        }
      }
    }

    // 3. Hex Tiles
    for (let i = 0; i < this.level.hexTiles.length; i++) {
      const hex = this.level.hexTiles[i];
      if (hex.state === 'fallen') continue;
      const dx = x - hex.x;
      const dz = z - hex.z;
      const distSq = dx * dx + dz * dz;
      const rad = hex.radius + 0.22;
      if (distSq <= rad * rad) {
        if (prevY >= hex.y - 0.6 && y <= hex.y + 0.35 && hex.y > bestY) {
          bestY = hex.y;
          found = true;
          slippery = false;
          conveyorZ = 0;
          bounceY = 0;
          carryX = 0;
          carryY = 0;
          carryZ = 0;
          hexTileIndex = i;
        }
      }
    }

    // 4. Dash Blocks (allow standing/vaulting on top!)
    for (const db of this.level.dashBlocks) {
      if (db.broken) continue;
      if (
        x >= db.x - db.w / 2 - r &&
        x <= db.x + db.w / 2 + r &&
        z >= db.z - db.d / 2 - r &&
        z <= db.z + db.d / 2 + r
      ) {
        const topY = db.y + db.h / 2;
        if (prevY >= topY - 0.45 && y <= topY + 0.35 && topY > bestY) {
          bestY = topY;
          found = true;
          slippery = false;
          conveyorZ = 0;
          bounceY = 0;
          carryX = 0;
          carryY = 0;
          carryZ = 0;
        }
      }
    }

    return { found, floorY: bestY, slippery, conveyorZ, bounceY, carryX, carryY, carryZ, hexTileIndex };
  }

  private getHighestGroundBelow(x: number, y: number, z: number): number {
    if (!this.level) return -99;
    let best = -99;
    for (const p of this.level.platforms) {
      if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) {
        let topY = p.y;
        if (p.slopeRise) {
          const zStart = p.z + p.d / 2;
          const zEnd = p.z - p.d / 2;
          const t = THREE.MathUtils.clamp((zStart - z) / (zStart - zEnd), 0, 1);
          topY = p.y + t * p.slopeRise;
        }
        if (topY <= y + 0.4 && topY > best) best = topY;
      }
    }
    for (const mv of this.level.movers) {
      if (mv.isPushWall) continue;
      if (Math.abs(x - mv.x) <= mv.w / 2 && Math.abs(z - mv.z) <= mv.d / 2) {
        if (mv.y <= y + 0.4 && mv.y > best) best = mv.y;
      }
    }
    for (const hex of this.level.hexTiles) {
      if (hex.state === 'fallen') continue;
      const dx = x - hex.x;
      const dz = z - hex.z;
      if (dx * dx + dz * dz <= hex.radius * hex.radius) {
        if (hex.y <= y + 0.4 && hex.y > best) best = hex.y;
      }
    }
    return best;
  }

  private stepContestants(dt: number): void {
    if (!this.level) return;
    const meta = MAPS_META[this.currentMapId];
    let alive = 0;

    for (const c of this.contestants) {
      if (c.eliminated || c.qualified) {
        // Spectators/qualified idle gently off-screen or cheering at finish
        if (c.qualified) {
          c.animTime += dt;
          animateRig(c.rig, 0, true, false, false, c.animTime, dt);
        }
        continue;
      }
      alive++;

      if (c.diveCooldown > 0) c.diveCooldown -= dt;
      if (c.stunTimer > 0) c.stunTimer -= dt;
      if (c.coyoteTimer > 0) c.coyoteTimer -= dt;
      if (c.activeEmoteTimer > 0) {
        c.activeEmoteTimer -= dt;
        if (c.activeEmoteTimer <= 0) c.activeEmote = null;
      }
      if (c.bubbleTimer > 0) {
        c.bubbleTimer -= dt;
        if (c.bubbleTimer <= 0) c.rig.emoteSprite.visible = false;
      }
      if (c.shieldTimer > 0) {
        c.shieldTimer -= dt;
        c.rig.shieldBubble.rotation.y += dt * 2.5;
        if (c.shieldTimer <= 0) c.rig.shieldBubble.visible = false;
      }
      if (c.invisTimer > 0) {
        c.invisTimer -= dt;
        if (c.invisTimer <= 0) setRigInvisible(c.rig, false);
      }

      // AI Emotes (when enabled)
      if (!c.isPlayer && this.matchEmotesEnabled && this.matchAllowedEmoteIds.size > 0) {
        c.aiEmoteCooldown -= dt;
        if (c.aiEmoteCooldown <= 0) {
          c.aiEmoteCooldown = 6 + Math.random() * 10;
          if (Math.random() < 0.35) {
            const pool = EMOTES_CATALOG.filter((e) => this.matchAllowedEmoteIds.has(e.id));
            if (pool.length > 0) {
              const chosen = pool[Math.floor(Math.random() * pool.length)];
              this.executeEmote(c, chosen);
            }
          }
        }
      }

      // Determine desired input vector (moveX, moveZ)
      let moveX = 0;
      let moveZ = 0;
      let wantJump = false;
      let wantDive = false;

      if (c.isPlayer) {
        let inX = 0;
        let inY = 0;
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) inX -= 1;
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) inX += 1;
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) inY -= 1;
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) inY += 1;

        inX += this.touchMoveX;
        inY += this.touchMoveY;

        const mag = Math.hypot(inX, inY);
        if (mag > 0.05) {
          const normX = inX / Math.max(1, mag);
          const normY = inY / Math.max(1, mag);
          // Camera-relative movement
          const cosY = Math.cos(this.camYaw);
          const sinY = Math.sin(this.camYaw);
          moveX = normX * cosY + normY * sinY;
          moveZ = -normX * sinY + normY * cosY;
        }

        if (this.jumpQueued) {
          wantJump = true;
          this.jumpQueued = false;
        }
        if (this.diveQueued) {
          wantDive = true;
          this.diveQueued = false;
        }
      } else {
        // AI Logic
        const ai = this.computeBotInput(c, dt);
        moveX = ai.moveX;
        moveZ = ai.moveZ;
        wantJump = ai.wantJump;
        wantDive = ai.wantDive;
      }

      // Diving state
      if (wantDive && !c.diving && c.diveCooldown <= 0 && c.stunTimer <= 0) {
        c.diving = true;
        c.diveTimer = 0.36;
        c.diveCooldown = 0.72;
        const dirX = -Math.sin(c.yaw);
        const dirZ = -Math.cos(c.yaw);
        c.vx = dirX * 14.2;
        c.vz = dirZ * 14.2;
        c.vy = Math.max(c.vy, 3.6);
        c.grounded = false;
        if (c.isPlayer) {
          this.sound.playDive();
          this.spawnBurst(c.x, c.y + 0.5, c.z, 7, 0xffffff, 4, 0.9);
          this.callbacks.onMissionProgress?.('dives_made', 1);
        }
      }

      if (c.diving) {
        c.diveTimer -= dt;
        if (c.diveTimer <= 0) {
          c.diving = false;
        }
      }

      // Jump
      if (wantJump && (c.grounded || c.coyoteTimer > 0) && c.stunTimer <= 0) {
        c.vy = 11.8;
        c.grounded = false;
        c.coyoteTimer = 0;
        if (c.isPlayer) {
          this.sound.playJump();
          this.spawnBurst(c.x, c.y + 0.1, c.z, 6, 0xe0f2fe, 3.2, 0.8);
          this.callbacks.onMissionProgress?.('jumps_made', 1);
        }
      }

      // Horizontal acceleration (reduced control when stunned or diving)
      const invisMult = c.invisTimer > 0 ? 1.2 : 1.0;
      const maxSpeed = (c.isPlayer ? 9.6 : 9.1 * c.aiSkill) * invisMult;
      if (c.stunTimer <= 0 && !c.diving) {
        const accel = c.grounded ? 36 : 18;
        const targetVx = moveX * maxSpeed;
        const targetVz = moveZ * maxSpeed;
        c.vx = THREE.MathUtils.damp(c.vx, targetVx, accel * 0.35, dt);
        c.vz = THREE.MathUtils.damp(c.vz, targetVz, accel * 0.35, dt);

        if (Math.hypot(moveX, moveZ) > 0.15) {
          const targetYaw = Math.atan2(-moveX, -moveZ);
          // Shortest angular interpolation
          let diff = targetYaw - c.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          c.yaw += diff * Math.min(1, dt * 14);
        }
      } else if (c.stunTimer > 0) {
        c.vx *= 1 - dt * 1.4;
        c.vz *= 1 - dt * 1.4;
      }

      // Gravity
      c.vy -= 29 * dt;

      const prevY = c.y;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;

      // Ground / Floor check
      const wasGrounded = c.grounded;
      const impactSpeed = -c.vy;
      const floor = this.getFloorHeight(c.x, c.y, c.z, prevY);
      if (floor.found && c.vy <= 0) {
        c.y = floor.floorY;
        c.vy = 0;
        c.grounded = true;
        c.coyoteTimer = 0.12;
        c.fallWhistlePlayed = false;

        if (!wasGrounded && impactSpeed > 3.8 && c.isPlayer) {
          this.sound.playLand(impactSpeed);
        }

        // Carry on moving platforms
        c.x += floor.carryX;
        c.y += floor.carryY;
        c.z += floor.carryZ;

        // Speed chevron conveyor
        if (floor.conveyorZ !== 0) {
          c.z += floor.conveyorZ * dt;
        }

        // Bouncy pad
        if (floor.bounceY > 0) {
          c.vy = floor.bounceY;
          c.grounded = false;
          if (c.isPlayer) {
            this.sound.playBounce();
            this.spawnBurst(c.x, c.y + 0.2, c.z, 10, 0xf43f5e, 6, 1.1);
          }
        }

        // Hex tile trigger!
        if (floor.hexTileIndex >= 0 && this.level.hexTiles[floor.hexTileIndex]) {
          const hex = this.level.hexTiles[floor.hexTileIndex];
          if (hex.state === 'solid') {
            hex.state = 'shaking';
            hex.timer = 0.56;
            if (c.isPlayer) {
              this.sound.playTileCrack();
            }
          }
        }
      } else {
        c.grounded = false;
      }

      // Hazard Collisions
      this.checkHazardCollisions(c);

      // Checkpoints (Race)
      if (meta.type === 'race') {
        for (let cp = c.checkpointIdx + 1; cp < this.level.checkpoints.length; cp++) {
          if (c.z <= this.level.checkpoints[cp].z) {
            c.checkpointIdx = cp;
          }
        }
      }

      // Falling off into the abyss whistle
      if (c.isPlayer && !c.fallWhistlePlayed && c.y < -2.6 && c.vy < -5) {
        c.fallWhistlePlayed = true;
        this.sound.playFall();
      }

      // Out of bounds / Fallen
      if (c.y < this.level.fallLimitY) {
        if (meta.type === 'survival') {
          c.eliminated = true;
          c.rig.root.visible = false;
          if (c.isPlayer) {
            this.sound.playEliminate();
            this.sound.stopMusic();
            this.phase = 'eliminated';
            this.emitHud();
          }
        } else {
          // Respawn at latest checkpoint
          const cp = this.level.checkpoints[c.checkpointIdx] || this.level.checkpoints[0];
          c.x = cp.spawnX + (Math.random() - 0.5) * 4;
          c.y = cp.spawnY + 1.5;
          c.z = cp.spawnZ;
          c.vx = 0;
          c.vy = 0;
          c.vz = 0;
          c.stunTimer = 0;
          c.diving = false;
          c.fallWhistlePlayed = false;
          if (c.isPlayer) {
            this.sound.playRespawn();
          }
        }
      }

      // Race Finish Check
      if (meta.type === 'race' && c.z <= this.level.finishZ && !c.qualified) {
        c.qualified = true;
        this.qualifyCount++;
        c.rank = this.qualifyCount;
        c.vx = 0;
        c.vz = 0;

        if (c.isPlayer) {
          this.sound.playQualify();
          this.spawnBurst(c.x, c.y + 1.5, c.z, 28, 0xfacc15, 8, 1.4);
          this.feedText = `¡Clasificado #${c.rank}!`;
          this.feedTimer = 2.5;
          this.callbacks.onMissionProgress?.('rounds_qualified', 1);
        } else {
          this.feedText = `${c.name} clasificó (${this.qualifyCount}/${this.qualifyTarget})`;
          this.feedTimer = 1.6;
        }

        if (this.qualifyCount >= this.qualifyTarget || (c.isPlayer && this.tournamentQueue.length === 1)) {
          this.concludeRaceRound();
        }
      }

      // Update Visual Transform & Animation
      c.rig.root.position.set(c.x, c.y, c.z);
      c.rig.root.rotation.y = c.yaw;

      // Ground shadow height tracking
      const groundUnder = this.getHighestGroundBelow(c.x, c.y, c.z);
      if (groundUnder > -50) {
        c.rig.shadowMesh.visible = true;
        const heightAbove = Math.max(0, c.y - groundUnder);
        c.rig.shadowMesh.position.y = -heightAbove + 0.04;
        const s = Math.max(0.35, 1 - heightAbove * 0.12);
        c.rig.shadowMesh.scale.setScalar(s);
      } else {
        c.rig.shadowMesh.visible = false;
      }

      const hSpeed = Math.hypot(c.vx, c.vz);

      // 0.56 Footstep trail particles
      if (c.isPlayer && c.grounded && hSpeed > 3.5 && this.playerFootstep.id !== 'normal') {
        c.footstepTimer -= dt;
        if (c.footstepTimer <= 0) {
          c.footstepTimer = 0.09;
          const colors = this.playerFootstep.colors;
          const col = colors[Math.floor(Math.random() * colors.length)];
          this.spawnBurst(c.x, c.y + 0.08, c.z, 2, col, 1.8, 0.75);
        }
      }

      c.animTime += dt * (0.6 + hSpeed * 0.08);
      animateRig(
        c.rig,
        hSpeed / 9.5,
        c.grounded,
        c.diving,
        c.stunTimer > 0,
        c.animTime,
        dt,
        c.activeEmote,
      );
    }

    // Prevent waiting indefinitely after player qualifies in a large race round
    if (meta.type === 'race' && this.phase === 'playing' && this.player?.qualified) {
      this.playerQualifiedTimer += dt;
      if (this.playerQualifiedTimer >= 7.0) {
        this.concludeRaceRound();
        return;
      }
    }

    // Check Survival Completion (supports both intermediate multi-qualify tournament phases and 1-winner Finals!)
    if (meta.type === 'survival' && this.phase === 'playing') {
      const remaining = this.contestants.filter((x) => !x.eliminated);
      if (remaining.length <= this.qualifyTarget) {
        const playerAlive = Boolean(this.player && !this.player.eliminated);
        if (this.qualifyTarget > 1 && this.roundIndex + 1 < this.tournamentQueue.length) {
          this.sound.stopMusic();
          if (playerAlive && this.player) {
            this.player.qualified = true;
            this.player.rank = Math.max(1, remaining.indexOf(this.player) + 1);
            this.sound.playQualify();
            this.phase = 'round_over';
            this.callbacks.onRoundReward?.(true, false, this.currentMode === 'tournament');
            this.callbacks.onMissionProgress?.('rounds_qualified', 1);
          } else {
            this.sound.playEliminate();
            this.phase = 'eliminated';
            this.callbacks.onRoundReward?.(false, false, this.currentMode === 'tournament');
          }
          this.emitHud();
        } else {
          const champ = remaining[0];
          this.winnerName = champ ? champ.name : this.playerName;
          const playerWon = Boolean(champ?.isPlayer);
          this.sound.stopMusic();
          if (playerWon) {
            this.sound.playCrown();
            this.phase = 'victory';
          } else {
            this.sound.playEliminate();
            this.phase = 'eliminated';
          }
          this.callbacks.onTournamentCrown(
            this.winnerName,
            playerWon,
            this.currentMode === 'tournament',
          );
          this.callbacks.onRoundReward?.(
            playerWon,
            playerWon,
            this.currentMode === 'tournament',
          );
          this.emitHud();
        }
      }
    }
  }

  private concludeRaceRound(): void {
    if (!this.player) return;
    this.sound.stopMusic();
    if (this.player.qualified) {
      if (this.roundIndex + 1 >= this.tournamentQueue.length) {
        this.winnerName = this.player.name;
        this.sound.playCrown();
        this.phase = 'victory';
        this.callbacks.onTournamentCrown(
          this.winnerName,
          true,
          this.currentMode === 'tournament',
        );
        this.callbacks.onRoundReward?.(true, true, this.currentMode === 'tournament');
      } else {
        this.phase = 'round_over';
        this.callbacks.onRoundReward?.(true, false, this.currentMode === 'tournament');
      }
    } else {
      const firstFinisher = this.contestants.find((x) => x.rank === 1);
      if (firstFinisher) {
        this.winnerName = firstFinisher.name;
      }
      this.sound.playEliminate();
      this.phase = 'eliminated';
      this.callbacks.onRoundReward?.(false, false, this.currentMode === 'tournament');
    }
    this.emitHud();
  }

  private checkHazardCollisions(c: Contestant): void {
    if (!this.level) return;
    const charRad = 0.45;

    // 1. Spinners (Sweeper bars)
    for (const sp of this.level.spinners) {
      if (Math.abs(c.y + 0.65 - sp.y) > 0.95) continue;
      const dx = c.x - sp.x;
      const dz = c.z - sp.z;
      if (dx * dx + dz * dz > (sp.armLength + charRad + 0.5) ** 2) continue;

      const angles = sp.armCount === 4 ? [sp.angle, sp.angle + Math.PI / 2] : [sp.angle];
      for (const a of angles) {
        const ux = Math.cos(a);
        const uz = -Math.sin(a);
        const proj = THREE.MathUtils.clamp(dx * ux + dz * uz, -sp.armLength, sp.armLength);
        const cx = sp.x + ux * proj;
        const cz = sp.z + uz * proj;
        const distX = c.x - cx;
        const distZ = c.z - cz;
        const dist = Math.hypot(distX, distZ);
        const minDist = sp.armRadius + charRad;
        if (dist < minDist) {
          // Tangent push direction + outward impulse
          const nx = dist > 0.01 ? distX / dist : 0;
          const nz = dist > 0.01 ? distZ / dist : 1;
          c.x = cx + nx * (minDist + 0.05);
          c.z = cz + nz * (minDist + 0.05);
          if (c.stunTimer <= 0) {
            if (c.shieldTimer > 0) {
              c.shieldTimer = 0;
              c.rig.shieldBubble.visible = false;
              c.stunTimer = 0.2;
              if (c.isPlayer) {
                this.sound.playShield();
                this.spawnBurst(c.x, c.y + 0.8, c.z, 10, 0x38bdf8, 5, 1);
              }
            } else {
              c.vx = nx * sp.knockForce;
              c.vz = nz * sp.knockForce;
              c.vy = 6.5;
              c.grounded = false;
              c.stunTimer = 0.5;
              if (c.isPlayer) {
                this.sound.playHit();
                this.spawnBurst(c.x, c.y + 0.8, c.z, 10, 0xfacc15, 6, 1);
              }
            }
          }
        }
      }
    }

    // 2. Push Walls
    for (const mv of this.level.movers) {
      if (!mv.isPushWall) continue;
      const halfW = mv.w / 2 + charRad;
      const halfD = mv.d / 2 + charRad;
      if (
        c.y < mv.y + mv.h / 2 &&
        c.y + 1.4 > mv.y - mv.h / 2 &&
        Math.abs(c.x - mv.x) < halfW &&
        Math.abs(c.z - mv.z) < halfD
      ) {
        const overlapX = halfW - Math.abs(c.x - mv.x);
        const overlapZ = halfD - Math.abs(c.z - mv.z);
        if (overlapX < overlapZ) {
          const sign = c.x >= mv.x ? 1 : -1;
          c.x = mv.x + sign * halfW;
          c.vx = sign * 8 + (mv.x - mv.prevX) * 35;
        } else {
          const sign = c.z >= mv.z ? 1 : -1;
          c.z = mv.z + sign * halfD;
          c.vz = sign * 8;
        }
        if (c.isPlayer) {
          this.sound.playBump();
        }
      }
    }

    // 3. Bouncy Pinball Bumpers
    for (const bmp of this.level.bumpers) {
      if (c.y > bmp.y + bmp.height + 0.3 || c.y + 1.3 < bmp.y) continue;
      const dx = c.x - bmp.x;
      const dz = c.z - bmp.z;
      const dist = Math.hypot(dx, dz);
      const minDist = bmp.radius + charRad;
      if (dist < minDist) {
        const nx = dist > 0.01 ? dx / dist : 0;
        const nz = dist > 0.01 ? dz / dist : 1;
        c.x = bmp.x + nx * (minDist + 0.1);
        c.z = bmp.z + nz * (minDist + 0.1);
        c.vx = nx * bmp.bounceForce;
        c.vz = nz * bmp.bounceForce;
        c.vy = 6.2;
        c.grounded = false;
        bmp.pulse = 1;
        if (c.isPlayer) {
          this.sound.playBounce();
          this.spawnBurst(c.x, c.y + 0.8, c.z, 10, 0xf43f5e, 5.5, 1);
        }
      }
    }

    // 4. Swinging Hammers
    for (const hm of this.level.hammers) {
      const dx = c.x - hm.headWorldPos.x;
      const dy = c.y + 0.7 - hm.headWorldPos.y;
      const dz = c.z - hm.headWorldPos.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const minD = hm.headRadius + charRad;
      if (distSq < minD * minD && c.stunTimer <= 0) {
        if (c.shieldTimer > 0) {
          c.shieldTimer = 0;
          c.rig.shieldBubble.visible = false;
          c.stunTimer = 0.25;
          if (c.isPlayer) {
            this.sound.playShield();
            this.spawnBurst(c.x, c.y + 0.8, c.z, 10, 0x38bdf8, 5, 1);
          }
        } else {
          const dist = Math.sqrt(distSq) || 0.1;
          c.vx = (dx / dist) * 16;
          c.vz = (dz / dist) * 16;
          c.vy = 7.5;
          c.grounded = false;
          c.stunTimer = 0.65;
          if (c.isPlayer) {
            this.sound.playHit();
            this.spawnBurst(c.x, c.y + 0.8, c.z, 12, 0xfef08a, 7, 1.2);
          }
        }
      }
    }

    // 5. Rolling Candy Boulders
    for (const b of this.level.balls) {
      const dx = c.x - b.x;
      const dy = c.y + 0.7 - b.y;
      const dz = c.z - b.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const minD = b.radius + charRad;
      if (distSq < minD * minD && c.stunTimer <= 0) {
        if (c.shieldTimer > 0) {
          c.shieldTimer = 0;
          c.rig.shieldBubble.visible = false;
          c.stunTimer = 0.25;
          if (c.isPlayer) {
            this.sound.playShield();
            this.spawnBurst(c.x, c.y + 0.8, c.z, 10, 0x38bdf8, 5, 1);
          }
        } else {
          const dist = Math.sqrt(distSq) || 0.1;
          c.vx = (dx / dist) * 13;
          c.vz = (dz / dist) * 13 + 6;
          c.vy = 7.2;
          c.grounded = false;
          c.stunTimer = 0.6;
          if (c.isPlayer) {
            this.sound.playHit();
            this.spawnBurst(c.x, c.y + 0.8, c.z, 10, 0xf97316, 6, 1.1);
          }
        }
      }
    }

    // 6. Block Dash (0.56) Incoming Blocks
    for (const db of this.level.dashBlocks) {
      if (db.broken) continue;
      const topY = db.y + db.h / 2;
      if (c.y >= topY - 0.35) continue;
      const halfW = db.w / 2 + charRad;
      const halfD = db.d / 2 + charRad;
      if (
        c.y + 1.35 > db.y - db.h / 2 &&
        Math.abs(c.x - db.x) < halfW &&
        Math.abs(c.z - db.z) < halfD
      ) {
        if (db.breakable && c.diving) {
          db.broken = true;
          db.mesh.visible = false;
          this.spawnBurst(db.x, db.y, db.z, 12, 0xf43f5e, 7, 1.1);
          if (c.isPlayer) this.sound.playHit();
          continue;
        }
        const overlapX = halfW - Math.abs(c.x - db.x);
        const overlapZ = halfD - Math.abs(c.z - db.z);
        if (overlapX < overlapZ && c.z < db.z + db.d / 2) {
          const sign = c.x >= db.x ? 1 : -1;
          c.x = db.x + sign * halfW;
          c.vx = sign * 6.5;
        } else {
          c.z = db.z + halfD + 0.04;
          c.vz = Math.max(c.vz, db.vz + 4.5);
        }
        if (c.isPlayer) this.sound.playBump();
      }
    }

    // 7. Laser Tracer (0.56) Sweeping Beams
    for (const lb of this.level.laserBeams) {
      if (c.y > lb.y + lb.radius + 0.1 || c.y + 1.25 < lb.y - lb.radius) continue;
      const ux = Math.cos(lb.angle);
      const uz = -Math.sin(lb.angle);
      const proj = THREE.MathUtils.clamp(c.x * ux + c.z * uz, -lb.length, lb.length);
      const cx = ux * proj;
      const cz = uz * proj;
      const distX = c.x - cx;
      const distZ = c.z - cz;
      const dist = Math.hypot(distX, distZ);
      if (dist < lb.radius + charRad && c.stunTimer <= 0) {
        if (c.shieldTimer > 0) {
          c.shieldTimer = 0;
          c.rig.shieldBubble.visible = false;
          c.stunTimer = 0.25;
          if (c.isPlayer) {
            this.sound.playShield();
            this.spawnBurst(c.x, c.y + 0.8, c.z, 10, 0x38bdf8, 5, 1);
          }
        } else {
          const nx = dist > 0.01 ? distX / dist : 0;
          const nz = dist > 0.01 ? distZ / dist : 1;
          c.vx = nx * 14.5;
          c.vz = nz * 14.5;
          c.vy = 6.8;
          c.grounded = false;
          c.stunTimer = 0.55;
          if (c.isPlayer) {
            this.sound.playLaser();
            this.spawnBurst(c.x, c.y + 0.8, c.z, 12, 0xef4444, 6.5, 1.15);
          }
        }
      }
    }

    // 8. Block Dash Lethal Red Lasers (instant death on contact!)
    for (const dl of this.level.dashLasers) {
      const charTopY = c.y + (c.diving ? 0.85 : 1.65);
      if (
        Math.abs(c.x - dl.x) <= dl.halfW + charRad * 0.55 &&
        Math.abs(c.z - dl.z) <= dl.radius + charRad * 0.6 &&
        c.y <= dl.y + dl.radius &&
        charTopY >= dl.y - dl.radius
      ) {
        c.eliminated = true;
        c.rig.root.visible = false;
        this.spawnBurst(c.x, c.y + 0.8, c.z, 16, 0xef4444, 7.5, 1.25);
        if (c.isPlayer) {
          this.sound.playLaser();
          this.sound.playEliminate();
          this.sound.stopMusic();
          this.feedText = '¡Tocaste un láser mortal!';
          this.phase = 'eliminated';
          this.emitHud();
        } else {
          this.feedText = `${c.name} tocó un láser`;
          this.feedTimer = 1.6;
        }
        return;
      }
    }
  }

  private resolvePlayerCollisions(): void {
    const active = this.contestants;
    const minDist = 0.82;
    const minDistSq = minDist * minDist;

    for (let i = 0; i < active.length; i++) {
      const a = active[i];
      if (a.eliminated || a.qualified) continue;
      for (let j = i + 1; j < active.length; j++) {
        const b = active[j];
        if (b.eliminated || b.qualified) continue;
        if (Math.abs(a.y - b.y) > 1.2) continue;

        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDistSq && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          b.x += nx * overlap;
          b.z += nz * overlap;

          // Dive bump!
          if (a.diving && !b.diving && b.stunTimer <= 0) {
            b.vx += nx * 7;
            b.vz += nz * 7;
            b.vy = 4;
            if (a.isPlayer || b.isPlayer) {
              this.sound.playBump();
            }
          } else if (b.diving && !a.diving && a.stunTimer <= 0) {
            a.vx -= nx * 7;
            a.vz -= nz * 7;
            a.vy = 4;
            if (a.isPlayer || b.isPlayer) {
              this.sound.playBump();
            }
          } else if ((a.isPlayer || b.isPlayer) && (Math.hypot(a.vx, a.vz) > 4 || Math.hypot(b.vx, b.vz) > 4)) {
            this.sound.playBump();
          }
        }
      }
    }
  }

  private computeBotInput(
    c: Contestant,
    dt: number,
  ): { moveX: number; moveZ: number; wantJump: boolean; wantDive: boolean } {
    if (!this.level) {
      return { moveX: 0, moveZ: 0, wantJump: false, wantDive: false };
    }

    const meta = MAPS_META[this.currentMapId];
    c.aiJumpCooldown -= dt;

    if (meta.type === 'survival') {
      // Block Dash 0.56 AI: dodge 2-high blocks, dive breakables, and jump low lethal lasers
      if (this.level.isBlockDash) {
        let tx = THREE.MathUtils.clamp(c.aiLaneOffset, -6.5, 6.5);
        const tz = 0.5;
        let jumpBlock = false;
        let diveBlock = false;
        let highLaserClose = false;

        for (const dl of this.level.dashLasers) {
          if (dl.vz > 0 && dl.z < c.z && c.z - dl.z < 3.4 && Math.abs(c.x - dl.x) <= dl.halfW + 0.6) {
            if (dl.y < 1.1 && c.grounded && c.aiJumpCooldown <= 0) {
              jumpBlock = true;
            } else if (dl.y >= 1.8 && dl.y < 2.25) {
              highLaserClose = true;
            }
          }
        }

        for (const db of this.level.dashBlocks) {
          if (db.broken) continue;
          if (Math.abs(db.x - c.x) < db.w / 2 + 0.85 && db.z < c.z && c.z - db.z < 4.2) {
            const hasTopStack = db.y > 1.5;
            if (db.breakable && c.diveCooldown <= 0) {
              diveBlock = true;
            } else if (hasTopStack) {
              // Towering 2-high wall ahead: dodge sideways toward center/open gap
              tx = db.x >= 0 ? Math.max(-6.8, db.x - 3.6) : Math.min(6.8, db.x + 3.6);
            } else if (!highLaserClose && c.grounded && c.aiJumpCooldown <= 0) {
              jumpBlock = true;
            }
          }
        }

        if (highLaserClose) jumpBlock = false;
        if (jumpBlock) c.aiJumpCooldown = 0.72;

        const dx = tx - c.x;
        const dz = tz - c.z;
        const dist = Math.hypot(dx, dz) || 1;
        return {
          moveX: dist > 0.6 ? dx / dist : 0,
          moveZ: dist > 0.6 ? dz / dist : 0,
          wantJump: jumpBlock,
          wantDive: diveBlock,
        };
      }

      // Laser Tracer 0.56 AI: stay near center & jump sweeping low lasers
      if (this.level.isLaserTracer) {
        const tx = Math.cos(this.elapsedTotal * 0.7 + c.id) * 5.2;
        const tz = Math.sin(this.elapsedTotal * 0.7 + c.id) * 5.2;
        let wantJump = false;
        if (c.grounded && c.aiJumpCooldown <= 0) {
          for (const lb of this.level.laserBeams) {
            if (lb.y > 1.2) continue;
            const ux = Math.cos(lb.angle);
            const uz = -Math.sin(lb.angle);
            const proj = THREE.MathUtils.clamp(c.x * ux + c.z * uz, -lb.length, lb.length);
            const dist = Math.hypot(c.x - ux * proj, c.z - uz * proj);
            if (dist < 2.2) {
              wantJump = true;
              c.aiJumpCooldown = 0.65;
              break;
            }
          }
        }
        const dx = tx - c.x;
        const dz = tz - c.z;
        const dist = Math.hypot(dx, dz) || 1;
        return { moveX: dx / dist, moveZ: dz / dist, wantJump, wantDive: false };
      }

      // Hexágonos Clásicos AI: find nearest solid tile on current layer!
      if (this.level.hexTiles.length > 0) {
        c.aiHexDecisionTimer -= dt;
        if (c.aiHexDecisionTimer <= 0) {
          c.aiHexDecisionTimer = 0.25 + Math.random() * 0.2;
          let bestDist = Infinity;
          let foundTile = false;
          for (const hex of this.level.hexTiles) {
            if (hex.state !== 'solid') continue;
            if (Math.abs(hex.y - c.y) > 2.2) continue;
            const d = Math.hypot(hex.x - c.x, hex.z - c.z);
            if (d < bestDist && d > 0.4) {
              bestDist = d;
              c.aiHexTargetX = hex.x;
              c.aiHexTargetZ = hex.z;
              foundTile = true;
            }
          }
          if (!foundTile) {
            c.aiHexTargetX = 0;
            c.aiHexTargetZ = 0;
          }
        }

        const dx = c.aiHexTargetX - c.x;
        const dz = c.aiHexTargetZ - c.z;
        const dist = Math.hypot(dx, dz) || 1;
        const wantJump = c.grounded && dist > 2.4 && c.aiJumpCooldown <= 0;
        if (wantJump) c.aiJumpCooldown = 0.7;
        return {
          moveX: dx / dist,
          moveZ: dz / dist,
          wantJump,
          wantDive: false,
        };
      }

      // Generic survival (Lava Land): orbit safely near center island / nearest platform
      const tx = Math.cos(this.elapsedTotal * 0.4 + c.id) * 3.2;
      const tz = Math.sin(this.elapsedTotal * 0.4 + c.id) * 3.2;
      const dx = tx - c.x;
      const dz = tz - c.z;
      const dist = Math.hypot(dx, dz) || 1;
      let wantJump = false;
      if (c.grounded && c.aiJumpCooldown <= 0) {
        const ahead = this.getHighestGroundBelow(c.x + (dx / dist) * 1.4, c.y, c.z + (dz / dist) * 1.4);
        if (ahead < c.y - 1.5) {
          wantJump = true;
          c.aiJumpCooldown = 0.75;
        }
      }
      return { moveX: dx / dist, moveZ: dz / dist, wantJump, wantDive: false };
    }

    // Race AI: Steer toward next waypoint + lane offset
    const wps = this.level.waypoints;
    let wp = wps[c.aiWaypointIdx];
    if (wp && c.z <= wp.z + 2.5 && c.aiWaypointIdx < wps.length - 1) {
      c.aiWaypointIdx++;
      wp = wps[c.aiWaypointIdx];
    }

    const targetX = wp ? wp.x + c.aiLaneOffset * 0.5 : 0;
    const targetZ = wp ? wp.z : this.level.finishZ;

    const dx = targetX - c.x;
    const dz = targetZ - c.z;
    const dist = Math.hypot(dx, dz) || 1;

    // Look ahead for gap or spinner to jump!
    let wantJump = false;
    let wantDive = false;
    if (c.grounded && c.aiJumpCooldown <= 0) {
      const aheadFloor = this.getHighestGroundBelow(
        c.x + (dx / dist) * 1.4,
        c.y,
        c.z + (dz / dist) * 1.4,
      );
      if (aheadFloor < c.y - 1.5) {
        wantJump = true;
        c.aiJumpCooldown = 0.8;
      } else {
        // Check spinner proximity
        for (const sp of this.level.spinners) {
          if (Math.hypot(c.x - sp.x, c.z - sp.z) < sp.armLength + 1.2) {
            wantJump = Math.random() < 0.45;
            if (wantJump) c.aiJumpCooldown = 0.9;
            break;
          }
        }
      }
    } else if (!c.grounded && c.vy < -1.5 && c.diveCooldown <= 0 && Math.random() < 0.08) {
      wantDive = true;
    }

    return {
      moveX: dx / dist,
      moveZ: dz / dist,
      wantJump,
      wantDive,
    };
  }

  private updateMatchCamera(dt: number): void {
    if (!this.player) return;

    if (this.phase === 'intro') {
      // Sweeping overview pan down toward the starting grid!
      const frac = THREE.MathUtils.clamp(1 - this.phaseTimer / 1.6, 0, 1);
      _v1.set(0, 18, -32);
      _v2.set(
        this.player.x,
        this.player.y + 5.8,
        this.player.z + 10.5,
      );
      this.camera.position.lerpVectors(_v1, _v2, frac);
      _camTarget.set(this.player.x, this.player.y + 1.4, this.player.z - 6 * (1 - frac));
      this.camera.lookAt(_camTarget);
      return;
    }

    // Dynamic FOV boost when diving
    const targetFov = this.player.diving ? 66 : 58;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 10, dt);
      this.camera.updateProjectionMatrix();
    }

    const horizDist = Math.cos(this.camPitch) * this.camDist;
    const vertDist = Math.sin(this.camPitch) * this.camDist;

    _camDesired.set(
      this.player.x + Math.sin(this.camYaw) * horizDist,
      this.player.y + 1.6 + vertDist,
      this.player.z + Math.cos(this.camYaw) * horizDist,
    );

    this.camera.position.lerp(_camDesired, 1 - Math.exp(-11 * dt));
    _camTarget.set(this.player.x, this.player.y + 1.25, this.player.z);
    this.camera.lookAt(_camTarget);

    // Move shadow frustum with player
    this.keyLight.position.set(
      this.player.x + 22,
      this.player.y + 38,
      this.player.z + 18,
    );
    this.keyLight.target.position.set(this.player.x, this.player.y, this.player.z);
  }

  private updateParticles(dt: number): void {
    let anyDirty = false;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyDirty = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      p.vy -= 12 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const frac = 1 - p.life / p.maxLife;
      _dummy.position.set(p.x, p.y, p.z);
      _dummy.scale.setScalar(p.scale * frac);
      _dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummy.matrix);
      this.particleMesh.setColorAt(i, p.color);
    }
    if (anyDirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private emitHud(): void {
    const meta = MAPS_META[this.currentMapId];
    const aliveCount = this.contestants.filter((c) => !c.eliminated).length;
    const isTournament = this.currentMode === 'tournament';
    const stage = isTournament
      ? TOURNAMENT_STAGES[this.roundIndex] || TOURNAMENT_STAGES[TOURNAMENT_STAGES.length - 1]
      : null;
    const stageName = stage ? stage.name : `Ronda ${this.roundIndex + 1}`;

    let countdownText = '';
    if (this.phase === 'intro') {
      countdownText = isTournament
        ? `${stageName.toUpperCase()} · ${meta.name.toUpperCase()}`
        : meta.name.toUpperCase();
    } else if (this.phase === 'countdown') {
      const n = Math.ceil(this.phaseTimer);
      countdownText = n > 0 ? String(n) : '¡YA!';
    }

    const effectiveSlots = this.getEffectiveEmoteSlots();
    this.callbacks.onHudUpdate({
      phase: this.phase,
      roundNumber: this.roundIndex + 1,
      totalRounds: this.tournamentQueue.length,
      isTournament,
      stageName,
      stages: isTournament ? TOURNAMENT_STAGES : [],
      mapMeta: meta,
      qualifyCount: this.qualifyCount,
      qualifyTarget: this.qualifyTarget,
      aliveCount,
      totalContestants: this.contestants.length,
      countdownText,
      elapsedTime: this.matchElapsed,
      playerQualified: Boolean(this.player?.qualified),
      playerEliminated: Boolean(this.player?.eliminated),
      playerRank: this.player?.rank ?? null,
      winnerName: this.winnerName,
      feedText: this.feedText,
      emotesEnabled: this.matchEmotesEnabled && effectiveSlots.length > 0,
      emoteSlots: effectiveSlots,
      emoteCooldowns: { ...this.emoteCooldowns },
      shieldActive: (this.player?.shieldTimer || 0) > 0,
      invisActive: (this.player?.invisTimer || 0) > 0,
      partyBadge: this.activeParty
        ? this.activeParty.partyType === 'normal'
          ? `Grupo Normal · ${this.activeParty.roomCode}`
          : `Personalizada · ${this.activeParty.roomCode}`
        : null,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.sound.stopMusic();
    this.unbindEvents();
    this.cleanupLevel();
    this.shadowTex.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
