// data/journal.tsx
import type { ReactNode } from "react";
import { Figure } from "@/components/editorial/Figure";
import { PullQuote } from "@/components/editorial/PullQuote";
import { DropCap } from "@/components/editorial/DropCap";
import type { Locale } from "@/types/locale";

export type JournalArticle = {
  slug: string;
  title: { en: string; es: string };
  excerpt: { en: string; es: string };
  date: string;
  readingMinutes: number;
  cover: { src: string; alt: { en: string; es: string } };
  body: (locale: Locale) => ReactNode;
  seo: { title: { en: string; es: string }; description: { en: string; es: string } };
};

export const journalArticles: JournalArticle[] = [
  {
    slug: "color-of-the-season-rouge",
    title: { en: "The color of the season is rouge.", es: "El color de la temporada es rouge." },
    excerpt: { en: "On why we keep returning to deep, single-saturation pinks — and how we use them sparingly.", es: "Por qué seguimos volviendo al rosa profundo de saturación única — y cómo lo usamos con moderación." },
    date: "2026-04-12",
    readingMinutes: 6,
    cover: {
      src: "https://picsum.photos/seed/diva-journal-rouge/2400/1350",
      alt: { en: "Close-up of garden roses in deep rouge", es: "Primer plano de rosas de jardín en rouge profundo" },
    },
    body: (locale) => {
      const en = locale === "en";
      return (
        <>
          <DropCap>{en ? "There is a particular pink we keep coming back to — somewhere between dahlia, ranunculus, and the awning we hang every spring. Saturated but not loud. Old-world but not dusty. We call it rouge." : "Hay un rosa particular al que seguimos volviendo — entre la dalia, el ranúnculo y el toldo que colgamos cada primavera. Saturado pero no ruidoso. Clásico pero no polvoriento. Le llamamos rouge."}</DropCap>
          <p>{en ? "When you spend a decade designing under the same color, you start to notice the negative space. Rouge only sings when it's surrounded by quiet — bone, ivory, mute slate. Splash too much of it and the room becomes Valentine's Day. Use it as one stem in twenty and the eye finds it like a candle in a window." : "Cuando pasas una década diseñando con el mismo color, empiezas a notar el espacio negativo. El rouge solo canta rodeado de silencio — bone, marfil, gris apagado. Pones demasiado y el espacio se vuelve día de San Valentín. Úsalo como un tallo entre veinte, y el ojo lo encuentra como una vela en una ventana."}</p>
          <Figure src="https://picsum.photos/seed/diva-journal-rouge-2/1600/2000" alt={en ? "A single rouge ranunculus on a bone tablecloth" : "Un solo ranúnculo rouge sobre mantel bone"} aspect="4/5" align="right" />
          <p>{en ? "Rouge is also stubborn under photography. Phones cool it down to magenta; warm light pushes it toward brick. We've stopped fighting and started photographing rouge only at golden hour or under the warm fixtures we keep above the studio bench." : "El rouge también es testarudo ante la cámara. Los teléfonos lo enfrían a magenta; la luz cálida lo empuja hacia el ladrillo. Hemos dejado de pelear y empezamos a fotografiar el rouge solo en la hora dorada o bajo los focos cálidos sobre la mesa del estudio."}</p>
          <PullQuote cite={en ? "From the studio" : "Desde el estudio"}>{en ? "Rouge only sings when it's surrounded by quiet." : "El rouge solo canta cuando está rodeado de silencio."}</PullQuote>
          <p>{en ? "If you're working on a wedding or an installation with us this season, expect us to ask twice before we add a second rouge. The first one earns its place. The second has to earn it harder." : "Si estás trabajando en una boda o instalación con nosotros esta temporada, espera que preguntemos dos veces antes de añadir un segundo rouge. El primero se gana su lugar. El segundo tiene que ganárselo aún más."}</p>
        </>
      );
    },
    seo: {
      title: { en: "The color of the season is rouge — Diva Flowers Journal", es: "El color de la temporada es rouge — Diario de Diva Flowers" },
      description: { en: "Notes on rouge: how we use deep pinks sparingly, and why a single stem reads more expensive than a whole arrangement.", es: "Notas sobre el rouge: cómo usamos los rosas profundos con moderación, y por qué un solo tallo se ve más caro que un arreglo entero." },
    },
  },
  {
    slug: "under-the-arch",
    title: { en: "Under the arch.", es: "Bajo el arco." },
    excerpt: { en: "How we built the storefront arch on Willis Ave, and why we rebuild it every spring.", es: "Cómo construimos el arco de la entrada en Willis Ave, y por qué lo reconstruimos cada primavera." },
    date: "2026-03-18",
    readingMinutes: 5,
    cover: {
      src: "https://picsum.photos/seed/diva-journal-arch/2400/1350",
      alt: { en: "Diva Flowers storefront arch in full bloom", es: "Arco de la entrada de Diva Flowers en plena floración" },
    },
    body: (locale) => {
      const en = locale === "en";
      return (
        <>
          <DropCap>{en ? "We did not plan to be the place with the arch. The first year, we built a small awning out of dahlia stems and chicken wire because the storefront felt too plain. By the second year, neighbors were stopping their cars." : "No planeábamos ser el lugar del arco. El primer año, hicimos un pequeño toldo con tallos de dalia y malla de gallinero porque el frente nos parecía demasiado simple. Al segundo año, los vecinos detenían sus autos."}</DropCap>
          <Figure src="https://picsum.photos/seed/diva-journal-arch-build/1600/2000" alt={en ? "Building the arch frame in early spring" : "Construyendo el marco del arco a principios de primavera"} aspect="4/5" align="left" />
          <p>{en ? "The frame is welded steel — the same one we've reused for nine years. What changes is the flowers, the time of year, and what the season is asking for. In April it's hydrangea and ranunculus. In June it's peony and rose. In autumn it's amaranthus and dahlia in shades that match the leaves." : "El marco es de acero soldado — el mismo que hemos reutilizado durante nueve años. Lo que cambia son las flores, la época del año, y lo que la temporada está pidiendo. En abril son hortensias y ranúnculos. En junio, peonías y rosas. En otoño, amaranto y dalias en tonos que combinan con las hojas."}</p>
          <p>{en ? "Every year someone asks if we'd consider making it permanent — silk, dried, preserved. We always say no. The point of the arch is that it's alive. It wilts by Sunday. It comes down by mid-summer. It is the loudest love letter we know how to write to the neighborhood, and you can only write that letter if you mean it for one season at a time." : "Cada año alguien nos pregunta si lo haríamos permanente — seda, secas, preservadas. Siempre decimos que no. El punto del arco es que está vivo. Se marchita para el domingo. Se desmonta a mitad de verano. Es la carta de amor más fuerte que sabemos escribirle al barrio, y solo puedes escribirla si lo dices en serio una temporada a la vez."}</p>
        </>
      );
    },
    seo: {
      title: { en: "Under the arch — Diva Flowers Journal", es: "Bajo el arco — Diario de Diva Flowers" },
      description: { en: "Inside the storefront arch on Willis Ave: the steel frame, the seasonal blooms, and why we rebuild it every spring.", es: "Por dentro del arco en Willis Ave: el marco de acero, las flores de temporada, y por qué lo reconstruimos cada primavera." },
    },
  },
  {
    slug: "what-the-arrangement-is-saying",
    title: { en: "What the arrangement is saying.", es: "Lo que dice el arreglo." },
    excerpt: { en: "On reading the room: the difference between an apology arrangement and a celebration arrangement.", es: "Sobre leer la habitación: la diferencia entre un arreglo de disculpa y uno de celebración." },
    date: "2026-02-22",
    readingMinutes: 4,
    cover: {
      src: "https://picsum.photos/seed/diva-journal-meaning/2400/1350",
      alt: { en: "Two arrangements side by side, contrasting tones", es: "Dos arreglos lado a lado, tonos contrastantes" },
    },
    body: (locale) => {
      const en = locale === "en";
      return (
        <>
          <DropCap>{en ? "When someone calls and tells us they need an arrangement for a recipient they have hurt, we do not ask why. We ask about the recipient. The flowers are not for the sender." : "Cuando alguien llama y dice que necesita un arreglo para alguien a quien ha lastimado, no preguntamos por qué. Preguntamos por la persona que lo recibe. Las flores no son para quien las envía."}</DropCap>
          <p>{en ? "An apology bouquet is quieter than a celebration bouquet. There is no peony. There is no orchid. There is white, and ivory, and a single stem of something the recipient once mentioned in passing. The card message is short, and the writing is plain. Anything more and it becomes a performance." : "Un ramo de disculpa es más silencioso que uno de celebración. No hay peonía. No hay orquídea. Hay blanco, marfil, y un solo tallo de algo que la persona alguna vez mencionó al pasar. El mensaje en la tarjeta es breve, y la letra simple. Cualquier cosa más y se convierte en una actuación."}</p>
          <PullQuote>{en ? "The flowers are not for the sender." : "Las flores no son para quien las envía."}</PullQuote>
          <p>{en ? "A celebration bouquet, by contrast, can be loud. It can have peonies the size of a fist. It can have rouge. It can break the rules we usually keep. The recipient is somewhere already happy and the flowers are joining them, not arguing with them." : "Un ramo de celebración, en cambio, puede ser ruidoso. Puede tener peonías del tamaño de un puño. Puede tener rouge. Puede romper las reglas que normalmente seguimos. La persona ya está en algún lugar feliz y las flores se les unen, no discuten con ellas."}</p>
          <p>{en ? "The hardest call we get is somewhere in between — someone who is gone, but the recipient is in a complicated grief. For those, we make something that has not made up its mind: white, with one warm thread running through it. We have made hundreds of those. They are the arrangements we are most careful with." : "La llamada más difícil está en algún punto intermedio — alguien que se ha ido, pero el dolor de quien recibe es complicado. Para esos casos, hacemos algo que aún no se ha decidido: blanco, con un hilo cálido atravesándolo. Hemos hecho cientos. Son los arreglos con los que tenemos más cuidado."}</p>
        </>
      );
    },
    seo: {
      title: { en: "What the arrangement is saying — Diva Flowers Journal", es: "Lo que dice el arreglo — Diario de Diva Flowers" },
      description: { en: "Reading the room: the difference between an apology arrangement and a celebration arrangement, and why white-with-one-warm-thread is the hardest one we make.", es: "Leer la habitación: la diferencia entre un arreglo de disculpa y uno de celebración, y por qué el blanco con un hilo cálido es el más difícil de hacer." },
    },
  },
];

export function getArticleBySlug(slug: string): JournalArticle | undefined {
  return journalArticles.find((a) => a.slug === slug);
}
