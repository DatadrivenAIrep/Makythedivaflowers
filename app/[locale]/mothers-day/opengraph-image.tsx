import { ImageResponse } from "next/og";

export const alt =
  "Mother's Day Flowers · Long Island Same-Day Delivery — Diva Flowers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#f5f0eb",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px",
        }}
      >
        <div
          style={{
            fontSize: 16,
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#B8345E",
            marginBottom: 24,
          }}
        >
          MOTHER&apos;S DAY · 2026
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#1a1a1a",
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          Mother&apos;s Day Flowers · Long Island
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 22,
            color: "#6b6b6b",
            textAlign: "center",
          }}
        >
          Same-day delivery · Order by Sat May 9 · 2 PM
        </div>
      </div>
    ),
    { ...size },
  );
}
