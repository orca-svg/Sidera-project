import { Turn } from '@prisma/client';

// Simple deterministic hash
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Sealed Random Generator
class SealedRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Linear Congruential Generator
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function generateCoordinates(
  projectId: string,
  parentTurn: Turn | null,
  childIndex: number
): Point3D {
  if (!parentTurn) {
    // Root Node: Center
    return { x: 0, y: 0, z: 0 };
  }

  // Deterministic Seed
  // Using parent properties to ensure consistency
  // Adding childIndex allows varied positions for siblings
  const seedStr = `${projectId}-${parentTurn.id}-${childIndex}`;
  const seed = hashString(seedStr);
  const rng = new SealedRandom(seed);

  // Spherical Coordinates Logic
  // 1. Radius: Increases with depth. Base radius + jitter.
  // We approximate depth by checking distance from origin, or simpler: just step out.
  // Since we don't have explicit 'depth' stored, we can estimate or just use parent's magnitude + step.

  // const parentDist = Math.sqrt(parentTurn.x**2 + parentTurn.y**2 + parentTurn.z**2);
  const baseStep = 8.0;
  const radiusStep = baseStep + rng.float(-2.0, 2.0); // Random variance in link length
  const r = radiusStep; // Distance from PARENT, not origin

  // 2. Angles
  // We want to avoid backtracking. 
  // Ideally, we move in a cone roughly 'away' from the grandfather, but for MVP:
  // Random spherical direction is usually fine if space is large enough.

  // Azimuth (0 to 2PI)
  const theta = rng.float(0, Math.PI * 2);

  // Inclination (0 to PI). 
  // Bias towards 'flat' disk (Z=0) for easier reading? 
  // Requirement says "organic constellation". Real constellations are 3D but we view them 2D. 
  // Let's allow full 3D but maybe compress Z slightly to make it somewhat "sheet-like" if desired.
  // Let's stick to full 3D for now as requested.
  const phi = rng.float(0, Math.PI);

  // Convert Spherical (r, theta, phi) to Cartesian offset
  const dx = r * Math.sin(phi) * Math.cos(theta);
  const dy = r * Math.sin(phi) * Math.sin(theta);
  const dz = r * Math.cos(phi);

  return {
    x: parentTurn.x + dx,
    y: parentTurn.y + dy,
    z: parentTurn.z + dz
  };
}
