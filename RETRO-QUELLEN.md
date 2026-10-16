# Retro-Recherche und Medien für 0.1.2

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

| Lokale Datei unter `public/audio/` | Originalsymbol | Ereignis |
| --- | --- | --- |
| `retro-match.mp3` | 6 / `fruit2-0` | Treffer |
| `retro-combo.mp3` | 837 / `combo` | Mehrstufige Kette |
| `retro-transfer.mp3` | 839 / `transhappy1` | Lamawechsel |

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
Fruchtsymbole, Teamfarben, Trefferblasen und Geräuschcharakter. Einschübe,
Schwerkraft, Trefferketten, Teamwechsel und Sieganzeige sind neu im Browser
animiert. Abschalten bricht laufende Animationen ab; `prefers-reduced-motion`
deaktiviert Bewegung unabhängig vom gespeicherten Schalter.

Die existierenden sechs Steintypen, Punkte, Vorschau und Zeitwahl bleiben die
Abstimmung dieses Projekts. Das Originalvideo zeigt sieben Symbole inklusive BAR
und die Werte 10/20/30/40/70/100/150. Der Retro-Schalter behauptet deshalb keine
vollständige Regelkopie und ergänzt weder BAR noch Poker. Die neu angeforderte
Kontaktregel ist in beiden Layouts serverseitig implementiert.
