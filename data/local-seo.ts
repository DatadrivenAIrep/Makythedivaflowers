// data/local-seo.ts
//
// The town × occasion landing pages. Modelled on how flowersbymikeny.com wins
// local search — every page names a town — but with one hard rule: nothing on
// these pages is boilerplate with the town name swapped in. Google calls that a
// doorway page and demotes the whole set. Each city carries its own ZIPs,
// neighbours, real drive distance from 1077 Willis Ave and a specific delivery
// note; each occasion carries substantive guidance that stands on its own.
//
// ZIP codes, village/hamlet status and named institutions (Nassau County
// courthouse, NYU Langone Hospital — Long Island, Adelphi) are verified public
// facts. The operational sentences in each `note` — routing, cutoffs, how we
// handle a given town — are DRAFTS written to plausible florist practice and
// must be confirmed by the owner before they are treated as promises.
// Distances are straight-line from the shop scaled for the street grid, stated
// as approximate on the page — never as a promise.

export type LocalCity = {
  slug: string;
  name: string;
  /** "village" | "hamlet" | "incorporated village cluster" — affects the copy. */
  kind: "village" | "hamlet" | "cluster";
  zips: string[];
  neighbors: string[];
  miles: number;
  driveMinutes: number;
  /** One true, specific thing about delivering here. Never generic. */
  note: { en: string; es: string };
};

export const LOCAL_CITIES: LocalCity[] = [
  {
    slug: "roslyn-ny",
    name: "Roslyn",
    kind: "village",
    zips: ["11576", "11577"],
    neighbors: ["Roslyn Heights", "Roslyn Harbor", "East Hills", "Greenvale"],
    miles: 2.4,
    driveMinutes: 7,
    note: {
      en: "Roslyn is our closest neighbour to the north — straight up Willis Avenue. Orders placed before our 2:00 PM cutoff almost always land the same afternoon, and we can hand-carry tall arrangements down the hill to Roslyn Harbor without transferring them between vehicles.",
      es: "Roslyn es nuestro vecino más cercano al norte — subiendo por Willis Avenue. Los pedidos antes de las 2:00 PM casi siempre llegan esa misma tarde, y podemos llevar a mano los arreglos altos hasta Roslyn Harbor sin trasladarlos entre vehículos.",
    },
  },
  {
    slug: "manhasset-ny",
    name: "Manhasset",
    kind: "hamlet",
    zips: ["11030"],
    neighbors: ["Plandome", "Munsey Park", "Flower Hill", "Strathmore"],
    miles: 4.0,
    driveMinutes: 11,
    note: {
      en: "Manhasset runs about eleven minutes west of the studio. Northern Boulevard backs up badly between 4:00 and 6:30 PM, so for Manhasset addresses we schedule same-day runs before the afternoon crush rather than promising an evening window we would have to break.",
      es: "Manhasset queda a unos once minutos al oeste del estudio. Northern Boulevard se congestiona entre las 4:00 y 6:30 PM, así que para direcciones en Manhasset programamos las entregas del mismo día antes de la hora pico en lugar de prometer una ventana nocturna que tendríamos que incumplir.",
    },
  },
  {
    slug: "great-neck-ny",
    name: "Great Neck",
    kind: "cluster",
    zips: ["11020", "11021", "11023", "11024"],
    neighbors: ["Great Neck Plaza", "Kings Point", "Russell Gardens", "Great Neck Estates"],
    miles: 5.9,
    driveMinutes: 16,
    note: {
      en: "Great Neck is nine separate incorporated villages sharing one name, and several have their own gate or doorman procedures. Give us the village — Kings Point, Great Neck Plaza, Russell Gardens — and not just \"Great Neck\", and we can clear building access before the driver leaves rather than after they arrive.",
      es: "Great Neck son nueve pueblos incorporados distintos que comparten un nombre, y varios tienen sus propios procedimientos de acceso o portería. Dinos el pueblo — Kings Point, Great Neck Plaza, Russell Gardens — y no solo «Great Neck», y resolvemos el acceso antes de que salga el conductor.",
    },
  },
  {
    slug: "port-washington-ny",
    name: "Port Washington",
    kind: "hamlet",
    zips: ["11050"],
    neighbors: ["Sands Point", "Manorhaven", "Baxter Estates", "Port Washington North"],
    miles: 5.8,
    driveMinutes: 16,
    note: {
      en: "Port Washington is our longest regular run at roughly sixteen minutes, and the peninsula means there is no second route in. We build Port Washington arrangements with a deeper water reservoir and mechanics that hold on the drive out to Sands Point.",
      es: "Port Washington es nuestro recorrido habitual más largo, unos dieciséis minutos, y por ser península no hay una segunda ruta de entrada. Construimos los arreglos para Port Washington con más reserva de agua y una mecánica que aguanta el trayecto hasta Sands Point.",
    },
  },
  {
    slug: "garden-city-ny",
    name: "Garden City",
    kind: "village",
    zips: ["11530"],
    neighbors: ["Stewart Manor", "Mineola", "Franklin Square", "Hempstead"],
    miles: 4.3,
    driveMinutes: 12,
    note: {
      en: "Garden City is our busiest corporate destination — the Adelphi campus, the county offices and the hotel corridor all sit within a few minutes of each other. Those buildings have staffed front desks that accept deliveries all day, which makes Garden City one of the few addresses where a late-afternoon drop is genuinely reliable.",
      es: "Garden City es nuestro destino corporativo más activo — el campus de Adelphi, las oficinas del condado y el corredor hotelero están a pocos minutos entre sí. Esos edificios tienen recepciones atendidas que reciben entregas todo el día, lo que hace de Garden City una de las pocas direcciones donde una entrega a última hora sí es fiable.",
    },
  },
  {
    slug: "mineola-ny",
    name: "Mineola",
    kind: "village",
    zips: ["11501"],
    neighbors: ["Williston Park", "Carle Place", "Garden City Park", "Albertson"],
    miles: 2.2,
    driveMinutes: 6,
    note: {
      en: "Mineola is six minutes south and holds the Nassau County courthouse complex and NYU Langone Hospital — Long Island. Hospital deliveries need a patient room number and are left at the front desk; ask us for a low, unscented arrangement, since many units restrict anything tall or strongly scented.",
      es: "Mineola queda a seis minutos al sur y alberga el complejo judicial del condado de Nassau y NYU Langone Hospital — Long Island. Las entregas hospitalarias necesitan número de habitación y se dejan en recepción; pídenos un arreglo bajo y sin perfume, ya que muchas unidades restringen lo alto o muy aromático.",
    },
  },
  {
    slug: "williston-park-ny",
    name: "Williston Park",
    kind: "village",
    zips: ["11596"],
    neighbors: ["Albertson", "East Williston", "Mineola", "Herricks"],
    miles: 1.5,
    driveMinutes: 6,
    note: {
      en: "Williston Park is the next village down Willis Avenue — close enough that walk-in pickup is usually faster than delivery. If you order before noon we can often have it ready by the time you have driven over, and Hillside Avenue orders go out on the first run of the day.",
      es: "Williston Park es el siguiente pueblo bajando por Willis Avenue — tan cerca que recoger en tienda suele ser más rápido que la entrega. Si pides antes del mediodía solemos tenerlo listo para cuando llegues, y los pedidos de Hillside Avenue salen en el primer recorrido del día.",
    },
  },
];

export type LocalOccasion = {
  slug: string;
  /** Used in titles: "Wedding Flowers in Roslyn, NY" */
  label: { en: string; es: string };
  /** The keyword head: "wedding flowers", "funeral flowers". */
  keyword: { en: string; es: string };
  /** Which /shop category or landing page this funnels into. */
  shopHref: string;
  leadIn: { en: string; es: string };
  /** Substantive, occasion-specific guidance. This is what keeps the set out of
   *  doorway-page territory — it is useful whether or not you buy from us. */
  guidance: { heading: { en: string; es: string }; body: { en: string; es: string } }[];
};

export const LOCAL_OCCASIONS: LocalOccasion[] = [
  {
    slug: "wedding",
    label: { en: "Wedding Flowers", es: "Flores de Boda" },
    keyword: { en: "wedding flowers", es: "flores de boda" },
    shopHref: "/weddings",
    leadIn: {
      en: "Bridal bouquets, ceremony pieces, centrepieces and boutonnières, designed in the studio and delivered on the morning of the wedding.",
      es: "Ramos de novia, piezas de ceremonia, centros de mesa y boutonnières, diseñados en el estudio y entregados la mañana de la boda.",
    },
    guidance: [
      {
        heading: { en: "Book six to nine months out — but call us anyway", es: "Reserva con seis a nueve meses — pero llámanos igual" },
        body: {
          en: "Six to nine months is the comfortable window for a full wedding order. It is not a hard requirement. We regularly take on bouquets inside of two weeks, and we have rebuilt a bridal bouquet the night before when another florist let a couple down. What changes with short notice is not whether we can do it, but how specific we can be about particular stems.",
          es: "De seis a nueve meses es la ventana cómoda para un pedido completo de boda. No es un requisito estricto. Aceptamos ramos con menos de dos semanas de aviso, y hemos rehecho un ramo de novia la noche anterior cuando otra floristería falló. Con poco aviso no cambia si podemos hacerlo, sino cuán específicos podemos ser con tallos concretos.",
        },
      },
      {
        heading: { en: "What actually drives the cost", es: "Lo que de verdad determina el costo" },
        body: {
          en: "Not the number of guests — the number of pieces that need individual construction. Twenty centrepieces of the same design cost less per head than eight bespoke arrangements. Bridal party items, ceremony structures and anything installed on site are where a wedding budget concentrates. Bring us the number, and we will tell you honestly where to spend and where it will not show in photographs.",
          es: "No la cantidad de invitados, sino la cantidad de piezas que requieren construcción individual. Veinte centros del mismo diseño cuestan menos por persona que ocho arreglos únicos. El presupuesto se concentra en las piezas del cortejo, las estructuras de ceremonia y todo lo que se instala en el lugar. Danos la cifra y te diremos con honestidad dónde gastar y dónde no se notará en las fotos.",
        },
      },
      {
        heading: { en: "Seasonality is real", es: "La temporada importa" },
        body: {
          en: "Peonies run roughly May into June. Garden roses and dahlias hold through the autumn. Anything forced out of season arrives smaller, costs more, and travels worse. If your date falls outside a flower you love, we will show you what reads the same way in a photograph for less.",
          es: "Las peonías van aproximadamente de mayo a junio. Las rosas de jardín y las dalias aguantan hasta el otoño. Todo lo forzado fuera de temporada llega más pequeño, cuesta más y viaja peor. Si tu fecha cae fuera de una flor que amas, te mostraremos qué se ve igual en una foto por menos.",
        },
      },
    ],
  },
  {
    slug: "sympathy",
    label: { en: "Sympathy & Funeral Flowers", es: "Flores de Condolencia y Funerales" },
    keyword: { en: "funeral and sympathy flowers", es: "flores fúnebres y de condolencia" },
    shopHref: "/sympathy",
    leadIn: {
      en: "Standing sprays, casket pieces and arrangements for the home — built the same day when a service is tomorrow, and delivered directly to the funeral home.",
      es: "Coronas de pie, piezas para féretro y arreglos para el hogar — hechos el mismo día cuando el servicio es mañana, y entregados directamente a la funeraria.",
    },
    guidance: [
      {
        heading: { en: "To the service, or to the house?", es: "¿Al servicio o a la casa?" },
        body: {
          en: "They are different orders. Flowers for a service are large, one-sided and built to read from across a room — standing sprays and casket pieces. Flowers for the home are smaller, low enough to sit on a table someone is eating at, and should last the fortnight after everyone has gone home. If you are unsure which moment you are sending to, tell us and we will ask the right questions.",
          es: "Son pedidos distintos. Las flores para un servicio son grandes, de una sola cara y pensadas para verse desde el otro lado de la sala — coronas de pie y piezas de féretro. Las flores para el hogar son más pequeñas, bajas para una mesa donde se come, y deben durar las dos semanas siguientes. Si no sabes a cuál momento envías, dínoslo y haremos las preguntas correctas.",
        },
      },
      {
        heading: { en: "Send to the funeral home, not the family", es: "Envía a la funeraria, no a la familia" },
        body: {
          en: "For a viewing or service, flowers go to the funeral home with the deceased's name and the service time — the family is rarely home to receive anything. We confirm the delivery window directly with the funeral director, so nothing arrives after the room has been cleared. Send to the house afterwards, in the quiet week when the visitors have stopped coming.",
          es: "Para un velatorio o servicio, las flores van a la funeraria con el nombre del difunto y la hora del servicio — la familia rara vez está en casa para recibir. Confirmamos la ventana de entrega directamente con el director funerario, para que nada llegue después de vaciar la sala. Envía a la casa después, en la semana silenciosa cuando ya no llegan visitas.",
        },
      },
      {
        heading: { en: "On timing and short notice", es: "Sobre los tiempos y el aviso corto" },
        body: {
          en: "Sympathy work is the one thing we will always try to turn around same-day, cutoff or not. Ring the studio rather than ordering online if the service is within twenty-four hours — the phone gets you a real answer about what can be built and when it can be there.",
          es: "El trabajo de condolencia es lo único que siempre intentamos resolver el mismo día, haya o no pasado el horario límite. Llama al estudio en lugar de pedir en línea si el servicio es en menos de veinticuatro horas — por teléfono obtienes una respuesta real sobre qué se puede hacer y cuándo puede estar allí.",
        },
      },
    ],
  },
  {
    slug: "birthday",
    label: { en: "Birthday Flowers", es: "Flores de Cumpleaños" },
    keyword: { en: "birthday flowers", es: "flores de cumpleaños" },
    shopHref: "/shop/bouquets",
    leadIn: {
      en: "Hand-tied bouquets and arrangements delivered the same day, with a handwritten card — order before 2:00 PM and it arrives that afternoon.",
      es: "Ramos atados a mano y arreglos entregados el mismo día, con tarjeta escrita a mano — pide antes de las 2:00 PM y llega esa tarde.",
    },
    guidance: [
      {
        heading: { en: "The 2:00 PM cutoff, honestly explained", es: "El límite de las 2:00 PM, explicado con honestidad" },
        body: {
          en: "Two o'clock is when the afternoon route is loaded, not an arbitrary deadline. Order at 1:45 PM and you make the run. Order at 2:30 PM and we will usually still try — call us and we will tell you straight whether it goes today or first thing tomorrow, rather than taking the order and hoping.",
          es: "Las dos de la tarde es cuando se carga la ruta vespertina, no un límite arbitrario. Pide a la 1:45 PM y entras en el recorrido. Pide a las 2:30 PM y normalmente igual lo intentaremos — llámanos y te diremos claramente si sale hoy o a primera hora mañana, en lugar de aceptar el pedido y cruzar los dedos.",
        },
      },
      {
        heading: { en: "Sending to an office or a school", es: "Enviar a una oficina o escuela" },
        body: {
          en: "Workplaces need a delivery before 4:00 PM and a floor or suite number. Schools usually will not interrupt a class — the flowers sit at the front office until the end of the day, which is fine for a bouquet and hard on anything in water. For a workplace surprise, tell us the recipient's hours and we will aim for the middle of them.",
          es: "Las oficinas necesitan entrega antes de las 4:00 PM y número de piso o suite. Las escuelas normalmente no interrumpen una clase — las flores esperan en recepción hasta el final del día, lo cual está bien para un ramo y mal para algo en agua. Para una sorpresa en el trabajo, dinos el horario de la persona y apuntamos a la mitad.",
        },
      },
    ],
  },
  {
    slug: "anniversary",
    label: { en: "Anniversary Flowers", es: "Flores de Aniversario" },
    keyword: { en: "anniversary flowers", es: "flores de aniversario" },
    shopHref: "/shop/roses",
    leadIn: {
      en: "Roses by the dozen and by the hundred, and arrangements built around the flower for the year — same-day where the count allows.",
      es: "Rosas por docena y por cien, y arreglos construidos alrededor de la flor del año — el mismo día cuando la cantidad lo permite.",
    },
    guidance: [
      {
        heading: { en: "The flower for the year", es: "La flor de cada año" },
        body: {
          en: "The traditional list is worth knowing: carnations for the first, lily of the valley for the second, sunflowers for the third, roses for the fifteenth, and yellow roses or daffodils for the fiftieth. It is a lovely thing to name in a card even when the arrangement itself is something else entirely — tell us the year and we will work the flower in somewhere.",
          es: "Vale la pena conocer la lista tradicional: claveles para el primero, muguete para el segundo, girasoles para el tercero, rosas para el decimoquinto, y rosas amarillas o narcisos para el cincuenta. Es un detalle hermoso para mencionar en la tarjeta aunque el arreglo sea otra cosa — dinos el año y trabajamos esa flor en algún lugar.",
        },
      },
      {
        heading: { en: "Large rose counts need a day", es: "Las cantidades grandes de rosas necesitan un día" },
        body: {
          en: "A dozen goes out same-day. Fifty, a hundred, or a specific colour we do not hold that week needs twenty-four hours so we can bring the stems in properly rather than substituting on the spot. If you want a hundred red roses on a Saturday, Thursday is the call to make.",
          es: "Una docena sale el mismo día. Cincuenta, cien, o un color específico que no tengamos esa semana necesita veinticuatro horas para traer los tallos como corresponde en lugar de sustituir sobre la marcha. Si quieres cien rosas rojas un sábado, la llamada es el jueves.",
        },
      },
    ],
  },
];

export const getCity = (slug: string) => LOCAL_CITIES.find((c) => c.slug === slug);
export const getOccasion = (slug: string) => LOCAL_OCCASIONS.find((o) => o.slug === slug);

/**
 * Town × occasion notes — the paragraph that exists only at this intersection.
 *
 * Without these, every "sympathy" page shared ~55% of its text with the other
 * six, which is the shape Google demotes as doorway pages. Each note is written
 * from the town's verified geography and the occasion's real logistics; none of
 * them asserts an inventory item, a price, or a third-party business's policy.
 *
 * Keyed `${citySlug}:${occasionSlug}`.
 */
export const LOCAL_INTERSECTIONS: Record<string, { en: string; es: string }> = {
  // ---- Roslyn ----------------------------------------------------------
  "roslyn-ny:wedding": {
    en: "Roslyn weddings tend to split between the harbour and the hill, and the two want different things. Waterfront ceremonies get wind off the water, so we build bouquets with a tighter binding point and skip the top-heavy focal flowers that look magnificent indoors and shred outside. For the country club and estate sites up the hill, we can deliver, install and be gone before a morning ceremony because we are seven minutes away — no staging trip the day before.",
    es: "Las bodas en Roslyn se dividen entre el puerto y la colina, y cada zona pide cosas distintas. Las ceremonias frente al agua reciben viento, así que atamos los ramos con un punto de amarre más ajustado y evitamos las flores focales pesadas que lucen magníficas en interiores y se deshacen afuera. Para los clubes y fincas de la colina podemos entregar, instalar e irnos antes de una ceremonia matinal porque estamos a siete minutos — sin viaje de montaje el día anterior.",
  },
  "roslyn-ny:sympathy": {
    en: "Because Roslyn is our closest neighbour, sympathy orders here are the ones we can most often turn around for a service the next morning. If you are arranging from out of state and do not know which funeral home is handling things yet, call us anyway — give us the family name and the town and we will hold the design while you confirm, rather than making you place the order twice.",
    es: "Como Roslyn es nuestro vecino más cercano, los pedidos de condolencia aquí son los que más a menudo podemos resolver para un servicio a la mañana siguiente. Si estás organizando desde otro estado y aún no sabes qué funeraria lo lleva, llámanos igual — danos el apellido de la familia y el pueblo y reservamos el diseño mientras confirmas, en vez de hacerte pedir dos veces.",
  },
  "roslyn-ny:birthday": {
    en: "Roslyn is close enough that a birthday order placed at lunchtime is genuinely a surprise that afternoon, not an evening delivery that arrives after the dinner it was meant for. If the address is in Roslyn Estates or up toward East Hills, the long private drives mean the doorbell is a fair distance from the road — a phone number for the recipient matters more here than the note on the card.",
    es: "Roslyn está lo bastante cerca como para que un pedido de cumpleaños hecho al mediodía sea una sorpresa real esa tarde, y no una entrega nocturna que llega después de la cena para la que era. Si la dirección está en Roslyn Estates o hacia East Hills, los accesos privados largos dejan el timbre lejos de la calle — aquí el teléfono de quien recibe importa más que la nota de la tarjeta.",
  },
  "roslyn-ny:anniversary": {
    en: "Anniversary orders to Roslyn are our most common standing arrangement — the same date every year, often the same design. If you tell us the year and the date once, we will keep the record and call you the week before rather than waiting for you to remember. Large rose counts still need the twenty-four hours, even seven minutes away.",
    es: "Los pedidos de aniversario a Roslyn son nuestro encargo fijo más común — la misma fecha cada año, a menudo el mismo diseño. Si nos dices el año y la fecha una vez, guardamos el registro y te llamamos la semana anterior en lugar de esperar a que te acuerdes. Las cantidades grandes de rosas siguen necesitando veinticuatro horas, aunque estemos a siete minutos.",
  },

  // ---- Manhasset -------------------------------------------------------
  "manhasset-ny:wedding": {
    en: "The thing that catches Manhasset weddings out is not the flowers, it is Northern Boulevard. A 4:00 PM ceremony means the delivery window collides with the worst of the traffic, so we load Manhasset weddings early and hold the pieces cool on site rather than gambling on the drive. Tell us the ceremony time first and we will work backwards from it.",
    es: "Lo que complica las bodas en Manhasset no son las flores, es Northern Boulevard. Una ceremonia a las 4:00 PM hace que la ventana de entrega choque con lo peor del tráfico, así que cargamos las bodas de Manhasset temprano y mantenemos las piezas frescas en el lugar en vez de apostar al trayecto. Dinos primero la hora de la ceremonia y trabajamos hacia atrás desde ahí.",
  },
  "manhasset-ny:sympathy": {
    en: "For a Manhasset service, the delivery time is set by the funeral home's viewing schedule, not by us — most run afternoon and evening viewings with a gap between. We confirm that gap with the director before we load, so the piece is standing when the room opens rather than being carried in past seated mourners.",
    es: "Para un servicio en Manhasset, la hora de entrega la marca el horario de velatorio de la funeraria, no nosotros — la mayoría hace velatorios de tarde y de noche con un intervalo entre ambos. Confirmamos ese intervalo con el director antes de cargar, para que la pieza esté colocada cuando abra la sala y no se lleve entre los asistentes ya sentados.",
  },
  "manhasset-ny:birthday": {
    en: "Manhasset birthday deliveries to a home address are best aimed at late morning — the Northern Boulevard crawl starts around four and a bouquet sitting in a warm van is a bouquet losing a day of its life. If you want an after-work surprise, ordering the day before and scheduling a morning drop beats a same-day rush.",
    es: "Las entregas de cumpleaños a domicilios en Manhasset conviene apuntarlas a media mañana — el atasco de Northern Boulevard empieza sobre las cuatro y un ramo esperando en una furgoneta caliente pierde un día de vida. Si quieres una sorpresa al salir del trabajo, pedir el día anterior y programar una entrega matinal supera a la prisa del mismo día.",
  },
  "manhasset-ny:anniversary": {
    en: "Manhasset addresses in Plandome and Munsey Park are set back from the road behind mature planting, which is lovely and makes a doorstep delivery easy to miss. For an anniversary, where the surprise is the point, we would rather hand it to someone than leave it on a step — give us a phone number and we will call from the kerb.",
    es: "Las direcciones de Manhasset en Plandome y Munsey Park están retiradas de la calle detrás de vegetación madura, lo cual es precioso y hace fácil que una entrega en la puerta pase desapercibida. Para un aniversario, donde la sorpresa es el punto, preferimos entregarlo en mano antes que dejarlo en un escalón — danos un teléfono y llamamos desde la acera.",
  },

  // ---- Great Neck ------------------------------------------------------
  "great-neck-ny:wedding": {
    en: "Great Neck weddings almost always involve a building or a village with its own access rules — a doorman, a gate, a certificate of insurance for the venue. We would rather sort that paperwork three weeks out than discover it on the morning. When you book, tell us the exact village and venue name and we will make the calls ourselves.",
    es: "Las bodas en Great Neck casi siempre implican un edificio o un pueblo con normas de acceso propias — portero, verja, un certificado de seguro para el lugar. Preferimos resolver ese papeleo tres semanas antes que descubrirlo la misma mañana. Al reservar, dinos el pueblo y el nombre exacto del lugar y hacemos las llamadas nosotros.",
  },
  "great-neck-ny:sympathy": {
    en: "Great Neck has a large observant community, and that changes the timing of sympathy work more than anything else about the town. Where a funeral follows quickly and a shiva begins straight after, flowers to the house during shiva are often more welcome than flowers at the service — and in some households flowers are not the custom at all. Tell us the family and we will ask the right question rather than guessing.",
    es: "Great Neck tiene una amplia comunidad observante, y eso cambia los tiempos del trabajo de condolencia más que ninguna otra cosa del pueblo. Cuando el funeral es rápido y la shivá empieza justo después, las flores a la casa durante la shivá suelen ser más bienvenidas que en el servicio — y en algunos hogares las flores no son la costumbre. Dinos de qué familia se trata y haremos la pregunta correcta en lugar de suponer.",
  },
  "great-neck-ny:birthday": {
    en: "Much of Great Neck Plaza is apartment buildings with a doorman, which is the easiest delivery there is — the flowers are received, logged and kept out of the sun. Kings Point and the estate villages are the opposite: private roads, gates, and often nobody home midday. For those addresses, an evening or weekend window is worth the wait.",
    es: "Gran parte de Great Neck Plaza son edificios con portero, que es la entrega más fácil que existe — las flores se reciben, se registran y se guardan del sol. Kings Point y los pueblos residenciales son lo contrario: calles privadas, verjas y a menudo nadie en casa al mediodía. Para esas direcciones, una ventana nocturna o de fin de semana vale la espera.",
  },
  "great-neck-ny:anniversary": {
    en: "Sixteen minutes each way makes Great Neck our longest anniversary run, which matters when you want a hundred roses delivered at a specific hour. Book the count twenty-four hours ahead and give us a one-hour window rather than a single time, and we will hit it — a fixed minute on a Saturday afternoon across Northern Boulevard is a promise no honest florist should make.",
    es: "Dieciséis minutos por trayecto hacen de Great Neck nuestro recorrido de aniversario más largo, lo que importa cuando quieres cien rosas a una hora concreta. Reserva la cantidad con veinticuatro horas y danos una ventana de una hora en lugar de una hora exacta, y la cumpliremos — un minuto fijo un sábado por la tarde cruzando Northern Boulevard es una promesa que ninguna floristería honesta debería hacer.",
  },

  // ---- Port Washington -------------------------------------------------
  "port-washington-ny:wedding": {
    en: "Port Washington weddings are waterfront weddings, and salt air and wind are the design constraint. We build for it: lower profiles, tighter mechanics, and hardier stems in anything that will stand outside for an hour before guests arrive. For a Sands Point ceremony we schedule a single delivery with everything on it, because the drive out and back is long enough that a forgotten boutonnière is a real problem.",
    es: "Las bodas en Port Washington son bodas frente al agua, y el aire salino y el viento son la restricción de diseño. Construimos para eso: perfiles más bajos, mecánica más ajustada y tallos más resistentes en todo lo que vaya a estar afuera una hora antes de que lleguen los invitados. Para una ceremonia en Sands Point programamos una sola entrega con todo incluido, porque el trayecto de ida y vuelta es lo bastante largo como para que una boutonnière olvidada sea un problema real.",
  },
  "port-washington-ny:sympathy": {
    en: "The peninsula means one road in and one road out, so a sympathy delivery to Port Washington has no alternative route if something goes wrong. We build in a margin for it and leave earlier than the distance strictly requires — a standing spray that arrives after the service has started is worse than no flowers at all.",
    es: "La península implica una vía de entrada y una de salida, así que una entrega de condolencia a Port Washington no tiene ruta alternativa si algo falla. Incluimos un margen y salimos antes de lo que la distancia estrictamente exige — una corona que llega después de empezado el servicio es peor que no enviar flores.",
  },
  "port-washington-ny:birthday": {
    en: "Port Washington is the one town on our list where we would gently push you toward ordering the day before. Sixteen minutes out plus sixteen back is most of an hour, so it goes on a planned route rather than squeezed into a gap — order Tuesday for Wednesday and you get a guaranteed morning window instead of a hopeful afternoon.",
    es: "Port Washington es el único pueblo de nuestra lista donde te sugeriríamos con suavidad pedir el día anterior. Dieciséis minutos de ida más dieciséis de vuelta son casi una hora, así que va en una ruta planificada y no encajado en un hueco — pide el martes para el miércoles y tienes una ventana matinal garantizada en vez de una tarde con esperanza.",
  },
  "port-washington-ny:anniversary": {
    en: "If the anniversary dinner is at one of the Port Washington harbour restaurants, sending flowers to the house that morning works far better than trying to have them meet you at the table. Restaurants are not set up to store an arrangement through a service, and the flowers spend the evening in a back corridor. Morning to the house, then dinner.",
    es: "Si la cena de aniversario es en uno de los restaurantes del puerto de Port Washington, enviar las flores a casa esa mañana funciona mucho mejor que intentar que te esperen en la mesa. Los restaurantes no están preparados para guardar un arreglo durante todo el servicio, y las flores pasan la noche en un pasillo trasero. Por la mañana a casa, y luego la cena.",
  },

  // ---- Garden City -----------------------------------------------------
  "garden-city-ny:wedding": {
    en: "Garden City weddings are frequently hotel weddings, which is the most forgiving setup we work with: a loading entrance, a banquet manager who knows what time the room flips, and somewhere cool to hold pieces. Get us the banquet contact when you book. That one phone number removes most of what usually goes wrong on a wedding morning.",
    es: "Las bodas en Garden City suelen ser bodas de hotel, que es el montaje más cómodo con el que trabajamos: una entrada de carga, un jefe de banquetes que sabe a qué hora se cambia el salón, y un sitio fresco donde guardar las piezas. Danos el contacto de banquetes al reservar. Ese único teléfono elimina casi todo lo que suele salir mal la mañana de una boda.",
  },
  "garden-city-ny:sympathy": {
    en: "Garden City sympathy orders are often placed by a colleague or an office rather than by family, and a company name on the card without a note reads coldly. We will help you word it — a single specific sentence about the person is worth more than a formal condolence line, and we would rather spend a minute on the phone getting it right.",
    es: "Los pedidos de condolencia en Garden City suelen hacerlos un colega o una oficina más que la familia, y un nombre de empresa en la tarjeta sin mensaje se lee con frialdad. Te ayudamos a redactarlo — una sola frase concreta sobre la persona vale más que una línea formal de pésame, y preferimos dedicar un minuto al teléfono a acertar.",
  },
  "garden-city-ny:birthday": {
    en: "This is the one town where a late-afternoon birthday delivery is genuinely dependable, because the offices and hotels have staffed desks that will take a delivery at 4:30 PM and hold it. For a residential Garden City address the usual rule still applies: before four, or nobody is home.",
    es: "Este es el único pueblo donde una entrega de cumpleaños a última hora de la tarde es de verdad fiable, porque las oficinas y hoteles tienen recepciones atendidas que aceptan una entrega a las 4:30 PM y la guardan. Para una dirección residencial en Garden City sigue valiendo la regla de siempre: antes de las cuatro, o no habrá nadie.",
  },
  "garden-city-ny:anniversary": {
    en: "If you are staying the night as part of the anniversary, flowers waiting in the room beat flowers handed over at dinner. Garden City hotels will place an arrangement before check-in if it arrives that morning with the reservation name — book the room first, then call us with the name and the date and we will coordinate it with the front desk.",
    es: "Si vais a pasar la noche como parte del aniversario, unas flores esperando en la habitación superan a unas flores entregadas en la cena. Los hoteles de Garden City colocan un arreglo antes del check-in si llega esa mañana con el nombre de la reserva — reserva la habitación primero, luego llámanos con el nombre y la fecha y lo coordinamos con recepción.",
  },

  // ---- Mineola ---------------------------------------------------------
  "mineola-ny:wedding": {
    en: "A good number of Mineola weddings start at the village hall or the courthouse — small, quick ceremonies where the whole flower order is a bouquet and two boutonnières. We are six minutes away and happy to do exactly that, with no minimum. A courthouse wedding deserves a properly built bouquet as much as a four-hundred-guest reception does.",
    es: "Buena parte de las bodas de Mineola empiezan en el ayuntamiento o el juzgado — ceremonias pequeñas y rápidas donde todo el pedido floral es un ramo y dos boutonnières. Estamos a seis minutos y encantados de hacer justo eso, sin mínimo. Una boda en el juzgado merece un ramo tan bien construido como una recepción de cuatrocientos invitados.",
  },
  "mineola-ny:sympathy": {
    en: "Mineola sympathy work often follows a stay at the hospital, and the family is frequently still in and out of the building. In that situation the useful thing is not a large piece at the service but something small that survives being moved between a hospital room, a car and a house. Tell us that is the situation and we will build for it.",
    es: "El trabajo de condolencia en Mineola suele venir después de una estancia hospitalaria, y la familia a menudo sigue entrando y saliendo del edificio. En esa situación lo útil no es una pieza grande en el servicio sino algo pequeño que aguante moverse entre una habitación de hospital, un coche y una casa. Dinos que ese es el caso y lo construimos así.",
  },
  "mineola-ny:birthday": {
    en: "A birthday spent in hospital is the order we get most often from Mineola, and it has rules: no strong scent, nothing tall enough to block a monitor, and a patient room number or it will not get past the desk. Some units decline flowers entirely — intensive care usually does. Ring the ward before you order, and we will build to whatever they tell you.",
    es: "Un cumpleaños pasado en el hospital es el pedido que más nos llega desde Mineola, y tiene reglas: sin perfume fuerte, nada tan alto que tape un monitor, y número de habitación o no pasará de recepción. Algunas unidades no aceptan flores — cuidados intensivos normalmente no. Llama a la planta antes de pedir y lo construimos según lo que te digan.",
  },
  "mineola-ny:anniversary": {
    en: "Six minutes means a Mineola anniversary can be genuinely last-minute — a dozen roses ordered at one o'clock is on the doorstep by three. What we cannot compress is a hundred-stem order or an unusual colour; those need the day regardless of how close you are. Everything else, call us and we will tell you honestly.",
    es: "Seis minutos significan que un aniversario en Mineola puede ser de verdad de último momento — una docena de rosas pedida a la una está en la puerta a las tres. Lo que no podemos comprimir es un pedido de cien tallos o un color inusual; esos necesitan el día, estés donde estés. Para todo lo demás, llámanos y te diremos la verdad.",
  },

  // ---- Williston Park --------------------------------------------------
  "williston-park-ny:wedding": {
    en: "Williston Park is a mile and a half from the studio, which changes what is possible on a wedding morning: we can hold the bouquets in the cooler until an hour before you need them instead of building early and hoping. For a local wedding we will bring the bridal bouquet last, at the time you ask for, rather than dropping everything at eight in the morning.",
    es: "Williston Park está a poco más de dos kilómetros del estudio, lo que cambia lo posible en la mañana de una boda: podemos mantener los ramos en cámara hasta una hora antes de que los necesites en vez de construirlos temprano y confiar. Para una boda local traemos el ramo de novia al final, a la hora que pidas, y no lo dejamos todo a las ocho de la mañana.",
  },
  "williston-park-ny:sympathy": {
    en: "For a Williston Park family we can usually get a piece to a service the same day it is ordered, even late. We are the next village over — if a service was arranged overnight and you have woken up to a morning viewing, call the studio rather than assuming it is too late. It usually is not.",
    es: "Para una familia de Williston Park normalmente podemos llevar una pieza a un servicio el mismo día en que se pide, incluso tarde. Somos el pueblo de al lado — si un servicio se organizó de un día para otro y te has despertado con un velatorio matinal, llama al estudio en vez de dar por hecho que es tarde. Normalmente no lo es.",
  },
  "williston-park-ny:birthday": {
    en: "For Williston Park, pickup is usually the better answer. You will be in the shop in under six minutes, you get to see the bouquet before it goes, and we can adjust it in front of you — which is worth more on a birthday than a delivery fee. Order in the morning and it will be wrapped and waiting.",
    es: "Para Williston Park, recoger en tienda suele ser la mejor respuesta. Estarás en la tienda en menos de seis minutos, verás el ramo antes de que salga y podemos ajustarlo delante de ti — lo cual vale más en un cumpleaños que una tarifa de entrega. Pide por la mañana y estará envuelto y esperando.",
  },
  "williston-park-ny:anniversary": {
    en: "Being this close means we can do the thing that is otherwise impossible: deliver at a specific minute. If you want roses to arrive while you are both at the table, tell us the time and for Williston Park we can actually hold to it. That is a promise we would not make to Port Washington.",
    es: "Estar tan cerca nos permite hacer lo que de otro modo es imposible: entregar a un minuto concreto. Si quieres que las rosas lleguen mientras estáis los dos en la mesa, dinos la hora y para Williston Park sí podemos cumplirla. Esa es una promesa que no haríamos para Port Washington.",
  },
};

export const getIntersection = (citySlug: string, occasionSlug: string) =>
  LOCAL_INTERSECTIONS[`${citySlug}:${occasionSlug}`];
