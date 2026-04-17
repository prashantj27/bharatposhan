import { useEffect, useState, RefObject } from "react";

interface Props {
  targetRef: RefObject<HTMLElement>;
  side?: "left" | "right";
  label?: string;
}

/**
 * Stylish vertical glowing line + "scroll down" hint.
 * Fades out when the user has scrolled, or when the panel isn't scrollable.
 */
const ScrollHint = ({ targetRef, side = "right", label = "scroll down" }: Props) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    const update = () => {
      const scrollable = el.scrollHeight - el.clientHeight > 24;
      const nearTop = el.scrollTop < 40;
      setVisible(scrollable && nearTop);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [targetRef]);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        bottom: 14,
        [side]: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transform: `translateY(${visible ? 0 : 6}px)`,
        transition: "opacity 0.35s ease, transform 0.35s ease",
        zIndex: 30,
      } as React.CSSProperties}
    >
      <span
        style={{
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontFamily: "'JetBrains Mono', monospace",
          color: "hsl(25,95%,65%)",
          textShadow: "0 0 8px hsla(25,95%,55%,0.55)",
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <div
        style={{
          width: 1.5,
          height: 42,
          background: "linear-gradient(to bottom, hsla(25,95%,55%,0), hsla(25,95%,55%,0.9), hsla(200,70%,55%,0.9))",
          boxShadow: "0 0 10px hsla(25,95%,55%,0.7), 0 0 18px hsla(200,70%,55%,0.4)",
          borderRadius: 2,
          animation: "scrollHintPulse 1.8s ease-in-out infinite",
        }}
      />
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "hsl(200,70%,60%)",
          boxShadow: "0 0 10px hsla(200,70%,55%,0.9), 0 0 20px hsla(25,95%,55%,0.5)",
          animation: "scrollHintDot 1.8s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes scrollHintPulse {
          0%, 100% { opacity: 0.55; transform: scaleY(0.85); }
          50% { opacity: 1; transform: scaleY(1.15); }
        }
        @keyframes scrollHintDot {
          0%, 100% { transform: translateY(0); opacity: 0.7; }
          50% { transform: translateY(4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ScrollHint;
