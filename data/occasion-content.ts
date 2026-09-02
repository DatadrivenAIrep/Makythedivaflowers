// data/occasion-content.ts
//
// Copy for the /ocasiones/[slug] landing pages. Every competing Long Island
// florist organises the shop by occasion; this is the substance behind that —
// what to send, and the two or three questions people actually call to ask.
//
// The guidance is written to be useful whether or not you buy here. That is what
// keeps these pages out of doorway-page territory, and it is the same standard
// `data/local-seo.ts` holds for the town pages.
import type { Occasion } from "@/types/product";

export type OccasionContent = {
  /** Page H1 and menu label. */
  label: { en: string; es: string };
  /** Short line above the H1. */
  eyebrow: { en: string; es: string };
  /** One or two sentences under the H1; also the meta description seed. */
  lead: { en: string; es: string };
  /** Substantive advice — 2 blocks, each a real question people ask. */
  guidance: {
    heading: { en: string; es: string };
    body: { en: string; es: string };
  }[];
  /** Rendered visibly and emitted as FAQPage schema, never schema-only. */
  faq: { q: { en: string; es: string }; a: { en: string; es: string } }[];
};

export const OCCASIONS_ALL: Occasion[] = [
  "birthday",
  "romance",
  "anniversary",
  "sympathy",
  "congrats",
  "graduation",
  "new-baby",
  "thank-you",
  "get-well",
  "thinking-of-you",
  "just-because",
  "mothers-day",
];

export const OCCASION_CONTENT: Record<Occasion, OccasionContent> = {
  birthday: {
    label: { en: "Birthday Flowers", es: "Flores de Cumpleaños" },
    eyebrow: { en: "For the day that is theirs", es: "Para el día que es suyo" },
    lead: {
      en: "Bright, generous arrangements built the morning they go out. Order by 2:00 PM and they arrive the same day across Nassau and Queens.",
      es: "Arreglos brillantes y generosos, armados la mañana en que salen. Pide antes de las 2:00 PM y llegan el mismo día en Nassau y Queens.",
    },
    guidance: [
      {
        heading: { en: "Colour beats size on a birthday", es: "En un cumpleaños el color gana al tamaño" },
        body: {
          en: "A tight, saturated bouquet reads bigger in a photo than a loose pale one twice its price. If the budget is fixed, spend it on colour density rather than on stem count — that is what makes a desk or a kitchen counter look like something happened.",
          es: "Un ramo compacto y saturado se ve más grande en una foto que uno pálido y suelto del doble de precio. Si el presupuesto es fijo, gástalo en densidad de color y no en cantidad de tallos — eso es lo que hace que un escritorio o una cocina se vean como que algo pasó.",
        },
      },
      {
        heading: { en: "Sending to an office", es: "Si va a una oficina" },
        body: {
          en: "Keep it low and in a vessel that holds water on its own, so nobody has to hunt for a vase. Add the recipient's phone number: front desks close, and a driver who can call gets it into the right hands instead of leaving it in a lobby.",
          es: "Que sea bajo y en un recipiente que sostenga el agua solo, para que nadie tenga que buscar un jarrón. Incluye el teléfono de quien lo recibe: las recepciones cierran, y un conductor que puede llamar lo entrega en las manos correctas en vez de dejarlo en un lobby.",
        },
      },
    ],
    faq: [
      {
        q: { en: "Can it arrive today?", es: "¿Puede llegar hoy?" },
        a: {
          en: "Yes, if you order before 2:00 PM on a delivery day. After that we deliver the next day, and pickup at the Willis Avenue shop is usually available the same afternoon.",
          es: "Sí, si pides antes de las 2:00 PM en un día de entrega. Después de esa hora entregamos al día siguiente, y recoger en la tienda de Willis Avenue suele estar disponible esa misma tarde.",
        },
      },
      {
        q: { en: "Can you write the card for me?", es: "¿Pueden escribir la tarjeta por mí?" },
        a: {
          en: "Yes. Every order includes a hand-written card, and if you are stuck the checkout can suggest a line based on who it is for.",
          es: "Sí. Cada pedido incluye una tarjeta escrita a mano, y si no se te ocurre nada, el checkout te sugiere una línea según para quién es.",
        },
      },
      {
        q: { en: "What if I do not know their taste?", es: "¿Y si no sé qué le gusta?" },
        a: {
          en: "Send the designer's choice. You set the budget and Maky builds from what came in freshest that morning — it is consistently the best flowers per dollar we sell.",
          es: "Manda la elección del diseñador. Tú pones el presupuesto y Maky arma con lo más fresco que llegó esa mañana — son las mejores flores por dólar que vendemos.",
        },
      },
    ],
  },

  romance: {
    label: { en: "Romantic Flowers", es: "Flores Románticas" },
    eyebrow: { en: "Say it with the stem", es: "Dilo con el tallo" },
    lead: {
      en: "Roses, garden blooms and deep-toned arrangements for the gesture that is not waiting for a holiday. Same-day across Long Island.",
      es: "Rosas, flores de jardín y arreglos de tonos profundos para el gesto que no espera una fecha. El mismo día en Long Island.",
    },
    guidance: [
      {
        heading: { en: "A dozen roses is a starting point, not a rule", es: "Doce rosas son un punto de partida, no una regla" },
        body: {
          en: "The count matters less than the variety. Garden roses open wide and read as generous at half the stem count of a standard long-stem rose, and they last about as long. If you want impact for the money, ask for garden varieties rather than more stems.",
          es: "La cantidad importa menos que la variedad. Las rosas de jardín abren amplias y se ven generosas con la mitad de tallos que una rosa de tallo largo estándar, y duran casi lo mismo. Si quieres impacto por el dinero, pide variedades de jardín en vez de más tallos.",
        },
      },
      {
        heading: { en: "Delivering to a home where they may not be", es: "Si entregamos donde quizá no estén" },
        body: {
          en: "Tell us and we will hold it. Flowers left in a hallway for six hours arrive tired, and a surprise that wilts is worse than one that comes an hour later. We would rather re-time the run than leave it at a door.",
          es: "Avísanos y lo guardamos. Unas flores que pasan seis horas en un pasillo llegan cansadas, y una sorpresa marchita es peor que una que llega una hora después. Preferimos reprogramar el recorrido antes que dejarlo en una puerta.",
        },
      },
    ],
    faq: [
      {
        q: { en: "Do you deliver in the evening?", es: "¿Entregan de noche?" },
        a: {
          en: "Our last window runs to 8 PM. Choose the evening slot at checkout and tell us if the timing has to be exact — we will call you if the run is running behind.",
          es: "Nuestra última ventana llega hasta las 8 PM. Elige la franja de la noche al pagar y dinos si la hora tiene que ser exacta — te llamamos si el recorrido se atrasa.",
        },
      },
      {
        q: { en: "Can I keep it anonymous?", es: "¿Puede ser anónimo?" },
        a: {
          en: "Yes. Leave the card unsigned and we will not add your name. We still need your phone in case the recipient's address does not work out.",
          es: "Sí. Deja la tarjeta sin firmar y no agregamos tu nombre. Igual necesitamos tu teléfono por si la dirección no funciona.",
        },
      },
      {
        q: { en: "What lasts longest?", es: "¿Qué dura más?" },
        a: {
          en: "Orchids, by a wide margin — weeks rather than days. Among cut flowers, roses and alstroemeria outlast peonies and ranunculus, which are gorgeous and brief.",
          es: "Las orquídeas, por mucho — semanas en vez de días. Entre las flores cortadas, las rosas y la alstroemeria duran más que las peonías y los ranúnculos, que son preciosos y breves.",
        },
      },
    ],
  },

  anniversary: {
    label: { en: "Anniversary Flowers", es: "Flores de Aniversario" },
    eyebrow: { en: "For the year you both counted", es: "Por el año que ambos contaron" },
    lead: {
      en: "Statement arrangements and rose work for the date that repeats. Built by hand in Albertson, delivered the same day when you order by 2:00 PM.",
      es: "Arreglos de presencia y trabajo en rosas para la fecha que se repite. Hechos a mano en Albertson y entregados el mismo día si pides antes de las 2:00 PM.",
    },
    guidance: [
      {
        heading: { en: "Scale is the anniversary signal", es: "La escala es la señal del aniversario" },
        body: {
          en: "This is the one occasion where size does the talking. A hundred-rose piece or a tall statement arrangement changes a room in a way a hand-tied bouquet cannot. If you are choosing between more stems and a nicer vase, choose the stems — the vase gets replaced, the photograph does not.",
          es: "Es la ocasión donde el tamaño habla. Una pieza de cien rosas o un arreglo alto cambian una sala como un ramo atado a mano no puede. Si eliges entre más tallos y un mejor jarrón, elige los tallos — el jarrón se reemplaza, la foto no.",
        },
      },
      {
        heading: { en: "Order two days out for the big pieces", es: "Pide con dos días para las piezas grandes" },
        body: {
          en: "Anything above about a hundred stems is sourced for you specifically. We can often do it same-day, but with two days we can pick the variety and the colour instead of taking what the market has that morning.",
          es: "Todo lo que pasa de unos cien tallos se consigue especialmente para ti. Muchas veces podemos hacerlo el mismo día, pero con dos días escogemos la variedad y el color en vez de tomar lo que haya esa mañana.",
        },
      },
    ],
    faq: [
      {
        q: { en: "Can you match last year's arrangement?", es: "¿Pueden repetir el arreglo del año pasado?" },
        a: {
          en: "Usually. Send us a photo or the order number and we will rebuild it, substituting only what the season no longer carries — we will tell you in advance what changes.",
          es: "Casi siempre. Mándanos una foto o el número de pedido y lo rehacemos, cambiando solo lo que la temporada ya no trae — te decimos por adelantado qué cambia.",
        },
      },
      {
        q: { en: "Do you deliver to restaurants?", es: "¿Entregan en restaurantes?" },
        a: {
          en: "Yes, and it works best when we deliver before service starts. Give us the reservation name and time and we will coordinate with the host stand.",
          es: "Sí, y funciona mejor si entregamos antes de que empiece el servicio. Danos el nombre y la hora de la reserva y coordinamos con la recepción.",
        },
      },
      {
        q: { en: "How far ahead can I order?", es: "¿Con cuánta anticipación puedo pedir?" },
        a: {
          en: "You can schedule a delivery date up to two weeks out at checkout. For anything further, call the shop and we will put it on the calendar.",
          es: "Puedes agendar la fecha hasta dos semanas adelante al pagar. Para más tiempo, llama a la tienda y lo ponemos en el calendario.",
        },
      },
    ],
  },

  sympathy: {
    label: { en: "Sympathy & Funeral Flowers", es: "Flores de Condolencia y Funeral" },
    eyebrow: { en: "When words are not enough", es: "Cuando las palabras no bastan" },
    lead: {
      en: "Standing sprays, casket pieces and arrangements for the home, delivered directly to funeral homes across Long Island and Queens. Call us and we will handle the timing with the funeral director.",
      es: "Coronas de pie, piezas para féretro y arreglos para el hogar, entregados directamente a funerarias de Long Island y Queens. Llámanos y coordinamos la hora con la funeraria.",
    },
    guidance: [
      {
        heading: { en: "Send to the service or to the house, not both", es: "Manda al servicio o a la casa, no a los dos" },
        body: {
          en: "Pieces sent to a service belong to the room and usually stay there. Something sent to the house is for the weeks after, when the visitors have gone. If you only send once, the house is often the kinder choice — and it does not have to arrive in the first three days.",
          es: "Las piezas del servicio pertenecen a la sala y suelen quedarse ahí. Lo que se manda a la casa es para las semanas siguientes, cuando ya no hay visitas. Si solo mandas una vez, la casa suele ser lo más generoso — y no tiene que llegar en los primeros tres días.",
        },
      },
      {
        heading: { en: "Ask before you choose the form", es: "Pregunta antes de elegir la forma" },
        body: {
          en: "Standing sprays and casket pieces are usually the family's to choose; crosses, hearts and specific colours can carry meaning a friend should not assume. If you are not immediate family, an arrangement for the home is always correct.",
          es: "Las coronas de pie y las piezas de féretro suelen elegirlas la familia; las cruces, los corazones y ciertos colores cargan un significado que un amigo no debería asumir. Si no eres familia directa, un arreglo para la casa siempre es correcto.",
        },
      },
    ],
    faq: [
      {
        q: { en: "Can you deliver to a funeral home today?", es: "¿Pueden entregar hoy en una funeraria?" },
        a: {
          en: "Often yes, if you call before 11 AM on the day of the service. We deliver, set the piece where the family wants it, and confirm with a photo when we leave.",
          es: "Muchas veces sí, si llamas antes de las 11 AM del día del servicio. Entregamos, colocamos la pieza donde la familia la quiere y confirmamos con una foto al salir.",
        },
      },
      {
        q: { en: "What do I write on the card?", es: "¿Qué escribo en la tarjeta?" },
        a: {
          en: "Short is right. Your name and one true sentence does more than a long message. If you knew something specific about the person, say that.",
          es: "Corto está bien. Tu nombre y una frase verdadera hacen más que un mensaje largo. Si sabías algo específico de la persona, dilo.",
        },
      },
      {
        q: { en: "Can we order as a group?", es: "¿Podemos pedir en grupo?" },
        a: {
          en: "Yes, and it is common for an office or a family branch. Call us with the names for the card and one person can pay for the whole piece.",
          es: "Sí, y es común para una oficina o una rama de la familia. Llámanos con los nombres para la tarjeta y una sola persona paga la pieza completa.",
        },
      },
    ],
  },

  congrats: {
    label: { en: "Congratulations Flowers", es: "Flores de Felicitación" },
    eyebrow: { en: "For the news worth marking", es: "Para la noticia que merece marcarse" },
    lead: {
      en: "New job, new home, new chapter. Bright arrangements and long-lasting plants that say it before the card is opened.",
      es: "Trabajo nuevo, casa nueva, capítulo nuevo. Arreglos brillantes y plantas duraderas que lo dicen antes de abrir la tarjeta.",
    },
    guidance: [
      {
        heading: { en: "A plant outlasts the moment", es: "Una planta dura más que el momento" },
        body: {
          en: "For a new office or a first apartment, a plant is doing more work than cut flowers: it is still there in March. An orchid blooms for two to three months and needs water roughly once a week, which is about the right amount of care for someone who just moved.",
          es: "Para una oficina nueva o un primer apartamento, una planta trabaja más que las flores cortadas: sigue ahí en marzo. Una orquídea florece dos o tres meses y se riega más o menos una vez por semana, que es el cuidado justo para alguien que acaba de mudarse.",
        },
      },
      {
        heading: { en: "Housewarming has a size limit", es: "La mudanza tiene un límite de tamaño" },
        body: {
          en: "Someone surrounded by boxes has no counter space and no vase. Send something self-contained and modest in footprint, and save the statement piece for after they have unpacked.",
          es: "Quien está rodeado de cajas no tiene mesada ni jarrón. Manda algo autónomo y de poca huella, y guarda la pieza grande para cuando ya haya desempacado.",
        },
      },
    ],
    faq: [
      {
        q: { en: "Can you deliver to an office building?", es: "¿Entregan en un edificio de oficinas?" },
        a: {
          en: "Yes. Give us the company name and floor, and the recipient's phone if you have it — most lobbies will not call up without a name they recognise.",
          es: "Sí. Danos el nombre de la empresa y el piso, y el teléfono de quien recibe si lo tienes — la mayoría de los lobbies no llaman arriba sin un nombre que reconozcan.",
        },
      },
      {
        q: { en: "Do plants need a card too?", es: "¿Las plantas también llevan tarjeta?" },
        a: {
          en: "They come with one at no extra cost, and we include care instructions so nobody has to guess how often to water it.",
          es: "Vienen con una sin costo extra, e incluimos instrucciones de cuidado para que nadie adivine cada cuánto regar.",
        },
      },
      {
        q: { en: "Can I send something for a whole team?", es: "¿Puedo mandar algo para todo un equipo?" },
        a: {
          en: "A low centrepiece for a shared table works better than individual bouquets, and costs less. Call us and we will size it to the room.",
          es: "Un centro bajo para una mesa compartida funciona mejor que ramos individuales, y cuesta menos. Llámanos y lo ajustamos al espacio.",
        },
      },
    ],
  },

  graduation: {
    label: { en: "Graduation Flowers", es: "Flores de Graduación" },
    eyebrow: { en: "They finished it", es: "Lo terminaron" },
    lead: {
      en: "Bold, photographable arrangements and bouquets for the ceremony and the dinner after. Order ahead for June — graduation weekends book out.",
      es: "Arreglos y ramos vistosos y fotogénicos para la ceremonia y la cena de después. Pide con tiempo para junio — los fines de semana de graduación se llenan.",
    },
    guidance: [
      {
        heading: { en: "A ceremony bouquet has to be carried", es: "Un ramo de ceremonia hay que cargarlo" },
        body: {
          en: "Wrapped and hand-tied, not in a vase — a graduate is holding it through photographs, a hug line and a car ride. Keep it light and keep the wrap dry, and it still looks right two hours later at dinner.",
          es: "Envuelto y atado a mano, no en jarrón — el graduado lo carga durante las fotos, la fila de abrazos y el viaje en auto. Que sea liviano y con el envoltorio seco, y a las dos horas en la cena sigue viéndose bien.",
        },
      },
      {
        heading: { en: "School colours photograph better than pastels", es: "Los colores de la escuela fotografían mejor que los pasteles" },
        body: {
          en: "Against a black gown in bright sun, pale flowers disappear. Saturated colour holds up in the photographs everyone actually keeps. Tell us the school colours and we will build to them.",
          es: "Contra una toga negra y a pleno sol, las flores pálidas desaparecen. El color saturado aguanta en las fotos que la gente sí guarda. Dinos los colores de la escuela y armamos con esos.",
        },
      },
    ],
    faq: [
      {
        q: { en: "Can I pick it up on the way to the ceremony?", es: "¿Puedo recogerlo camino a la ceremonia?" },
        a: {
          en: "Yes, and for a morning ceremony that is usually the safest plan. Pickup is free, and we will have it wrapped and ready at the time you choose.",
          es: "Sí, y para una ceremonia de mañana suele ser lo más seguro. Recoger es gratis, y lo tenemos envuelto y listo a la hora que elijas.",
        },
      },
      {
        q: { en: "Do you make leis or corsages?", es: "¿Hacen leis o corsages?" },
        a: {
          en: "We make corsages and boutonnières to order, and can do a flower lei with about a week's notice. Call the shop for either.",
          es: "Hacemos corsages y boutonnières por encargo, y un lei de flores con una semana de aviso. Llama a la tienda para cualquiera de los dos.",
        },
      },
      {
        q: { en: "How early should I order for June?", es: "¿Con cuánto pido para junio?" },
        a: {
          en: "A week is comfortable. Graduation weekends are the busiest days of our year after Mother's Day, and same-day slots go early.",
          es: "Una semana es cómodo. Los fines de semana de graduación son los días más ocupados del año después del Día de la Madre, y los cupos del mismo día se van temprano.",
        },
      },
    ],
  },

  "new-baby": {
    label: { en: "New Baby Flowers", es: "Flores de Recién Nacido" },
    eyebrow: { en: "For the smallest arrival", es: "Para la llegada más pequeña" },
    lead: {
      en: "Soft, low arrangements and long-lasting plants for a house that has just stopped sleeping. Delivered across Nassau and Queens.",
      es: "Arreglos bajos y suaves y plantas duraderas para una casa que acaba de dejar de dormir. Entregamos en Nassau y Queens.",
    },
    guidance: [
      {
        heading: { en: "Send it to the house, not the hospital", es: "Mándalo a la casa, no al hospital" },
        body: {
          en: "Maternity floors often restrict flowers, and whatever is in the room has to be carried home along with everything else. Something waiting at the house lands better — and the second week, when the visitors stop, is a better time than the first.",
          es: "Los pisos de maternidad suelen restringir las flores, y lo que esté en la habitación hay que cargarlo a casa junto con todo lo demás. Algo esperando en la casa cae mejor — y la segunda semana, cuando dejan de llegar visitas, es mejor momento que la primera.",
        },
      },
      {
        heading: { en: "Keep it low and unscented", es: "Bajo y sin perfume" },
        body: {
          en: "Strong fragrance is a lot in a small room with a newborn, and a tall arrangement is one more thing to move. Low, soft and self-watering is the whole brief. Ask us to leave out lilies if there is a cat in the house — they are toxic to cats.",
          es: "Un perfume fuerte es demasiado en un cuarto pequeño con un recién nacido, y un arreglo alto es una cosa más que mover. Bajo, suave y que se sostenga solo es todo el encargo. Pídenos quitar los lirios si hay gato en la casa — son tóxicos para ellos.",
        },
      },
    ],
    faq: [
      {
        q: { en: "Can you deliver to a hospital?", es: "¿Pueden entregar en un hospital?" },
        a: {
          en: "We can, and we need the patient's full name and room number. Some maternity and recovery units do not accept flowers at all, so it is worth one phone call to the floor first.",
          es: "Podemos, y necesitamos el nombre completo y el número de habitación. Algunas unidades de maternidad y recuperación no aceptan flores, así que conviene llamar antes al piso.",
        },
      },
      {
        q: { en: "Something that is not flowers?", es: "¿Algo que no sean flores?" },
        a: {
          en: "A plant. It survives a month of no sleep, and it is still there when the flowers would have been thrown out.",
          es: "Una planta. Sobrevive un mes sin dormir, y sigue ahí cuando las flores ya se habrían tirado.",
        },
      },
      {
        q: { en: "Can you deliver quietly?", es: "¿Pueden entregar sin ruido?" },
        a: {
          en: "Tell us not to ring and we will text on arrival instead. It is the most common request we get for this one.",
          es: "Dinos que no toquemos el timbre y mandamos un texto al llegar. Es el pedido más común que recibimos para esta ocasión.",
        },
      },
    ],
  },

  "thank-you": {
    label: { en: "Thank You Flowers", es: "Flores de Agradecimiento" },
    eyebrow: { en: "For the favour you cannot repay", es: "Por el favor que no se devuelve" },
    lead: {
      en: "Warm, generous arrangements for the neighbour, the host, the person who showed up. Same-day across Long Island when you order by 2:00 PM.",
      es: "Arreglos cálidos y generosos para el vecino, el anfitrión, quien estuvo ahí. El mismo día en Long Island si pides antes de las 2:00 PM.",
    },
    guidance: [
      {
        heading: { en: "Arrive in a vessel", es: "Que llegue en su propio recipiente" },
        body: {
          en: "A thank-you should not create work. Wrapped stems mean the person you are thanking has to find a vase, trim and arrange them — send something already in water and the gesture stays a gift.",
          es: "Un agradecimiento no debería crear trabajo. Unos tallos envueltos obligan a quien agradeces a buscar jarrón, cortar y armar — manda algo que ya venga en agua y el gesto sigue siendo un regalo.",
        },
      },
      {
        heading: { en: "Timing beats size", es: "El momento gana al tamaño" },
        body: {
          en: "Flowers that arrive the day after they helped you land harder than a bigger arrangement three weeks later. If you are debating budget, send sooner and smaller.",
          es: "Unas flores que llegan al día siguiente de que te ayudaron pegan más fuerte que un arreglo más grande tres semanas después. Si dudas del presupuesto, manda antes y más chico.",
        },
      },
    ],
    faq: [
      {
        q: { en: "Is there a small option?", es: "¿Hay una opción pequeña?" },
        a: {
          en: "Yes. The standard size on most of our arrangements is built for exactly this — enough to read as a real gesture without being an event.",
          es: "Sí. El tamaño estándar de casi todos nuestros arreglos está pensado justo para esto — suficiente para leerse como un gesto real sin ser un acontecimiento.",
        },
      },
      {
        q: { en: "Can you deliver to a neighbour without me being there?", es: "¿Pueden entregar a un vecino sin que yo esté?" },
        a: {
          en: "Yes, that is most of what we do. Add their phone number so our driver can reach them if nobody answers the door.",
          es: "Sí, es la mayor parte de lo que hacemos. Agrega su teléfono para que el conductor pueda ubicarlo si nadie abre.",
        },
      },
      {
        q: { en: "Can I send to a whole office?", es: "¿Puedo mandar a toda una oficina?" },
        a: {
          en: "A low centrepiece for the shared kitchen or reception works better than one bouquet for one desk. Call us and we will size it.",
          es: "Un centro bajo para la cocina compartida o la recepción funciona mejor que un ramo para un escritorio. Llámanos y lo dimensionamos.",
        },
      },
    ],
  },

  "get-well": {
    label: { en: "Get Well Flowers", es: "Flores para Mejorarse" },
    eyebrow: { en: "Something bright in the room", es: "Algo brillante en el cuarto" },
    lead: {
      en: "Cheerful, low arrangements and easy plants for a recovery that is taking longer than anyone hoped. Delivered to homes and hospitals across Nassau and Queens.",
      es: "Arreglos bajos y alegres y plantas fáciles para una recuperación que va más lenta de lo que todos esperaban. Entregamos a casas y hospitales en Nassau y Queens.",
    },
    guidance: [
      {
        heading: { en: "Hospitals have rules, and they vary by floor", es: "Los hospitales tienen reglas, y cambian por piso" },
        body: {
          en: "Intensive care and most transplant and oncology units do not allow flowers or plants at all. General floors usually do, as long as the arrangement is low, unscented and in a vessel that will not tip. When in doubt, send it to the house for when they are home.",
          es: "Cuidados intensivos y la mayoría de las unidades de trasplante y oncología no permiten flores ni plantas. Los pisos generales suelen permitirlas, si el arreglo es bajo, sin perfume y en un recipiente que no se vuelque. Ante la duda, mándalo a la casa para cuando regresen.",
        },
      },
      {
        heading: { en: "The second week is the quiet one", es: "La segunda semana es la callada" },
        body: {
          en: "Everyone sends something in the first three days. If you want your flowers to matter, send them in week two, when the room has emptied out and the recovery is still going.",
          es: "Todo el mundo manda algo en los primeros tres días. Si quieres que tus flores importen, mándalas en la segunda semana, cuando el cuarto se vació y la recuperación sigue.",
        },
      },
    ],
    faq: [
      {
        q: { en: "What do I need for a hospital delivery?", es: "¿Qué necesito para entregar en un hospital?" },
        a: {
          en: "The patient's full name as admitted, the hospital, and the room number if you have it. We deliver to the front desk, which is how every hospital on Long Island prefers it.",
          es: "El nombre completo del paciente como fue admitido, el hospital y el número de habitación si lo tienes. Entregamos en recepción, que es como lo prefieren todos los hospitales de Long Island.",
        },
      },
      {
        q: { en: "What if they are discharged before it arrives?", es: "¿Y si le dan de alta antes de que llegue?" },
        a: {
          en: "Call us and we will redirect it to the house at no extra charge, as long as it is still in the same delivery zone.",
          es: "Llámanos y lo redirigimos a la casa sin cargo extra, mientras siga en la misma zona de entrega.",
        },
      },
      {
        q: { en: "Are there flowers to avoid?", es: "¿Hay flores que evitar?" },
        a: {
          en: "Anything strongly scented — lilies and stock especially — in a small room with someone who feels unwell. Tell us and we will build without them.",
          es: "Todo lo muy perfumado — sobre todo lirios y alhelí — en un cuarto pequeño con alguien que se siente mal. Dinos y lo armamos sin eso.",
        },
      },
    ],
  },

  "thinking-of-you": {
    label: { en: "Thinking of You Flowers", es: "Flores de Pienso en Ti" },
    eyebrow: { en: "No occasion required", es: "No hace falta una ocasión" },
    lead: {
      en: "Quiet, soft arrangements for the hard week that is not a funeral and not an illness — the divorce, the layoff, the stretch nobody is sending cards for.",
      es: "Arreglos suaves y tranquilos para la semana difícil que no es un funeral ni una enfermedad — el divorcio, el despido, el tramo por el que nadie manda tarjetas.",
    },
    guidance: [
      {
        heading: { en: "Say the thing plainly", es: "Dilo simple" },
        body: {
          en: "The card matters more here than the flowers. \"I heard. I am around.\" beats anything longer. Do not ask a question the person then has to answer — the point is that they owe you nothing.",
          es: "Aquí la tarjeta importa más que las flores. «Me enteré. Aquí estoy.» gana a cualquier cosa más larga. No hagas una pregunta que obligue a responder — el punto es que no te deben nada.",
        },
      },
      {
        heading: { en: "Soft, not celebratory", es: "Suave, no festivo" },
        body: {
          en: "Bright and loud can read as tone-deaf when someone is having a bad month. Muted palettes, or a plant that asks nothing of them, do the work without demanding a mood they do not have.",
          es: "Lo brillante y ruidoso puede sonar a que no leíste el momento cuando alguien la está pasando mal. Las paletas apagadas, o una planta que no les pide nada, hacen el trabajo sin exigir un ánimo que no tienen.",
        },
      },
    ],
    faq: [
      {
        q: { en: "Is it strange to send with no occasion?", es: "¿Es raro mandar sin ocasión?" },
        a: {
          en: "It is the reason people remember the flowers. An arrangement on an ordinary Tuesday says someone was thinking about them when nothing prompted it.",
          es: "Es justo por eso que la gente recuerda esas flores. Un arreglo un martes cualquiera dice que alguien pensó en ellos sin que nada lo obligara.",
        },
      },
      {
        q: { en: "Can you deliver without a name on the card?", es: "¿Pueden entregar sin nombre en la tarjeta?" },
        a: {
          en: "Yes, though for this one we usually suggest signing it. Anonymous flowers during a hard week can add a puzzle the person does not need.",
          es: "Sí, aunque para esta ocasión solemos sugerir firmarla. Unas flores anónimas en una semana difícil agregan un enigma que la persona no necesita.",
        },
      },
      {
        q: { en: "Something that lasts?", es: "¿Algo que dure?" },
        a: {
          en: "A plant. It is still there in a month, which is roughly how long the hard part lasts.",
          es: "Una planta. Sigue ahí en un mes, que es más o menos lo que dura la parte difícil.",
        },
      },
    ],
  },

  "just-because": {
    label: { en: "Just Because Flowers", es: "Flores Porque Sí" },
    eyebrow: { en: "The Wednesday flowers", es: "Las flores del miércoles" },
    lead: {
      en: "For no reason at all, which is the best reason. Hand-tied bouquets and arrangements built the morning they go out.",
      es: "Sin ningún motivo, que es el mejor motivo. Ramos atados a mano y arreglos armados la mañana en que salen.",
    },
    guidance: [
      {
        heading: { en: "Smaller and more often", es: "Más chico y más seguido" },
        body: {
          en: "One large arrangement a year is a gesture; a modest bouquet every few weeks is a habit, and people notice the habit. Our subscription exists because of exactly this — same flowers, better rhythm, lower cost per delivery.",
          es: "Un arreglo grande al año es un gesto; un ramo modesto cada pocas semanas es una costumbre, y la gente nota la costumbre. Nuestra suscripción existe por esto — las mismas flores, mejor ritmo, menor costo por entrega.",
        },
      },
      {
        heading: { en: "Let the florist choose", es: "Deja que elija el florista" },
        body: {
          en: "With no occasion to match, the designer's choice is the best value on the site: we build from whatever came in strongest that morning rather than sourcing to a picture. It is the same reason chefs write the menu after the market.",
          es: "Sin una ocasión que igualar, la elección del diseñador es lo que más rinde en el sitio: armamos con lo que llegó mejor esa mañana en vez de conseguir algo para copiar una foto. Es la misma razón por la que los chefs escriben el menú después del mercado.",
        },
      },
    ],
    faq: [
      {
        q: { en: "What is the least I can spend and still send something good?", es: "¿Cuál es lo mínimo que puedo gastar y que valga la pena?" },
        a: {
          en: "Our smallest hand-tied bouquets start around $65 and are real flowers arranged by hand, not a filler bouquet. Pickup is free if you would rather not add delivery.",
          es: "Nuestros ramos atados a mano más pequeños empiezan alrededor de $65 y son flores reales armadas a mano, no un ramo de relleno. Recoger es gratis si prefieres no sumar la entrega.",
        },
      },
      {
        q: { en: "Can I set up a standing order?", es: "¿Puedo dejar un pedido fijo?" },
        a: {
          en: "Yes — weekly or every two weeks, pause or cancel whenever. It is the cheapest way to have flowers in the house all the time.",
          es: "Sí — semanal o cada dos semanas, pausa o cancela cuando quieras. Es la forma más barata de tener flores en casa todo el tiempo.",
        },
      },
      {
        q: { en: "Do you deliver on weekends?", es: "¿Entregan los fines de semana?" },
        a: {
          en: "Saturdays yes, Sundays for pickup and select orders. The shop is open Sunday from 10 to 4.",
          es: "Sábados sí, domingos para recoger y pedidos seleccionados. La tienda abre el domingo de 10 a 4.",
        },
      },
    ],
  },

  "mothers-day": {
    label: { en: "Mother's Day Flowers", es: "Flores del Día de la Madre" },
    eyebrow: { en: "The one date that will not move", es: "La única fecha que no se mueve" },
    lead: {
      en: "Our busiest weekend of the year. Order early — delivery windows fill first, and the best stems are spoken for by the Thursday before.",
      es: "Nuestro fin de semana más ocupado del año. Pide temprano — las ventanas de entrega se llenan primero, y los mejores tallos ya están apartados desde el jueves anterior.",
    },
    guidance: [
      {
        heading: { en: "Order by the Thursday before", es: "Pide antes del jueves previo" },
        body: {
          en: "Mother's Day is not a day for us, it is four days. Orders placed by Thursday get first pick of the flowers and a delivery window you actually choose. By Saturday afternoon we are usually working from what is left.",
          es: "El Día de la Madre no es un día para nosotros, son cuatro. Los pedidos hechos hasta el jueves eligen primero las flores y una ventana de entrega real. Para el sábado en la tarde solemos trabajar con lo que queda.",
        },
      },
      {
        heading: { en: "If she is far, send early in the week", es: "Si está lejos, manda a principio de semana" },
        body: {
          en: "Flowers that arrive on Thursday are still beautiful on Sunday, and they get four extra days of being looked at. The date on the calendar matters less than the week she has them.",
          es: "Unas flores que llegan el jueves siguen preciosas el domingo, y ganan cuatro días más de ser miradas. La fecha del calendario importa menos que la semana en que las tiene.",
        },
      },
    ],
    faq: [
      {
        q: { en: "What is the last day to order?", es: "¿Cuál es el último día para pedir?" },
        a: {
          en: "We take orders until we run out of delivery capacity, usually the Saturday morning before. Earlier is genuinely better on this one weekend.",
          es: "Tomamos pedidos hasta que se acaba la capacidad de entrega, normalmente el sábado por la mañana. En este fin de semana, antes es de verdad mejor.",
        },
      },
      {
        q: { en: "Can I choose the delivery time?", es: "¿Puedo elegir la hora de entrega?" },
        a: {
          en: "You choose a window, and on Mother's Day weekend those windows are wider than usual. If the timing has to be exact, pickup is the reliable option.",
          es: "Eliges una ventana, y en el fin de semana del Día de la Madre esas ventanas son más amplias que de costumbre. Si la hora tiene que ser exacta, recoger es la opción confiable.",
        },
      },
      {
        q: { en: "Something other than roses?", es: "¿Algo que no sean rosas?" },
        a: {
          en: "Peonies if the season lands right, garden roses, or a phalaenopsis orchid that is still blooming in July. Ask us what came in that week.",
          es: "Peonías si la temporada acompaña, rosas de jardín, o una orquídea phalaenopsis que en julio sigue floreciendo. Pregúntanos qué llegó esa semana.",
        },
      },
    ],
  },
};

export const getOccasionContent = (slug: string): OccasionContent | undefined =>
  (OCCASIONS_ALL as string[]).includes(slug)
    ? OCCASION_CONTENT[slug as Occasion]
    : undefined;
