import { useEffect, useMemo } from "react";

// A clean, accessible player for classroom audio playback.
// Object URL is created during render and revoked when unmounted or changed.
export default function AudioPlayer({ blob, label, autoPlay = false }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const handlePlay = (e) => {
    // Ensure only one audio plays at a time across the entire page
    document.querySelectorAll("audio").forEach((el) => {
      if (el !== e.currentTarget && !el.paused) {
        el.pause();
      }
    });
  };

  return (
    <div className="audio-player-wrapper" style={{ marginTop: "0.4rem" }}>
      <audio
        controls
        autoPlay={autoPlay}
        src={url}
        aria-label={label}
        onPlay={handlePlay}
        style={{ width: "100%", display: "block" }}
      >
        Your browser cannot play audio.
      </audio>
    </div>
  );
}
