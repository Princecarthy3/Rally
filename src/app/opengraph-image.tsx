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
          padding: "64px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#f4dc69",
            border: "4px solid #171821",
            borderRadius: "999px",
            display: "flex",
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: 2,
            padding: "14px 26px",
            textTransform: "uppercase",
          }}
        >
          Free online games for friends
        </div>

        <div
          style={{
            alignItems: "center",
            display: "flex",
            marginTop: 28,
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: "#8b5cf6",
              borderRadius: 14,
              display: "flex",
              height: 48,
              justifyContent: "center",
              width: 48,
            }}
          >
            <span
              style={{
                color: "#ffffff",
                fontSize: 28,
                fontWeight: 800,
              }}
            >
              ✦
            </span>
          </div>

          <span
            style={{
              fontSize: 21,
              fontWeight: 800,
              marginLeft: 12,
            }}
          >
            <span style={{ color: "#8b5cf6" }}>R</span>ally
          </span>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 700,
            marginTop: 22,
            textAlign: "center",
          }}
        >
          Built by Carthy
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 42,
            fontWeight: 800,
            marginTop: 12,
            textAlign: "center",
          }}
        >
          Play together. Anywhere.
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 72,
            gap: 24,
            marginTop: 40,
          }}
        >
          🏀 🏓 ✊ 🎲
        </div>
      </div>
    ),
    size,
  );
}