# Slide-a-Llama Reborn

Version **0.1.1** — spielbarer Nachbau des klassischen Früchte-Duells mit privaten
Online-Räumen, Chat, Revanche und Trainingsgegner. Deutsche Oberfläche, eigene
SVG-Grafiken, Maus-, Touch- und Tastaturbedienung.

## Starten

Node.js **24** installieren, dann:

```sh
npm ci
npm run dev
```

Browser: **http://localhost:5173**. Unter Windows auch `Start-Windows.cmd`.
Name eingeben, **Freund einladen** wählen und den Link weitergeben. Beide Spieler
brauchen Zugriff auf denselben Server. Ein localhost-Link funktioniert nur auf
deinem Rechner; im LAN die Rechner-IP verwenden. **Mit Paco üben** startet sofort
eine Partie gegen den Computer.

Produktionsbetrieb:

```sh
npm run build
npm start
```

Oberfläche und WebSocket-Server laufen gemeinsam auf **http://localhost:2568**.
`HOST` (Standard `0.0.0.0`) und `PORT` sind konfigurierbar. `/ready` liefert
Bereitschaft und die gemeinsame Version aus `package.json`.

## Spielen

- 5×5-Feld, abwechselnd Steine von oben, links oder rechts einschieben.
- Volle Streifen verlieren den Stein am gegenüberliegenden Rand. Steine fallen
  nach unten; leere Felder werden nicht zufällig aufgefüllt.
- Drei gleiche Symbole geben Punkte; vier zählen ×2, fünf ×3. Weitere Kaskaden
  multiplizieren die Punkte zusätzlich mit ×2, ×3 usw.
- Je 60 Punkte Vorsprung wechselt ein Lama die Seite. 300 Punkte Vorsprung gewinnen
  alle zehn Lamas. Beide starten mit fünf.
- Vorschau: aktueller Stein plus drei kommende Steine.
- 15/30/60 Sekunden Zugzeit. Danach setzt der Server automatisch oben links ein.
- Tastatur: `1`–`5` von oben, `Shift` + Zahl von links, `Alt` + Zahl von rechts.
- Gemeinsame Revanche mit wechselndem Startspieler und Siegstand.

Die sechs Symbole zählen 10/20/30/40/50/60 Punkte pro Dreierreihe.
Punktetabelle, Symbolhäufigkeiten und Zeitwahl sind eigene Abstimmungen dieser
Version. Der Poker-Modus mancher Originalausgaben ist nicht enthalten.
Grundlage und Quellen: [SPIELREGELN.md](SPIELREGELN.md).

## Multiplayer und Chat

Der Server entscheidet über Züge, Zufall, Punkte, Zugzeit und Siege. Clients
senden Aktionen mit einer Spielrevision; veraltete oder doppelte Züge werden
abgewiesen. Private Räume haben zwei Plätze und einen achtstelligen Code.

Übertragene RPS-Erfahrungen: 120 Sekunden Wiederverbindungszeit, pausierte Partie
bei Abbruch, private Sitzungskennung in sessionStorage, vollständiger
Spielstand nach Wiederkehr und eine ausdrückliche Meldung bei Serverneustart.
Sitzungskennungen erscheinen weder im Link noch im Spielstand des Gegners.

Chat: 300 Unicode-Zeichen, 50 Nachrichten Verlauf, 500 ms Mindestabstand und
Deduplizierung pro Spieler. Benutzertexte werden sicher als Text ausgegeben.
Origin-Prüfung und Limits für Nachrichten, Paketgrößen, Verbindungen und Räume
begrenzen Missbrauch. `ALLOWED_ORIGINS` akzeptiert eine kommaseparierte Origin-Liste;
ohne Liste sind Browser vom selben Host und native Clients ohne Origin erlaubt.

Räume und Chat liegen im Arbeitsspeicher eines Serverprozesses. Ein Neustart
beendet Sitzungen; es gibt keine Konten oder dauerhafte Historie. Mehrere
Serverinstanzen würden eine gemeinsame Raum-/Sitzungsverwaltung benötigen.
Paco berücksichtigt bei seiner Zugwahl die beste Antwort des Gegners.

## Prüfen

```sh
npm run check
npm test
npm run build
npm run test:browser
npm run check:docker
```

Browsertests verwenden auf Windows Edge; auf Linux/macOS zuvor
`npx playwright install --with-deps chromium` ausführen. Dockerprüfung benötigt
Docker mit Compose v2. Sie baut ein eigenes Testimage und prüft darin HTTP,
zwei Spieler, einen Zug, Chat und Wiederverbindung. Anschließend entfernt sie
nur ihren eigenen Testcontainer und ihr Testimage.

`verify.yml` führt bei Push/PR Regel-, Server-, Browser- und Containerprüfungen
aus. Der manuelle `nas-build.yml` baut Spiel-/Proxy-Images und ein Quellarchiv.
Er löst kein NAS-Deployment aus. NAS, TLS und Porttrennung zu RPS:
[QNAP-DEPLOYMENT.md](QNAP-DEPLOYMENT.md).

Aufteilung: `shared/` Regeln/Protokoll, `server/` Räume/Chat/HTTP,
`client/` Darstellung/Verbindung, `tests/` Regel-, Server- und Browsertests.
