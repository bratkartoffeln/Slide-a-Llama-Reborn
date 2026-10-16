# Regelgrundlage und Entscheidungen für 0.1.1

Umgesetzt ist der Früchte-/Slots-Modus mit eigener Darstellung. Recherche: 16.10.2026.

Das [Remakeprojekt von 2013](https://slide-a-lama.webnode.sk/) beschreibt ein
5×5-Feld mit 15 Einschüben von oben, links und rechts. Die
[Spielbeschreibung bei IGDB](https://www.igdb.com/games/slide-a-lama/presskit)
nennt Linien ab drei gleichen Symbolen und Lamawechsel je 60 Punkten Differenz.
Die [Slots-Adaption bei Nejlepší hry](https://www.nejlepsihry.cz/hry/slide-a-lama)
beschreibt Schwerkraft, Kaskaden, ×2 für vier bzw. ×3 für fünf gleiche Symbole
und 300 Punkte Vorsprung zum Sieg.

Original-Punktetabelle und Zufallsverteilung waren aus diesen Quellen nicht
vollständig zuverlässig rekonstruierbar. Folgende Entscheidungen sind im Spiel
einsehbar und in `shared/game.ts` zentral festgelegt:

| Symbol | Punkte für 3 / 4 / 5 | Zufallsgewicht |
| --- | --- | --- |
| Kirsche | 10 / 20 / 30 | 3 |
| Zitrone | 20 / 40 / 60 | 3 |
| Traube | 30 / 60 / 90 | 2 |
| Melone | 40 / 80 / 120 | 2 |
| Glocke | 50 / 100 / 150 | 1 |
| Sieben | 60 / 120 / 180 | 1 |

Kaskaden werden mit ihrer laufenden Nummer multipliziert. Gleichzeitige horizontale
und vertikale Linien zählen beide; ihr gemeinsames Feld wird nur einmal entfernt.
Nach dem Entfernen fallen Steine, ohne zufällige Auffüllung. Der Start enthält
25 Steine und keine fertigen Linien. Lamas folgen der aktuellen Punktedifferenz;
ein geschrumpfter Vorsprung kann sie wieder zurückbringen.

Ergänzungen: Zugzeit 15/30/60 Sekunden (Standard 30), automatische Einsetzung oben
links bei Zeitablauf, Revanche mit wechselndem Startspieler, 120 Sekunden
Wiederverbindungszeit und ein Trainingsgegner. Dies sind Entscheidungen der
Neuauflage, keine Behauptung vollständiger Originaltreue. Poker ist nicht enthalten.

Aus RPS übernommen wurden die Erfahrungen mit serverseitiger Zugprüfung,
privaten Räumen, zeitlich begrenzter Wiederverbindung, Chat-Deduplizierung und
sicherer Textausgabe. Hier verwendet das Netzwerk direkt WebSockets (`ws`).
Die Darstellung besteht aus eigenen SVGs; Originalgrafiken und Sounds wurden
nicht eingebunden.
