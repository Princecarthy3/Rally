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
          background:
            "linear-gradient(135deg, #f7f5ff 0%, #ede9fe 52%, #fef3c7 100%)",
          color: "#171821",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: "48px 64px",
          position: "relative",
          width: "100%",
        }}
      >
        {/* Top badge */}
        <div
          style={{
            background: "#f4dc69",
            border: "4px solid #171821",
            borderRadius: "999px",
            display: "flex",
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 2,
            padding: "11px 24px",
            textTransform: "uppercase",
          }}
        >
          Free online games for friends
        </div>
        {/* Rally logo */}
        <div
          style={{
            alignItems: "center",
            display: "flex",
            marginTop: 18,
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "#8b5cf6",
              borderRadius: 20,
              display: "flex",
              height: 82,
              justifyContent: "center",
              width: 82,
            }}
          >
            <span
              style={{
                color: "#ffffff",
                fontSize: 48,
                fontWeight: 800,
              }}
            >
              ✦
            </span>
          </div>
          <span
            style={{
              fontSize: 68,
              fontWeight: 900,
              letterSpacing: "-3px",
              marginLeft: 18,
            }}
          >
            <span style={{ color: "#8b5cf6" }}>R</span>ally
          </span>
        </div>
        {/* Built by */}
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            marginTop: 10,
          }}
        >
          Built by Carthy
        </div>
        {/* Tagline */}
        <div
          style={{
            display: "flex",
            fontSize: 40,
            fontWeight: 800,
            marginTop: 6,
            textAlign: "center",
          }}
        >
          Play together. Anywhere.
        </div>
        {/* Game icons */}
        <div
          style={{
            display: "flex",
            fontSize: 64,
            gap: 20,
            marginTop: 18,
          }}
        >
          🏀 🏓 ✊ 🎲
        </div>
      </div>
    ),
    size,
  );
}

