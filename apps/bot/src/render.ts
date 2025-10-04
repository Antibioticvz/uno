import {
  Card,
  GameState,
  PublicGameState,
  PublicPlayerState,
  UnoColor,
  getPublicState,
} from '../../../packages/core/dist/index.js'

import { RoomPlayer } from './rooms.js'

const COLOR_EMOJI: Record<UnoColor, string> = {
  red: '🔴',
  green: '🟢',
  blue: '🔵',
  yellow: '🟡',
}

export const formatCard = (card: Card): string => `${COLOR_EMOJI[card.color]}${card.value}`

export const formatHand = (hand: Card[]): string => {
  if (hand.length === 0) {
    return 'У вас нет карт.'
  }
  return hand.map((card, index) => `${index + 1}. ${formatCard(card)} · id=${card.id}`).join('\n')
}

export const formatPublicState = (
  roomId: string,
  game: GameState,
  players: RoomPlayer[],
): string => {
  const publicState: PublicGameState = getPublicState(game)
  const lines: string[] = []

  lines.push(`Комната ${roomId}`)
  if (publicState.topDiscard) {
    lines.push(`Верхняя карта: ${formatCard(publicState.topDiscard)}`)
  }
  if (publicState.phase === 'finished' && publicState.winnerId) {
    const winner = players.find((player) => player.id === publicState.winnerId)
    lines.push(`🏆 Победитель: ${winner?.displayName ?? publicState.winnerId}`)
  } else {
    const active = publicState.activePlayerId
      ? (players.find((player) => player.id === publicState.activePlayerId)?.displayName ??
        publicState.activePlayerId)
      : '—'
    lines.push(`Ходит: ${active}`)
  }

  lines.push('Карты в руках:')
  publicState.players.forEach((playerState: PublicPlayerState) => {
    const info = players.find((player) => player.id === playerState.id)
    lines.push(`• ${info?.displayName ?? playerState.id} — ${playerState.cardsCount}`)
  })

  return lines.join('\n')
}

export const formatPlayerLabel = (player: RoomPlayer): string =>
  player.username ? `@${player.username}` : player.displayName
