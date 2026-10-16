# Slide-a-Llama: automatischer NAS-Updater

Der Updater läuft auf QNAS1 als eigener Container
`slide-a-llama-updater-updater-1`, getrennt vom RPS-Updater. Er prüft alle
fünf Minuten `bratkartoffeln/Slide-a-Llama-Reborn`, Branch `main`.
Die vorhandene RPS-Cron-Konfiguration wird nicht geändert.

## Was automatisch passiert

1. Der erste Start merkt sich den aktuellen GitHub-Stand als **beobachtete
   Ausgangsbasis**, ohne die laufende Installation diesem Commit zuzuordnen
   oder sie zu ersetzen. Ein bereits laufendes Spiel bleibt damit bestehen.
2. Ein neuer `main`-Commit wird nur übernommen, wenn dessen neuester
   `verify.yml`-Push-Lauf vollständig erfolgreich ist. PR-Prüfungen oder ein
   älterer erfolgreicher Lauf reichen nicht.
3. Bei offenen Räumen oder unbekanntem Serverstatus wird das Update verschoben.
4. Der exakte Commit wird in einem getrennten Staging-Ordner heruntergeladen,
   als eigenes Image gebaut und in einem Testcontainer ohne Netzwerkfreigaben
   auf Bereitschaft geprüft. Dockerfile-Tests gehören weiterhin zum Build.
5. Direkt vor dem Wechsel werden Räume nochmals geprüft. Neue Spielversionen
   enthalten zusätzlich eine nur im Spielcontainer über Loopback erreichbare
   Wartungssperre: Sie blockiert Raumgründungen und neue WebSockets atomar,
   wenn keine Räume offen sind. Eine aufgegebene Sperre läuft nach fünf Minuten ab.
6. Das alte Image und die Programmdateien werden gesichert. Nur der Dienst
   `game` im bestehenden Compose-Projekt **`slide-a-lama`** wird ersetzt.
   Die Schreibweise des NAS-Ordners **`slide-a-llama`** ändert diesen bestehenden
   Compose-Namen nicht.
7. Nach erfolgreicher Bereitschafts- und Versionsprüfung werden die neuen
   Programmdateien übernommen und der installierte Commit gespeichert.
   Bei Umschalt-/Gesundheits-/Kopierfehlern wird das vorherige Image wieder
   gestartet und gegebenenfalls die Dateisicherung zurückgespielt.

Der aktuell laufende Server 0.1.0 besitzt den Wartungsendpunkt noch nicht.
Bei diesem ersten Übergang sind nur die wiederholten Raumprüfungen möglich;
die atomare Sperre steht nach Veröffentlichung und Installation der neuen
Serverdateien zur Verfügung. Die neuen Serverdateien liegen im Projekt vor.

Bei vorübergehenden Netzwerkfehlern wird ein Build bis zu dreimal versucht.
Netzwerk-/API-Zugriffsfehler können bei einem späteren Poll erneut versucht werden.
Ein echter Code-/Testfehler sperrt den Commit bis zum nächsten Commit oder
einem neuen manuellen GitHub-Auftrag. Ein erfolgreich gebautes Image wird nicht
aktiviert, wenn inzwischen Spieler hinzugekommen sind.

## Geschützte lokale Inhalte

`.env`, eigene `.env.*`, `secrets/`, `skins/`, `data/`, Caddy-Dateien,
Compose-Dateien sowie der gesamte lokale `deploy/`-Ordner bleiben erhalten.
Insbesondere wird der reparierte dynv6-Caddy nicht durch eine ältere Fassung
aus einem Quellarchiv ersetzt. Der Updater baut und startet Caddy nicht neu.
RPS-Pfade und RPS-Container sind keine Updateziele.

Änderungen an Compose, Proxy, NAS-Konfiguration oder am Updater selbst werden
deshalb bewusst über die separate Einrichtung vorgenommen; sie sind keine
automatischen Spielupdates. Es gibt kein globales Docker-Prune.
Backups, Staging-Ordner und eigene Image-Tags werden erhalten und können Platz
belegen; sie liegen vollständig im eigenen Updater-Bereich.

## Installation und Status

Bereits am 16.10.2026 auf QNAS1 eingerichtet und als healthy bestätigt.
Für eine erneute Installation nach Übernahme neuer Updater-Quelldateien:

```sh
cd /share/Container/slide-a-llama/app
sh scripts/install-nas-updater.sh
```

Status und Protokoll in der NAS-Administrations-Shell:

```sh
docker ps --filter label=com.docker.compose.project=slide-a-llama-updater
docker logs --tail=80 slide-a-llama-updater-updater-1
```

Lesender Probelauf, ohne ein Spielupdate auszulösen:

```sh
docker exec slide-a-llama-updater-updater-1 node /updater/main.mjs --once --dry-run
```

Einmalige sofortige Prüfung mit normaler Updatefunktion:

```sh
docker exec slide-a-llama-updater-updater-1 node /updater/main.mjs --once
```

Daten und Buildprotokolle liegen außerhalb des Spiel-Repositories:

```text
/share/Container/slide-a-llama/.slide-updater/
  runtime/              installierte Updater-Dateien
  state.json            beobachteter / tatsächlich installierter Commit
  heartbeat.json        letzte abgeschlossene Prüfung und Ergebnis
  logs/                 Buildprotokolle
  staging/              Commit-Archive und getrennte Quellstände
  backups/              frühere Programmdateien und Image-Referenzen
  active-image.json     vom Updater verwendetes Game-Image-Override
  github-deploy.token   optionales, nur lokal gespeichertes GitHub-Secret
```

`observed_sha` ist ausdrücklich kein Installationsnachweis.
`installed_sha` wird erst nach erfolgreicher Aktivierung und Versionsprüfung gesetzt.
Der Healthcheck bestätigt einen frischen Scheduler-Lebensnachweis; Details zu
API-Fehlern stehen im Protokoll und in `heartbeat.json`.

## GitHub: manueller Knopf und Deployment-Bestätigung

Automatische Checks des öffentlichen Repositories funktionieren zunächst ohne
persönlichen Token. Für höhere API-Limits, private Repository-Zugriffe und
GitHub-Deployment-Bestätigungen wird ein eigener Fine-grained PAT empfohlen.
Nur das Repository `bratkartoffeln/Slide-a-Llama-Reborn` freigeben:

- Contents: Read
- Actions: Read
- Deployments: Read and write
- Metadata: die von GitHub automatisch erforderliche Leseberechtigung

Den Token ausschließlich auf dem NAS verdeckt eingeben:

```sh
cd /share/Container/slide-a-llama/app
sh scripts/setup-github-updater-token.sh
```

Der Updater liest ihn bei jeder Abfrage neu; ein Neustart ist nicht nötig.
Er ist kein dynv6-Token. RPS-Token werden weder kopiert noch geändert.

Der vorbereitete Workflow `.github/workflows/deploy-request.yml` erscheint
nach Commit/Push der Datei auf `main` in GitHub Actions als
**QNAP Deployment anfordern**. Dort **Run workflow**, Branch **main** wählen.
Der NAS-Updater verarbeitet die Anforderung, sobald die Spielräume frei und
die normalen Prüfungen des Commits erfolgreich sind. Er meldet das Ergebnis
als Deployment mit der zugehörigen Workflow-Run-ID zurück.

Ohne GitHub-Token bleibt die automatische öffentliche main-Prüfung aktiv,
aber der manuelle Workflow kann keine NAS-Erfolgsbestätigung erhalten und
erreicht sein Zeitlimit. Deshalb den Token vor Nutzung dieses Knopfes einrichten.
Die Workflow-Datei und der neue Server-Wartungsschutz sind lokal vorbereitet;
die Installation des Updater-Containers pusht oder merged keine Quelländerungen.

## Pausieren, Fortsetzen und Fehlerbehebung

```sh
docker stop slide-a-llama-updater-updater-1
docker start slide-a-llama-updater-updater-1
```

Ein normaler Stop wartet auf einen laufenden Durchgang; der Container hat
dafür eine Schonfrist von 30 Minuten. Der laufende Spielcontainer bleibt bestehen.
Nach einem harten Abbruch kann `app/.nas-update.lock` zurückbleiben. Erst anhand
von Container-/Buildstatus sicherstellen, dass kein Update mehr läuft, und die
Sperre anschließend gezielt entfernen. Eine unbekannte Sperre wird nicht
automatisch gelöscht. Manuelles Update und Autoupdater verwenden dieselbe Sperre.

Der Updater nutzt Docker-Socket-Zugriff für Build, Testcontainer und Game-Wechsel.
Das ist eine administrative Berechtigung; seine Skripte und Runtime-Dateien
sind deshalb wie die bisherigen NAS-Deployment-Skripte nur vertrauenswürdig zu ändern.

## Prüfergebnis bei Einrichtung

14 isolierte Updater-Tests, 23 Spiel-/Server-Tests und TypeScript-Prüfung erfolgreich.
Das Updater-Image führt die isolierten Tests auch im Dockerbuild aus.
Auf QNAS1 wurden Docker-/Compose-Zugriff aus dem Updater, die GitHub-main-/CI-
Abfrage und das Image-ID-Override für einen Rollback ohne Containerwechsel geprüft.
Der erste echte Poll hat die Ausgangsbasis erfolgreich gespeichert.
Bei einem tatsächlich offenen Raum meldete die Raumprüfung Aktivierung=false.
Ein echter Spielversionswechsel wurde bei der Einrichtung nicht ausgelöst.

## Quellen

- [GitHub: Workflow runs](https://docs.github.com/en/rest/actions/workflow-runs)
- [GitHub: Deployments](https://docs.github.com/en/rest/deployments/deployments)
- Lokale RPS-Vorlage auf QNAS1: `.rps-updater/poll.sh`, `update.sh`,
  `check-idle.sh`, `github-report.sh`, `manual-confirm.sh`, `rollback.sh`.
