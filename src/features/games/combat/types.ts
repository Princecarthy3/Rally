export type CharacterArchetype = "balanced" | "speed" | "power" | "defender";

export type CharacterStats = {
  key: CharacterArchetype;
  name: string;
  title: string;
  hp: number;
  maxHp: number;
  speed: number;
  jumpVelocity: number;
  lightDamage: number;
  heavyDamage: number;
  attackSpeed: number;
  knockbackMult: number;
  blockMitigation: number;
  specialName: string;
  specialCooldown: number;
  specialDamage: number;
  color: string;
  modelIcon: string;
  description: string;
};

export type FighterTransform = {
  seat: number;
  playerId: string;
  displayName: string;
  archetype: CharacterArchetype;
  position: [number, number, number];
  rotationY: number;
  hp: number;
  maxHp: number;
  isBlocking: boolean;
  isDodging: boolean;
  attackState: "idle" | "light" | "heavy" | "special" | "hit" | "knockdown" | "eliminated";
  animState: "idle" | "walk" | "jump" | "light_attack" | "heavy_attack" | "special_attack" | "block" | "dodge" | "hit" | "knockdown" | "victory" | "defeat";
  comboCount: number;
  specialCooldownRemaining: number;
  dodgeCooldownRemaining: number;
  isEliminated: boolean;
  kills: number;
  damageDealt: number;
  damageReceived: number;
};

export type TouchCombatInputs = {
  moveDir: [number, number];
  lightAttack: boolean;
  heavyAttack: boolean;
  block: boolean;
  dodge: boolean;
  special: boolean;
  jump: boolean;
};

export type CombatMatchResult = {
  seat: number;
  playerId: string;
  displayName: string;
  archetype: CharacterArchetype;
  rank: number;
  kills: number;
  damageDealt: number;
  damageReceived: number;
};
