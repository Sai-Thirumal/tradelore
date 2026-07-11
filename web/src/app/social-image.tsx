import { ImageResponse } from "next/og";

export const socialImageAlt = "TradeLore - Your Trading Companion";
export const socialImageSize = {
  width: 1200,
  height: 630,
};

export function createSocialImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 45%, #f0fdf4 100%)",
          color: "#1a1a1a",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <svg width="48" height="58" viewBox="0 0 20 24" fill="none">
            <line x1="10" y1="2" x2="10" y2="7" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 7H12.5L17 11.5V17H3V7Z" fill="#f97316" />
            <line x1="10" y1="17" x2="10" y2="22" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div style={{ fontSize: "42px", fontWeight: 800 }}>TradeLore</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ fontSize: "76px", lineHeight: 1, fontWeight: 900, maxWidth: "850px" }}>
            Your Trading Companion
          </div>
          <div style={{ fontSize: "34px", lineHeight: 1.3, color: "#525252", maxWidth: "760px" }}>
            Journal, analyse and improve your trading process.
          </div>
        </div>
        <div style={{ fontSize: "26px", fontWeight: 700, color: "#f97316" }}>tradelore.co.in</div>
      </div>
    ),
    socialImageSize,
  );
}
