---
name: commit-publish-merge
description: Änderungen dieses Projekts mit einer KI-formulierten Commit-Nachricht committen, den Branch veröffentlichen, einen Pull Request nach main erstellen, mit Merge-Commit zusammenführen und anschließend auf das aktualisierte main wechseln. Verwenden, wenn der Nutzer diesen Veröffentlichungsablauf anfordert; eine reine Bitte um eine Commit-Nachricht autorisiert keinen Push oder Merge.
---

# Commit, Publish und Merge nach main

Führe den angeforderten Ablauf vollständig aus. Ein Auftrag für den gesamten
Workflow autorisiert Commit, Push, PR-Erstellung und Merge einschließlich des
unten beschriebenen Admin-Bypasses für fehlende Reviews; frage dafür nicht
erneut nach einer allgemeinen Bestätigung. Technisch erforderliche Freigaben
der Ausführungsumgebung bleiben einzuhalten. Das bloße Erstellen oder Bearbeiten
dieses Skills startet den Workflow nicht.

## Ausgangslage und Prüfungen

- Lies die geltenden `AGENTS.md`-Regeln. Prüfe Arbeitsverzeichnis, aktiven Branch,
  `package.json` (falls vorhanden), `git status --short`, gestagte und ungestagte Diffs sowie
  unversionierte Dateien. Leite den Änderungsumfang aus den tatsächlichen Dateien
  und der Nutzeranfrage ab.
- Ermittle Remote und Zielrepository mit `git remote -v`; verwende nicht blind
  ein möglicherweise anderes Standardrepository von `gh`. Prüfe die verfügbare
  GitHub-Anbindung, etwa `gh auth status`. Verwende im Folgenden explizit
  `--repo OWNER/REPO` und den ermittelten Remote.
- Arbeite auf dem vorhandenen Arbeitsbranch. Auf `main` muss vor einem Commit
  ein Arbeitsbranch entstehen. Bei Quellcodeänderungen gelten Branchname und
  Versionspflege aus `AGENTS.md`; bei reinen Dokumentationsänderungen genügt
  ein freier beschreibender Branch ohne Versionssprung. Überschreibe keinen
  vorhandenen Branch. Bei detached HEAD kläre den gewünschten Arbeitsbranch.
- Aktualisiere die Remote-Referenzen mit `git fetch REMOTE`. Prüfe die Änderungen
  gegenüber `REMOTE/main`, vorhandene lokale Commits und einen vorhandenen PR
  für diesen Head-Branch. Nutze einen passenden offenen PR weiter. Falls bereits
  alles veröffentlicht und gemergt ist, verifiziere den Zustand und fahre beim
  abschließenden Wechsel auf `main` fort.
- Führe die zum Änderungsumfang passenden Prüfungen aus. Orientiere dich an
  den vorhandenen Paket-Skripten und `.github/workflows/verify.yml`. Sobald
  die Anwendung existiert, bei Quellcodeänderungen `npm test`, `npm run build`
  und, falls vorhanden, `npm run check` ausführen. Der Anwendungsvertrag lässt
  sich mit `node scripts/check-app-contract.mjs` prüfen; solange die Paketdateien
  fehlen, schlägt diese Prüfung erwartungsgemäß fehl. `verify.yml` prüft bei
  Push/PR Anwendung, Browser und Produktionscontainer; `nas-build.yml` erstellt
  nur auf manuellen Auftrag ein Quellpaket. Bei Infrastrukturänderungen die betroffenen
  Compose-/Docker-Konfigurationen passend prüfen. Reine Skill- oder
  Dokumentationsänderungen benötigen keine vollständigen Anwendungstests.
  Behaupte nur tatsächlich ausgeführte Prüfungen als bestanden.

## Commit und Branch veröffentlichen

1. Prüfe den vollständigen relevanten Diff und formuliere daraus eine prägnante
   Commit-Nachricht. Orientiere dich an Sprache und Stil der letzten Commits.
   Beschreibe die konkrete Änderung; verwende einen Body nur, wenn die Begründung
   oder mehrere zusammenhängende Aspekte ihn erfordern.
2. Stage gezielt die zum Auftrag gehörenden Dateien mit `git add -- DATEIEN`.
   Übernimm keine fremden Änderungen, Secrets oder generierten Dateien ungeprüft.
   Prüfe mit `git diff --cached` den gesamten geplanten Commit. Bei bereits
   gestagten fremden Änderungen halte vor dem Commit an, ohne sie zu verwerfen.
3. Erstelle den Commit. Für mehrzeilige Nachrichten verwende eine temporäre
   UTF-8-Datei und `git commit -F DATEI`. Gibt es keine neuen Dateiänderungen,
   veröffentliche gegebenenfalls bereits vorhandene Commits; erzeuge keinen
   leeren Commit.
4. Veröffentliche mit `git push -u REMOTE BRANCH`. Kein Force-Push und kein
   Umschreiben vorhandener Commits. Bei auseinanderlaufender Remote-Historie
   halte an und benenne den Konflikt.

## Pull Request erstellen und mit Merge-Commit zusammenführen

1. Erstelle oder aktualisiere einen PR mit Base `main` und dem Arbeitsbranch
   als Head. Titel und Beschreibung müssen den gesamten PR-Diff gegen `main`
   abdecken. Beschreibe knapp das gelöste Problem, das resultierende Verhalten
   und die tatsächlich ausgeführten Prüfungen samt relevanten Einschränkungen.
   Verwende bei `gh pr create` bzw. `gh pr edit` für mehrzeilige Beschreibungen
   `--body-file DATEI`; keine als Shell-Code interpolierten Texte.
2. Prüfe PR-URL, Base, Head und aktuelle Head-SHA. Warte auf vorhandene
   CI-Prüfungen, beispielsweise mit `gh pr checks NUMMER --repo OWNER/REPO
   --watch --interval 10`. Sind noch keine Checks sichtbar, prüfe auch die
   Workflow-Läufe für diese Head-SHA, bevor du CI als nicht vorhanden einstufst.
   Warte in kurzen beobachtbaren Abschnitten und gib bei längerer Laufzeit
   Statusmeldungen. Fehlende Checks ersetzen keine lokal erforderlichen Tests.
3. Merge erst bei erfolgreichen erforderlichen Prüfungen und erfüllten
   Repository-Vorgaben, mit der folgenden Ausnahme für Reviews. Verwende
   ausdrücklich die Methode **Merge-Commit**:
   `gh pr merge NUMMER --repo OWNER/REPO --merge --match-head-commit HEAD_SHA`.
   Damit erzeugt GitHub den Merge-Commit; es braucht keinen zusätzlichen lokalen
   Merge. Fehlen ausschließlich PR-/Codeowner-Freigaben, darf ein berechtigter
   Repository-Admin den von GitHub erlaubten Bypass verwenden. Prüfe zuvor die
   Admin-/Bypass-Berechtigung, die aktuellen Regeln und die Head-SHA; verwende
   `gh pr merge NUMMER --repo OWNER/REPO --merge --admin --match-head-commit HEAD_SHA`
   oder den entsprechenden GitHub-API-Merge mit `merge_method: merge` und `sha`.
   Umgehe damit keine fehlgeschlagenen oder noch laufenden erforderlichen
   Prüfungen. Ändere oder deaktiviere keine Branch-Regeln, um den Merge zu
   ermöglichen. Melde den verwendeten Review-Bypass im Abschluss.
   Verwende weder Squash noch Rebase. Lösche den Arbeitsbranch nur auf
   gesonderten Wunsch.
4. Prüfe anschließend den tatsächlichen PR-Zustand, etwa mit `gh pr view NUMMER
   --repo OWNER/REPO --json state,mergedAt,mergeCommit,url,headRefOid`. Eine
   angenommene Merge-Anforderung oder ein eingeplanter Auto-Merge reicht nicht
   als Erfolg. Warte bis `MERGED` und ein Merge-Commit bestätigt sind. Ändert
   sich die Head-SHA, prüfe den neuen Diff und dessen Checks erneut vor dem Merge.

## Abschluss und Wiederaufnahme

- Wechsle erst nach bestätigt erfolgtem Merge mit sauberem Arbeitsverzeichnis
  über `git switch main` auf `main`. Aktualisiere mit `git fetch REMOTE` und
  `git merge --ff-only REMOTE/main`. Bestätige mit `git merge-base --is-ancestor
  MERGE_SHA HEAD`, dass der PR-Merge-Commit lokal enthalten ist, und prüfe Branch
  sowie Arbeitsverzeichnis abschließend.
- Bei fehlender Authentifizierung, fehlgeschlagenen Prüfungen, Merge-Konflikten,
  fehlendem Review ohne zulässigen Admin-Bypass, deaktivierten Merge-Commits
  oder fehlenden Rechten:
  halte am betroffenen Schritt an und berichte den konkreten Blocker sowie
  Commit, Branch und vorhandene PR-URL. Verwende nur den oben erlaubten
  Review-Bypass; umgehe keine anderen Branch-Regeln. Wiederhole
  unverändert fehlgeschlagene Aktionen nicht endlos; bei ausbleibendem CI-
  Fortschritt prüfe die Ursache und berichte den offenen Zustand.
- Verwirf und verstecke keine lokalen Änderungen mit Reset, Clean oder Stash.
  Ist ein Fast-Forward auf `main` nicht möglich, melde die Abweichung.
- Bei Wiederaufnahme lies zuerst den realen Git- und PR-Zustand; erstelle keine
  doppelten Commits oder PRs. Melde zum Abschluss Commit, PR-Link, Merge-Commit,
  Prüfergebnis und den tatsächlich aktiven lokalen Branch.
