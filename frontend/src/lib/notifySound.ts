/**
 * Qisqa bildirishnoma ovozi ("ding") — Web Audio API bilan sintez qilinadi,
 * tashqi audio fayl kerak emas (offline ham ishlaydi). Yangi xabar/javob
 * kelganda chaqiriladi (chat notify hook'lari orqali).
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

function tone(
  ac: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  peakGain: number
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ac.destination);
  const t0 = ac.currentTime + startOffset;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const notifySound = {
  /** Ikki ohangli qisqa "ding" (telegram-uslub bildirishnoma signali). */
  ding() {
    const ac = getCtx();
    if (!ac) return;
    if (ac.state === "suspended") ac.resume().catch(() => {});
    tone(ac, 880, 0, 0.14, 0.12);
    tone(ac, 1318.5, 0.09, 0.16, 0.1);
  },
};
