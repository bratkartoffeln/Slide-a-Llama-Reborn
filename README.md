# Slide-a-Llama-Reborn

NAS-/Docker-Vorbereitung für einen eigenständigen Betrieb neben RPS Online.

**Status: Infrastrukturvorlage, noch kein lauffähiges Spiel.** Beim Einrichten
enthielt dieses Repository nur diese README und lokale VS-Code-Einstellungen.
Anwendungscode, Paketdateien und Tests fehlen noch. Der Dockerfile übernimmt
vorläufig die Node-24-Grundlage von RPS; vor dem ersten Build den unten
beschriebenen Anwendungsvertrag umsetzen oder den Dockerfile an den tatsächlichen
Technikstapel anpassen. Es wird keine RPS-Anwendung mitkopiert.

Einrichtung, Ports, DNS/TLS, Updates und offene Voraussetzungen:
[QNAP-DEPLOYMENT.md](QNAP-DEPLOYMENT.md).

Paketvoraussetzungen prüfen: `node scripts/check-app-contract.mjs`.
Solange Anwendungscode fehlt, muss diese Prüfung fehlschlagen.
