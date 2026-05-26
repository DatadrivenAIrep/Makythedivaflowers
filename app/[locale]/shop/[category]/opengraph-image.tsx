import { ImageResponse } from "next/og";

export const alt = "Diva Flowers — Shop";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
  arrangements: { en: "Arrangements", es: "Arreglos" },
  bouquets: { en: "Bouquets", es: "Ramos" },
  roses: { en: "Roses", es: "Rosas" },
  exotic: { en: "Exotic", es: "Exóticas" },
  plants: { en: "Plants & Orchids", es: "Plantas y Orquídeas" },
  gifts: { en: "Gifts", es: "Regalos" },
  sympathy: { en: "Sympathy", es: "Condolencias" },
  subscriptions: { en: "Subscriptions", es: "Suscripciones" },
};

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; category: string }>;
}) {
  const { locale, category } = await params;
  const lang = locale === "es" ? "es" : "en";
  const label = CATEGORY_LABELS[category]?.[lang] ?? category;

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
            fontSize: 72,
            fontWeight: 700,
            color: "#1a1a1a",
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          {label}
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 20,
            color: "#6b6b6b",
          }}
        >
          {lang === "es" ? "Envío el mismo día · Long Island" : "Same-day delivery · Long Island"}
        </div>
      </div>
    ),
    { ...size }
  );
}
