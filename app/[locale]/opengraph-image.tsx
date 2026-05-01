import { ImageResponse } from "next/og";
import { SITE } from "@/data/site";

export const alt = "Diva Flowers — Romance, by the stem.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lang = locale === "es" ? "es" : "en";
  const tagline = SITE.tagline[lang];

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
            color: "#9e7c6a",
            marginBottom: 24,
          }}
        >
          DIVA FLOWERS
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
          {tagline}
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 20,
            color: "#6b6b6b",
          }}
        >
          {SITE.address.locality}, {SITE.address.region} · {SITE.phoneDisplay}
        </div>
      </div>
    ),
    { ...size }
  );
}
