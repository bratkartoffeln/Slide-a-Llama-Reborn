# Retro-Recherche und Medien für 0.1.3

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
| `follower.png` | Flash-Sprite 690 `worshiper1`, Frame 1, siehe unten |
| `flower.svg` | Eigene SVG-Zeichnung für den Fenster-/Statusstil |

Die Figur wird per SVG-Ausschnitt angezeigt. Nur die blaue Kleidung wird für
Team 0 im Browser rot eingefärbt. Die Gesichtsfarben bleiben erhalten.

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
| `original/fruit7-0` bis `fruit7-2.mp3` | Tags 47–49 | Sieben, 3 Varianten |
| `retro-combo.mp3` | 837 / `combo` | Ab der zweiten Kaskade |
| `original/transhappy1.mp3` bis `transhappy7.mp3` | 839–844 und 53 | Freude über hinzugewonnene Lamas |
| `original/transpissed1.mp3` bis `transpissed3.mp3` | 52, 51, 50 | Verärgerung über verlorene Lamas |

45 Treffer-Varianten, zehn Stimmen und ein Ketteneffekt: insgesamt 56 Dateien.
Alle MP3s wurden unverändert aus den Sound-Tags exportiert. Die unbenutzte
BAR-Gruppe `fruit6` wird nicht ausgeliefert. Eine gemischte Auswahl verwendet
alle Varianten einmal, bevor sie erneut gemischt wird, ohne direkte Wiederholung.

Die konkrete Zuordnung ist im exportierten Originalcode belegt:
`DefineSprite_1174/frame_2` setzt `sn = winningHand.used[0].num - 1` und spielt
`fruit{sn}-{Variante}`. `frame_9` definiert die sieben Gruppen und deren Größen.
`worshiper.prototype.ef` spielt bei Ankunft `transHappy1`–`7`;
`DefineSprite_690/frame_1132` spielt `transPissed1`–`3`.

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
des Videos. Der Browser prüft das erfolgreiche Decodieren aller 56 Dateien.
Die Wiedergabe startet pro tatsächlichem Zug, nicht beim Laden oder Reconnect.
Neue Züge, Stummschalten und Raumwechsel verwerfen veraltete Audioereignisse.
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

Die existierenden sechs Steintypen, Punkte, Vorschau und Zeitwahl bleiben die
Abstimmung dieses Projekts. Das Originalvideo zeigt sieben Symbole inklusive BAR
und die Werte 10/20/30/40/70/100/150. Der Retro-Schalter behauptet deshalb keine
vollständige Regelkopie und ergänzt weder BAR noch Poker. Die neu angeforderte
Kontaktregel ist in beiden Layouts serverseitig implementiert.
