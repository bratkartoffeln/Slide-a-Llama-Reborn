# Regelgrundlage und Entscheidungen für 0.1.5

Umgesetzt ist der Früchte-/Slots-Modus mit eigener Darstellung. Recherche: 16.10.2026.

Das [Remakeprojekt von 2013](https://slide-a-lama.webnode.sk/) beschreibt ein
5×5-Feld mit 15 Einschüben von oben, links und rechts. Die
[Spielbeschreibung bei IGDB](https://www.igdb.com/games/slide-a-lama/presskit)
nennt Linien ab drei gleichen Symbolen und Lamawechsel je 60 Punkten Differenz.
Die [Slots-Adaption bei Nejlepší hry](https://www.nejlepsihry.cz/hry/slide-a-lama)
beschreibt Schwerkraft, Kaskaden, ×2 für vier bzw. ×3 für fünf gleiche Symbole
und 300 Punkte Vorsprung zum Sieg.

Die erste Fassung verwendet eine eigene Punkte- und Zufallsabstimmung, die auch
im Retro-Modus gilt. Die zusätzliche Videorecherche zeigt eine abweichende
Originaltabelle mit sieben Symbolen; siehe `RETRO-QUELLEN.md`. Folgende Werte
sind im Spiel einsehbar und in `shared/game.ts` zentral festgelegt:

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
Beim Einschub wird nur die vom Rand aus direkt zusammenhängende
Steinkette bis zur ersten Lücke verschoben. Steine hinter dieser Lücke werden
nicht mitgeschoben. Ist der Randplatz bereits leer, wird nur dort eingesetzt.
Nur ein lückenlos voller Streifen verliert seinen letzten Stein. Beispiel links:
`[Kirsche, Zitrone, leer, Melone, Sieben]` + Glocke ergibt vor der Schwerkraft
`[Glocke, Kirsche, Zitrone, Melone, Sieben]`.
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
Das moderne Layout verwendet eigene SVGs. Der optionale Retro-Modus ergänzt
recherchierte Originalgrafiken und extrahierte Effekte; Herkunft, Gameplay-Videos
und Unterschiede zur Originalfassung stehen in [RETRO-QUELLEN.md](RETRO-QUELLEN.md).
