// Tiny self-contained pages for /c/<code>. They live outside the localized app
// shell on purpose: the recipient only needs a friendly, branded message.

type Locale = "es" | "en";

const COPY: Record<Locale, { title: string; body: string; link: string }> = {
  es: {
    title: "Tu sorpresa está en camino",
    body: "Tu sorpresa digital se está terminando de preparar. Vuelve a escanear el código en un rato 💐",
    link: "Visitar Maky the Diva Flowers",
  },
  en: {
    title: "Your surprise is on its way",
    body: "Your digital surprise is being finished. Scan the code again in a little while 💐",
    link: "Visit Maky the Diva Flowers",
  },
};

function shell(locale: Locale, title: string, body: string, link: string): string {
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #FAF6F0; color: #0E0D0C; font-family: Georgia, "Times New Roman", serif; }
  main { max-width: 26rem; padding: 2rem 1.5rem; text-align: center; }
  .brand { font-size: 2rem; letter-spacing: 0.02em; }
  .tag { font-size: 0.75rem; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0.6; }
  h1 { font-size: 1.35rem; font-weight: normal; margin: 2rem 0 0.75rem; }
  p { line-height: 1.5; opacity: 0.8; }
  a { color: #B8345E; }
</style>
</head>
<body>
<main>
  <div class="brand">maky</div>
  <div class="tag">the diva flowers</div>
  <h1>${title}</h1>
  <p>${body}</p>
  <p><a href="https://makythedivaflowers.com">${link}</a></p>
</main>
</body>
</html>`;
}

export function preparingPage(locale: Locale): string {
  const c = COPY[locale];
  return shell(locale, c.title, c.body, c.link);
}

export function notFoundPage(): string {
  return shell(
    "es",
    "No encontramos esta tarjeta",
    "Revisa que el código esté completo o escríbenos y te ayudamos.",
    COPY.es.link,
  );
}
