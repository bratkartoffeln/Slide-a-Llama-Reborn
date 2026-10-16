# Slide-a-Llama Reborn

Version **0.1.8** — spielbarer Nachbau des klassischen Früchte-Duells mit privaten
Online-Räumen, Chat, Revanche und Trainingsgegner. Deutsche Oberfläche mit modernem
Design und umschaltbarem ICQ-Retro-Layout, Maus-, Touch- und Tastaturbedienung.

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
- Nur zusammenhängende Steine werden geschoben, bis zur ersten Lücke. Steine
  dahinter bleiben stehen. Lückenlos volle Streifen verlieren den letzten Stein.
  Anschließend fallen Steine nach unten; leere Felder werden nicht zufällig aufgefüllt.
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

## Layout, Animationen und Ton

Oben mit **ICQ-Retro** zwischen modernem Design und klassischer Darstellung
wechseln, auch während einer Partie. Der Retro-Modus verwendet recherchierte
Tempel-, Landschafts-, Figuren- und Symbolgrafiken mit ICQ-artigen Fensterrahmen.
Banane, Pflaume und Birne ersetzen darin optisch Zitrone, Traube und Melone;
Punkte und Spielzustand bleiben gleich.

Die Spielsteine haben unregelmäßige, abgeschlagene Tempelstein-Profile mit
Sandsteinstruktur und sichtbarer Tiefe. Treffer zerlegen sie in Fragmente;
die Punkte steigen direkt über der Kombination auf, bei Kaskaden mit Faktor.
Ab dem zweiten Treffer der Kette steigt zusätzlich ein großer „COMBO ×2“,
„COMBO ×3“, „COMBO ×4“ usw. mit den Punkten auf.
Lichtblitz, Druckwelle, Staub und ein kurzes Rütteln verstärken den Bruch.
Bei voller Spalte bekommt zunächst der unterste Stein Risse und zerplatzt;
erst danach rutscht der Stapel nach. In freien Spalten fällt der neue Stein
ohne Zwischenstopp bis zu seinem Ziel. Der Fall-Sound erklingt beim Landen.
Die Vorschau sitzt auf einem Drehrad, das rechts neben dem Tempel halb sichtbar ist.
Der direkt einzuschiebende Stein steht unten und ist größer als die folgenden
Steine; beim Nachrücken dreht sich das Rad gegen den Uhrzeigersinn.
Nur der gerade gewählte Einschubpfeil ist sichtbar; alle Touchflächen bleiben erhalten.
Die Lamas wechseln tatsächlich ihre Plätze, wippen beim Laufen und blinzeln
im Stand mit voneinander unabhängigen Ruhebewegungen.

**✦** schaltet Einschub-, Bruch-, Punkte-, Fall-, Trefferketten-, Lamawechsel- und Sieganimationen
an oder aus. Ausschalten beendet laufende Animationen sofort; der endgültige
Spielstand erscheint direkt. Die Systemeinstellung für reduzierte Bewegung
hat Vorrang. **♪** schaltet separat die Effekte ein. Retro, Sounds, Stimmen und
Animationen sind beim ersten Start aktiv; gespeicherte Einstellungen gelten weiter.
Aktive Schalter leuchten ICQ-grün.
In beiden Layouts spielen 45 Originalvarianten aus sechs Symbolgruppen die
passenden Treffer, ergänzt um einen Ketteneffekt, zehn Lama-Stimmen und fünf
Effekte für Steinbewegungen und Bruch. Lamawechsel spielen aus eigener Sicht
`transhappy` bei Zugewinn und `transpissed` bei Verlust, auch bei mehreren Lamas.
Neue fremde
Chatnachrichten spielen den klassischen ICQ-„Uh-oh“-Ton.
**Stimmen** schaltet die positiven bzw. verärgerten Reaktionen bei eigenen
Lama-Gewinnen/-Verlusten separat ab. Sound und Animationen funktionieren
unabhängig voneinander. Zuganimationen laufen mit halber Geschwindigkeit;
der Server wartet bis zum Ende der Stein- und Lama-Bewegungen. Neue Züge
schneiden laufende Originalsounds nicht ab. Die Auswahl wird lokal gespeichert; beide Spieler
wählen unabhängig voneinander.

Identische mechanische Sounds spielen pro Zug nur einmal; wiederholte
Zustandsmeldungen lösen keine zweite Wiedergabe aus. Nach Rundenende bleibt
ein Gewinn-/Verlust-Overlay mit „Noch eine Runde?“ sichtbar, bis die nächste
Runde beginnt. Alternativ lässt sich dort zum Startbildschirm zurückkehren.
Das Overlay erscheint erst nach dem letzten Zug samt Lamawechsel und Effekten.
Eine ICQ-Bühne zeigt die Sieger-Lamas jubelnd und hüpfend, die unterlegenen
Lamas mit gesenktem Kopf und Seufzerbewegung. Teamfarben bleiben für beide
Spieler gleich. Der Animationsschalter und reduzierte Bewegung gelten auch hier.

Bildquellen, Gameplay-Videos, Extraktion und Zuordnung der Medien:
[RETRO-QUELLEN.md](RETRO-QUELLEN.md).

## Multiplayer und Chat

Der Server entscheidet über Züge, Zufall, Punkte, Zugzeit und Siege. Clients
senden Aktionen mit einer Spielrevision; veraltete oder doppelte Züge werden
abgewiesen. Private Räume haben zwei Plätze und einen achtstelligen Code.

Übertragene RPS-Erfahrungen: 120 Sekunden Wiederverbindungszeit, pausierte Partie
bei Abbruch, private Sitzungskennung in sessionStorage, vollständiger
Spielstand nach Wiederkehr und eine ausdrückliche Meldung bei Serverneustart.
Sitzungskennungen erscheinen weder im Link noch im Spielstand des Gegners.
Räume ohne verbundene menschliche Spieler werden gelöscht, sobald alle
Wiederverbindungsfristen abgelaufen sind (standardmäßig 120 Sekunden je Spieler).
Das gilt auch für beendete Partien und Training mit Bot; solche Räume blockieren
den NAS-Updater danach nicht mehr.

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

Automatische NAS-Updates nach erfolgreichen main-Prüfungen und bei freien Spielräumen:
[QNAP-AUTOUPDATE.md](QNAP-AUTOUPDATE.md). Der Updater läuft als eigener Container.
