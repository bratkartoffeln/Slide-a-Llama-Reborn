import type { Tile } from '../shared/game';

const variants = (symbol: string, count: number) => Array.from({ length: count }, (_, i) => `/audio/original/${symbol}-${i}.mp3`);
// Original Flash: winningHand.used[0].num - 1 selects the fruit sound group.
// Modern symbols share their retro counterparts' groups; scoring is unchanged.
export const MATCH_SOUNDS: Record<Tile, readonly string[]> = {
  bell: variants('fruit1', 5), lemon: variants('fruit2', 15), grape: variants('fruit3', 6),
  melon: variants('fruit4', 9), cherry: variants('fruit5', 7), seven: variants('fruit7', 3)
};
export const LAMA_SOUNDS = {
  happy: Array.from({ length: 7 }, (_, i) => `/audio/original/transhappy${i + 1}.mp3`),
  angry: Array.from({ length: 3 }, (_, i) => `/audio/original/transpissed${i + 1}.mp3`)
} as const;
export const COMBO_SOUND = '/audio/retro-combo.mp3';
export const ORIGINAL_SOUND_FILES = [...Object.values(MATCH_SOUNDS).flat(), ...LAMA_SOUNDS.happy, ...LAMA_SOUNDS.angry, COMBO_SOUND];
