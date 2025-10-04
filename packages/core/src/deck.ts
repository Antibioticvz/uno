import { Card, UNO_COLORS, UNO_VALUES } from './types.js';

export type RandomFn = () => number;

const DEFAULT_RANDOM: RandomFn = () => Math.random();

export const createDeck = (): Card[] => {
  const cards: Card[] = [];
  let idCounter = 0;

  for (const color of UNO_COLORS) {
    cards.push({ id: `card-${idCounter++}`, color, value: 0 });

    for (const value of UNO_VALUES) {
      if (value === 0) {
        continue;
      }

      cards.push({ id: `card-${idCounter++}`, color, value });
      cards.push({ id: `card-${idCounter++}`, color, value });
    }
  }

  return cards;
};

export const shuffle = <T>(items: T[], random: RandomFn = DEFAULT_RANDOM): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const drawTopCard = <T>(items: T[]): T | undefined => items.pop();