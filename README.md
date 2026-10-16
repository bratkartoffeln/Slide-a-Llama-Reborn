# Slide-a-Llama Reborn

Version **0.1.11** — spielbarer Nachbau des klassischen Früchte-Duells mit privaten
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

Die sieben Symbole zählen 10/20/30/40/50/60/100 Punkte pro Dreierreihe (BAR: 100).
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
Der direkt einzuschiebende Stein steht links unten und ist größer als die folgenden
Steine. Die drei Folgesteine verteilen sich gleichmäßig auf dem sichtbaren Bogen
bis nach oben; beim Nachrücken dreht sich das Rad gegen den Uhrzeigersinn.
Nach dem Einschub rücken die Folgesteine von ihren bisherigen Positionen nach;
das Rad behält seinen Drehwinkel und springt zwischen den Zügen nicht zurück.
Die Steine bleiben dabei wie Riesenrad-Gondeln aufrecht und bewegen nur ihre
Position entlang der Kreisbahn.
Am Desktop zeigt die gewählte Einschubposition den aktuellen Stein, der in
Einschubrichtung schwingt. Auf Touch-Geräten bleiben die Pfeilbuttons sichtbar.
Die Lamas wechseln tatsächlich ihre Plätze, wippen beim Laufen und blinzeln
im Stand mit voneinander unabhängigen Ruhebewegungen. Im Retro-Layout stehen sie
direkt am Tempelfuß. Der mittige Countdown darunter zeigt die verbleibende Zugzeit;
ein Pfeil zeigt in der Teamfarbe zur Seite des aktiven Spielers. Die obere
Zeitanzeige und ihr Balken entfallen.
Die Lamas blinzeln unabhängig voneinander alle drei bis zehn Sekunden.
Beim Zersplittern ersetzen die Bruchstücke sofort den ursprünglichen Stein.
Die Tempelsäulen liegen vor den Spielsteinen. Seitlich herausgeschobene Steine
kippen über die Kante, fallen zum Tempelfuß und zerplatzen erst beim Aufprall.
Aufprallgeräusche und Freigabe des nächsten Zugs folgen derselben Zeitleiste.
Erkannte Treffer starten mit dem Originaldonner und dreimaligem Blinken nur der
betroffenen Steine. Danach erscheint der originale Schriftzug „Three of a Kind“,
„Four of a Kind“ oder „Five of a Kind“, bevor die Steine zerspringen.
Bei sich kreuzenden Treffern zählt für den Schriftzug die längste einzelne Reihe.
Der Countdown mit Team-Pfeil steht ohne eigene Fläche direkt im grauen Tempelfeld.
Die Säulen sind verbreitert und lassen sämtliche Steine im 5×5-Feld frei.
Schwingende Einschubsteine bleiben hinter den Säulen. Auf dem Desktop wählen
auch die äußeren Spielfeldzellen den nächsten Rand-Slot; die Mitte und gleich
weit entfernte Randübergänge bleiben neutral. Die Randpfeile bleiben unsichtbar,
auf Touch-Geräten sind ihre quadratischen Flächen so groß wie ein Stein.
Die Punktefenster zeigen wie im Original nur Spielernamen und vierstelligen
Punktestand. Zusätzliche Hinweiszeilen auf der Bühne und „JETZT“ am Rad entfallen.
Die Lamas sammeln sich in leicht versetzten Gruppen links bzw. rechts der Mitte;
bei einem Seitenwechsel ändert sich die Farbe erst beim Überqueren der Mitte.
Originalgeräusche ergänzen das Nachsetzen nach einem Treffer und die Jubel- bzw.
Verlustreaktion beim Ergebnis-Overlay. Sie folgen ebenfalls dem SFX-Schalter.

**✦** schaltet Einschub-, Bruch-, Punkte-, Fall-, Trefferketten-, Lamawechsel- und Sieganimationen
an oder aus. Ausschalten beendet laufende Animationen sofort; der endgültige
Spielstand erscheint direkt. Die Systemeinstellung für reduzierte Bewegung
hat Vorrang. **SFX** schaltet alle Soundeffekte einschließlich Lama-Stimmen,
Ruhe-Reaktionen und Chatton. **♪** schaltet ausschließlich die unveränderte
Original-Hintergrundmusik als leise Schleife während aktiver Runden. Beide
Ton-Einstellungen sind unabhängig und werden lokal gespeichert. Retro, SFX,
Musik und Animationen sind beim ersten Start aktiv; die Musik startet nach
einer Benutzerinteraktion und pausiert bei verstecktem Tab oder pausierter Runde.
Aktive Schalter leuchten ICQ-grün.
In beiden Layouts spielen 49 Originalvarianten aus sieben Symbolgruppen die
passenden Treffer, ergänzt um einen Ketteneffekt, zehn Lama-Stimmen und fünf
Effekte für Steinbewegungen und Bruch. Lamawechsel spielen aus eigener Sicht
`transhappy` bei Zugewinn und `transpissed` bei Verlust, auch bei mehreren Lamas.
Gelegentliche Original-Lama-Laute mit kleinen Körperreaktionen ergänzen ruhige
Spielphasen. Sie haben mindestens zehn Sekunden Abstand zum letzten Sound und
machen Platz, sobald ein Zug oder eine Chatnachricht beginnt. SFX schaltet
auch diese Laute ab.
Neue fremde
Chatnachrichten spielen den klassischen ICQ-„Uh-oh“-Ton.
SFX enthält auch die positiven bzw. verärgerten Reaktionen bei eigenen
Lama-Gewinnen/-Verlusten. Musik, Soundeffekte und Animationen funktionieren
unabhängig voneinander. Zuganimationen laufen mit halber Geschwindigkeit;
der Server wartet bis zum Ende der Stein- und Lama-Bewegungen. Neue Züge
schneiden laufende Originalsounds nicht ab. Die Auswahl wird lokal gespeichert; beide Spieler
wählen unabhängig voneinander.

Identische mechanische Sounds spielen pro Zug nur einmal; wiederholte
Zustandsmeldungen lösen keine zweite Wiedergabe aus. Combo-Faktor und Combo-Ton
setzen gemeinsam 900 ms nach dem Treffer ein. Eine zusätzliche Pause trennt sie
von der nächsten Kaskade und den Lama-Stimmen, auch ohne aktivierte Animationen.
Der ICQ-Chatton hat einen kurzen stummen Vorlauf gegen verschluckte Anfangssilben.
Nach Rundenende bleibt
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
