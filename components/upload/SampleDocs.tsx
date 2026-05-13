"use client";

import { motion } from "framer-motion";

interface SampleDocsProps {
  /** Called with the sample text when a chip is tapped. */
  onPick: (sample: { title: string; text: string }) => void;
}

export const SAMPLES: { id: string; emoji: string; title: string; text: string }[] = [
  {
    id: "photosynthesis",
    emoji: "🌱",
    title: "Photosynthesis",
    text: `Photosynthesis is the biochemical process by which green plants, algae, and certain bacteria convert light energy — usually from the Sun — into chemical energy stored in the bonds of carbohydrate molecules. It is, by an enormous margin, the most important biological process on Earth: nearly every food chain ultimately traces its energy back to a photosynthesizing organism, and the oxygen that aerobic life depends on is, in geological terms, almost entirely a byproduct of photosynthesis.

The overall reaction is deceptively simple. Six molecules of carbon dioxide combine with six molecules of water in the presence of light to produce one molecule of glucose and six molecules of oxygen: 6 CO2 + 6 H2O + light → C6H12O6 + 6 O2. Behind that one-line summary, however, lies a remarkable two-stage molecular machine.

The first stage is called the light-dependent reactions. These take place in the thylakoid membranes inside chloroplasts, the green organelles that give plants their color. Embedded in the thylakoid membranes are pigment molecules — most famously chlorophyll a and chlorophyll b, plus accessory pigments like carotenoids — organized into protein complexes called photosystems. When a photon of light strikes a chlorophyll molecule, it boosts an electron to a higher energy level. That excited electron is passed down a chain of acceptor molecules called the electron transport chain. As it moves, it pumps hydrogen ions across the thylakoid membrane, building a gradient that drives the synthesis of ATP, the cell's main energy currency. At the end of the chain, the electron reduces NADP+ to NADPH, another energy carrier. To replace the electrons removed from chlorophyll, the photosystem splits water molecules — releasing oxygen as a waste product. Every breath you take is, in essence, a recycled byproduct of this electron-shuffling.

The second stage, the Calvin cycle, takes place in the stroma — the watery space surrounding the thylakoids. Here the energy carriers ATP and NADPH are spent to fix carbon dioxide into organic molecules. The enzyme RuBisCO grabs CO2 from the air and attaches it to a five-carbon sugar called ribulose 1,5-bisphosphate, which then breaks apart into two three-carbon molecules. Through a cycle of phosphorylation and reduction, these are eventually transformed into glyceraldehyde 3-phosphate (G3P), the precursor to glucose, sucrose, starch, and many other organic compounds.

Several factors limit the rate of photosynthesis. Light intensity is the most obvious: up to a point, more light means more reactions. Carbon dioxide concentration matters too — at the present atmospheric level of around 420 parts per million, most plants are slightly CO2-limited. Temperature affects enzyme activity, particularly RuBisCO, which becomes inefficient at high temperatures because it can also bind oxygen instead of CO2 (a wasteful process called photorespiration). Plants in hot, dry climates have evolved workarounds: C4 plants like maize and sugarcane use a special enzyme to concentrate CO2 around RuBisCO, while CAM plants like cacti open their stomata at night to capture CO2 and store it as malic acid, only fixing it in daylight.

Photosynthesis is not just biology — it is the foundation of nearly every ecosystem and the engine of the carbon cycle. Understanding it is essential to understanding climate change, agriculture, biofuels, and the search for life on other planets. Each year, photosynthesizing organisms remove roughly 120 billion tons of carbon from the atmosphere; without them, our atmosphere would look completely different and complex life as we know it would never have evolved.`
  },
  {
    id: "rome",
    emoji: "🏛️",
    title: "Roman Empire",
    text: `The Roman Empire is one of the most studied political entities in human history, and for good reason: at its height, it stretched from the misty hills of northern Britain to the deserts of Mesopotamia, encompassing somewhere between 50 and 90 million people — perhaps a fifth of humanity at the time. Its rise, structure, and eventual fragmentation continue to shape the legal systems, languages, infrastructure, and cultural imagination of much of the world today.

Rome's transition from Republic to Empire was not a single event but a long political collapse. The Roman Republic, founded around 509 BCE after the legendary expulsion of King Tarquinius Superbus, governed itself through a mix of elected magistrates, the Senate, and popular assemblies. By the first century BCE, however, generals and their personal armies repeatedly overrode constitutional norms. Civil wars between figures like Marius and Sulla, then Caesar and Pompey, then Octavian and Mark Antony, exhausted Republican institutions. In 27 BCE the Senate awarded Octavian the title "Augustus" and a basket of extraordinary powers — and although he carefully maintained the fiction that the Republic still existed, the imperial system had effectively begun.

The early Empire (the Principate, 27 BCE – 284 CE) is often divided into a series of dynasties: the Julio-Claudians (Augustus, Tiberius, Caligula, Claudius, Nero), the Flavians (Vespasian, Titus, Domitian), the Nerva-Antonines (which produced the famous "Five Good Emperors"), and the Severans. The second century, under emperors like Trajan, Hadrian, and Marcus Aurelius, was widely considered the height of Roman peace and prosperity — the so-called Pax Romana. Under Trajan in 117 CE the Empire reached its greatest territorial extent.

Roman administration was a marvel of organization for its time. Provinces were governed by senators or imperial appointees, taxes were collected through a mix of state officials and private contractors, and a network of paved roads — many still visible today — let messages, troops, and trade move with unprecedented speed. Legions of around 5,000 professional soldiers each were stationed in frontier provinces, supported by auxiliary units recruited from local populations. Latin became the language of administration in the West, while Greek dominated the East.

Economically, the Empire ran on agriculture, slave labor, and long-distance trade. Egyptian grain fed the city of Rome itself, which by the second century may have housed a million people. Olive oil from Hispania, wine from Gaul, garum (fermented fish sauce) from coastal factories, marble from Asia Minor, and even silk from China traveled along Roman trade routes. Cities everywhere imitated the Roman urban template: a forum, public baths, an amphitheater, and an aqueduct.

The third century, however, brought a long crisis: plagues, runaway inflation, civil wars, and barbarian invasions. The emperor Diocletian (r. 284–305) stabilized the situation by reorganizing the Empire into a "Tetrarchy" of four co-rulers and tightening bureaucratic control. His successor Constantine famously legalized Christianity and founded a new eastern capital at Constantinople. After 395 CE the Empire was administered as two halves — Western and Eastern — and would never again be reunited.

The Western Empire, weakened by economic strain and successive waves of Germanic migrations, dissolved over the fifth century, with the traditional date for its "fall" set at 476 CE, when the boy-emperor Romulus Augustulus was deposed by the Germanic chieftain Odoacer. The Eastern Empire, which historians call the Byzantine Empire, continued for another thousand years until the fall of Constantinople in 1453.

Yet Rome never really vanished. Its legal codes underpin modern civil law. Its alphabet is on this page. Its calendar (and its month names) shape your daily life. Its architecture defines countless capital buildings. And the very idea of a unifying transnational order — sometimes inspiring, sometimes oppressive — is, in many ways, still Roman.`
  },
  {
    id: "http",
    emoji: "💻",
    title: "How HTTP works",
    text: `HTTP — the Hypertext Transfer Protocol — is the language that web browsers and web servers use to talk to each other. Every time you visit a webpage, scroll an image gallery, log in to a service, or refresh your inbox, your device is exchanging HTTP messages, often dozens or even hundreds of them. Despite its central role in modern life, HTTP itself is built on a surprisingly simple request-and-response model.

A typical HTTP exchange begins when a client — usually a browser, but it could also be a mobile app or a script — wants something from a server. It first needs to know where to send its request. The client takes the URL (for example, https://example.com/about) and breaks it into parts: the scheme (https), the host (example.com), an optional port (defaulting to 443 for https), and a path (/about). It then performs a DNS lookup to translate the host name into an IP address. With an IP in hand, the client opens a TCP connection to the server, and — for HTTPS — performs a TLS handshake to negotiate encryption. Only then does it send the actual HTTP request.

An HTTP request has three parts: a request line, a set of headers, and an optional body. The request line specifies a method (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS), a path, and a protocol version. Headers are name-value pairs that supply metadata: which host to use, what content types the client can accept, the user agent, cookies, authorization tokens, the encoding of the body, and so on. The body, if present, contains the actual data being sent — for example, a JSON payload submitted to an API or a form being uploaded.

The server processes the request and replies with a response. The response also has three parts: a status line, headers, and a body. The status line includes a three-digit status code that broadly classifies the result. 1xx codes are informational, 2xx mean success (200 OK is the most common), 3xx are redirections (301 Moved Permanently, 302 Found, 304 Not Modified), 4xx indicate client errors (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests), and 5xx indicate server errors (500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable). Headers describe the response — content type, length, caching directives, cookies to set — and the body contains the actual content: HTML, JSON, an image, a video segment.

A defining property of HTTP is that it is stateless: each request is independent, and the server is not required to remember anything between them. To preserve state across multiple requests — for example, to keep a user logged in — applications use cookies, tokens, or session identifiers, which the client includes with each subsequent request. Caching is another key concept: clients and intermediaries can store responses and reuse them, dramatically reducing latency and server load. The Cache-Control and ETag headers govern how long and under what conditions responses can be cached.

HTTP has evolved through several major versions. HTTP/1.0 opened a fresh TCP connection for every request, which was wasteful. HTTP/1.1 introduced persistent connections, allowing multiple requests over the same TCP connection, plus features like chunked encoding and content negotiation. HTTP/2 added binary framing, multiplexing many streams over one connection, header compression, and server push, dramatically improving performance for asset-heavy pages. HTTP/3, the newest version, abandons TCP entirely and runs over QUIC, a UDP-based protocol that handles its own congestion control and recovers more gracefully from packet loss, especially on mobile networks.

Modern web applications layer many concepts on top of HTTP. REST APIs map CRUD operations onto HTTP methods. GraphQL typically tunnels through a single POST endpoint. WebSockets upgrade an HTTP connection to a long-lived bidirectional channel. Despite all this complexity, the underlying conversation is still the same simple loop it was in 1991: a client asks, a server answers, and the web continues to render — one request at a time.`
  },
];

export function SampleDocs({ onPick }: SampleDocsProps) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider font-extrabold text-ink-soft mb-2">
        Or try a sample
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-touch snap-x-mandatory -mx-1 px-1 pb-1">
        {SAMPLES.map((s, i) => (
          <motion.button
            key={s.id}
            type="button"
            onClick={() => onPick({ title: s.title, text: s.text })}
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              delay: 0.15 + i * 0.07,
              type: "spring",
              stiffness: 300,
              damping: 18,
            }}
            whileTap={{ scale: 0.96 }}
            className="snap-start shrink-0 inline-flex items-center gap-2 rounded-full bg-surface border-2 border-border-soft hover:border-primary/60 hover:bg-primary-soft transition-colors px-4 min-h-[44px] py-2 text-sm font-extrabold text-ink shadow-pop-soft"
          >
            <span className="text-base leading-none">{s.emoji}</span>
            <span>{s.title}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
