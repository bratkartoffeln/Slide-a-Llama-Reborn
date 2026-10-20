# Slide-a-Llama für Android

Die APK enthält den Spielclient, beide Layouts, Grafiken und Sounds. Die lokale
Oberfläche läuft mit Capacitor unter `https://localhost`. Online- und CPU-Partien
benötigen weiterhin einen Spielserver. App- und Browserspieler teilen dieselben
Räume, Spielzüge und Chats.

## Installieren und spielen

`Slide-a-Llama-0.1.16-debug.apk` aus dem GitHub-Release auf Android 7 oder neuer
installieren. Android System WebView bzw. Chrome muss mindestens Version 107
haben. Bei älteren Versionen erscheint ein lokaler Aktualisierungshinweis.

Der vorbelegte Spielserver ist **https://flusensieb.dns.navy:9443**. In der Lobby
lässt sich unter **Spielserver** eine andere HTTPS-Adresse mit optionalem Port
speichern. Pfade und Zugangsdaten sind nicht zulässig. `VITE_SERVER_URL` kann die
Buildvorgabe ändern. Die auf dem Gerät gespeicherte Auswahl hat Vorrang.
Einladungslinks verwenden die öffentliche Serveradresse. Ein Link eines anderen
Servers verlangt einen ausdrücklichen Serverwechsel; Sitzungstokens bleiben
nach Server getrennt.

**Vollbild** maximiert den Spieltisch passend zu Breite und Höhe, einschließlich
Vorschau und Lamas. Unter Android blendet es auch die Systemleisten aus.
**Vollbild beenden** bzw. die Zurück-Geste stellt die normale Ansicht wieder her.
Die Zurück-Geste schließt zuerst offene Dialoge; in einer Partie fragt sie vor
dem Verlassen nach. In der Lobby wechselt die App in den Hintergrund.
Beim App-Wechsel pausieren Ton und Animationen; die bestehende Wiederverbindung
und die serverseitige Reservierungsfrist gelten weiter.

Die Oberfläche bleibt bei einem Serverausfall erreichbar. Ein kompletter
Offline-Spielmodus ist nicht enthalten.

## Server

Ohne `ALLOWED_ORIGINS` erlaubt der Server zusätzlich zum eigenen Host den lokalen
App-Ursprung `https://localhost`. Bei einer expliziten Liste muss dieser Ursprung
aufgenommen werden:

```dotenv
ALLOWED_ORIGINS=https://flusensieb.dns.navy:9443,https://localhost
```

Zertifikatsprüfung und HTTPS bleiben aktiv. Der Reverse Proxy muss WebSockets
weiterleiten. Der Server muss mindestens den Android-Support dieser Version
enthalten; ältere Server können den lokalen App-Ursprung ablehnen.

## Bauen und prüfen

Voraussetzungen: Node.js 24, JDK 21, Android SDK Platform 36 und Build Tools
36.0.0. `JAVA_HOME` und `ANDROID_HOME` müssen auf JDK bzw. SDK zeigen; alternativ
den SDK-Pfad in der ignorierten `android/local.properties` hinterlegen.

```sh
npm ci
npm run android:apk
```

Der Befehl baut den separaten Android-Client, synchronisiert Capacitor und erzeugt
eine signierte Debug-APK samt SHA-256 unter `dist/android-apk/`.
Frontend, Server und Android verwenden die Version aus `package.json`.

Weitere Befehle: `npm run build:android`, `npm run android:sync`,
`npm run android:open`. Der Webbuild bleibt unter `dist/client`.

Nach `npm run build` und `npm run build:android` prüft `npm run test:android`
den tatsächlich gebündelten Client mit einem echten lokalen Spielserver und
einem Browser-Gegner. Nur native Pluginaufrufe und das WebSocket-Transportziel
werden im Test simuliert. Der Workflow `android.yml` führt diesen Test aus,
baut mit JDK/SDK die APK und speichert APK und Prüfsumme als Artefakt.

Die APK ist wie beim RPS-Projekt eine Debug-Testversion. Verschiedene lokale
oder CI-Builds können unterschiedliche Debugsignaturen besitzen; dann ist vor
einem Update die alte Installation zu entfernen. Für dauerhaft aktualisierbare
Produktionsversionen ist ein eigener sicher aufbewahrter Releaseschlüssel nötig.
Schlüssel und lokale SDK-Konfigurationen werden nicht eingecheckt.

Eine Prüfung auf einem echten Android-Gerät (Hoch-/Querformat, Tastatur,
Zurück-Geste, WLAN-Wechsel und komplette Partie) steht zusätzlich zum
automatisierten Build und Browser-Integrationstest aus.
