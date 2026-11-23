/**
 * Camera access that works on iOS Safari and Android Chrome.
 * `facing` is 'user' (front / selfie) or 'environment' (rear).
 * Tries progressively looser constraints; permission errors are thrown immediately.
 */
export const openFrontCamera = () => openCamera('user');

export async function openCamera(facing = 'user') {
  if (!navigator.mediaDevices?.getUserMedia) {
    if (!window.isSecureContext) {
      const err = new Error(window.location.href.replace(/^http:/i, 'https:'));
      err.name = 'InsecureContextError';
      throw err;
    }
    throw new Error('This browser does not support camera access.');
  }

  // 'user' stays exact-ish as before; the rear camera uses `ideal` so devices with one camera still open.
  const facingMode = facing === 'environment' ? { ideal: 'environment' } : 'user';
  const tiers = [
    { facingMode, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
    { facingMode },
    true,
  ];

  let lastError;
  for (const video of tiers) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (err) {
      lastError = err;
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') throw err;
    }
  }
  throw lastError || new Error('Unable to open the camera.');
}

export function describeCameraError(err) {
  if (err?.name === 'InsecureContextError') {
    return { title: 'HTTPS required', body: 'Phones only allow camera access over HTTPS. Open the https:// address shown by `npm run dev`.' };
  }
  if (err?.name === 'NotAllowedError') {
    return { title: 'Camera blocked', body: 'Allow camera access for this site in your browser settings, then try again.' };
  }
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
    return { title: 'No camera found', body: 'This device has no front camera available to the browser.' };
  }
  return { title: 'Camera problem', body: err?.message || 'The camera could not be started.' };
}
