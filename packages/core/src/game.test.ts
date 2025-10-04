import { describe, expect, it } from 'vitest'

import {
  createGame,
  drawCard,
  getPlayerHand,
  getPublicState,
  joinGame,
  listPlayableCards,
  passTurn,
  playCard,
  startGame,
} from './game.js'
import { Card, GameState } from './types.js'

const createStartedState = (): GameState => {
  const baseTimestamp = 1_000
  const game: GameState = {
    roomId: 'room-1',
    phase: 'in-progress',
    players: [
      { id: 'alice', hand: [] },
      { id: 'bob', hand: [] },
    ],
    playerOrder: ['alice', 'bob'],
    drawPile: [],
    discardPile: [],
    currentColor: 'red',
    currentValue: 5,
    turn: {
      activePlayerId: 'alice',
      hasDrawnCard: false,
    },
    winnerId: undefined,
    createdAt: baseTimestamp,
    updatedAt: baseTimestamp,
  }

  const aliceHand: Card[] = [
    { id: 'a-1', color: 'red', value: 3 },
    { id: 'a-2', color: 'green', value: 1 },
  ]
  const bobHand: Card[] = [{ id: 'b-1', color: 'yellow', value: 9 }]
  game.players[0].hand = aliceHand
  game.players[1].hand = bobHand
  game.discardPile = [
    { id: 'd-aux-1', color: 'yellow', value: 8 },
    { id: 'd-aux-2', color: 'blue', value: 2 },
    { id: 'd-1', color: 'red', value: 5 },
  ]
  game.drawPile = [
    { id: 'deck-1', color: 'blue', value: 5 },
    { id: 'deck-2', color: 'red', value: 7 },
  ]
  return game
}

describe('createGame / joinGame / startGame', () => {
  it('initializes state and handles join/start flow', () => {
    const game = createGame('room-1', 'alice')
    expect(game.phase).toBe('waiting-for-player')
    expect(game.players).toHaveLength(1)
    expect(game.playerOrder).toEqual(['alice'])

    const joinResult = joinGame(game, 'bob')
    expect(joinResult.ok).toBe(true)
    expect(game.players).toHaveLength(2)
    expect(game.phase).toBe('ready-to-start')

    const startResult = startGame(game, () => 0)
    expect(startResult.ok).toBe(true)
    if (!startResult.ok) {
      return
    }

    expect(game.phase).toBe('in-progress')
    expect(game.players[0].hand).toHaveLength(7)
    expect(game.players[1].hand).toHaveLength(7)
    expect(game.discardPile).toHaveLength(1)
    expect(game.drawPile.length).toBe(76 - 14 - 1)
    expect(game.turn?.activePlayerId).toBe('alice')
  })
})

describe('playCard', () => {
  it('allows playing a matching card and advances turn', () => {
    const game = createStartedState()
    const result = playCard(game, 'alice', 'a-1')
    expect(result.ok).toBe(true)
    expect(game.discardPile[game.discardPile.length - 1].id).toBe('a-1')
    expect(game.turn?.activePlayerId).toBe('bob')
    expect(game.players[0].hand).toHaveLength(1)
  })

  it('rejects playing a non-matching card', () => {
    const game = createStartedState()
    const result = playCard(game, 'alice', 'a-2')
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error.code).toBe('CARD_NOT_PLAYABLE')
  })

  it('declares winner when player discards last card', () => {
    const game = createStartedState()
    game.players[0].hand = [{ id: 'a-1', color: 'red', value: 3 }]
    const result = playCard(game, 'alice', 'a-1')
    expect(result.ok).toBe(true)
    expect(game.phase).toBe('finished')
    expect(game.winnerId).toBe('alice')
    expect(game.turn).toBeUndefined()
  })
})

describe('drawCard & passTurn', () => {
  it('prevents drawing when a card is playable', () => {
    const game = createStartedState()
    const result = drawCard(game, 'alice')
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error.code).toBe('MUST_DRAW_FIRST')
  })

  it('allows drawing when no playable cards remain', () => {
    const game = createStartedState()
    game.players[0].hand = [{ id: 'a-2', color: 'green', value: 1 }]
    const result = drawCard(game, 'alice', () => 0)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(game.turn?.hasDrawnCard).toBe(true)
    expect(result.value.card).toBeDefined()
    expect(game.players[0].hand).toHaveLength(2)
  })

  it('reshuffles discard pile when draw pile is empty', () => {
    const game = createStartedState()
    game.players[0].hand = [{ id: 'a-2', color: 'green', value: 1 }]
    game.drawPile = []
    game.discardPile = [
      { id: 'rest-1', color: 'yellow', value: 8 },
      { id: 'rest-2', color: 'blue', value: 2 },
      { id: 'top', color: 'red', value: 5 },
    ]

    const result = drawCard(game, 'alice', () => 0.5)
    expect(result.ok).toBe(true)
    expect(game.drawPile.length).toBe(1)
    expect(game.discardPile[game.discardPile.length - 1].id).toBe('top')
  })

  it('requires drawing before passing turn', () => {
    const game = createStartedState()
    const result = passTurn(game, 'alice')
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error.code).toBe('MUST_DRAW_FIRST')
  })

  it('passes turn after drawing', () => {
    const game = createStartedState()
    game.players[0].hand = [{ id: 'a-2', color: 'green', value: 1 }]
    const drawResult = drawCard(game, 'alice')
    expect(drawResult.ok).toBe(true)

    const passResult = passTurn(game, 'alice')
    expect(passResult.ok).toBe(true)
    expect(game.turn?.activePlayerId).toBe('bob')
    expect(game.turn?.hasDrawnCard).toBe(false)
  })
})

describe('state projections', () => {
  it('lists playable cards correctly', () => {
    const game = createStartedState()
    const playable = listPlayableCards(game, 'alice')
    expect(playable.ok).toBe(true)
    if (!playable.ok) {
      return
    }
    expect(playable.value.map((card) => card.id)).toContain('a-1')
  })

  it('provides player hand and public state views', () => {
    const game = createStartedState()
    const hand = getPlayerHand(game, 'alice')
    expect(hand.ok).toBe(true)
    if (!hand.ok) {
      return
    }
    expect(hand.value).toHaveLength(2)

    const publicState = getPublicState(game)
    expect(publicState.players).toEqual([
      { id: 'alice', cardsCount: 2 },
      { id: 'bob', cardsCount: 1 },
    ])
    expect(publicState.topDiscard?.id).toBe('d-1')
  })
})
