# Retro-Recherche und Medien für 0.1.5

Recherche und Abruf: 16.10.2026. Der Retro-Modus ist eine alternative Darstellung
derselben Online-Partie. Das moderne Layout bleibt auswählbar.

## Bild- und Videoreferenzen

- [PLAYzone: ICQ-Spiele](https://www.playzone.cz/clanky/24841-icq-hry-na-playzonecz),
  [Screenshot](https://www.playzone.cz/sites/default/files/redakce/23386/icq-slidealama.jpg):
  grüne ICQ-Titelleiste, blaue/goldene Bühne, Tempel, Symbole, rot/blaue Figuren,
  Punktefenster und Chatzeile.
- [Slide a Lama Game Walkthrough, 6games, 3 Minuten](https://www.youtube.com/watch?v=CXQXQgVflCI),
  eingebettet auf [6games](https://6games.eu/games/421-slide-a-lama.html).
  Video heruntergeladen und Standbilder bei 00:35 und 01:15 ausgewertet:
  volle und gelichtete Felder, seitliche Einschübe, Trefferblasen und Figuren.
  Ein 12-Sekunden-Tonabschnitt ab 00:35 wurde als Recherche extrahiert.
- [Slide a Lama Online – ICQ Games, 6games](https://www.youtube.com/watch?v=otgoYFcYFK8),
  eingebettet auf [Riongames](https://riongames.com/games/multiplayer/puzzle/7946-slide-a-lama-online.html).
  Zweite, per YouTube-Metadaten bestätigte Gameplay-Referenz einer Neuauflage;
  daraus wurden keine Spielassets übernommen.

## Eingebundene Grafiken

Die PNGs stammen aus dem öffentlich zugänglichen
[Repository Roshmar/Slide-a-lama, Commit 44f4589](https://github.com/Roshmar/Slide-a-lama/tree/44f4589bab84ac91889fbb4edf41209a02550074/slide-a-lama-master/WebApplicationSlideALama/wwwroot/img).
Dateien wurden unverändert übernommen; Skalierung und Darstellung erfolgen im Browser.

| Lokale Datei unter `public/retro/` | Quelldatei / Verwendung |
| --- | --- |
| `landscape.png` | `MainGame.png`, Landschaft hinter dem Fenster |
| `temple.png` | `MainBoard.png`, Rahmen der Spielbühne |
| `cherry.png` | `Cherry.png`, Kirsche |
| `banana.png` | `Banana.png`, Retro-Darstellung des Zitrone-Steins |
| `plum.png` | `Plump.png`, Retro-Darstellung des Traube-Steins |
| `pear.png` | `pear.png`, Retro-Darstellung des Melone-Steins |
| `bell.png` | `Bel.png`, Glocke |
| `seven.png` | `Seven.png`, Sieben |
| `bar.png` | `bar.png`, BAR, aus demselben oben verlinkten Repository |
| `follower.png` | Flash-Sprite 690 `worshiper1`, Frame 1, siehe unten |
| `flower.svg` | Eigene SVG-Zeichnung für den Fenster-/Statusstil |

Die Figur wird per SVG-Ausschnitt angezeigt. Nur die blaue Kleidung wird für
Team 0 im Browser rot eingefärbt. Die Gesichtsfarben bleiben erhalten.

### Trefferfolge und Originalschrift für 0.1.11

Der oben verlinkte Walkthrough wurde bei 01:10–01:14 mit fünf Bildern pro Sekunde
erneut ausgewertet: Die getroffenen Pflaumen werden hervorgehoben, dann fallen
einzelne Buchstaben von oben herein. „THREE OF A KIND“ steht groß und cremefarben
mit dunkler Kontur und versetztem Schatten über dem Feld; erst danach zerbrechen
die Steine. Die Neuauflage ergänzt wie angefordert drei klar getrennte Blinkzyklen
(insgesamt 1200 ms), gefolgt von 1000 ms Schriftanzeige vor dem Bruch.

`three-of-a-kind.png`, `four-of-a-kind.png` und `five-of-a-kind.png` sind unveränderte
PNG-Exporte von Sprite 1160, Frames 4, 9 und 12. Damit wird die Originalschrift
einschließlich ihrer Kontur und Schatten verwendet; der komplette Schriftzug
fliegt gemeinsam herein. Im Original steuert Sprite 1174 einzelne Buchstaben.

`audio/original/match-thunder.wav` ist Sound-Tag 915: Sprite 917 startet ihn in
Frame 43 gleichzeitig mit `goCombo` für die getroffenen Steine. Der exportierte
ADPCM-SWF-Ton (`915.flv`, Mono, 5512 Hz) wurde ohne Schnitt oder Fade in
PCM-WAV decodiert und für Browserkompatibilität auf 22050 Hz umgerechnet.
Er beginnt bei jeder erkannten Kaskade, vor Symbolstimme und
Bruch, und läuft vollständig aus. SFX schaltet ihn zusammen mit den übrigen
Effekten. Der Kaskadenfaktor behält seinen separaten, späteren Combo-Ton.
Mit dem Donner umfasst der Originaleffekt-Katalog jetzt 75 Dateien.

### Ergänzender Sound-Abgleich und Bühne für 0.1.11

Alle übrigen exportierten Sound-Tags wurden mit ihren `StartSound`-Aufrufen und
Frame-Labels im Original-XML abgeglichen. Zusätzlich eingebunden sind unveränderte
MP3-Exporte:

| Datei | Sound-Tag / Originalaufruf | Verwendung im Nachbau |
| --- | --- | --- |
| `original/stones-settle.mp3` | 916, Sprite 917 Frame 121, `endKilling` | Leiser Ausklang nach dem Zerfall einer Trefferkaskade; einmal je Zug |
| `original/lama-victory.mp3` | 600, Sprite 690 Frame 1027, `happy2loop` | Original-Jubel beim erstmals angezeigten Gewinn-Overlay |
| `original/lama-defeat.mp3` | 1237, Sprite 1240 Frames 74/131, `startLose` | Beginn der Verliererreaktion beim erstmals angezeigten Verlust-Overlay |

Der Effektkatalog umfasst damit 78 Originaldateien, zusätzlich zum ICQ-Chatton
und der Originalmusik. Ergebnisstimmen beginnen erst nach den Zuganimationen;
Reconnects und wiederholte Snapshots lösen sie nicht erneut aus.

Die ebenfalls gefundenen Ansagen 1142/1152/1156 für Drei-/Vier-/Fünferhände
gehören zum Poker-Ablauf: Sprite 1160 stoppt in den Frames 4/9/12 bei `fruitMode`,
bevor die Sound-Frames 5/10/13 erreicht werden. Das Früchtespiel verwendet dort
seine bereits eingebundenen Fruchtvarianten. Weitere ungenutzte Tags gehören zu
Pokerhänden, Vorhang-/Bühnen- und Nebenanimationen (u. a. Sprites 219, 708, 740,
743, 778, 1043, 1069 und 1186). Sie werden nicht pauschal als zusätzliche
Treffergeräusche abgespielt; Steinaufprall und Erschütterung besitzen bereits
eigene Ereignisse und Originaleffekte.

Die kompakte Namens-/Punkteanzeige wurde anhand derselben Videobildfolge
abgeglichen: getrennte cremefarbene Namensfelder und dunkle vierstellige
Zahlenfelder in den oberen Ecken. Die Tempelgrafik und ihre vorderen Säulen
werden horizontal verbreitert, damit die Spielfeldsteine frei bleiben, während
die Einschubvorschau hinter den Säulen liegt.

### Einzelne Buchstaben und Trefferumrandungen für 0.1.12

Die Frames 4, 9 und 12 von Sprite 1160 wurden zusätzlich als SVG exportiert.
`three-of-a-kind.svg`, `four-of-a-kind.svg` und `five-of-a-kind.svg` erhalten nur
eine passende `viewBox`; die Originalpfade und Buchstabenpositionen bleiben
erhalten. Die benannten `a1`–`a12`-Instanzen fallen zeitversetzt mit leichter
Drehung herein und federn einzeln ein. Die bisherigen PNGs bleiben als Referenz.
Die Trefferhervorhebung verwendet nun drei blinkende helle Umrandungen statt
eines Ausblendens der vollständigen Steine. Gleichzeitig erkannte Reihen und
Folgekaskaden lösen beide den vorhandenen Original-Combo-Effekt aus.
Zusätzliche „of a Kind“-Ansagen werden auf Nutzerwunsch nicht eingebunden.

## Originaleffekte und Extraktion

Quelle: die auf der Spielseite verlinkte
[archivierte Flash-Datei](https://6games.eu/files/file/421-slide-a-lama.swf).
Exportiert mit [JPEXS Free Flash Decompiler 26.3.0](https://github.com/jindrapetrik/jpexs-decompiler/releases/tag/version26.3.0).
Die Soundnamen wurden anhand der exportierten Symboltabelle und der Soundaufrufe
zugeordnet. Die eingebundenen MP3s stammen direkt aus diesem Export, nicht aus
der gemischten Tonspur des Walkthroughs.

Die frühere pauschale Trefferdatei war tatsächlich `fruit2-0`, also eine Variante
der Bananengruppe. Seit 0.1.3 wird das aufgelöste Symbol je Kaskade ausgewertet;
der eingeschobene Stein ist dafür nicht maßgeblich. Beide Layouts verwenden
dieselben Originalgruppen. Drei, vier und fünf gleiche Symbole wählen im
Original dieselbe Symbolgruppe; eine zusätzliche Kaskade erhält den Ketteneffekt.

| Dateien unter `public/audio/` | Originalsymbol(e) | Zuordnung |
| --- | --- | --- |
| `original/fruit1-0` bis `fruit1-4.mp3` | Tags 1–5 | Glocke, 5 Varianten |
| `original/fruit2-0` bis `fruit2-14.mp3` | Tags 6–20 | Banane / moderne Zitrone, 15 Varianten |
| `original/fruit3-0` bis `fruit3-5.mp3` | Tags 21–26 | Pflaume / moderne Traube, 6 Varianten |
| `original/fruit4-0` bis `fruit4-8.mp3` | Tags 27–35 | Birne / moderne Melone, 9 Varianten |
| `original/fruit5-0` bis `fruit5-6.mp3` | Tags 36–42 | Kirsche, 7 Varianten |
| `original/fruit6-0` bis `fruit6-3.mp3` | Tags 43–46 | BAR, 4 Varianten |
| `original/fruit7-0` bis `fruit7-2.mp3` | Tags 47–49 | Sieben, 3 Varianten |
| `retro-combo.mp3` | 837 / `combo` | Ab der zweiten Kaskade |
| `original/transhappy1.mp3` bis `transhappy7.mp3` | 839–844 und 53 | Freude über hinzugewonnene Lamas |
| `original/transpissed1.mp3` bis `transpissed3.mp3` | 52, 51, 50 | Verärgerung über verlorene Lamas |
| `original/lama-idle-1.mp3` bis `lama-idle-9.mp3` | 351, 374, 405, 441, 474, 481, 528, 555, 556 | Originale `maknit1`–`maknit9` aus Sprite 690 |

Die Original-Ruhelogik (`frame_33`, `doIdleAnim`) kombiniert stumme Idle-Bewegungen
mit gelegentlichen `maknit`-Reaktionen. Deren neun `StartSound`-Tags wurden in der
Timeline von Sprite 690 nachgeschlagen und unverändert exportiert. Die Neuauflage
versucht alle 20–45 Sekunden eine leise Reaktion; laufende Sounds, Combo-Timer,
Lamawechsel und die letzten zehn Sekunden nach anderen Sounds sperren sie.
Zugbeginn oder Chatton beenden eine noch laufende Ruhe-Reaktion. Ausgeschaltete
Stimmen, stummes Spiel und ein unsichtbarer Browser-Tab verhindern sie ebenfalls.

49 Treffer-Varianten, zehn Transferstimmen, neun gelegentliche Lama-Laute,
ein Ketteneffekt und fünf mechanische Effekte: insgesamt 74 Dateien aus dem Spiel,
dazu ein ICQ-Nachrichtenton.
Die Hintergrundmusik `original/background-music.mp3` ist der unveränderte
SWF-Export von Tag 838 (`music1`). Sie läuft in aktiven Runden als Schleife mit
separater Musiknoten-Taste. SFX steuert alle übrigen Geräusche unabhängig davon.
Die Spielsounds stammen aus den Sound-Tags; bis auf den unten beschriebenen,
aus zwei Originalsamples rekonstruierten Fall-Sound bleiben sie unverändert. Die bisher unbenutzte
BAR-Gruppe `fruit6` wird seit 0.1.10 ebenfalls ausgeliefert. Eine gemischte Auswahl verwendet
alle Varianten einmal, bevor sie erneut gemischt wird, ohne direkte Wiederholung.

Die konkrete Zuordnung ist im exportierten Originalcode belegt:
`DefineSprite_1174/frame_2` setzt `sn = winningHand.used[0].num - 1` und spielt
`fruit{sn}-{Variante}`. `frame_9` definiert die sieben Gruppen und deren Größen.
`worshiper.prototype.ef` spielt bei Ankunft `transHappy1`–`7`;
`DefineSprite_690/frame_1132` spielt `transPissed1`–`3`.

### Mechanische Effekte und Chatton für 0.1.4

Die mechanischen Samples stammen aus demselben SWF-Export. Beim Fallen wird
die unten beschriebene Rekonstruktion `reference/stone-drop-original.mp3` verwendet. Die
Zuordnung wurde in den `StartSound`-Tags der Sprite-Timelines geprüft
(`java -jar ffdec.jar -swf2xml original.swf original.xml`):

| Datei unter `public/audio/original/` | Sound-Tag | Original-Verwendung |
| --- | --- | --- |
| `../reference/stone-drop-original.mp3` | 895 + 896 | Sprite 914, „fall“, rekonstruiert |
| `stone-slide.mp3` | 896 | Sprite 917, „pushCardLeft“ / „pushCardRight“ |
| `stone-squeeze.mp3` | 900 | Sprite 914, „squeeze“ / seitliches Verschieben |
| `stone-burst.mp3` | 806 | Sprite 832, „pizuz“ (kleiner Bruch) |
| `stone-shatter.mp3` | 750 | Sprite 803, „pizuzGadol“ (große Explosion) |

`stone-drop.mp3` wurde auf Wunsch zu einem schweren Steinaufprall überarbeitet:
Der Originalanteil ist auf 70 % Tonhöhe abgesenkt, gekürzt und tiefpassgefiltert.
Eine eigene synthetische Schicht ergänzt einen kurzen Fallansatz, einen tiefen
Aufprall nach etwa 105 ms (abfallende Resonanz von 96 auf 52 Hz), körniges
Steinrasseln und kurzen Nachhall mit 43/79 ms Verzögerung. Der Effekt klingt
nach 0,95 s aus; Ausgabe: Mono-MP3, 44,1 kHz, 128 kbit/s. Er ist eine Bearbeitung
des Originals und kein unverändertes Originalsample.

Die erneute Prüfung der Original-Timeline zeigt: Sprite 914 startet bei
„fall“, Frame 3, **895 und 896 gleichzeitig**, jeweils mit Lautstärkehüllkurve.
895 läuft bis Sample 27939 (0,634 s); bei 896 wird der Ausschnitt zwischen
Sample 6036 und 31689 verwendet (0,137–0,719 s). Diese Positionen beziehen sich
auf die 44,1-kHz-Zeitbasis der SWF. Sprite 917 spielt beim „slideDown“ dagegen
895 allein. Der reine Export liegt als `public/audio/reference/stone-drop-895.mp3`
vor; `stone-drop-original.mp3` daneben ist eine Hörprobe aus beiden Samples mit
angenäherten Originalausschnitten und Lautstärkeverläufen. Diese Rekonstruktion
wird jetzt im Spiel für alle Fallereignisse verwendet. Die vorherige schwere
Bearbeitung `original/stone-drop.mp3` bleibt als unbenutzte Variante erhalten.

Beim Beginn des Seitenwechsels spielen ausschließlich `transhappy1–7` bei
eigenem Lama-Zugewinn oder `transpissed1–3` bei Verlust an den Gegner. Die
Zuordnung gilt für beide Sitzplätze und für ein oder mehrere Lamas pro Zug.
Der Seitenwechsel beginnt nach den Steinkaskaden. Spiel und Server
verwenden dieselbe Zeitleiste mit 330 ms Einschub, 210 ms Fall und 360 ms Bruch
sowie 1900 ms für den Seitenwechsel. Zugbewegungen dauern doppelt so lang
wie in 0.1.3; das kurze natürliche Blinzeln bleibt unverändert.

Seit 0.1.5 geht bei voller Spalte eine Rissphase von 420 ms und eine Bruchphase
von 360 ms voraus; erst danach verschiebt sich die Spalte. Freie Einschübe von
oben laufen als durchgehender 540-ms-Fall. Fall-Sounds starten beim Landen.
Identische mechanische Soundereignisse werden je Zug zusammengefasst; eine
Kennung aus Raum, Runde und Revision verhindert doppelte Zugwiedergabe.

Der separat ergänzte ICQ-Chatton `public/audio/icq-uh-oh.mp3` stammt von
[Myinstants – ICQ Uh Oh](https://www.myinstants.com/es/instant/icq-uh-oh-46540/),
[MP3-Datei](https://www.myinstants.com/media/sounds/icq-uh-oh.mp3), abgerufen am
16.10.2026. Die lokale Fassung ist als MP3 eingebunden. Ein stummer Vorlauf von
220 ms lässt der Audioausgabe Zeit zum Anlaufen, damit die kurze erste Silbe
nicht verschluckt wird. Beide Lautteile bleiben vollständig erhalten; die
Wiedergabe verwendet keine Einblendung. Er spielt bei neuen fremden
Nachrichten, nicht bei eigenen Nachrichten oder beim Laden des Verlaufs.
Die bestehende Einschränkung zur nicht bestätigten freien Lizenz gilt auch hier.

### Erneuter Videoabgleich für 0.1.3

Der Original-Walkthrough wurde erneut mit Bild und Ton heruntergeladen. Der
Abschnitt 01:05–01:25 wurde als Bildfolge und separate Tonspur extrahiert.
Zusätzlich wurden die Originalsamples mit der Videotonspur technisch verglichen:
Mono-PCM mit 2 kHz, Bandpass 120–900 Hz, normierte Kreuzkorrelation.
Dieser Abgleich unterstützt die Zuordnung trotz der gemischten Videotonspur:

| Videoposition | Bester zugehöriger Sampletreffer | Korrelationswert |
| --- | --- | --- |
| 01:07,968 | `transPissed2` | 0,356 |
| 01:12,100 | `fruit3-3` (Pflaumen-Kombination) | 0,394 |
| 01:18,674 | `transhappy5` | 0,517 |

Die Einzelsamples aus der SWF vermeiden die überlagerten Musik-/Spielsounds
des Videos. Der Browser prüft das erfolgreiche Decodieren aller eingebundenen Audiodateien.
Die Wiedergabe startet pro tatsächlichem Zug, nicht beim Laden oder Reconnect.
Laufende Samples werden durch neue Züge nicht abgeschnitten. Bei voller
Kanalbelegung warten weitere Samples bis zum Ende eines laufenden Sounds.
Stummschalten und Raumwechsel beenden Wiedergabe und ausstehende Ereignisse.
Die positiven/verärgerten Stimmen orientieren sich an der Perspektive des
jeweiligen Spielers. Die Zahl offener Audiokanäle ist begrenzt.

Reproduzierbare Befehle, Pfade an die lokale Werkzeugablage anpassen:

```sh
java -jar ffdec.jar -export image,sound,symbolClass export original.swf
java -jar ffdec.jar -select all:1 -selectid 690 -export sprite sprites original.swf
yt-dlp --js-runtimes node -f 'bv*[height<=480]+ba' -o 'gameplay.%(ext)s' 'https://www.youtube.com/watch?v=CXQXQgVflCI'
ffmpeg -ss 35 -t 12 -i gameplay.webm -vn video-audio-reference.wav
```

Die Figur aus dem Export ist 757×270 Pixel groß; der sichtbare SVG-Ausschnitt
lautet `60 55 100 135`. Original-SWF, Videos, Rechercheausschnitte und Werkzeuge
sind keine Laufzeitabhängigkeiten. Im Spiel werden alle Assets lokal ausgeliefert;
es gibt keine YouTube-Einbettung und keine externen Medienanfragen.

Die Quellen weisen für die Original-Spielmedien keine hier bestätigte freie
Weiterverwendungslizenz aus. Herkunftsnachweise übertragen keine Rechte;
Originalmedien werden nicht als eigene oder frei lizenzierte Werke ausgegeben.

## Umsetzung und Abweichungen

Aus den Referenzen übernommen: ICQ-artiger Fensterrahmen, Tempelbühne,
Fruchtsymbole, Teamfarben und Geräuschcharakter. Die neuen Steinprofile,
Sandsteinstruktur, Bruchstücke und aufsteigenden Punkte sind eigene CSS-/SVG-
Gestaltungen. Pro Kaskade wird die tatsächlich gutgeschriebene Punktzahl gezeigt.
Die Herde verwendet stabile Figurenkennungen für sichtbare Wege zwischen
den Seiten. Blinzeln und kleine Deformationen folgen dem Prinzip der RPS-
Ruhebewegungen: voneinander unabhängige Zeitgeber statt synchroner Bewegung,
160-ms-Blinzeln und zurückhaltende Skalierungen/Drehungen.
Abschalten bricht laufende Animationen ab; `prefers-reduced-motion`
deaktiviert Bewegung unabhängig vom gespeicherten Schalter.

Die sechs bisherigen Steintypen, Punkte, Vorschau und Zeitwahl bleiben die
Abstimmung dieses Projekts. Seit 0.1.10 ergänzt BAR die Auswahl mit 100 Punkten
pro Dreierreihe, entsprechend `fruitScore[7]` im Originalcode. Das Originalvideo
zeigt sieben Symbole und die Werte 10/20/30/40/70/100/150. Der Retro-Schalter
behauptet deshalb keine vollständige Regelkopie; Poker bleibt ausgeschlossen. Die
Kontaktregel ist in beiden Layouts serverseitig implementiert.
