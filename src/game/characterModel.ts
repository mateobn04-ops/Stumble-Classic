import * as THREE from 'three';
import { EmoteId, SkinConfig, VictoryAnimId, WBadgeColor } from './types';
import { createCharacterPatternTexture } from './textures';

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  headGroup: THREE.Group;
  shadowMesh: THREE.Mesh;
  shieldBubble: THREE.Mesh;
  emoteSprite: THREE.Sprite;
  nameSprite: THREE.Sprite;
  bodyMaterials: THREE.MeshStandardMaterial[];
}

const sharedGeo = {
  torso: new THREE.CapsuleGeometry(0.42, 0.5, 8, 16),
  head: new THREE.SphereGeometry(0.41, 18, 14),
  face: new THREE.SphereGeometry(0.32, 14, 12),
  ogEye: new THREE.CapsuleGeometry(0.042, 0.085, 6, 8),
  bigEye: new THREE.SphereGeometry(0.095, 10, 10),
  belt: new THREE.CylinderGeometry(0.435, 0.435, 0.09, 18),
  arm: new THREE.CapsuleGeometry(0.115, 0.27, 6, 10),
  hand: new THREE.SphereGeometry(0.135, 10, 10),
  leg: new THREE.CapsuleGeometry(0.135, 0.21, 6, 10),
  shoe: new THREE.BoxGeometry(0.27, 0.16, 0.37),
  capDome: new THREE.SphereGeometry(0.43, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
  capBrim: new THREE.CylinderGeometry(0.44, 0.44, 0.055, 16, 1, false, -Math.PI * 0.38, Math.PI * 0.76),
  hoodRim: new THREE.TorusGeometry(0.43, 0.085, 10, 22),
  headphoneCup: new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12),
  kabutoDome: new THREE.SphereGeometry(0.46, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
  kabutoWing: new THREE.BoxGeometry(0.16, 0.34, 0.06),
  horn: new THREE.ConeGeometry(0.08, 0.36, 10),
  snout: new THREE.CapsuleGeometry(0.18, 0.16, 6, 10),
  manePuff: new THREE.SphereGeometry(0.17, 10, 8),
  visor: new THREE.SphereGeometry(0.445, 16, 12, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.2, Math.PI * 0.52),
  backpack: new THREE.BoxGeometry(0.48, 0.52, 0.24),
  wing: new THREE.BoxGeometry(0.05, 0.44, 0.22),
  earLong: new THREE.ConeGeometry(0.11, 0.46, 6),
  antennaStem: new THREE.CylinderGeometry(0.025, 0.03, 0.28, 8),
  antennaOrb: new THREE.SphereGeometry(0.08, 10, 10),
  tricornBrim: new THREE.CylinderGeometry(0.62, 0.58, 0.12, 3),
  hairBun: new THREE.SphereGeometry(0.16, 10, 10),
  crestPlane: new THREE.PlaneGeometry(0.36, 0.44),
  // 0.56 accessory geometries
  crownBand: new THREE.CylinderGeometry(0.28, 0.25, 0.2, 8),
  crownSpike: new THREE.ConeGeometry(0.07, 0.22, 6),
  bananaTop: new THREE.ConeGeometry(0.32, 0.55, 12),
  hotdogBun: new THREE.CapsuleGeometry(0.22, 0.88, 6, 12),
  beakCone: new THREE.ConeGeometry(0.14, 0.28, 8),
  sharkFin: new THREE.ConeGeometry(0.18, 0.52, 4),
  dragonWing: new THREE.BoxGeometry(0.55, 0.38, 0.06),
  cyberBar: new THREE.BoxGeometry(0.56, 0.14, 0.14),
  glamFrame: new THREE.TorusGeometry(0.13, 0.035, 8, 16),
  wizardCone: new THREE.ConeGeometry(0.42, 0.72, 14),
  wizardBrim: new THREE.CylinderGeometry(0.62, 0.62, 0.05, 18),
  haloRing: new THREE.TorusGeometry(0.42, 0.045, 8, 24),
  shieldSphere: new THREE.SphereGeometry(1.05, 18, 14),
};

const badgeTextureCache = new Map<string, THREE.Texture>();
const badgeLoader = new THREE.TextureLoader();

function getBadgeTexture(url: string): THREE.Texture {
  const existing = badgeTextureCache.get(url);
  if (existing) return existing;
  const tex = badgeLoader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  badgeTextureCache.set(url, tex);
  return tex;
}

const emoteTextureCache = new Map<string, THREE.CanvasTexture>();

export function getEmoteBubbleTexture(icon: string, bgColor: string): THREE.CanvasTexture {
  const key = `${icon}_${bgColor}`;
  const existing = emoteTextureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  // Speech bubble background
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(80, 74, 62, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(64, 128);
  ctx.lineTo(80, 154);
  ctx.lineTo(96, 128);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 6;
  ctx.strokeStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(80, 74, 60, 0, Math.PI * 2);
  ctx.stroke();

  // Inner colored disk
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(80, 74, 50, 0, Math.PI * 2);
  ctx.fill();

  // Emoji glyph
  ctx.font = '64px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(icon, 80, 78);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  emoteTextureCache.set(key, tex);
  return tex;
}

const nameTagTextureCache = new Map<string, THREE.CanvasTexture>();

export function getNameTagTexture(
  name: string,
  isPlayer: boolean,
  hasW: boolean,
  wColor: WBadgeColor,
): THREE.CanvasTexture {
  const key = `${name}_${isPlayer ? '1' : '0'}_${hasW ? wColor : 'none'}`;
  const existing = nameTagTextureCache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  const fontMain = '800 34px "Plus Jakarta Sans", system-ui, sans-serif';
  const fontW = '900 34px "Bricolage Grotesque", system-ui, sans-serif';

  ctx.font = fontMain;
  const nameWidth = ctx.measureText(name).width;
  ctx.font = fontW;
  const wText = hasW ? '[W]' : '';
  const wWidth = hasW ? ctx.measureText(wText).width + 12 : 0;

  const totalTextWidth = wWidth + nameWidth;
  const padX = 26;
  const boxW = Math.min(404, Math.max(130, totalTextWidth + padX * 2));
  const boxH = 62;
  const boxX = (canvas.width - boxW) / 2;
  const boxY = (canvas.height - boxH) / 2;
  const radius = 22;

  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, radius);
  ctx.fillStyle = isPlayer ? 'rgba(8, 22, 48, 0.88)' : 'rgba(15, 23, 42, 0.62)';
  ctx.fill();

  ctx.lineWidth = isPlayer ? 4 : 2;
  ctx.strokeStyle = isPlayer ? '#facc15' : 'rgba(255, 255, 255, 0.35)';
  ctx.stroke();

  const startX = (canvas.width - totalTextWidth) / 2;
  const centerY = canvas.height / 2 + 2;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  if (hasW) {
    ctx.font = fontW;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.95)';
    ctx.strokeText(wText, startX, centerY);

    if (wColor === 'blue') {
      ctx.fillStyle = '#38bdf8';
    } else if (wColor === 'red') {
      ctx.fillStyle = '#f43f5e';
    } else {
      const grad = ctx.createLinearGradient(startX, 0, startX + wWidth, 0);
      grad.addColorStop(0, '#ff004c');
      grad.addColorStop(0.2, '#ff8a00');
      grad.addColorStop(0.4, '#ffe600');
      grad.addColorStop(0.6, '#22c55e');
      grad.addColorStop(0.8, '#06b6d4');
      grad.addColorStop(1, '#ec4899');
      ctx.fillStyle = grad;
    }
    ctx.fillText(wText, startX, centerY);
  }

  ctx.font = fontMain;
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
  ctx.strokeText(name, startX + wWidth, centerY);
  ctx.fillStyle = isPlayer ? '#fef08a' : '#ffffff';
  ctx.fillText(name, startX + wWidth, centerY);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  nameTagTextureCache.set(key, tex);
  return tex;
}

export function createStumblerModel(
  skin: SkinConfig,
  shadowTexture: THREE.Texture,
): CharacterRig {
  const root = new THREE.Group();

  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  const shadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 1.25),
    shadowMat,
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.03;
  root.add(shadowMesh);

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0.85;
  root.add(bodyPivot);

  const patternTex = skin.pattern
    ? createCharacterPatternTexture(skin.pattern, skin.bodyColor, skin.accentColor)
    : null;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: patternTex ? 0xffffff : skin.bodyColor,
    map: patternTex,
    roughness: 0.44,
    metalness:
      skin.id === 'robot_mk1' || skin.id === 'mr_stumble_oro' || skin.id === 'caballero_oscuro'
        ? 0.48
        : 0.06,
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: skin.pantsColor,
    roughness: 0.72,
    metalness: 0.04,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: skin.skinTone,
    roughness: 0.46,
    metalness: 0.02,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: skin.accentColor,
    roughness: skin.rarity === 'Legendario' || skin.rarity === 'Mítico' ? 0.24 : 0.38,
    metalness:
      skin.id === 'anubis' ||
      skin.id === 'valkiria' ||
      skin.id === 'mr_stumble_oro' ||
      skin.id === 'titan_bestia'
        ? 0.72
        : 0.14,
  });

  const shoeMat = new THREE.MeshStandardMaterial({
    color: skin.shoeColor,
    roughness: 0.65,
    metalness: 0.05,
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.2,
    metalness: 0.1,
  });

  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.25,
    metalness: 0.05,
  });

  const bodyMaterials: THREE.MeshStandardMaterial[] = [
    bodyMat,
    pantsMat,
    skinMat,
    accentMat,
    shoeMat,
  ];

  // 1. Torso
  const torso = new THREE.Mesh(sharedGeo.torso, bodyMat);
  torso.position.y = 0.08;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  // 2. Waist / Belt
  if (skin.id !== 'sr_stumble' && skin.id !== 'fantasma' && skin.id !== 'bananaman') {
    const belt = new THREE.Mesh(sharedGeo.belt, accentMat);
    belt.position.y = -0.14;
    belt.castShadow = true;
    bodyPivot.add(belt);
  }

  // 3. Head Group
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.55;
  bodyPivot.add(headGroup);

  const head = new THREE.Mesh(
    sharedGeo.head,
    skin.accessory === 'astro_helmet' || skin.accessory === 'banana_suit'
      ? bodyMat
      : skinMat,
  );
  head.castShadow = true;
  head.receiveShadow = true;
  headGroup.add(head);

  // Eyes (facing -Z)
  if (skin.accessory === 'dj_hoodie') {
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xfacc15,
      emissiveIntensity: 0.65,
      roughness: 0.2,
    });
    const screenFace = new THREE.Mesh(sharedGeo.face, screenMat);
    screenFace.position.set(0, -0.01, -0.14);
    screenFace.scale.set(0.95, 0.9, 0.88);
    headGroup.add(screenFace);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(sharedGeo.ogEye, darkMat);
      eye.position.set(side * 0.11, 0.04, -0.42);
      headGroup.add(eye);
    }
  } else if (skin.accessory === 'astro_helmet' || skin.accessory === 'turbo_helmet') {
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.08,
      metalness: 0.85,
    });
    const visor = new THREE.Mesh(sharedGeo.visor, visorMat);
    visor.rotation.y = Math.PI;
    headGroup.add(visor);
  } else if (skin.accessory === 'alien_head') {
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(sharedGeo.bigEye, darkMat);
      eye.position.set(side * 0.16, 0.03, -0.35);
      eye.scale.set(1.05, 1.35, 0.65);
      eye.rotation.z = side * -0.25;
      headGroup.add(eye);
    }
  } else {
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(sharedGeo.ogEye, darkMat);
      eye.position.set(side * 0.125, 0.02, -0.39);
      headGroup.add(eye);
    }
  }

  // Skin-Specific Accessories
  switch (skin.accessory) {
    case 'cap_og':
    case 'cap_bw': {
      const dome = new THREE.Mesh(
        sharedGeo.capDome,
        skin.accessory === 'cap_bw' ? whiteMat : accentMat,
      );
      dome.position.y = 0.06;
      headGroup.add(dome);
      const brim = new THREE.Mesh(
        sharedGeo.capBrim,
        skin.accessory === 'cap_bw'
          ? darkMat
          : new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 }),
      );
      brim.position.set(0, 0.11, -0.14);
      brim.rotation.y = Math.PI;
      headGroup.add(brim);
      break;
    }

    case 'crest_r': {
      const redCapMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
      const dome = new THREE.Mesh(sharedGeo.capDome, redCapMat);
      dome.position.y = 0.06;
      headGroup.add(dome);

      const brim = new THREE.Mesh(sharedGeo.capBrim, accentMat);
      brim.position.set(0, 0.11, -0.14);
      brim.rotation.y = Math.PI;
      headGroup.add(brim);

      if (skin.badgeImage) {
        const badgeMat = new THREE.MeshStandardMaterial({
          map: getBadgeTexture(skin.badgeImage),
          transparent: true,
          alphaTest: 0.1,
          roughness: 0.35,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });

        const chestBadge = new THREE.Mesh(sharedGeo.crestPlane, badgeMat);
        chestBadge.position.set(0, 0.12, -0.435);
        chestBadge.rotation.y = Math.PI;
        bodyPivot.add(chestBadge);

        const capBadge = new THREE.Mesh(sharedGeo.crestPlane, badgeMat);
        capBadge.scale.setScalar(0.42);
        capBadge.position.set(0, 0.27, -0.415);
        capBadge.rotation.set(0.28, Math.PI, 0);
        headGroup.add(capBadge);
      }
      break;
    }

    case 'dj_hoodie': {
      const hood = new THREE.Mesh(sharedGeo.capDome, bodyMat);
      hood.scale.set(1.12, 1.15, 1.12);
      hood.position.y = 0.04;
      headGroup.add(hood);

      const neonRim = new THREE.Mesh(sharedGeo.hoodRim, accentMat);
      neonRim.position.set(0, 0.01, -0.14);
      headGroup.add(neonRim);

      for (const side of [-1, 1]) {
        const cup = new THREE.Mesh(sharedGeo.headphoneCup, accentMat);
        cup.rotation.z = Math.PI / 2;
        cup.position.set(side * 0.48, 0.02, 0);
        headGroup.add(cup);
      }

      const tuft = new THREE.Mesh(
        sharedGeo.hairBun,
        new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.4 }),
      );
      tuft.position.set(0, 0.36, -0.22);
      tuft.scale.set(1.2, 0.7, 0.9);
      headGroup.add(tuft);
      break;
    }

    case 'samurai_kabuto': {
      const kabuto = new THREE.Mesh(sharedGeo.kabutoDome, bodyMat);
      kabuto.position.y = 0.05;
      headGroup.add(kabuto);
      for (const side of [-1, 1]) {
        const crest = new THREE.Mesh(sharedGeo.kabutoWing, accentMat);
        crest.position.set(side * 0.28, 0.34, -0.25);
        crest.rotation.z = side * -0.45;
        headGroup.add(crest);
      }
      for (const side of [-1, 1]) {
        const pauldron = new THREE.Mesh(sharedGeo.kabutoWing, bodyMat);
        pauldron.position.set(side * 0.54, 0.3, 0);
        pauldron.rotation.z = side * 0.5;
        bodyPivot.add(pauldron);
      }
      break;
    }

    case 'unicorn_horn': {
      const snoutMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.45 });
      const snout = new THREE.Mesh(sharedGeo.snout, snoutMat);
      snout.rotation.z = Math.PI / 2;
      snout.position.set(0, -0.1, -0.34);
      headGroup.add(snout);

      const hornMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.2,
        metalness: 0.4,
      });
      const horn = new THREE.Mesh(sharedGeo.horn, hornMat);
      horn.position.set(0, 0.48, -0.18);
      horn.rotation.x = -0.35;
      headGroup.add(horn);

      for (let m = 0; m < 4; m++) {
        const puff = new THREE.Mesh(sharedGeo.manePuff, accentMat);
        puff.position.set(0, 0.38 - m * 0.16, 0.25 + m * 0.06);
        headGroup.add(puff);
      }
      break;
    }

    case 'pirate_hat': {
      const brim = new THREE.Mesh(sharedGeo.tricornBrim, darkMat);
      brim.position.set(0, 0.33, 0);
      brim.rotation.y = Math.PI;
      headGroup.add(brim);

      const goldBand = new THREE.Mesh(sharedGeo.belt, accentMat);
      goldBand.scale.set(0.9, 0.6, 0.9);
      goldBand.position.set(0, 0.39, 0);
      headGroup.add(goldBand);
      break;
    }

    case 'astro_helmet': {
      const pack = new THREE.Mesh(sharedGeo.backpack, whiteMat);
      pack.position.set(0, 0.1, 0.42);
      pack.castShadow = true;
      bodyPivot.add(pack);
      break;
    }

    case 'valkyrie_wings': {
      const helm = new THREE.Mesh(sharedGeo.capDome, bodyMat);
      helm.position.y = 0.06;
      headGroup.add(helm);
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(sharedGeo.wing, accentMat);
        wing.position.set(side * 0.45, 0.26, 0.02);
        wing.rotation.z = side * -0.35;
        headGroup.add(wing);
      }
      break;
    }

    case 'anubis_ears': {
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(sharedGeo.earLong, bodyMat);
        ear.position.set(side * 0.2, 0.5, 0.02);
        ear.rotation.z = side * -0.15;
        headGroup.add(ear);
      }
      const snout = new THREE.Mesh(sharedGeo.snout, bodyMat);
      snout.rotation.x = Math.PI / 2;
      snout.scale.set(0.75, 0.9, 0.75);
      snout.position.set(0, -0.08, -0.34);
      headGroup.add(snout);
      break;
    }

    case 'lion_mane': {
      const maneMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const puff = new THREE.Mesh(sharedGeo.manePuff, maneMat);
        puff.position.set(Math.cos(a) * 0.37, Math.sin(a) * 0.37, 0.05);
        headGroup.add(puff);
      }
      break;
    }

    case 'robot_antenna': {
      const stem = new THREE.Mesh(sharedGeo.antennaStem, accentMat);
      stem.position.y = 0.48;
      headGroup.add(stem);
      const orb = new THREE.Mesh(
        sharedGeo.antennaOrb,
        new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 0.7,
        }),
      );
      orb.position.y = 0.65;
      headGroup.add(orb);
      break;
    }

    case 'ninja_topknot': {
      const hair = new THREE.Mesh(sharedGeo.capDome, darkMat);
      hair.position.y = 0.06;
      headGroup.add(hair);
      const bun = new THREE.Mesh(sharedGeo.hairBun, darkMat);
      bun.position.set(0, 0.46, 0.12);
      headGroup.add(bun);
      break;
    }

    case 'gold_crown':
    case 'beast_crown': {
      const band = new THREE.Mesh(sharedGeo.crownBand, accentMat);
      band.position.y = 0.42;
      headGroup.add(band);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const spike = new THREE.Mesh(sharedGeo.crownSpike, accentMat);
        spike.position.set(Math.cos(a) * 0.21, 0.56, Math.sin(a) * 0.21);
        headGroup.add(spike);
      }
      break;
    }

    case 'banana_suit': {
      const top = new THREE.Mesh(sharedGeo.bananaTop, bodyMat);
      top.position.set(0, 0.52, 0.08);
      top.rotation.x = 0.25;
      headGroup.add(top);
      const stemTip = new THREE.Mesh(sharedGeo.crownBand, accentMat);
      stemTip.scale.set(0.35, 0.7, 0.35);
      stemTip.position.set(0, 0.8, 0.15);
      headGroup.add(stemTip);
      break;
    }

    case 'hotdog_suit': {
      const bunMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });
      for (const side of [-1, 1]) {
        const bun = new THREE.Mesh(sharedGeo.hotdogBun, bunMat);
        bun.position.set(side * 0.28, 0.15, 0.02);
        bodyPivot.add(bun);
      }
      break;
    }

    case 'chicken_head': {
      const comb = new THREE.Mesh(sharedGeo.manePuff, accentMat);
      comb.scale.set(0.65, 1.2, 1.3);
      comb.position.set(0, 0.44, -0.04);
      headGroup.add(comb);
      const beak = new THREE.Mesh(sharedGeo.beakCone, pantsMat);
      beak.rotation.x = -Math.PI / 2;
      beak.position.set(0, -0.06, -0.45);
      headGroup.add(beak);
      break;
    }

    case 'shark_fin': {
      const fin = new THREE.Mesh(sharedGeo.sharkFin, bodyMat);
      fin.position.set(0, 0.5, 0.06);
      fin.rotation.x = 0.35;
      headGroup.add(fin);
      const backFin = new THREE.Mesh(sharedGeo.sharkFin, bodyMat);
      backFin.position.set(0, 0.15, 0.45);
      backFin.rotation.x = 0.85;
      bodyPivot.add(backFin);
      break;
    }

    case 'dragon_wings': {
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(sharedGeo.horn, accentMat);
        horn.position.set(side * 0.22, 0.45, -0.05);
        horn.rotation.z = side * -0.25;
        headGroup.add(horn);

        const wing = new THREE.Mesh(sharedGeo.dragonWing, accentMat);
        wing.position.set(side * 0.48, 0.16, 0.34);
        wing.rotation.y = side * -0.45;
        wing.rotation.z = side * 0.25;
        bodyPivot.add(wing);
      }
      break;
    }

    case 'cyber_visor': {
      const visorGlow = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.75,
        roughness: 0.15,
      });
      const bar = new THREE.Mesh(sharedGeo.cyberBar, visorGlow);
      bar.position.set(0, 0.04, -0.37);
      headGroup.add(bar);
      const pack = new THREE.Mesh(sharedGeo.backpack, darkMat);
      pack.scale.set(0.65, 0.85, 0.55);
      pack.position.set(0, 0.1, 0.38);
      bodyPivot.add(pack);
      break;
    }

    case 'glam_glasses': {
      const hair = new THREE.Mesh(sharedGeo.capDome, accentMat);
      hair.position.y = 0.08;
      headGroup.add(hair);
      for (const side of [-1, 1]) {
        const rim = new THREE.Mesh(sharedGeo.glamFrame, whiteMat);
        rim.position.set(side * 0.15, 0.03, -0.41);
        headGroup.add(rim);
      }
      break;
    }

    case 'turbo_helmet': {
      const dome = new THREE.Mesh(sharedGeo.kabutoDome, bodyMat);
      dome.position.y = 0.05;
      headGroup.add(dome);
      const fin = new THREE.Mesh(sharedGeo.kabutoWing, accentMat);
      fin.position.set(0, 0.45, 0.05);
      headGroup.add(fin);
      break;
    }

    case 'knight_helm': {
      const helm = new THREE.Mesh(sharedGeo.kabutoDome, bodyMat);
      helm.position.y = 0.05;
      headGroup.add(helm);
      const plume = new THREE.Mesh(sharedGeo.manePuff, accentMat);
      plume.scale.set(0.7, 1.3, 1.6);
      plume.position.set(0, 0.52, 0.06);
      headGroup.add(plume);
      break;
    }

    case 'cosmic_halo': {
      const halo = new THREE.Mesh(
        sharedGeo.haloRing,
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.7,
        }),
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.62;
      headGroup.add(halo);
      break;
    }

    case 'neon_skull': {
      const crown = new THREE.Mesh(sharedGeo.hoodRim, accentMat);
      crown.scale.set(0.75, 0.75, 0.75);
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 0.42;
      headGroup.add(crown);
      break;
    }

    case 'penguin_beak': {
      const beak = new THREE.Mesh(sharedGeo.beakCone, accentMat);
      beak.rotation.x = -Math.PI / 2;
      beak.position.set(0, -0.05, -0.44);
      headGroup.add(beak);
      const band = new THREE.Mesh(sharedGeo.crownBand, accentMat);
      band.scale.set(0.6, 0.7, 0.6);
      band.position.y = 0.44;
      headGroup.add(band);
      break;
    }

    case 'wizard_hat': {
      const brim = new THREE.Mesh(sharedGeo.wizardBrim, bodyMat);
      brim.position.y = 0.34;
      headGroup.add(brim);
      const cone = new THREE.Mesh(sharedGeo.wizardCone, bodyMat);
      cone.position.y = 0.68;
      cone.rotation.z = -0.12;
      headGroup.add(cone);
      break;
    }

    default:
      break;
  }

  // 4 & 5. Arms
  const armMat =
    skin.id === 'sr_stumble' ||
    skin.id === 'kunoichi' ||
    skin.id === 'valkiria' ||
    skin.id === 'barbie_glam'
      ? skinMat
      : bodyMat;
  const handMat =
    skin.accessory === 'astro_helmet' ||
    skin.accessory === 'samurai_kabuto' ||
    skin.accessory === 'knight_helm'
      ? bodyMat
      : skinMat;

  const armL = new THREE.Group();
  armL.position.set(-0.5, 0.23, 0);
  const armMeshL = new THREE.Mesh(sharedGeo.arm, armMat);
  armMeshL.position.y = -0.17;
  armMeshL.castShadow = true;
  armL.add(armMeshL);
  const handMeshL = new THREE.Mesh(sharedGeo.hand, handMat);
  handMeshL.position.y = -0.36;
  handMeshL.castShadow = true;
  armL.add(handMeshL);
  bodyPivot.add(armL);

  const armR = new THREE.Group();
  armR.position.set(0.5, 0.23, 0);
  const armMeshR = new THREE.Mesh(sharedGeo.arm, armMat);
  armMeshR.position.y = -0.17;
  armMeshR.castShadow = true;
  armR.add(armMeshR);
  const handMeshR = new THREE.Mesh(sharedGeo.hand, handMat);
  handMeshR.position.y = -0.36;
  handMeshR.castShadow = true;
  armR.add(handMeshR);
  bodyPivot.add(armR);

  // 6 & 7. Legs + Sneakers
  const legL = new THREE.Group();
  legL.position.set(-0.2, -0.32, 0);
  const legMeshL = new THREE.Mesh(sharedGeo.leg, pantsMat);
  legMeshL.position.y = -0.22;
  legMeshL.castShadow = true;
  legL.add(legMeshL);
  const shoeL = new THREE.Mesh(sharedGeo.shoe, shoeMat);
  shoeL.position.set(0, -0.45, -0.05);
  shoeL.castShadow = true;
  legL.add(shoeL);
  bodyPivot.add(legL);

  const legR = new THREE.Group();
  legR.position.set(0.2, -0.32, 0);
  const legMeshR = new THREE.Mesh(sharedGeo.leg, pantsMat);
  legMeshR.position.y = -0.22;
  legMeshR.castShadow = true;
  legR.add(legMeshR);
  const shoeR = new THREE.Mesh(sharedGeo.shoe, shoeMat);
  shoeR.position.set(0, -0.45, -0.05);
  shoeR.castShadow = true;
  legR.add(shoeR);
  bodyPivot.add(legR);

  // 8. Shield Bubble (Special Emote)
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.35,
    roughness: 0.15,
    depthWrite: false,
  });
  const shieldBubble = new THREE.Mesh(sharedGeo.shieldSphere, shieldMat);
  shieldBubble.position.y = 0.05;
  shieldBubble.visible = false;
  bodyPivot.add(shieldBubble);

  // 9. Floating Emote Bubble Sprite
  const emoteMat = new THREE.SpriteMaterial({
    transparent: true,
    depthTest: false,
  });
  const emoteSprite = new THREE.Sprite(emoteMat);
  emoteSprite.position.set(0, 2.95, 0);
  emoteSprite.scale.set(1.25, 1.25, 1);
  emoteSprite.visible = false;
  root.add(emoteSprite);

  // 10. Floating Nameplate Sprite above character
  const nameMat = new THREE.SpriteMaterial({
    transparent: true,
    depthTest: true,
  });
  const nameSprite = new THREE.Sprite(nameMat);
  nameSprite.position.set(0, 2.22, 0);
  nameSprite.scale.set(2.45, 0.56, 1);
  nameSprite.visible = false;
  root.add(nameSprite);

  return {
    root,
    bodyPivot,
    armL,
    armR,
    legL,
    legR,
    headGroup,
    shadowMesh,
    shieldBubble,
    emoteSprite,
    nameSprite,
    bodyMaterials,
  };
}

export function setRigInvisible(rig: CharacterRig, invisible: boolean): void {
  for (const mat of rig.bodyMaterials) {
    mat.transparent = invisible;
    mat.opacity = invisible ? 0.28 : 1;
    mat.needsUpdate = true;
  }
}

export function animateLobbyVictory(
  rig: CharacterRig,
  animId: VictoryAnimId,
  time: number,
): void {
  rig.bodyPivot.rotation.set(0, 0, 0);
  if (animId === 'salto_campeon') {
    const hop = Math.abs(Math.sin(time * 4.2)) * 0.45;
    rig.bodyPivot.position.y = 0.85 + hop;
    rig.armL.rotation.x = -2.4;
    rig.armR.rotation.x = -2.4;
    rig.legL.rotation.x = hop * 0.6;
    rig.legR.rotation.x = -hop * 0.6;
  } else if (animId === 'giro_epico') {
    rig.bodyPivot.position.y = 0.85 + Math.abs(Math.sin(time * 3)) * 0.15;
    rig.bodyPivot.rotation.y = time * 4.5;
    rig.armL.rotation.z = 1.1;
    rig.armR.rotation.z = -1.1;
    rig.armL.rotation.x = 0;
    rig.armR.rotation.x = 0;
  } else if (animId === 'pose_rey') {
    rig.bodyPivot.position.y = 0.85 + Math.sin(time * 2.5) * 0.03;
    rig.armL.rotation.x = -0.3;
    rig.armR.rotation.x = -2.5;
    rig.armL.rotation.z = 0.35;
    rig.armR.rotation.z = -0.35;
  } else {
    // baile_clasico
    rig.bodyPivot.position.y = 0.85 + Math.abs(Math.sin(time * 5)) * 0.08;
    rig.armL.rotation.x = Math.sin(time * 5) * 0.5;
    rig.armR.rotation.x = -Math.sin(time * 5) * 0.5;
    rig.legL.rotation.x = Math.sin(time * 5) * 0.3;
    rig.legR.rotation.x = -Math.sin(time * 5) * 0.3;
  }
}

export function animateRig(
  rig: CharacterRig,
  speedRatio: number,
  grounded: boolean,
  diving: boolean,
  stunned: boolean,
  animTime: number,
  dt: number,
  activeEmote?: EmoteId | null,
): void {
  if (stunned) {
    rig.bodyPivot.rotation.x += dt * 10;
    rig.bodyPivot.rotation.z += dt * 7;
    rig.armL.rotation.x = -2.2;
    rig.armR.rotation.x = -2.2;
    rig.legL.rotation.x = 0.6;
    rig.legR.rotation.x = -0.6;
    return;
  }

  if (diving) {
    rig.bodyPivot.rotation.x = THREE.MathUtils.damp(
      rig.bodyPivot.rotation.x,
      -Math.PI * 0.42,
      16,
      dt,
    );
    rig.bodyPivot.rotation.z = THREE.MathUtils.damp(
      rig.bodyPivot.rotation.z,
      0,
      12,
      dt,
    );
    rig.armL.rotation.x = -2.4;
    rig.armR.rotation.x = -2.4;
    rig.legL.rotation.x = 0.3;
    rig.legR.rotation.x = 0.3;
    return;
  }

  // Action Emote Animation Overrides
  if (activeEmote === 'punetazo') {
    rig.armR.rotation.x = -Math.PI * 0.55;
    rig.armL.rotation.x = 0.5;
    rig.bodyPivot.rotation.y = 0.35;
    return;
  }
  if (activeEmote === 'patada') {
    rig.legR.rotation.x = -1.35;
    rig.armL.rotation.x = -1.4;
    rig.armR.rotation.x = 0.6;
    rig.bodyPivot.rotation.x = 0.35;
    return;
  }
  if (activeEmote === 'abrazo') {
    rig.armL.rotation.x = -1.4;
    rig.armR.rotation.x = -1.4;
    rig.armL.rotation.z = -0.3;
    rig.armR.rotation.z = 0.3;
    return;
  }

  rig.bodyPivot.rotation.y = THREE.MathUtils.damp(rig.bodyPivot.rotation.y, 0, 14, dt);
  rig.bodyPivot.rotation.x = THREE.MathUtils.damp(
    rig.bodyPivot.rotation.x,
    speedRatio * 0.14,
    14,
    dt,
  );
  rig.bodyPivot.rotation.z = THREE.MathUtils.damp(
    rig.bodyPivot.rotation.z,
    0,
    14,
    dt,
  );

  if (!grounded) {
    rig.legL.rotation.x = THREE.MathUtils.damp(rig.legL.rotation.x, 0.55, 12, dt);
    rig.legR.rotation.x = THREE.MathUtils.damp(rig.legR.rotation.x, -0.35, 12, dt);
    rig.armL.rotation.x = THREE.MathUtils.damp(rig.armL.rotation.x, -1.7, 12, dt);
    rig.armR.rotation.x = THREE.MathUtils.damp(rig.armR.rotation.x, -1.7, 12, dt);
    rig.armL.rotation.z = 0.35;
    rig.armR.rotation.z = -0.35;
    return;
  }

  if (speedRatio > 0.08) {
    const freq = 13;
    const swing = Math.sin(animTime * freq) * 0.85 * Math.min(1, speedRatio);
    rig.legL.rotation.x = swing;
    rig.legR.rotation.x = -swing;
    rig.armL.rotation.x = activeEmote === 'saludo' ? -2.4 : -swing * 0.9;
    rig.armR.rotation.x = swing * 0.9;
    rig.armL.rotation.z = 0.22;
    rig.armR.rotation.z = -0.22;
    rig.bodyPivot.position.y = 0.85 + Math.abs(Math.sin(animTime * freq)) * 0.08;
  } else {
    const idleBob = Math.sin(animTime * 3.2) * 0.025;
    rig.bodyPivot.position.y = 0.85 + idleBob;
    rig.legL.rotation.x = THREE.MathUtils.damp(rig.legL.rotation.x, 0, 10, dt);
    rig.legR.rotation.x = THREE.MathUtils.damp(rig.legR.rotation.x, 0, 10, dt);
    rig.armL.rotation.x = activeEmote === 'saludo' ? -2.4 + Math.sin(animTime * 12) * 0.35 : THREE.MathUtils.damp(rig.armL.rotation.x, 0, 10, dt);
    rig.armR.rotation.x = THREE.MathUtils.damp(rig.armR.rotation.x, 0, 10, dt);
    rig.armL.rotation.z = 0.18 + Math.sin(animTime * 3.2) * 0.03;
    rig.armR.rotation.z = -0.18 - Math.sin(animTime * 3.2) * 0.03;
  }
}
