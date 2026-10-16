import './style.css';
import './retro.css';
import './feedback.css';
import { fruit, llama, arrow } from './art';
import { GameAudio } from './sound';
import { FEEDBACK_TIMING } from './sound-events';
import { crushesBottom } from '../shared/feedback';
import { BoardFeedback } from './board-feedback';
import { HerdMotion } from './herd-motion';
import { resultScene } from './result-scene';
import { Connection, roomCode, type ConnectionStatus } from './network';
import { newGame, push, insert, gravity, cloneBoard, lamaCounts, TILE_INFO, TILES, type Board, type Move, type Seat, type Tile } from '../shared/game';
import type { Snapshot, ServerMessage, ChatMessage } from '../shared/protocol';
declare const __APP_VERSION__: string;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const storage = { get(key: string) { try { return localStorage.getItem(key); } catch { return null; } }, set(key: string, value: string) { try { localStorage.setItem(key, value); } catch {} } };
let state: Snapshot | null = null;
let status: ConnectionStatus = 'idle';
let clockOffset = 0, renderedRevision = -1, animationGeneration = 0, animating = false, movePending = false;
let pendingMoveTimer: ReturnType<typeof setTimeout>;
let resultRevealPending = false;
let sound = storage.get('lama:sound') !== 'off';
const audio = new GameAudio(); audio.setEnabled(sound);
let voices = storage.get('lama:voices') !== 'off'; audio.setVoicesEnabled(voices);
let retro = storage.get('lama:theme') !== 'modern';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionPreference = storage.get('lama:motion') !== 'off';
const motionEnabled = () => motionPreference && !reducedMotion.matches;
const activeAnimations = new Set<Animation>();
document.body.dataset.theme = retro ? 'retro' : 'modern';
const tileName = (tile: Tile) => retro ? ({ cherry: 'Kirsche', lemon: 'Banane', grape: 'Pflaume', melon: 'Birne', bell: 'Glocke', seven: 'Sieben' })[tile] : TILE_INFO[tile].name;
let chatMessages: ChatMessage[] = [], unread = 0;
let chatInitialized = false;
const chatDrafts = new Map<string, string>();
const demo = newGame(() => 0.25);
demo.board = [['cherry','melon','lemon','grape','seven'],['grape','cherry','lemon','bell','melon'],['lemon','grape','melon','cherry','bell'],['melon','bell','cherry','grape','lemon'],['cherry','lemon','grape','melon','cherry']];
const app = $('app');
app.innerHTML = `
<div class="retro-titlebar" aria-hidden="true"><span class="retro-flower"><img src="/retro/flower.svg" alt=""/></span><span>Slide-a-Llama · ICQ Games</span><span class="retro-window-buttons">─ ▢ ×</span></div><header class="site-header"><a class="brand" href="/" aria-label="Slide-a-Llama Startseite"><img class="modern-brand" src="/favicon.svg" alt=""/><img class="retro-brand" src="/retro/flower.svg" alt=""/><span>slide<span class="brand-dash">-a-</span>llama<small>REBORN · DAS DUELL IST ZURÜCK</small></span></a><nav><button class="theme-toggle" id="theme-toggle" aria-pressed="false">ICQ-Retro</button><button class="theme-toggle voices-toggle" id="voices-toggle" aria-label="Lama-Stimmen" aria-pressed="true">Stimmen</button><button class="icon-button motion-toggle" id="motion-toggle" aria-label="Animationen ausschalten" title="Animationen ausschalten" aria-pressed="true">✦</button><span class="connection"><i id="connection-dot"></i><span id="connection-label">Bereit für ein Duell</span></span><button class="icon-button" id="sound" aria-label="Ton einschalten" title="Ton einschalten">♪</button><button class="text-button" id="rules-open">So geht’s <span>↗</span></button></nav></header>
<main>
  <section class="intro"><div><p class="eyebrow"><span></span> DER KLASSIKER. WIEDER ZUSAMMEN.</p><h1>Kleine Steine.<br/><em>Große Rivalität.</em></h1><p class="intro-copy">Schiebe Früchte, entdecke Ketten und gewinne die Lamas.<br class="desktop-only"/> Ein Freund. Ein Spielfeld. Noch eine Runde.</p></div><div class="intro-art"><span class="art-sun"></span>${llama('#f3e8d0','#d57850','hero-llama')}<span class="art-caption">ALTE LIEBE.<br/>NEUES DUELL.</span><span class="art-spark">✳</span></div></section>
  <div class="play-heading"><div><span class="live-dot"></span><h2 id="table-heading">Dein Spieltisch</h2><span class="mode-badge" id="mode-badge">FRÜCHTE · 1 GEGEN 1</span></div><button class="text-button" id="leave" hidden>Raum verlassen ↗</button></div>
  <div class="game-layout">
    <aside class="left-column">
      <section class="panel setup-panel" id="setup"><p class="eyebrow">GUT, DASS DU DA BIST</p><h3>Wer spielt mit?</h3><label for="name">Dein Name</label><input id="name" maxlength="20" autocomplete="nickname" placeholder="Zum Beispiel: Alex" value="${escape(storage.get('lama:name') ?? '')}"/><label for="turn-time">Zeit pro Zug</label><select id="turn-time"><option value="15">15 Sekunden · flott</option><option value="30" selected>30 Sekunden · entspannt</option><option value="60">60 Sekunden · mit Bedacht</option></select><button class="button primary" id="create">Freund einladen <span>↗</span></button><button class="button secondary" id="practice">Mit Paco üben <span>✧</span></button><div class="divider"><span>Du hast einen Raumcode?</span></div><form id="join-form"><label class="sr-only" for="room-input">Raumcode oder Einladungslink</label><div class="input-action"><input id="room-input" placeholder="Code oder Link" autocomplete="off"/><button type="submit" class="join-button" aria-label="Raum beitreten">${arrow('right')}</button></div></form><p class="small-note">Ohne Anmeldung. Direkt miteinander.</p></section>
      <section class="panel room-panel" id="room-panel" hidden><p class="eyebrow">DEIN PRIVATER RAUM</p><h3 id="room-title">Ein Platz für zwei.</h3><label for="invite-link">Einladungslink</label><input id="invite-link" readonly/><button class="button secondary" id="copy-link">Link kopieren <span>⧉</span></button><p class="room-code">Raumcode <strong id="room-code"></strong></p><p class="small-note" id="room-help">Schicke den Link an einen Freund. Sobald ihr beide da seid, geht’s los.</p><div class="room-stats"><span>RUNDE <b id="round">1</b></span><span>SIEGE <b id="wins">0 : 0</b></span></div></section>
      <section class="panel points-panel"><div class="section-title"><h3>Jede Frucht zählt.</h3><span>3ER-REIHE</span></div><div class="points-grid">${TILES.map(t => `<div title="${tileName(t)}: ${TILE_INFO[t].points} Punkte">${fruit(t)}<strong>${TILE_INFO[t].points}</strong></div>`).join('')}</div><p>4 gleiche = <b>×2</b> · 5 gleiche = <b>×3</b><br/>Jede weitere Kaskade erhöht den Faktor.</p></section>
    </aside>
    <section class="arena" id="arena" aria-label="Spielfeld">
      <div id="reconnecting" class="reconnect-banner" role="status" hidden>Verbindung unterbrochen. Dein Platz bleibt reserviert; wir verbinden dich erneut …</div>
      <div class="retro-game-caption" aria-hidden="true">SLIDE-A-LLAMA <small>CLASSIC FRUITS</small></div><div class="player-row"><div class="player player-zero" id="player-0"></div><div class="versus">VS</div><div class="player player-one" id="player-1"></div></div>
      <div class="turn-line"><span id="turn-label">Ein kleines Duell wartet auf dich.</span><span class="timer" id="timer">30<span>s</span></span></div><div class="timer-track"><span id="timer-fill"></span></div>
      <div class="temple-stage"><div class="board-scene"><img class="retro-temple" src="/retro/temple.png" alt="" draggable="false"/><div class="temple-top"><span>◆</span><i></i><span>◆</span></div><div class="board-controls" id="board-controls"></div><div class="board-effects" id="board-effects" aria-hidden="true"></div><div class="board-overlay" id="board-overlay"><span class="overlay-tag">DEIN NÄCHSTER LIEBLINGSKLASSIKER</span><h3>Ein Zug kann<br/>alles drehen.</h3><p>Lade einen Freund ein<br/>oder fordere Paco heraus.</p></div></div>
      <div class="tile-queue"><div class="wheel-window"><div class="queue-wheel" id="queue-wheel" role="group" aria-label="Stein-Drehrad, der kommende Stein steht unten"><div class="wheel-plate" aria-hidden="true"><i></i><b>&#9670;</b></div><div class="current-tile"><span>JETZT</span><div id="current-tile"></div></div><div class="next-tiles"><span>DANACH</span><div id="next-tiles"></div></div></div></div><div class="queue-hint" id="queue-hint">Einsetzen.<br/><strong>Überraschen.</strong></div></div>
      </div><div class="move-feedback" id="move-feedback" aria-live="polite">Drei gleiche Früchte. Ein ziemlich guter Anfang.</div>
      <div class="herd"><div class="herd-top"><span>DEINE LAMAS <b id="lamas-0">5</b></span><span><b id="lamas-1">5</b> GEGENSEITE</span></div><div id="herd-llamas" class="herd-llamas"></div><div class="lead-track"><span id="lead-fill"></span><i></i></div><p id="herd-caption">60 Punkte Vorsprung = ein Lama für dich.</p></div>
      <div id="result" class="result" role="dialog" aria-modal="true" aria-labelledby="result-heading" hidden></div>
      <button id="resign" class="text-button resign" hidden>Partie aufgeben</button>
    </section>
    <aside class="panel chat-panel" id="chat-panel"><div class="chat-heading"><div><span class="chat-icon">☷</span><h3>Am Spieltisch</h3></div><span id="chat-count">CHAT</span></div><p class="chat-subtitle" id="chat-subtitle">Gute Züge verdienen einen Kommentar.</p><div class="chat-messages" id="messages" role="log" aria-label="Raumchat" aria-live="polite"><div class="chat-empty">${llama('#e8e0cd','#739083')}<p>Ein „Hallo“ gehört dazu.</p><span>Hier ist Platz für eure Nachrichten,<br/>kleine Sticheleien und große Pläne.</span></div></div><button id="new-messages" class="unread" hidden>Neue Nachrichten ↓</button><div class="quick-chat"><button data-quick="Hallo! 👋" disabled>Hallo! 👋</button><button data-quick="Guter Zug! ✨" disabled>Guter Zug! ✨</button><button data-quick="Revanche? 🦙" disabled>Revanche? 🦙</button></div><form id="chat-form"><label class="sr-only" for="chat-input">Deine Nachricht</label><div class="chat-compose"><input id="chat-input" placeholder="Deine Nachricht …" maxlength="600" autocomplete="off" disabled/><button aria-label="Nachricht senden" id="send-chat" disabled>${arrow('right')}</button></div><span class="chat-footnote">Nur für euch beide. <span id="chat-length">0/300</span></span></form></aside>
  </div>
  <section class="how-strip"><div><span>01</span><p><strong>Schieb etwas an.</strong>Wähle eine der 15 Pfeiltasten am Rand.</p></div><div><span>02</span><p><strong>Bring sie zusammen.</strong>Drei gleiche bilden eine Reihe. Ketten zählen mehr.</p></div><div><span>03</span><p><strong>Überzeuge die Herde.</strong>300 Punkte Vorsprung holen alle zehn Lamas.</p></div></section>
</main>
<footer><span>Ein bisschen früher. Ein bisschen besser.</span><span>SLIDE-A-LLAMA REBORN <b>v${__APP_VERSION__}</b></span></footer>
<div id="toast" class="toast" role="status" hidden></div>
<dialog id="rules"><button class="dialog-close" id="rules-close" aria-label="Schließen">×</button><p class="eyebrow">KURZ ERKLÄRT</p><h2>Schieben. Kombinieren.<br/><em>Lamas gewinnen.</em></h2><p>Ihr spielt abwechselnd auf demselben 5×5-Feld. Setze den aktuellen Stein mit einem der Pfeile von <b>oben, links oder rechts</b> ein. Nur Steine mit direktem Kontakt werden mitgeschoben. An der ersten Lücke endet die Schiebekette; Steine dahinter bleiben stehen. Ist der Streifen lückenlos voll, fällt der letzte Stein hinaus. Anschließend wirkt die Schwerkraft.</p><p>Mindestens drei gleiche Symbole in einer waagerechten oder senkrechten Reihe verschwinden. Vier zählen doppelt, fünf dreifach. Entsteht danach eine weitere Reihe, zählen ihre Punkte mit dem nächsten Kaskadenfaktor (×2, ×3, …). Leere Felder werden mit euren nächsten Zügen gefüllt.</p><p>Ihr startet mit je fünf Lamas. Je <b>60 Punkte Vorsprung</b> wechselt eines die Seite. Mit <b>300 Punkten Vorsprung</b> gewinnst du alle zehn und die Partie.</p><p>Nach Ablauf der Zugzeit wird dein Stein automatisch oben links eingesetzt. Bei Verbindungsabbruch pausiert die Partie für bis zu <b>120 Sekunden</b>. Danach gewinnt der verbliebene Spieler.</p><div class="keyboard-tip">Tastatur: <kbd>1</kbd>–<kbd>5</kbd> von oben · <kbd>Shift</kbd> + Zahl von links · <kbd>Alt</kbd> + Zahl von rechts</div><p class="small-note">Eigenständiger Früchte-Nachbau, inspiriert vom ICQ-Klassiker. Symbolhäufigkeiten und Punktewerte sind die Abstimmung dieser Version.</p><button class="button primary" id="rules-play">Alles klar, los geht’s</button></dialog>
<dialog id="confirm"><h2 id="confirm-title">Partie verlassen?</h2><p id="confirm-copy"></p><div class="confirm-buttons"><button class="button secondary" id="confirm-no">Weiterspielen</button><button class="button primary" id="confirm-yes">Bestätigen</button></div></dialog>`;

function notify(message: string) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 6500); }
let toastTimer: ReturnType<typeof setTimeout>;
const boardFeedback = new BoardFeedback($('board-controls').parentElement!, $('board-effects'), motionEnabled);
const herdMotion = new HerdMotion($('herd-llamas'), () => motionEnabled() && (state?.phase !== 'finished' || animating));
function updateSound() { $('sound').classList.toggle('enabled', sound); $('sound').setAttribute('aria-label', sound ? 'Ton ausschalten' : 'Ton einschalten'); $('sound').title = sound ? 'Ton ausschalten' : 'Ton einschalten'; $('sound').setAttribute('aria-pressed', String(sound)); }
$('sound').onclick = () => { sound = !sound; storage.set('lama:sound', sound ? 'on' : 'off'); audio.setEnabled(sound); updateSound(); }; updateSound();
function applyPreferences() {
  document.body.dataset.theme = retro ? 'retro' : 'modern';
  document.body.classList.toggle('motion-off', !motionEnabled());
  $('theme-toggle').setAttribute('aria-pressed', String(retro));
  $('theme-toggle').title = retro ? 'Zum modernen Layout wechseln' : 'Zum ICQ-Retro-Layout wechseln';
  $('motion-toggle').setAttribute('aria-pressed', String(motionEnabled()));
  const label = reducedMotion.matches ? 'Animationen durch Systemeinstellung reduziert' : motionEnabled() ? 'Animationen ausschalten' : 'Animationen einschalten';
  $('motion-toggle').setAttribute('aria-label', label); $('motion-toggle').title = label;
  $<HTMLButtonElement>('motion-toggle').disabled = reducedMotion.matches;
  $('voices-toggle').setAttribute('aria-pressed', String(voices));
  $('voices-toggle').title = voices ? 'Lama-Stimmen ausschalten' : 'Lama-Stimmen einschalten';
  herdMotion.refresh();
}
function cancelVisuals() {
  animationGeneration++; animating = false;
  for (const animation of activeAnimations) animation.cancel();
  activeAnimations.clear();
  boardFeedback.clear(); herdMotion.clear();
}
$('voices-toggle').onclick = () => { voices = !voices; storage.set('lama:voices', voices ? 'on' : 'off'); audio.setVoicesEnabled(voices); applyPreferences(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) { audio.cancel(); herdMotion.clear(); } else herdMotion.refresh(); });
$('theme-toggle').onclick = () => {
  retro = !retro; storage.set('lama:theme', retro ? 'retro' : 'modern'); cancelVisuals(); applyPreferences();
  renderBoard(state?.game.board ?? demo.board); renderQueue(); renderPlayers(); renderHerd(); renderStatus(); renderChat();
  document.querySelectorAll<HTMLElement>('.points-grid [title]').forEach((element, i) => { element.title = `${tileName(TILES[i])}: ${TILE_INFO[TILES[i]].points} Punkte`; });
};
$('motion-toggle').onclick = () => {
  motionPreference = !motionPreference; storage.set('lama:motion', motionPreference ? 'on' : 'off');
  cancelVisuals(); applyPreferences(); renderBoard(state?.game.board ?? demo.board); renderStatus();
};
reducedMotion.addEventListener('change', () => { cancelVisuals(); applyPreferences(); renderBoard(state?.game.board ?? demo.board); renderStatus(); });
applyPreferences();
const rules = $<HTMLDialogElement>('rules');
$('rules-open').onclick = () => rules.showModal(); $('rules-close').onclick = $('rules-play').onclick = () => rules.close();
rules.addEventListener('click', e => { if (e.target === rules) rules.close(); });
let confirmAction: (() => void) | null = null;
function confirm(title: string, copy: string, action: () => void) { $('confirm-title').textContent = title; $('confirm-copy').textContent = copy; confirmAction = action; $<HTMLDialogElement>('confirm').showModal(); }
$('confirm-no').onclick = () => $<HTMLDialogElement>('confirm').close();
$('confirm-yes').onclick = () => { $<HTMLDialogElement>('confirm').close(); confirmAction?.(); };

const connection = new Connection(receive, s => {
  status = s;
  $('connection-label').textContent = ({ idle: 'Bereit für ein Duell', connecting: 'Verbindung wird aufgebaut …', connected: 'Am Spieltisch verbunden', reconnecting: 'Verbindung wird wiederhergestellt …', ended: 'Verbindung beendet' })[s];
  $('connection-dot').className = s;
  for (const id of ['create', 'practice']) $<HTMLButtonElement>(id).disabled = s === 'connecting' || s === 'reconnecting';
  $<HTMLButtonElement>('join-form').querySelector('button')!.disabled = s === 'connecting' || s === 'reconnecting';
  updateControls();
});
function name(): string | null {
  const input = $<HTMLInputElement>('name'); const n = input.value.trim();
  if (!n || Array.from(n).length > 20) { notify('Verrate uns deinen Namen (1–20 Zeichen).'); input.focus(); return null; }
  storage.set('lama:name', n); return n;
}
function create(bot: boolean) { const n = name(); if (n) connection.connect({ type: 'create', name: n, bot, turnSeconds: Number($<HTMLSelectElement>('turn-time').value) }); }
$('create').onclick = () => create(false); $('practice').onclick = () => create(true);
$('join-form').onsubmit = event => { event.preventDefault(); const n = name(); if (!n) return; const room = roomCode($<HTMLInputElement>('room-input').value); if (!room) { notify('Gib den achtstelligen Raumcode oder den vollständigen Einladungslink ein.'); return; } connection.connect({ type: 'join', room, name: n }); };
function reset() {
  resultRevealPending = false;
  document.body.classList.remove('in-room');
  cancelVisuals(); audio.cancel();
  state = null; renderedRevision = -1; movePending = false; chatMessages = []; chatInitialized = false; chatDrafts.clear(); unread = 0;
  history.replaceState({}, '', location.pathname); $('setup').hidden = false; $('room-panel').hidden = true; $('leave').hidden = true;
  $('result').hidden = true; $('resign').hidden = true; $('table-heading').textContent = 'Dein Spieltisch'; $('mode-badge').textContent = 'FRÜCHTE · 1 GEGEN 1';
  renderBoard(demo.board); renderPlayers(); renderQueue(); renderHerd(); renderChat(); renderStatus(); updateControls();
}
$('leave').onclick = () => confirm('Raum verlassen?', state?.phase === 'playing' || state?.phase === 'paused' ? 'Wenn du gehst, gewinnt dein Gegenüber diese Partie.' : 'Du verlässt diesen Spieltisch. Danach kannst du ein neues Duell starten.', () => { connection.leave(); reset(); });
$('resign').onclick = () => confirm('Diese Partie aufgeben?', 'Dein Gegenüber gewinnt diese Runde. Ihr könnt danach direkt eine Revanche spielen.', () => connection.send({ type: 'resign' }));
$('copy-link').onclick = async () => {
  try { await navigator.clipboard.writeText($<HTMLInputElement>('invite-link').value); notify('Einladungslink kopiert. Schick ihn deinem Freund!'); }
  catch { $<HTMLInputElement>('invite-link').select(); notify('Der Link ist markiert. Kopiere ihn mit Strg+C oder über das Kontextmenü.'); }
};
function receive(message: ServerMessage) {
  if (message.type === 'welcome') {
    chatInitialized = false;
    document.body.classList.add('in-room');
    const url = new URL(location.href); url.searchParams.set('room', message.room); history.replaceState({}, '', url);
    $('setup').hidden = true; $('room-panel').hidden = false; $('leave').hidden = false;
    $<HTMLInputElement>('invite-link').value = url.href; $('room-code').textContent = message.room;
  } else if (message.type === 'snapshot') {
    const previous = state; state = message.state; clockOffset = state.serverTime - Date.now(); movePending = false; clearTimeout(pendingMoveTimer);
    const moved = previous && state.round === previous.round && state.game.lastMove && state.game.revision > previous.game.revision;
    if (previous && state.phase === 'finished' && previous.phase !== 'finished') resultRevealPending = true;
    if (state.phase !== 'finished') resultRevealPending = false;
    if (moved && motionEnabled()) animating = true;
    renderPlayers(); renderQueue(!!moved);
    if (!moved && !animating) renderHerd();
    $('round').textContent = String(state.round); $('wins').textContent = state.wins.join(' : ');
    $('mode-badge').textContent = state.players[1]?.bot ? 'TRAINING MIT PACO' : `RAUM ${state.room}`;
    $('room-title').textContent = state.players[1]?.bot ? 'Paco nimmt die Herausforderung an.' : 'Ein Platz für zwei.';
    $('room-help').textContent = state.players[1]?.bot ? 'Paco plant einen Zug voraus. Übe deine Kombinationen und fordere danach Freunde heraus.' : 'Der Raum ist nur über euren Code erreichbar. Euer Chat bleibt am Spieltisch.';
    $('copy-link').hidden = !!state.players[1]?.bot;
    $('invite-link').hidden = !!state.players[1]?.bot;
    document.querySelector<HTMLLabelElement>('label[for="invite-link"]')!.hidden = !!state.players[1]?.bot;
    $('room-code').parentElement!.hidden = !!state.players[1]?.bot;
    if (state.game.revision !== renderedRevision) {
      renderedRevision = state.game.revision;
      if (moved && motionEnabled()) void animateMove(state, previous.game.board);
      else { cancelVisuals(); renderBoard(state.game.board); renderHerd(); }
      if (moved) audio.playTurn(state.game.lastMove!, previous.game.scores, state.game.scores, state.you, motionEnabled(), previous.game.board, `${state.room}:${state.round}:${state.game.revision}`);
      else audio.cancel();
    }
    if (state.phase === 'paused') audio.cancel();
    herdMotion.refresh(); renderStatus(); updateControls();
  } else if (message.type === 'chat') {
    for (const m of message.messages) if (m.seat === state?.you) chatDrafts.delete(m.requestId);
    const added = message.messages.filter(m => !chatMessages.some(old => old.id === m.id));
    if (chatInitialized && added.some(m => m.seat !== state?.you)) audio.playChat();
    chatInitialized = true;
    chatMessages = message.messages; renderChat(added.length);
  } else if (message.type === 'error') {
    if (message.requestId && chatDrafts.has(message.requestId)) {
      const input = $<HTMLInputElement>('chat-input');
      if (!input.value) input.value = chatDrafts.get(message.requestId)!;
      chatDrafts.delete(message.requestId);
      $('chat-length').textContent = `${Array.from(input.value).length}/300`;
    }
    movePending = false; clearTimeout(pendingMoveTimer); notify(message.message); updateControls();
    if (message.terminal) reset();
  } else if (message.type === 'shutdown') { notify(message.message); reset(); }
}
function renderPlayers() {
  for (const seat of [0, 1] as const) {
    const p = state?.players[seat];
    $(`player-${seat}`).innerHTML = `<div class="avatar">${llama(seat === 0 ? '#efe2c8' : '#dfd5bf', seat === 0 ? '#d57850' : '#6c9689')}</div><div class="player-info"><span>${state ? (state.you === seat ? 'DU' : p?.bot ? 'TRAININGSPARTNER' : 'GEGENÜBER') : seat === 0 ? 'DEINE SEITE' : 'DIE ANDERE SEITE'}</span><strong>${escape(p?.name ?? (seat === 0 ? 'Du' : 'Freier Platz'))}</strong><small class="${p && !p.connected ? 'offline' : ''}">${p ? (p.bot ? 'Denkt gern zwei Schritte weiter' : p.connected ? '● Online' : '○ Verbindung unterbrochen') : 'Bereit für einen guten Zug'}</small></div><b class="score">${state?.game.scores[seat] ?? 0}<small>PKT</small></b>`;
    $(`player-${seat}`).classList.toggle('active', !!state && state.game.turn === seat && state.phase === 'playing');
  }
}
function renderBoard(board: Board, matches: [number, number][] = []) {
  const focus = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.move : undefined;
  let html = '';
  for (let c = 0; c < 5; c++) html += moveButton('top', c, 1, c + 2);
  for (let r = 0; r < 5; r++) {
    html += moveButton('left', r, r + 2, 1);
    for (let c = 0; c < 5; c++) {
      const t = board[r][c];
      html += `<div class="tile stone-${(r * 7 + c * 3) % 5} ${t ?? 'empty'} ${matches.some(([mr, mc]) => mr === r && mc === c) ? 'matched' : ''}" data-row="${r}" data-col="${c}" style="grid-row:${r + 2};grid-column:${c + 2}" aria-label="Zeile ${r + 1}, Spalte ${c + 1}: ${t ? tileName(t) : 'leer'}">${t ? fruit(t) : '<span>·</span>'}</div>`;
    }
    html += moveButton('right', r, r + 2, 7);
  }
  $('board-controls').innerHTML = html;
  $('board-controls').querySelectorAll<HTMLButtonElement>('button').forEach(b => {
    b.onclick = () => { const [side, lane] = b.dataset.move!.split(':'); makeMove({ side: side as Move['side'], lane: +lane }); };
    const highlight = (on: boolean) => {
      if (on) $('board-controls').querySelectorAll('.active-arrow').forEach(other => other.classList.remove('active-arrow'));
      b.classList.toggle('active-arrow', on);
      const [side, lane] = b.dataset.move!.split(':');
      $('board-controls').querySelectorAll<HTMLElement>('.tile').forEach(cell => cell.classList.toggle('preview', on && !b.disabled && (side === 'top' ? cell.dataset.col : cell.dataset.row) === lane));
    };
    b.onpointerenter = () => highlight(true); b.onpointerleave = () => highlight(false); b.onfocus = () => highlight(true); b.onblur = () => highlight(false);
  });
  updateControls();
  if (focus) $('board-controls').querySelector<HTMLButtonElement>(`[data-move="${focus}"]`)?.focus({ preventScroll: true });
}
function moveButton(side: Move['side'], lane: number, row: number, col: number) {
  return `<button class="move-button ${side}" data-move="${side}:${lane}" style="grid-row:${row};grid-column:${col}" aria-label="${side === 'top' ? 'Spalte' : 'Zeile'} ${lane + 1} von ${side === 'top' ? 'oben' : side === 'left' ? 'links' : 'rechts'} einschieben" disabled>${arrow(side === 'top' ? 'down' : side === 'left' ? 'right' : 'left')}</button>`;
}
function animateElement(element: Element, frames: Keyframe[], duration: number, easing = 'cubic-bezier(.45,0,.3,1)') {
  if (!motionEnabled()) return;
  const animation = element.animate(frames, { duration, easing });
  activeAnimations.add(animation);
  void animation.finished.catch(() => {}).finally(() => activeAnimations.delete(animation));
}
function fallingPieces(board: Board, duration: number) {
  const height = $('board-controls').querySelector('.tile')!.getBoundingClientRect().height + (retro ? 2 : 5);
  for (let c = 0; c < 5; c++) {
    let target = 4;
    for (let r = 4; r >= 0; r--) if (board[r][c]) {
      if (target !== r) animateElement($('board-controls').querySelector(`[data-row="${target}"][data-col="${c}"]`)!, [{ transform: `translateY(${(r - target) * height}px)` }, { transform: 'translateY(2px) scale(1.025,.96)', offset: .85 }, { transform: 'none' }], duration);
      target--;
    }
  }
}
async function animateMove(snapshot: Snapshot, previous: Board) {
  const generation = ++animationGeneration; animating = true;
  const last = snapshot.game.lastMove!;
  const pushed = push(previous, last.tile, last.move);
  const scene = $('board-controls').parentElement!;
  const crush = crushesBottom(previous, last.move);
  if (crush) {
    renderBoard(previous); scene.dataset.motionPhase = 'cracking';
    boardFeedback.crackBottom(previous, last.move.lane, last.tile);
    await new Promise(r => setTimeout(r, FEEDBACK_TIMING.crack));
    if (generation !== animationGeneration) return;
    scene.dataset.motionPhase = 'bursting';
    renderBoard(previous, [[4, last.move.lane]]);
    boardFeedback.burst({ board: previous, matches: [[4, last.move.lane]], points: 0, multiplier: 1 }, true, false);
    await new Promise(r => setTimeout(r, FEEDBACK_TIMING.crush));
    if (generation !== animationGeneration) return;
    boardFeedback.releaseWaitingStone();
  } else if (last.move.side !== 'top') boardFeedback.eject(previous, last.move);
  const directFall = last.move.side === 'top' && !crush;
  scene.dataset.motionPhase = 'sliding';
  renderBoard(directFall ? insert(previous, last.tile, last.move) : pushed);
  const size = $('board-controls').querySelector('.tile')!.getBoundingClientRect().width + (retro ? 2 : 5);
  const { side, lane } = last.move;
  if (directFall) {
    const destination = 4 - previous.filter(row => row[lane] !== null).length;
    animateElement($('board-controls').querySelector(`[data-row="${destination}"][data-col="${lane}"]`)!, [
      { transform: `translateY(-${(destination + 1) * size}px)`, offset: 0, easing: 'cubic-bezier(.55,0,1,.65)' },
      { transform: 'translateY(2px) scale(1.025,.96)', offset: .96 }, { transform: 'none' }
    ], FEEDBACK_TIMING.insert + FEEDBACK_TIMING.gravity, 'linear');
  } else if (side === 'top') {
    for (let r = 0; r < 5; r++) {
      const cell = $('board-controls').querySelector(`[data-row="${r}"][data-col="${lane}"]`)!;
      animateElement(cell, [{ transform: `translateY(-${size}px)` }, { transform: 'translateY(2px) scaleY(.98)', offset: .88 }, { transform: 'none' }], 320);
      if (previous[r][lane] === null) break;
    }
  } else {
    const from = side === 'left' ? 0 : 4, step = side === 'left' ? 1 : -1;
    for (let c = from; c >= 0 && c < 5; c += step) {
      animateElement($('board-controls').querySelector(`[data-row="${lane}"][data-col="${c}"]`)!, [{ transform: `translateX(${-step * size}px)` }, { transform: `translateX(${step * 2}px) scaleX(.98)`, offset: .88 }, { transform: 'none' }], 320);
      if (previous[lane][c] === null) break;
    }
  }
  if (directFall) await new Promise(r => setTimeout(r, FEEDBACK_TIMING.insert + FEEDBACK_TIMING.gravity));
  else {
    await new Promise(r => setTimeout(r, FEEDBACK_TIMING.insert));
    if (generation !== animationGeneration) return;
    renderBoard(insert(previous, last.tile, last.move)); fallingPieces(pushed, 200);
    await new Promise(r => setTimeout(r, FEEDBACK_TIMING.gravity));
  }
  for (const frame of snapshot.game.lastMove!.frames) {
    if (generation !== animationGeneration) return;
    renderBoard(frame.board, frame.matches);
    boardFeedback.burst(frame, snapshot.game.lastMove!.seat === snapshot.you);
    $('move-feedback').textContent = `+${frame.points} Punkte${frame.multiplier > 1 ? ` · Kaskade ×${frame.multiplier}!` : ' · Gute Kombination!'}`;
    await new Promise(r => setTimeout(r, FEEDBACK_TIMING.burst));
    if (generation !== animationGeneration) return;
    const cleared = cloneBoard(frame.board);
    for (const [r, c] of frame.matches) cleared[r][c] = null;
    const settled = cloneBoard(cleared); gravity(settled); renderBoard(settled); fallingPieces(cleared, 200);
    await new Promise(r => setTimeout(r, FEEDBACK_TIMING.fall));
  }
  if (generation !== animationGeneration) return;
  renderBoard(snapshot.game.board); renderHerd(lamaCounts([snapshot.game.scores[0] - (last.seat === 0 ? last.points : 0), snapshot.game.scores[1] - (last.seat === 1 ? last.points : 0)]));
  // Keep the next player from interrupting a follower's actual walk.
  if ($('herd-llamas').querySelector('.is-crossing')) await new Promise(r => setTimeout(r, FEEDBACK_TIMING.transfer));
  if (generation !== animationGeneration) return;
  if (state?.phase === 'finished') await boardFeedback.settle();
  if (generation !== animationGeneration) return;
  animating = false; renderStatus(); updateControls();
  delete scene.dataset.motionPhase;
}
function makeMove(move: Move) {
  if (!state || !canMove()) return;
  if (connection.send({ type: 'move', move, revision: state.game.revision })) {
    movePending = true; updateControls();
    pendingMoveTimer = setTimeout(() => { movePending = false; connection.send({ type: 'sync' }); updateControls(); }, 4000);
  }
}
function canMove() { return !!state && status === 'connected' && state.phase === 'playing' && state.game.turn === state.you && !animating && !movePending && Date.now() + clockOffset >= state.availableAt; }
function updateControls() {
  $('reconnecting').hidden = status !== 'reconnecting';
  document.querySelectorAll<HTMLButtonElement>('.move-button').forEach(b => b.disabled = !canMove());
  const chatReady = !!state && status === 'connected';
  $<HTMLInputElement>('chat-input').disabled = !chatReady; $<HTMLButtonElement>('send-chat').disabled = !chatReady;
  document.querySelectorAll<HTMLButtonElement>('[data-quick]').forEach(b => b.disabled = !chatReady);
  $('arena')?.classList.toggle('my-turn', canMove());
  if ($('rematch')) $<HTMLButtonElement>('rematch').disabled = status !== 'connected' || !!state?.players[state.you]?.rematch;
  $<HTMLButtonElement>('resign').disabled = status !== 'connected';
}
function renderQueue(advance = false) {
  const queue = state?.game.queue ?? demo.queue;
  $('current-tile').innerHTML = fruit(queue[0]); $('next-tiles').innerHTML = queue.slice(1).map(t => `<div title="${tileName(t)}">${fruit(t)}</div>`).join('');
  $('current-tile').setAttribute('aria-label', 'Aktueller Stein: ' + tileName(queue[0]));
  if (advance) {
    animateElement($('queue-wheel'), [{ rotate: '45deg' }, { rotate: '0deg' }], 660);
    $('queue-wheel').querySelectorAll('.tile-art').forEach(art => animateElement(art, [{ rotate: '-45deg' }, { rotate: '0deg' }], 660));
  }
}
function renderHerd(previous?: [number, number]) {
  const counts = lamaCounts(state?.game.scores ?? [0, 0]);
  $('lamas-0').textContent = String(counts[0]); $('lamas-1').textContent = String(counts[1]);
  herdMotion.render(counts[0], !!previous && previous[0] !== counts[0]);
  $('lead-fill').style.width = `${counts[0] * 10}%`;
  const diff = state ? state.game.scores[0] - state.game.scores[1] : 0;
  $('herd-caption').textContent = diff ? `${state!.players[diff > 0 ? 0 : 1]?.name ?? 'Spieler'} führt mit ${Math.abs(diff)} Punkten · Noch ${60 - Math.abs(diff) % 60} bis zum nächsten Lama.` : '60 Punkte Vorsprung = ein Lama für dich.';
  const labels = $('herd-llamas').previousElementSibling!;
  labels.querySelector('span')!.firstChild!.textContent = state ? `${state.you === 0 ? 'DEINE' : state.players[0]?.name.toUpperCase() ?? ''} LAMAS ` : 'DEINE LAMAS ';
  labels.querySelector('span:last-child')!.lastChild!.textContent = state?.you === 1 ? ' DEINE LAMAS' : ' GEGENSEITE';
}
function renderStatus() {
  if (!state || state.phase !== 'finished') { $('result').replaceChildren(); delete $('result').dataset.resultKey; }
  const overlay = $('board-overlay');
  overlay.hidden = !!state && state.phase !== 'waiting' && state.phase !== 'paused';
  if (!state) {
    overlay.innerHTML = '<span class="overlay-tag">DEIN NÄCHSTER LIEBLINGSKLASSIKER</span><h3>Ein Zug kann<br/>alles drehen.</h3><p>Lade einen Freund ein<br/>oder fordere Paco heraus.</p>';
    $('turn-label').textContent = 'Ein kleines Duell wartet auf dich.'; $('move-feedback').textContent = 'Drei gleiche Früchte. Ein ziemlich guter Anfang.';
  } else {
    if (state.phase === 'waiting') overlay.innerHTML = `<span class="overlay-tag">DER TISCH IST GEDECKT</span><h3>Noch ein Lama<br/>fehlt.</h3><p>Teile deinen Einladungslink.<br/>Dein Freund kann direkt beitreten.</p><button id="overlay-copy" class="button primary">Link kopieren ⧉</button>`;
    if (state.phase === 'paused') overlay.innerHTML = `<span class="overlay-tag">KURZE VERSCHNAUFPAUSE</span><h3>Wir warten<br/>aufeinander.</h3><p>Die Verbindung wird wiederhergestellt.<br/>Der Spielstand bleibt für 120 Sekunden erhalten.</p>`;
    if ($('overlay-copy')) $('overlay-copy').onclick = () => $('copy-link').click();
    $('turn-label').textContent = state.phase === 'waiting' ? 'Warte auf deinen Mitspieler …' : state.phase === 'paused' ? 'Partie pausiert · Wiederverbindung möglich' : state.phase === 'finished' ? 'Diese Runde ist entschieden.' : state.you === state.game.turn ? 'Du bist dran. Was ist dein nächster Zug?' : `${state.players[state.game.turn]?.name} ist am Zug …`;
    $('turn-label').classList.toggle('your-turn', state.phase === 'playing' && state.you === state.game.turn);
    const last = state.game.lastMove;
    if (!animating) $('move-feedback').textContent = last ? `${state.players[last.seat]?.name}: ${last.automatic ? 'Zeit abgelaufen · ' : ''}${last.points ? `+${last.points} Punkte${last.frames.length > 1 ? ` · ${last.frames.length}er-Kette!` : ''}` : 'Ein Zug für den nächsten großen Moment.'}` : 'Wähle einen Pfeil, um deinen Stein einzuschieben.';
    $('resign').hidden = !['playing', 'paused'].includes(state.phase);
    $('result').hidden = state.phase !== 'finished' || animating;
    if (state.phase === 'finished' && !animating) {
      herdMotion.clear();
      const winner = state.game.winner!;
      const won = winner === state.you;
      const resultKey = `${state.room}:${state.round}:${winner}`;
      const fresh = $('result').dataset.resultKey !== resultKey;
      $('result').dataset.outcome = won ? 'won' : 'lost';
      if (fresh) {
        $('result').dataset.resultKey = resultKey;
        $('result').innerHTML = `<div class="result-card"><div class="result-titlebar" aria-hidden="true"><img src="/retro/flower.svg" alt=""/>Slide-a-Llama · ICQ Games<span>─ ▢ ×</span></div><span class="eyebrow">RUNDE ${state.round} · ${state.game.scores.join(' : ')}</span><h2 id="result-heading" tabindex="-1">${won ? 'Gewonnen!' : 'Verloren!'}</h2>${resultScene(winner, [state.players[0]?.name ?? 'Spieler 1', state.players[1]?.name ?? 'Spieler 2'])}<h3>${won ? 'Die Herde feiert dich!' : `${escape(state.players[winner]?.name ?? 'Dein Gegenüber')} gewinnt!`}</h3><p>${escape(state.endReason ?? '')}</p><button class="button primary" id="rematch"></button><button class="button secondary" id="result-leave">Zum Startbildschirm</button></div>`;
      }
      $('rematch').textContent = state.players[state.you]?.rematch ? 'Warte auf dein Gegenüber …' : state.players[winner === 0 ? 1 : 0]?.rematch ? 'Revanche annehmen ↗' : 'Noch eine Runde? ↗';
      $<HTMLButtonElement>('rematch').disabled = !!state.players[state.you]?.rematch;
      $('rematch').onclick = () => connection.send({ type: 'rematch' });
      $('result-leave').onclick = () => $('leave').click();
      if (fresh) $('result-heading').focus({ preventScroll: true });
      if (resultRevealPending) {
        resultRevealPending = false;
        if (won) audio.play('win');
        animateElement($('result').querySelector('.result-card')!, [{ transform: 'translateY(12px) scale(.96)' }, { transform: 'none' }], 700);
      }
    }
  }
  tick();
}
document.addEventListener('keydown', event => {
  if (event.key !== 'Tab' || $('result').hidden || document.querySelector('dialog[open]')) return;
  const buttons = [...$('result').querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const first = buttons[0], last = buttons.at(-1);
  if (event.shiftKey && (document.activeElement === first || document.activeElement === $('result-heading'))) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
function tick() {
  const total = state?.turnSeconds ?? 30;
  const remaining = state?.deadline ? Math.max(0, (state.deadline - Date.now() - clockOffset) / 1000) : total;
  $('timer').innerHTML = state && state.phase !== 'playing' ? '—' : `${Math.ceil(Math.min(total, remaining))}<span>s</span>`;
  $('timer').classList.toggle('urgent', remaining <= 5);
  $('timer-fill').style.width = `${Math.min(100, remaining / total * 100)}%`;
  updateControls();
}
setInterval(tick, 150);
function renderChat(added = 0) {
  const messages = $('messages'); const atBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 70;
  if (chatMessages.length) {
    messages.innerHTML = chatMessages.map(m => `<div class="chat-message ${m.seat === state?.you ? 'own' : ''}"><div class="chat-meta"><strong>${escape(m.name)}</strong><time>${new Date(m.sentAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</time></div><p>${escape(m.text)}</p></div>`).join('');
  } else messages.innerHTML = `<div class="chat-empty">${llama('#e8e0cd','#739083')}<p>${state?.players[1]?.bot ? 'Paco ist ganz konzentriert.' : 'Ein „Hallo“ gehört dazu.'}</p><span>${state?.players[1]?.bot ? 'Im Freundesduell könnt ihr hier<br/>miteinander schreiben.' : 'Hier ist Platz für eure Nachrichten,<br/>kleine Sticheleien und große Pläne.'}</span></div>`;
  if (atBottom) { messages.scrollTop = messages.scrollHeight; unread = 0; } else unread += added;
  $('new-messages').hidden = unread === 0;
  $('chat-count').textContent = state ? `${state.players.filter(p => p?.connected).length}/2 HIER` : 'CHAT';
}
$('new-messages').onclick = () => { $('messages').scrollTop = $('messages').scrollHeight; unread = 0; $('new-messages').hidden = true; };
function sendChat(text: string) {
  const cleaned = text.trim(); if (!cleaned) return;
  if (Array.from(cleaned).length > 300) { notify('Deine Nachricht darf höchstens 300 Zeichen enthalten.'); return; }
  const id = globalThis.crypto?.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (connection.send({ type: 'chat', requestId: id, text: cleaned })) {
    chatDrafts.set(id, cleaned);
    $<HTMLInputElement>('chat-input').value = ''; $('chat-length').textContent = '0/300';
  } else notify('Warte kurz, bis die Verbindung wieder da ist.');
}
$('chat-form').onsubmit = event => { event.preventDefault(); sendChat($<HTMLInputElement>('chat-input').value); };
$('chat-input').oninput = () => $('chat-length').textContent = `${Array.from($<HTMLInputElement>('chat-input').value).length}/300`;
document.querySelectorAll<HTMLButtonElement>('[data-quick]').forEach(b => b.onclick = () => sendChat(b.dataset.quick!));
document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey) return;
  const digit = event.code.match(/^Digit([1-5])$/)?.[1];
  if (digit) { event.preventDefault(); makeMove({ side: event.shiftKey ? 'left' : event.altKey ? 'right' : 'top', lane: Number(digit) - 1 }); }
});
renderBoard(demo.board); renderPlayers(); renderQueue(); renderHerd(); renderStatus();
const invited = roomCode(location.href);
if (invited) { $<HTMLInputElement>('room-input').value = invited; if (!connection.resume(invited)) { notify('Du bist eingeladen! Gib deinen Namen ein und tritt dem Raum bei.'); $<HTMLInputElement>('name').focus(); } }
