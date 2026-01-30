"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCoordinates = generateCoordinates;
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}
class SealedRandom {
    constructor(seed) {
        this.seed = seed;
    }
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
    float(min, max) {
        return min + this.next() * (max - min);
    }
}
function generateCoordinates(projectId, parentTurn, childIndex) {
    if (!parentTurn) {
        return { x: 0, y: 0, z: 0 };
    }
    const seedStr = `${projectId}-${parentTurn.id}-${childIndex}`;
    const seed = hashString(seedStr);
    const rng = new SealedRandom(seed);
    const baseStep = 8.0;
    const radiusStep = baseStep + rng.float(-2.0, 2.0);
    const r = radiusStep;
    const theta = rng.float(0, Math.PI * 2);
    const phi = rng.float(0, Math.PI);
    const dx = r * Math.sin(phi) * Math.cos(theta);
    const dy = r * Math.sin(phi) * Math.sin(theta);
    const dz = r * Math.cos(phi);
    return {
        x: parentTurn.x + dx,
        y: parentTurn.y + dy,
        z: parentTurn.z + dz
    };
}
//# sourceMappingURL=coordinates.js.map