/**
 * The drifting monochrome blobs behind the app shell. Purely decorative, so it
 * is hidden from assistive tech and frozen under prefers-reduced-motion.
 */
export function Ambient() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden bg-[#0a0a0b]">
      <div className="absolute -left-[12%] -top-[15%] h-[46vw] w-[46vw] animate-drift rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,.5),rgba(255,255,255,0)_70%)] opacity-30 blur-[100px]" />
      <div className="absolute -bottom-[18%] -right-[8%] h-[40vw] w-[40vw] animate-drift rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,.5),rgba(255,255,255,0)_70%)] opacity-20 blur-[100px] [animation-delay:-10s]" />
      <div className="absolute left-[55%] top-[35%] h-[32vw] w-[32vw] animate-drift rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,.5),rgba(255,255,255,0)_70%)] opacity-[0.15] blur-[100px] [animation-delay:-18s]" />
    </div>
  );
}
