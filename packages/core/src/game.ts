import {
  Card,
  GameError,
  GameState,
  PlayerId,
  Result,
  RoomId
} from './types.js';
import { createDeck, drawTopCard, shuffle, RandomFn } from './deck.js';

const DEFAULT_RANDOM = Math.random;
const CARDS_PER_PLAYER = 7;

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const err = <T>(error: GameError): Result<T> => ({ ok: false, error });

const now = () => Date.now();

const findPlayerIndex = (state: GameState, playerId: PlayerId): number =>
  state.players.findIndex((player) => player.id === playerId);

const getNextPlayerId = (state: GameState, currentId: PlayerId): PlayerId => {
  const order = state.playerOrder;
  const idx = order.indexOf(currentId);
  if (idx === -1) {
    return currentId;
  }
  const nextIndex = (idx + 1) % order.length;
  return order[nextIndex];
};

const isCardPlayable = (card: Card, currentColor?: Card['color'], currentValue?: Card['value']) =>
  card.color === currentColor || card.value === currentValue;

const ensureActivePlayer = (state: GameState, playerId: PlayerId): Result<void> => {
  if (!state.turn || state.turn.activePlayerId !== playerId) {
    return err({ code: 'NOT_PLAYER_TURN', message: 'Сейчас ход другого игрока.' });
  }
  return ok(undefined);
};

const refreshTimestamp = (state: GameState): void => {
  state.updatedAt = now();
};

const replenishDrawPile = (
  state: GameState,
  random: RandomFn
): Result<void> => {
  const discardSize = state.discardPile.length;
  if (discardSize <= 1) {
    return err({ code: 'NO_CARDS_TO_DRAW', message: 'В колоде не осталось карт для добора.' });
  }

  const topCard = state.discardPile[discardSize - 1];
  const rest = state.discardPile.slice(0, discardSize - 1);
  state.drawPile = shuffle(rest, random);
  state.discardPile = [topCard];
  return ok(undefined);
};

export const createGame = (roomId: RoomId, hostId: PlayerId): GameState => ({
  roomId,
  phase: 'waiting-for-player',
  players: [
    {
      id: hostId,
      hand: []
    }
  ],
  playerOrder: [hostId],
  drawPile: [],
  discardPile: [],
  createdAt: now(),
  updatedAt: now()
});

export const joinGame = (state: GameState, playerId: PlayerId): Result<GameState> => {
  if (state.phase !== 'waiting-for-player' && state.phase !== 'ready-to-start') {
    return err({ code: 'GAME_ALREADY_STARTED', message: 'Партия уже запущена.' });
  }

  if (findPlayerIndex(state, playerId) !== -1) {
    return err({ code: 'PLAYER_ALREADY_JOINED', message: 'Игрок уже в комнате.' });
  }

  if (state.players.length >= 2) {
    return err({ code: 'ROOM_FULL', message: 'Комната рассчитана на двух игроков.' });
  }

  state.players.push({ id: playerId, hand: [] });
  state.playerOrder.push(playerId);
  state.phase = state.players.length === 2 ? 'ready-to-start' : 'waiting-for-player';
  refreshTimestamp(state);
  return ok(state);
};

export const startGame = (
  state: GameState,
  random: RandomFn = DEFAULT_RANDOM
): Result<GameState> => {
  if (state.players.length < 2) {
    return err({ code: 'NOT_ENOUGH_PLAYERS', message: 'Нужно два игрока для старта.' });
  }
  if (state.phase === 'in-progress' || state.phase === 'finished') {
    return err({ code: 'GAME_ALREADY_STARTED', message: 'Партия уже запущена.' });
  }

  const deck = shuffle(createDeck(), random);

  for (let i = 0; i < CARDS_PER_PLAYER; i += 1) {
    for (const playerId of state.playerOrder) {
      const card = drawTopCard(deck);
      if (!card) {
        return err({ code: 'DRAW_PILE_EMPTY', message: 'Не хватило карт для раздачи.' });
      }
      const playerIndex = findPlayerIndex(state, playerId);
      state.players[playerIndex]?.hand.push(card);
    }
  }

  const firstDiscard = drawTopCard(deck);
  if (!firstDiscard) {
    return err({ code: 'DRAW_PILE_EMPTY', message: 'В колоде нет карты для сброса.' });
  }

  state.drawPile = deck;
  state.discardPile = [firstDiscard];
  state.currentColor = firstDiscard.color;
  state.currentValue = firstDiscard.value;
  state.phase = 'in-progress';
  state.winnerId = undefined;
  state.turn = {
    activePlayerId: state.playerOrder[0],
    hasDrawnCard: false
  };
  refreshTimestamp(state);
  return ok(state);
};

export const listPlayableCards = (state: GameState, playerId: PlayerId): Result<Card[]> => {
  if (!state.currentColor || state.currentValue === undefined) {
    return err({ code: 'GAME_NOT_READY', message: 'Партия ещё не началась.' });
  }
  const playerIndex = findPlayerIndex(state, playerId);
  if (playerIndex === -1) {
    return err({ code: 'PLAYER_ALREADY_JOINED', message: 'Игрок отсутствует в комнате.' });
  }

  const playable = state.players[playerIndex]?.hand.filter((card) =>
    isCardPlayable(card, state.currentColor, state.currentValue)
  ) ?? [];

  return ok(playable);
};

const advanceTurn = (state: GameState): void => {
  if (!state.turn) {
    return;
  }
  const nextPlayer = getNextPlayerId(state, state.turn.activePlayerId);
  state.turn = {
    activePlayerId: nextPlayer,
    hasDrawnCard: false
  };
};

export const playCard = (
  state: GameState,
  playerId: PlayerId,
  cardId: string
): Result<GameState> => {
  if (state.phase !== 'in-progress') {
    return err({ code: 'GAME_NOT_READY', message: 'Партия ещё не запущена.' });
  }

  const turnCheck = ensureActivePlayer(state, playerId);
  if (!turnCheck.ok) {
    return turnCheck;
  }

  const playerIndex = findPlayerIndex(state, playerId);
  if (playerIndex === -1) {
    return err({ code: 'PLAYER_ALREADY_JOINED', message: 'Игрок отсутствует в комнате.' });
  }

  const player = state.players[playerIndex];
  const cardIndex = player.hand.findIndex((card) => card.id === cardId);
  if (cardIndex === -1) {
    return err({ code: 'CARD_NOT_FOUND', message: 'Такой карты нет в руке.' });
  }

  const card = player.hand[cardIndex];
  if (!isCardPlayable(card, state.currentColor, state.currentValue)) {
    return err({ code: 'CARD_NOT_PLAYABLE', message: 'Эту карту нельзя сыграть сейчас.' });
  }

  player.hand.splice(cardIndex, 1);
  state.discardPile.push(card);
  state.currentColor = card.color;
  state.currentValue = card.value;

  if (player.hand.length === 0) {
    state.phase = 'finished';
    state.winnerId = playerId;
    state.turn = undefined;
  } else {
    advanceTurn(state);
  }

  refreshTimestamp(state);
  return ok(state);
};

export interface DrawCardResult {
  state: GameState;
  card: Card;
  isPlayable: boolean;
}

export const drawCard = (
  state: GameState,
  playerId: PlayerId,
  random: RandomFn = DEFAULT_RANDOM
): Result<DrawCardResult> => {
  if (state.phase !== 'in-progress') {
    return err({ code: 'GAME_NOT_READY', message: 'Партия ещё не запущена.' });
  }

  const turnCheck = ensureActivePlayer(state, playerId);
  if (!turnCheck.ok) {
    return turnCheck;
  }

  if (!state.turn) {
    return err({ code: 'GAME_NOT_READY', message: 'Состояние хода не определено.' });
  }

  if (state.turn.hasDrawnCard) {
    return err({ code: 'ALREADY_DREW_CARD', message: 'За ход можно взять только одну карту.' });
  }

  const playableBefore = listPlayableCards(state, playerId);
  if (playableBefore.ok && playableBefore.value.length > 0) {
    return err({ code: 'MUST_DRAW_FIRST', message: 'Есть доступные ходы — сыграйте карту.' });
  }

  if (state.drawPile.length === 0) {
    const replenishResult = replenishDrawPile(state, random);
    if (!replenishResult.ok) {
      return replenishResult;
    }
  }

  const card = drawTopCard(state.drawPile);
  if (!card) {
    return err({ code: 'DRAW_PILE_EMPTY', message: 'Невозможно взять карту из колоды.' });
  }

  const playerIndex = findPlayerIndex(state, playerId);
  if (playerIndex === -1) {
    return err({ code: 'PLAYER_ALREADY_JOINED', message: 'Игрок отсутствует в комнате.' });
  }

  const player = state.players[playerIndex];
  player.hand.push(card);
  state.turn.hasDrawnCard = true;
  const playableAfterDraw = isCardPlayable(card, state.currentColor, state.currentValue);
  refreshTimestamp(state);
  return ok({ state, card, isPlayable: playableAfterDraw });
};

export const passTurn = (state: GameState, playerId: PlayerId): Result<GameState> => {
  if (state.phase !== 'in-progress') {
    return err({ code: 'GAME_NOT_READY', message: 'Партия ещё не запущена.' });
  }

  const turnCheck = ensureActivePlayer(state, playerId);
  if (!turnCheck.ok) {
    return turnCheck;
  }

  if (!state.turn?.hasDrawnCard) {
    return err({ code: 'MUST_DRAW_FIRST', message: 'Нужно взять карту прежде чем передать ход.' });
  }

  advanceTurn(state);
  refreshTimestamp(state);
  return ok(state);
};

export interface PublicPlayerState {
  id: PlayerId;
  cardsCount: number;
}

export interface PublicGameState {
  roomId: RoomId;
  phase: GameState['phase'];
  currentColor?: Card['color'];
  currentValue?: Card['value'];
  activePlayerId?: PlayerId;
  players: PublicPlayerState[];
  topDiscard?: Card;
  winnerId?: PlayerId;
}

export const getPublicState = (state: GameState): PublicGameState => ({
  roomId: state.roomId,
  phase: state.phase,
  currentColor: state.currentColor,
  currentValue: state.currentValue,
  activePlayerId: state.turn?.activePlayerId,
  players: state.players.map((player) => ({
    id: player.id,
    cardsCount: player.hand.length
  })),
  topDiscard: state.discardPile[state.discardPile.length - 1],
  winnerId: state.winnerId
});

export const getPlayerHand = (
  state: GameState,
  playerId: PlayerId
): Result<Card[]> => {
  const playerIndex = findPlayerIndex(state, playerId);
  if (playerIndex === -1) {
    return err({ code: 'PLAYER_ALREADY_JOINED', message: 'Игрок отсутствует в комнате.' });
  }
  return ok(state.players[playerIndex]?.hand ?? []);
};