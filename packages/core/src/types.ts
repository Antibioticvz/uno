export type UnoColor = 'red' | 'green' | 'blue' | 'yellow'

export const UNO_COLORS: readonly UnoColor[] = ['red', 'green', 'blue', 'yellow']

export type UnoValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const UNO_VALUES: readonly UnoValue[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

export interface Card {
  id: string
  color: UnoColor
  value: UnoValue
}

export type PlayerId = string
export type RoomId = string

export type GamePhase = 'waiting-for-player' | 'ready-to-start' | 'in-progress' | 'finished'

export interface PlayerState {
  id: PlayerId
  hand: Card[]
}

export interface TurnState {
  activePlayerId: PlayerId
  hasDrawnCard: boolean
}

export interface GameState {
  roomId: RoomId
  phase: GamePhase
  players: PlayerState[]
  playerOrder: PlayerId[]
  drawPile: Card[]
  discardPile: Card[]
  currentColor?: UnoColor
  currentValue?: UnoValue
  winnerId?: PlayerId
  turn?: TurnState
  createdAt: number
  updatedAt: number
}

export type GameErrorCode =
  | 'GAME_NOT_READY'
  | 'GAME_ALREADY_STARTED'
  | 'PLAYER_ALREADY_JOINED'
  | 'ROOM_FULL'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_PLAYER_TURN'
  | 'INVALID_CARD'
  | 'CARD_NOT_PLAYABLE'
  | 'CARD_NOT_FOUND'
  | 'MUST_DRAW_FIRST'
  | 'ALREADY_DREW_CARD'
  | 'NO_PLAYABLE_CARDS'
  | 'DRAW_PILE_EMPTY'
  | 'NO_CARDS_TO_DRAW'

export interface GameError {
  code: GameErrorCode
  message: string
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: GameError }
