/**
 * Landmark index sets for MediaPipe Face Landmarker (478 points incl. irises),
 * used for the computer-vision overlay and for closing holes in the head occluder.
 */

export const FACE_OVAL_RING = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];

// Eye contours (closed loops). "Right" = the subject's right eye.
export const EYE_LOOP_RIGHT = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
export const EYE_LOOP_LEFT = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
export const LIPS_INNER_LOOP = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
export const LIPS_OUTER_LOOP = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
export const BROW_RIGHT = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107];
export const BROW_LEFT = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336];
export const IRIS_RIGHT = [469, 470, 471, 472];
export const IRIS_LEFT = [474, 475, 476, 477];

// Low-density "scanner" triangulation across the face.
const SCAN_TRIANGLES = [
  [10, 67, 109], [10, 109, 107], [10, 107, 9], [10, 9, 336], [10, 336, 338], [10, 338, 297],
  [109, 54, 103], [109, 103, 67], [338, 284, 297], [297, 332, 284],
  [107, 66, 9], [9, 66, 8], [9, 8, 296], [9, 296, 336], [107, 105, 66], [336, 296, 334],
  [8, 107, 168], [8, 168, 336],
  [70, 63, 105], [70, 105, 107], [70, 107, 33], [107, 168, 133], [107, 33, 133],
  [336, 296, 263], [336, 263, 300], [296, 334, 293], [334, 293, 300], [336, 362, 263], [168, 336, 362],
  [168, 197, 6], [168, 6, 1], [168, 133, 197], [168, 197, 362], [197, 1, 98], [197, 327, 1],
  [1, 98, 2], [1, 2, 327],
  [234, 127, 70], [70, 127, 33], [127, 116, 33], [454, 300, 356], [300, 263, 356], [356, 263, 345],
  [33, 116, 147], [33, 147, 98], [263, 376, 345], [263, 327, 376],
  [2, 98, 61], [2, 61, 0], [2, 0, 291], [2, 291, 327], [61, 37, 0], [0, 267, 291],
  [61, 147, 172], [291, 397, 376], [61, 17, 291], [61, 84, 17], [17, 314, 291],
  [61, 172, 136], [61, 136, 152], [61, 152, 17], [291, 17, 152], [291, 152, 365], [291, 365, 397],
  [152, 176, 148], [152, 377, 378], [152, 148, 377],
  [234, 93, 132], [132, 58, 172], [172, 136, 150], [150, 149, 152],
  [454, 323, 361], [361, 288, 397], [397, 365, 379], [379, 378, 152],
];

function buildOverlay() {
  const seen = new Set();
  const lines = [];
  const points = new Set();
  const add = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(a, b);
    points.add(a);
    points.add(b);
  };
  const loop = (ring, closed = true) => {
    for (let i = 0; i < ring.length - (closed ? 0 : 1); i++) add(ring[i], ring[(i + 1) % ring.length]);
  };
  for (const [a, b, c] of SCAN_TRIANGLES) { add(a, b); add(b, c); add(c, a); }
  loop(FACE_OVAL_RING);
  loop(EYE_LOOP_RIGHT);
  loop(EYE_LOOP_LEFT);
  loop(LIPS_OUTER_LOOP);
  loop(BROW_RIGHT, false);
  loop(BROW_LEFT, false);
  loop(IRIS_RIGHT);
  loop(IRIS_LEFT);
  return { lineIndices: lines, pointIndices: Array.from(points) };
}

export const OVERLAY = buildOverlay();
