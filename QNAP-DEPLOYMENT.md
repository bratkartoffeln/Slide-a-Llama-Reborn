# Slide-a-Llama auf dem QNAP neben RPS

## Stand und Voraussetzungen

Vorlage: `F:\Daten\DEV\Games\RPS-Online-reborn`, untersucht am 16.10.2026.
Ziel: `F:\Daten\DEV\Games\Slide-a-Llama-Reborn`.
Version 0.1.3 enthält Anwendungscode, Paketdateien, Build und Tests.
Browserclient und WebSocket-Server werden gemeinsam unter `dist/` gebaut.
Lokaler Anwendungsbuild und Multiplayerprüfungen sind erfolgreich. Der Caddy-
Imagebuild und die NAS-HTTPS-Prüfung der dynv6-Korrektur sind unten dokumentiert.

Der Node-24-Dockerfile verwendet folgenden implementierten Vertrag:

- `npm ci` funktioniert mit eingechecktem Lockfile.
- `npm test` führt die tatsächlichen Anwendungstests aus.
- `npm run build` erzeugt **alle** benötigten Laufzeitdateien unter `dist/`,
  einschließlich Browserdateien. Externe Assets müssen zusätzlich im Dockerfile
  berücksichtigt werden, sobald ihre tatsächlichen Pfade feststehen.
- `npm start` startet aus dem Produktionsimage nur mit Produktionsabhängigkeiten;
  ein Start über TypeScript-Entwicklungstools funktioniert dort nicht.
- Der Server beachtet `HOST=0.0.0.0` und `PORT=2568`, liefert HTTP `/ready` mit
  Status 200 erst bei Bereitschaft und unterstützt die gewünschten WebSockets.
- Der Server wertet `ALLOWED_ORIGINS` als kommaseparierte Origin-Liste aus.
  Ohne Liste erlaubt er Browser-Verbindungen vom selben Host und native Clients
  ohne Origin-Header. Bei gesetzter Liste muss der Origin enthalten sein.

Vor einem anderen Technikstapel Dockerfile, Healthcheck und Proxyziel anpassen.
Der Früchte-Modus ist implementiert; Regeln und Abweichungen stehen in
`SPIELREGELN.md`. Räume und Chat sind flüchtig: Neustarts beenden Partien.

## Getrennte Ressourcen

| Ressource | Bestehendes RPS laut Repository | Slide-a-Llama, vorgeschlagen |
| --- | --- | --- |
| Compose-Projekt | rps-arena | slide-a-lama |
| NAS-Verzeichnis | /share/Container/rps-arena/rps-remake | /share/Container/slide-a-llama/app |
| Spielport auf NAS | 2567 | 2568 |
| HTTPS-Port auf NAS | 18443 | 19943 |
| Öffentlicher TCP-Port | 8443 | 9443, vorher prüfen |
| Proxyziel intern | rps:2567 | game:2568 |
| Domain | flusensieb.dns.navy | flusensieb.dns.navy |
| Netzwerk | rps-arena_default | slide-a-lama_default |
| Zertifikats-Volumes | rps-arena_caddy_data/config | slide-a-lama_caddy_data/config |

Container heißen standardmäßig `slide-a-lama-game-1` und
`slide-a-lama-caddy-1`. Keine globalen Container-Namen oder externen Netzwerke.
Das neue Caddy-Image bleibt Compose-projektbezogen. RPS-Dateien, DNS, Token,
Volumes und laufende Container werden nicht geändert oder eingebunden.
Die Werte sind anhand der Vorlagendateien getrennt; Belegung durch weitere
NAS-Dienste und Routerfreigaben ist vor Ort zu prüfen.

## Ersteinrichtung

Erst Build/Tests und `npm run check:docker` prüfen. Danach in einer
Administrations-SSH-Sitzung auf dem NAS einen **neuen** Ordner anlegen:

```sh
mkdir -p /share/Container/slide-a-llama/app
cd /share/Container/slide-a-llama/app
```

Den vollständigen geprüften Zielprojektstand direkt hierher kopieren. Keine
RPS-Verzeichnisse überschreiben. `docker ps --format 'table {{.Names}}\t{{.Ports}}'`
und die QNAP-Portbelegung prüfen; nötigenfalls freie Ports in `.env` setzen.
Compose v2.29.1 ist laut RPS-Anleitung auf dem NAS vorhanden; tatsächlich mit
`docker compose version` bestätigen. Alle Befehle über die hier mitgelieferten
Skripte oder explizit mit **`-p slide-a-lama`** ausführen.

```sh
cp .env.example .env
sh scripts/nas-update.sh lan
```

LAN-Prüfung: `http://NAS-IP:2568/ready` und Spiel im Browser.
Für den Spielport keine öffentliche Routerfreigabe einrichten. Wer keinen
direkten LAN-Zugriff braucht, kann `SLIDE_LAN_BIND=127.0.0.1` setzen.

## Eigenes HTTPS mit dynv6

1. Der bestehende eigene dynv6-Hostname `flusensieb.dns.navy` wird für beide
   Spiele verwendet. DDNS sowie die bestehenden A/AAAA-Einträge nicht ändern.
2. `.env`: `SLIDE_DOMAIN=flusensieb.dns.navy` setzen, ohne Protokoll, Port
   oder Pfad. Slide-a-Llama: `https://flusensieb.dns.navy:9443`;
   RPS bleibt auf `https://flusensieb.dns.navy:8443`.
3. A muss zur öffentlichen Anschluss-IPv4 passen. AAAA nur veröffentlichen,
   wenn IPv6 bis zum neuen Caddy auf dem öffentlichen Port tatsächlich
   funktioniert; IPv4-Portumleitung gilt nicht automatisch für IPv6.
4. Auf dem NAS `sh scripts/setup-dynv6-token.sh` ausführen. Das Skript übernimmt
   die verdeckte Eingabe aus RPS und schreibt nur das neue lokale Secret mit
   restriktiven Dateirechten. Einen Token mit Zugriff auf diese Zone nutzen;
   keine Secrets aus RPS kopieren oder in Git, `.env` oder Images speichern.
5. Erst prüfen und bauen:

```sh
docker compose -p slide-a-lama -f compose.yaml -f compose.https.yaml config --quiet
docker compose -p slide-a-lama -f compose.yaml -f compose.https.yaml build
```

Optional vor dem Start die Caddy-Konfiguration prüfen (verwendet den echten
lokalen Token, gibt ihn nicht aus; stellt noch kein Zertifikat aus):

```sh
docker compose -p slide-a-lama -f compose.yaml -f compose.https.yaml run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Dann `sh scripts/nas-update.sh https` ausführen. Als neue IPv4-Routerfreigabe
**extern TCP 9443 -> NAS TCP 19943** anlegen, sofern beide frei sind; bei
abweichenden Werten `.env`, öffentliche URL und Router konsistent anpassen.
Gegebenenfalls QuFirewall für diesen NAS-Port freischalten. Die vorhandene
Weiterleitung 8443 -> 18443 für RPS bleibt bestehen. Kein zusätzlicher
HTTP-Port, keine neuen Freigaben auf 80/443 und keine Änderung am RPS-Caddy
sind erforderlich. DNS-01 prüft über TXT bei dynv6; der Browserzugang benötigt
trotzdem die genannte Portfreigabe.

```sh
docker compose -p slide-a-lama -f compose.yaml -f compose.https.yaml ps
docker compose -p slide-a-lama -f compose.yaml -f compose.https.yaml logs --tail=100 game caddy
```

Über Mobilfunk die neue HTTPS-Adresse und `/ready` ohne Zertifikatswarnung
prüfen, anschließend eine echte Spiel-/WebSocket-Verbindung. RPS daneben
weiterhin über dessen bisherige Adresse testen. Ein laufender Caddy allein
bestätigt weder gültiges TLS noch öffentliche Erreichbarkeit.

## Updates und GitHub

Vor Updates laufende Slide-a-Llama-Partien beenden; Speicherzustände könnten
beim Neustart verloren gehen. Den alten Quellstand bzw. das bisherige Image
für einen möglichen Rückwechsel behalten. Neue Quellen vollständig übernehmen,
lokale `.env` und `secrets/` behalten. Danach denselben Modus verwenden:

```sh
cd /share/Container/slide-a-llama/app
sh scripts/nas-update.sh https
```

Das Skript sperrt parallele Updates, prüft Compose, baut vor dem Neustart und
wartet auf die Spielbereitschaft. Ein fehlgeschlagener Build lässt bestehende
Container laufen. Fehler beim anschließenden Start führen **nicht** automatisch
zu einem Rollback; Logs prüfen und nötigenfalls den gesicherten Stand erneut
bauen/starten. Kein `down -v`, kein Docker-Prune und keine RPS-Befehle verwenden.
Ein nach Abbruch verbleibendes `.nas-update.lock` erst entfernen, wenn sicher
kein Update mehr läuft. Ein Moduswechsel von HTTPS zu LAN stoppt den bereits
laufenden Caddy nicht automatisch; diesen bei Bedarf gezielt mit der HTTPS-
Compose-Kombination und `stop caddy` stoppen.

Im GitHub-Repository `bratkartoffeln/Slide-a-Llama-Reborn` kann der Workflow
**NAS build and source package** manuell gestartet werden, nachdem die Dateien
eingecheckt und gepusht wurden. Er prüft Paketvoraussetzungen, baut Spiel und
DNS-Proxy und stellt ein Quellpaket des gewählten Commits als Artifact bereit.
Der NAS-Build erfolgt anschließend lokal mit dem Update-Skript. Das Archiv
enthält die versionierten Dateien; `.env` und `secrets/` niemals einchecken.
Dieser Paketworkflow ist nur manuell ausführbar. Zusätzlich prüft `verify.yml`
bei Push und PR Regeln, WebSocket-Multiplayer, Browserbedienung und Produktionsimage.

Der separate Slide-a-Llama-Autoupdater ist auf QNAS1 eingerichtet. Einrichtung,
GitHub-Token, manueller Deployment-Knopf und Status: [QNAP-AUTOUPDATE.md](QNAP-AUTOUPDATE.md).
RPS-Updater und RPS-Cron bleiben unverändert.

## Lokale Prüfung bei der Einrichtung

Am 16.10.2026 wurden beide Compose-Dateien und der GitHub-Workflow mit einem
YAML-Parser auf Syntax und doppelte Schlüssel geprüft. Die Shell-Syntax aller
drei `.sh`-Dateien und die JavaScript-Syntax der Paketprüfung sind gültig.
Das Update-Skript bricht bei fehlender Anwendung und ungültigem Modus mit einem
Fehler ab. Git ignoriert `.env` und `secrets/dynv6_api_token`. Die 17 übertragenen
Dateien wurden mit den vorbereiteten Dateien verglichen; `git diff --check`
meldete keine Whitespace-Fehler. Lokale VS-Code-Einstellungen blieben erhalten.

Docker ist auf diesem Arbeitsrechner nicht verfügbar. Daher wurden weder
`docker compose config` noch Imagebuild, Containerstart, Caddy-Validierung oder
öffentliche DNS-/TLS-/WebSocket-Tests ausgeführt. Der Paketcheck ist mit Version
0.1.0 erfolgreich. Die NAS-Befehle oben sind die
noch auszuführenden Schritte, keine bereits bestätigten Ergebnisse.

## Quellen und Vorlage

- [Docker: getrennte Compose-Projektnamen](https://docs.docker.com/compose/how-tos/project-name/)
- [Docker: Secrets als Laufzeitdateien](https://docs.docker.com/compose/how-tos/use-secrets/)
- [Caddy: Reverse Proxy und WebSockets](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- Lokale RPS-Dateien: Dockerfile, compose.yaml, compose.dns.yaml,
  Caddyfile.dns, deploy/caddy-dynv6/, scripts/setup-dynv6-token.sh,
  .github/workflows/deploy-request.yml, QNAP-HTTPS.md und QNAP-UPDATE.md.

## dynv6-Zonenabfrage korrigiert

Das Slide-a-Llama-Caddy-Image `slide-a-lama-caddy:dynv6-zone-list-v1` verwendet
einen lokal beigelegten libdns/dynv6-v1.1.1-Provider mit gezielter Korrektur:
`GET /api/v2/zones` liefert die Zone und ihre numerische ID, statt des auf
diesem Anschluss mit HTTP 404 fehlschlagenden `/zones/by-name/`-Aufrufs.
Tests im Imagebuild prüfen die Zonenauflösung ohne echte Tokens oder DNS-Schreibzugriffe.
Quellherkunft und Lizenz stehen in `deploy/caddy-dynv6/libdns-dynv6/`.
Nur das neue Projekt verwendet dieses Image; RPS bleibt auf seinem bisherigen Stand.

### Bestätigung am 16.10.2026

Das korrigierte Caddy-Image wurde auf QNAS1 gebaut; die isolierten Go-Tests
und `caddy validate` sind erfolgreich. DNS-01 und die Ausstellung eines
öffentlichen Let's-Encrypt-Zertifikats sind abgeschlossen.

Die öffentliche IPv4-Adresse auf Port 9443 liefert sowohl die Spielseite
(Titel: Slide-a-Lama — Das Duell ist zurück.) als auch `/ready` mit HTTP 200
und vollständig geprüfter TLS-Verbindung. Bestätigt vom NAS und vom PC.
Das Zertifikat ist bis 14.01.2027 gültig; Caddy übernimmt die Erneuerung.
Der unverändert laufende Spielcontainer meldet Version 0.1.0. Die lokale
Projektversion 0.1.2 enthält die Infrastrukturkorrektur für spätere Builds.

RPS antwortet weiterhin auf Port 8443 mit HTTP 200 und gültigem TLS
(Version 0.4.30). IDs, Images und Startzeiten beider RPS-Container und des
Slide-Spielcontainers wurden vor/nach der Caddy-Umstellung verglichen und
sind gleich geblieben. Nur der Slide-Caddy wurde ersetzt.

IPv6-Port 9443 wird weiterhin abgewiesen. Die gemeinsame Domain und deren
DNS-Einträge wurden nicht geändert. Für vollständigen IPv6-Betrieb ist eine
separat geprüfte IPv6-Freigabe/Portkonfiguration erforderlich; die IPv4-
Portumleitung allein stellt diese nicht her.

Die vorherigen Caddy-Builddateien und die HTTPS-Compose-Datei liegen auf dem
NAS unter `/share/homes/sebastian/.cache/slide-a-llama-caddy/20261016T090402Z/`.
Das bisherige Caddy-Image und die Zertifikats-Volumes wurden erhalten.
