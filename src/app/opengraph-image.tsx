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
          padding: "40px 60px",
          position: "relative",
          width: "100%",
        }}
      >
        {/* Badge */}
        <div
          style={{
            background: "#f4dc69",
            border: "3px solid #171821",
            borderRadius: 999,
            display: "flex",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 1.5,
            padding: "10px 24px",
            textTransform: "uppercase",
          }}
        >
          FREE ONLINE GAMES FOR FRIENDS
        </div>

        {/* Rally logo */}
        <div
          style={{
            alignItems: "center",
            display: "flex",
            marginTop: 18,
          }}
        >
          {/* Large purple icon */}
          <div
  style={{
    alignItems: "center",
    background: "#8b5cf6",
    borderRadius: 24,
    display: "flex",
    height: 100,
    justifyContent: "center",
    width: 100,
  }}
>
  <svg width="70" height="70" viewBox="0 0 100 100">
    <path
      d="M50 3
         C55 32 68 45 97 50
         C68 55 55 68 50 97
         C45 68 32 55 3 50
         C32 45 45 32 50 3Z"
      fill="#ffffff"
    />
  </svg>
</div>

          {/* Rally */}
          <span
            style={{
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: "-5px",
              lineHeight: 1,
              marginLeft: 20,
            }}
          >
            <span style={{ color: "#8b5cf6" }}>R</span>ally
          </span>
        </div>

        {/* Tagline directly underneath Rally */}
        <div
          style={{
            display: "flex",
            fontSize: 42,
            fontWeight: 800,
            letterSpacing: "-1px",
            marginTop: 10,
            textAlign: "center",
          }}
        >
          Play together. Anywhere.
        </div>

        {/* Built by */}
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 600,
            marginTop: 8,
          }}
        >
          Built by Carthy
        </div>

        {/* Game icons */}
        <div
          style={{
            alignItems: "center",
            display: "flex",
            fontSize: 64,
            gap: 28,
            marginTop: 22,
          }}
        >
          <span>🏀</span>
          <span>🏓</span>
          <span>✊</span>
          <span>🎲</span>
        </div>
      </div>
    ),
    size,
  );
}