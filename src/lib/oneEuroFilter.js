import * as THREE from 'three';

/**
 * One Euro filter (Casiez et al. 2012): heavy smoothing when the head is still
 * (kills jitter), light smoothing when it moves fast (kills lag).
 */
class LowPass {
  constructor() { this.y = null; }
  filter(x, alpha) {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
}

const alphaFor = (cutoff, dt) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuro {
  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
    Object.assign(this, { minCutoff, beta, dCutoff });
    this.x = new LowPass();
    this.dx = new LowPass();
    this.prev = null;
  }
  reset() { this.x = new LowPass(); this.dx = new LowPass(); this.prev = null; }
  filter(value, dt) {
    const d = this.prev === null ? 0 : (value - this.prev) / dt;
    this.prev = value;
    const edx = this.dx.filter(d, alphaFor(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, alphaFor(cutoff, dt));
  }
}

/** Filters a head pose (position in cm + orientation quaternion). */
export class PoseFilter {
  constructor({ posMinCutoff = 1.2, posBeta = 0.05, rotMinCutoff = 1.5, rotBeta = 0.6 } = {}) {
    this.pos = [0, 1, 2].map(() => new OneEuro({ minCutoff: posMinCutoff, beta: posBeta }));
    this.rot = [0, 1, 2, 3].map(() => new OneEuro({ minCutoff: rotMinCutoff, beta: rotBeta }));
    this.lastQuat = null;
  }
  reset() {
    this.pos.forEach((f) => f.reset());
    this.rot.forEach((f) => f.reset());
    this.lastQuat = null;
  }
  /** Mutates `position` and `quaternion` in place. */
  apply(position, quaternion, dt) {
    position.set(
      this.pos[0].filter(position.x, dt),
      this.pos[1].filter(position.y, dt),
      this.pos[2].filter(position.z, dt)
    );
    // q and -q are the same rotation; keep the sign continuous so the filter doesn't flip.
    if (this.lastQuat && this.lastQuat.dot(quaternion) < 0) {
      quaternion.set(-quaternion.x, -quaternion.y, -quaternion.z, -quaternion.w);
    }
    quaternion.set(
      this.rot[0].filter(quaternion.x, dt),
      this.rot[1].filter(quaternion.y, dt),
      this.rot[2].filter(quaternion.z, dt),
      this.rot[3].filter(quaternion.w, dt)
    ).normalize();
    this.lastQuat = (this.lastQuat || new THREE.Quaternion()).copy(quaternion);
  }
}
