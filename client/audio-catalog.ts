import type { Tile } from '../shared/game';

const variants = (symbol: string, count: number) => Array.from({ length: count }, (_, i) => `/audio/original/${symbol}-${i}.mp3`);
// Original Flash: winningHand.used[0].num - 1 selects the fruit sound group.
// Modern symbols share their retro counterparts' groups; scoring is unchanged.
export const MATCH_SOUNDS: Record<Tile, readonly string[]> = {
  bell: variants('fruit1', 5), lemon: variants('fruit2', 15), grape: variants('fruit3', 6),
  melon: variants('fruit4', 9), cherry: variants('fruit5', 7), seven: variants('fruit7', 3), bar: variants('fruit6', 4)
};
export const LAMA_SOUNDS = {
  happy: Array.from({ length: 7 }, (_, i) => `/audio/original/transhappy${i + 1}.mp3`),
  angry: Array.from({ length: 3 }, (_, i) => `/audio/original/transpissed${i + 1}.mp3`)
} as const;
export const COMBO_SOUND = '/audio/retro-combo.mp3';
export const IDLE_LAMA_SOUNDS = Array.from({ length: 9 }, (_, i) => `/audio/original/lama-idle-${i + 1}.mp3`);
export const MUSIC_SOUND = '/audio/original/background-music.mp3';
export const THUNDER_SOUND = '/audio/original/match-thunder.wav';
export const RESULT_SOUNDS = { won: '/audio/original/lama-victory.mp3', lost: '/audio/original/lama-defeat.mp3' } as const;
export const STONE_SOUNDS = {
  slide: '/audio/original/stone-slide.mp3', drop: '/audio/reference/stone-drop-original.mp3',
  squeeze: '/audio/original/stone-squeeze.mp3', burst: '/audio/original/stone-burst.mp3',
  shatter: '/audio/original/stone-shatter.mp3', settle: '/audio/original/stones-settle.mp3'
} as const;
export const ORIGINAL_SOUND_FILES = [...Object.values(MATCH_SOUNDS).flat(), ...LAMA_SOUNDS.happy, ...LAMA_SOUNDS.angry, COMBO_SOUND, ...Object.values(STONE_SOUNDS), ...IDLE_LAMA_SOUNDS, THUNDER_SOUND, ...Object.values(RESULT_SOUNDS)];
export const CHAT_SOUND = '/audio/icq-uh-oh.mp3';
export const START_SOUND = '/audio/temple-start.wav';
export const SOUND_FILES = [...ORIGINAL_SOUND_FILES, CHAT_SOUND, MUSIC_SOUND, START_SOUND];
