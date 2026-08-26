process.env.GARAGENTOR_STAND = '58c4987 vom 2026-08-26T18:50Z';
// Startet die Anwendung, die in `anwendung/` liegt.
//
// Next.js' eigenständige Startdatei setzt ihr Arbeitsverzeichnis selbst, sie
// darf also von überall aufgerufen werden. Diese Datei existiert nur, damit
// ein Ausrollwerkzeug im Wurzelverzeichnis fündig wird – und um eine Falle zu
// entschärfen, die zwei Tage gekostet hat.

// Die Falle: Next.js bindet den Server an `process.env.HOSTNAME`, ersatzweise
// an 0.0.0.0. `HOSTNAME` ist auf vielen Linux-Servern aber eine ganz
// gewöhnliche Shell-Variable, in der der Rechnername steht – niemand setzt sie
// für Next.js, sie ist einfach da. Löst dieser Name auf die Netzadresse des
// Servers auf, horcht die Anwendung ausschließlich dort. Der Webserver davor
// klopft über 127.0.0.1 an und bekommt nichts.
//
// Das Tückische daran ist das Protokoll: Der Prozess startet sauber und meldet
// „Ready in 143ms". Im Browser steht trotzdem 504. Nichts an dieser Meldung
// deutet auf die Ursache.
//
// 0.0.0.0 heißt „alle Adressen" und schließt beide Fälle ein. Wer wirklich
// einschränken will, setzt BIND_HOST.
process.env.HOSTNAME = process.env.BIND_HOST || '0.0.0.0';

// Damit im Laufzeitprotokoll steht, wo tatsächlich gehorcht wird. Genau diese
// Zeile hat beim letzten Mal gefehlt.
console.log(
  `[Garagentor] Stand ${process.env.GARAGENTOR_STAND}, Adresse ${process.env.HOSTNAME}, Port ${process.env.PORT || 3000}, Node ${process.version}`,
);

// Manche Ausrollwerkzeuge reichen in PORT keinen Port, sondern den Pfad eines
// Unix-Sockets. Next.js liest die Variable als Zahl, bekommt keine und nimmt
// 3000 – und wartet dort auf einen Anruf, der an ganz anderer Stelle klingelt.
// Auch das sieht im Protokoll nach einem gelungenen Start aus.
if (process.env.PORT && !/^\d+$/.test(process.env.PORT)) {
  console.log(
    `[Garagentor] Achtung: PORT ist keine Zahl, sondern „${process.env.PORT}". Next.js kann damit nichts anfangen und horcht auf 3000.`,
  );
}

// Ein Absturz beim Start soll im Protokoll stehen und nicht als leere Datei
// enden. Das war beim letzten Anlauf der Grund, warum nichts zu sehen war.
process.on('uncaughtException', (fehler) => {
  console.error('[Garagentor] Abbruch beim Start:', fehler);
  process.exit(1);
});
process.on('unhandledRejection', (grund) => {
  console.error('[Garagentor] Unbehandelte Ablehnung:', grund);
});

require('./anwendung/apps/web/server.js');
