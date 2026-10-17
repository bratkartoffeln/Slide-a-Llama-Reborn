import { follower } from './art';
import type { Seat } from '../shared/game';

const escape = (text: string) => text.replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[value]!));

/** Keep absolute team colours and moods identical for both viewers, like RPS. */
export function resultScene(winner: Seat, names: [string, string]): string {
  return `<div class="endgame-scene" data-winner="${winner}">
    <div class="result-confetti" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--i:${i};--confetti-color:${['#8fce42', '#f5cf36', '#f45a8b', '#588edb'][i % 4]}"></i>`).join('')}</div>
    ${([0, 1] as const).map(team => `<figure class="endgame-team" data-team="${team}" data-mood="${team === winner ? 'happy' : 'sad'}">
      <div class="endgame-herd" role="img" aria-label="${team === winner ? 'Jubelnde Lamas' : 'Enttäuschte Lamas'}">
        ${[0, 1, 2].map(i => `<span class="endgame-llama" style="--i:${i}" aria-hidden="true"><span class="result-actor">${follower(team, team === winner ? 'happy' : 'sad')}</span></span>`).join('')}
      </div><figcaption>${escape(names[team])}<small>${team === winner ? 'SIEGERTEAM' : 'REVANCHE?'}</small></figcaption>
    </figure>`).join('')}
  </div>`;
}
