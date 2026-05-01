import { ImageResponse } from "next/og";
import { getProductBySlug } from "@/data/products";

export const alt = "Diva Flowers — Product";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const lang = locale === "es" ? "es" : "en";
  const product = getProductBySlug(slug);
  const title = product?.title[lang] ?? "Diva Flowers";
  const description = product?.blurb[lang] ?? "";

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
            maxWidth: "900px",
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              marginTop: 24,
              fontSize: 24,
              color: "#6b6b6b",
              textAlign: "center",
              maxWidth: "800px",
            }}
          >
            {description}
          </div>
        ) : null}
      </div>
    ),
    { ...size }
  );
}
