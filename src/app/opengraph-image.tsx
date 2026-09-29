import { ImageResponse } from "next/og";

export const alt = "Rally — Play together, anywhere";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #f7f5ff 0%, #ede9fe 52%, #fef3c7 100%)",
          color: "#171821",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: "64px",
          position: "relative",
          width: "100%",
        }}
      >
        <div style={{ background: "#f4dc69", border: "4px solid #171821", borderRadius: "999px", display: "flex", fontSize: 28, fontWeight: 800, letterSpacing: 2, padding: "14px 26px", textTransform: "uppercase" }}>
          Free online games for friends
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-violet-600 text-lg text-white shadow-[0_8px_24px_rgba(108,71,255,.28)] transition-transform group-hover:-rotate-6 group-hover:scale-105">
        ✦
      </span>

      {!compact && (
        <span className="text-[21px] font-extrabold tracking-[-.04em] text-slate-950">
          <span style={{ color: "#8b5cf6" }}>R</span>ally
        </span>
        <div style={{ display: "flex", fontSize:30 , marginTop: 5, textAlign: "center" }}>Built by Carthy</div>
        <div style={{ display: "flex", fontSize: 42, marginTop: 12, textAlign: "center" }}>Play together. Anywhere.</div>
        <div style={{ display: "flex", fontSize: 72, gap: 24, marginTop: 46 }}>🏀 🏓 ✊ 🎲</div>
         
      </div>
    ),
    size,
  );
}
