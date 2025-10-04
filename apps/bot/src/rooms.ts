import {
  GameState,
  PlayerId,
  Result,
  RoomId,
  createGame,
  joinGame,
  startGame,
} from '../../../packages/core/dist/index.js'

import { BotError } from './errors.js'

export interface RoomPlayer {
  id: PlayerId
  telegramId: number
  chatId: number
  displayName: string
  username?: string
}

export interface RoomData {
  id: RoomId
  hostId: PlayerId
  game: GameState
  players: Map<PlayerId, RoomPlayer>
}

export interface PlayerRoom {
  room: RoomData
  player: RoomPlayer
}

const ROOM_CODE_LENGTH = 5
const ROOM_SYMBOLS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const generateRoomId = (): RoomId => {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * ROOM_SYMBOLS.length)
    code += ROOM_SYMBOLS[index]
  }
  return code
}

const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) {
    throw new BotError(result.error.code, result.error.message)
  }
  return result.value
}

export class RoomManager {
  private readonly rooms = new Map<RoomId, RoomData>()

  private readonly playerToRoom = new Map<PlayerId, RoomId>()

  createRoom(player: RoomPlayer): RoomData {
    if (this.playerToRoom.has(player.id)) {
      throw new BotError('ALREADY_IN_ROOM', 'Вы уже находитесь в комнате.')
    }

    let roomId: RoomId = generateRoomId()
    while (this.rooms.has(roomId)) {
      roomId = generateRoomId()
    }

    const game = createGame(roomId, player.id)
    const room: RoomData = {
      id: roomId,
      hostId: player.id,
      game,
      players: new Map([[player.id, player]]),
    }

    this.rooms.set(roomId, room)
    this.playerToRoom.set(player.id, roomId)
    return room
  }

  joinRoom(roomId: RoomId, player: RoomPlayer): RoomData {
    if (this.playerToRoom.has(player.id)) {
      throw new BotError('ALREADY_IN_ROOM', 'Сначала покиньте текущую комнату командой /leave.')
    }

    const room = this.rooms.get(roomId)
    if (!room) {
      throw new BotError('ROOM_NOT_FOUND', 'Комната не найдена.')
    }

    unwrap(joinGame(room.game, player.id))
    room.players.set(player.id, player)
    this.playerToRoom.set(player.id, roomId)
    return room
  }

  startRoom(roomId: RoomId): RoomData {
    const room = this.rooms.get(roomId)
    if (!room) {
      throw new BotError('ROOM_NOT_FOUND', 'Комната не найдена.')
    }

    unwrap(startGame(room.game))
    return room
  }

  getRoom(roomId: RoomId): RoomData | undefined {
    return this.rooms.get(roomId)
  }

  getRoomByPlayer(playerId: PlayerId): PlayerRoom | undefined {
    const roomId = this.playerToRoom.get(playerId)
    if (!roomId) {
      return undefined
    }
    const room = this.rooms.get(roomId)
    if (!room) {
      this.playerToRoom.delete(playerId)
      return undefined
    }
    const player = room.players.get(playerId)
    if (!player) {
      this.playerToRoom.delete(playerId)
      return undefined
    }
    return { room, player }
  }

  leaveRoom(playerId: PlayerId): { room: RoomData; remaining: RoomPlayer[] } | undefined {
    const mapping = this.getRoomByPlayer(playerId)
    if (!mapping) {
      return undefined
    }

    const { room } = mapping
    room.players.delete(playerId)
    this.playerToRoom.delete(playerId)

    const remaining = Array.from(room.players.values())
    this.rooms.delete(room.id)
    return { room, remaining }
  }

  updatePlayerChat(playerId: PlayerId, chatId: number): void {
    const mapping = this.getRoomByPlayer(playerId)
    if (!mapping) {
      return
    }
    mapping.player.chatId = chatId
  }

  getOpponent(room: RoomData, playerId: PlayerId): RoomPlayer | undefined {
    return Array.from(room.players.values()).find((player) => player.id !== playerId)
  }

  listRooms(): RoomData[] {
    return Array.from(this.rooms.values())
  }
}
