import { useEffect, useMemo } from "react";

// A player for one language's audio.
//
// The object URL is created during render and revoked when the blob
// changes or the player unmounts, so a teacher stepping back and forth
// through a lesson does not leak a wav per visit.
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
    <audio controls autoPlay={autoPlay} src={url} aria-label={label} onPlay={handlePlay}>
      Your browser cannot play audio.
    </audio>
  );
}
