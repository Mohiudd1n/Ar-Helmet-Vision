import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Startup splash: plays the "Made with Unity" clip once, then fades out and calls onDone.
 * Falls back to finishing on error / stall so the app can never get stuck on this screen.
 */
export default function Splash({ onDone }) {
  const videoRef = useRef(null);
  const doneRef = useRef(false);
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    setTimeout(onDone, 450);
  }, [onDone]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    // Try with sound first; browsers that block it get a muted retry.
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(finish);
    });
    const safety = setTimeout(finish, 8000);
    return () => clearTimeout(safety);
  }, [finish]);

  return (
    <div
      onClick={finish}
      className={`fixed inset-0 z-[100] bg-[#231f20] grid place-items-center transition-opacity duration-500 ${leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      <video
        ref={videoRef}
        src="/madewithunity.mp4"
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
        className="w-full h-full object-contain"
      />
    </div>
  );
}
