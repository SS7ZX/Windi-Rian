import { useEffect, useState } from "react";

export function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.15 }
    );
    document.querySelectorAll(".rv").forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

const calc = (t: string) => {
  const d = Math.max(0, new Date(t).getTime() - Date.now());
  return { Hari: Math.floor(d / 864e5), Jam: Math.floor(d / 36e5) % 24, Menit: Math.floor(d / 6e4) % 60, Detik: Math.floor(d / 1e3) % 60 };
};

export function useCountdown(target: string) {
  const [t, setT] = useState(() => calc(target));
  useEffect(() => {
    const id = setInterval(() => setT(calc(target)), 1000);
    return () => clearInterval(id);
  }, [target]);
  return t;
}