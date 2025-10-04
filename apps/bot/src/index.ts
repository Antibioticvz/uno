import { Bot, Context, GrammyError, HttpError, InlineKeyboard } from 'grammy'

import {
  GameState,
  PlayerId,
  Result,
  drawCard,
  getPlayerHand,
  listPlayableCards,
  passTurn,
  playCard,
} from '@uno/core'

import { loadConfig } from './config.js'
import { BotError, isBotError } from './errors.js'
import { formatCard, formatHand, formatPlayerLabel, formatPublicState } from './render.js'
import { RoomManager, RoomPlayer } from './rooms.js'

const config = loadConfig()

// Validate BOT_TOKEN format
if (!config.BOT_TOKEN || config.BOT_TOKEN.length < 20) {
  console.error('ОШИБКА: BOT_TOKEN недействителен или не установлен!')
  console.error('Длина токена:', config.BOT_TOKEN?.length ?? 0)
  console.error('Первые символы:', config.BOT_TOKEN?.substring(0, 10) ?? 'N/A')
  process.exit(1)
}

console.log('BOT_TOKEN загружен, длина:', config.BOT_TOKEN.length)

const bot = new Bot(config.BOT_TOKEN)
const rooms = new RoomManager()

const getPlayerId = (id: number): PlayerId => id.toString()

const buildRoomPlayer = (ctx: Context): RoomPlayer => {
  const from = ctx.from
  const chat = ctx.chat
  if (!from || !chat) {
    throw new BotError('NO_CONTEXT', 'Недостаточно данных о пользователе.')
  }

  return {
    id: getPlayerId(from.id),
    telegramId: from.id,
    chatId: chat.id,
    displayName: from.first_name ?? 'Игрок',
    username: from.username ?? undefined,
  }
}

const unwrapResult = <T>(result: Result<T>): T => {
  if (!result.ok) {
    throw new BotError(result.error.code, result.error.message)
  }
  return result.value
}

const broadcast = async (roomPlayers: RoomPlayer[], message: string): Promise<void> => {
  await Promise.all(roomPlayers.map((player) => bot.api.sendMessage(player.chatId, message)))
}

const sendHand = async (player: RoomPlayer, game: GameState): Promise<void> => {
  const hand = unwrapResult(getPlayerHand(game, player.id))
  await bot.api.sendMessage(player.chatId, `Ваши карты:\n${formatHand(hand)}`)
}

const refreshHandForAll = async (roomPlayers: RoomPlayer[], game: GameState): Promise<void> => {
  await Promise.all(roomPlayers.map((player) => sendHand(player, game)))
}

const postPublicState = async (roomPlayers: RoomPlayer[], roomState: GameState): Promise<void> => {
  const message = formatPublicState(roomState.roomId, roomState, roomPlayers)
  await broadcast(roomPlayers, message)
}

const buildActionKeyboard = (game: GameState, playerId: PlayerId): InlineKeyboard => {
  const keyboard = new InlineKeyboard()
  const playable = listPlayableCards(game, playerId)
  if (playable.ok && playable.value.length > 0) {
    playable.value.forEach((card) => {
      keyboard.text(`Играть ${formatCard(card)}`, `play:${card.id}`).row()
    })
  }

  if (!game.turn?.hasDrawnCard) {
    keyboard.text('Взять карту', 'draw')
  }

  if (game.turn?.hasDrawnCard) {
    if (keyboard.inline_keyboard.length > 0) {
      keyboard.row()
    }
    keyboard.text('Пас', 'pass')
  }

  return keyboard
}

const promptActivePlayer = async (roomPlayers: RoomPlayer[], game: GameState): Promise<void> => {
  const activeId = game.turn?.activePlayerId
  if (!activeId) {
    return
  }
  const activePlayer = roomPlayers.find((player) => player.id === activeId)
  if (!activePlayer) {
    return
  }

  const keyboard = buildActionKeyboard(game, activeId)
  const hand = unwrapResult(getPlayerHand(game, activeId))
  const playable = listPlayableCards(game, activeId)
  const playableLine =
    playable.ok && playable.value.length > 0
      ? `Доступные ходы: ${playable.value.map((card) => formatCard(card)).join(', ')}`
      : 'Нет подходящих карт — возьмите из колоды.'

  await bot.api.sendMessage(activePlayer.chatId, `Ваш ход!\n${playableLine}`, {
    reply_markup: keyboard,
  })

  await bot.api.sendMessage(activePlayer.chatId, `Актуальная рука:\n${formatHand(hand)}`)
}

bot.command('start', async (ctx) => {
  await ctx.reply(
    'UNO Lite — минималистичная двухпользовательская версия игры UNO.\n' +
      'Создайте комнату командой /create и пригласите друга /join <код>.',
  )
})

bot.command('help', async (ctx) => {
  await ctx.reply(
    [
      'Команды:',
      '/create — создать новую комнату',
      '/join <код> — присоединиться ко второй позиции',
      '/hand — показать вашу текущую руку',
      '/state — показать публичное состояние стола',
      '/leave — покинуть комнату',
    ].join('\n'),
  )
})

bot.command('create', async (ctx) => {
  try {
    const player = buildRoomPlayer(ctx)
    const room = rooms.createRoom(player)
    await ctx.reply(
      [
        `Комната создана: ${room.id}.`,
        'Передайте другу команду `/join ' + room.id + '`.',
        'Ожидаем подключения второго игрока.',
      ].join('\n'),
      { parse_mode: 'Markdown' },
    )
  } catch (error) {
    if (isBotError(error)) {
      await ctx.reply(error.message)
      return
    }
    throw error
  }
})

bot.command('join', async (ctx) => {
  const match = ctx.match
  const rawCode =
    typeof match === 'string' ? match : Array.isArray(match) ? (match[1] ?? match[0]) : undefined
  const roomCode = rawCode?.trim().toUpperCase()
  if (!roomCode) {
    await ctx.reply('Укажите код комнаты: /join ABCDE')
    return
  }

  try {
    const player = buildRoomPlayer(ctx)
    const room = rooms.joinRoom(roomCode, player)
    const players = Array.from(room.players.values())
    await ctx.reply('Вы успешно присоединились! Раздаю карты...')

    rooms.startRoom(roomCode)

    await refreshHandForAll(players, room.game)
    await postPublicState(players, room.game)
    await promptActivePlayer(players, room.game)
  } catch (error) {
    if (isBotError(error)) {
      await ctx.reply(error.message)
      return
    }
    throw error
  }
})

bot.command('hand', async (ctx) => {
  try {
    const player = buildRoomPlayer(ctx)
    const mapping = rooms.getRoomByPlayer(player.id)
    if (!mapping) {
      await ctx.reply('Вы не находитесь в комнате.')
      return
    }

    rooms.updatePlayerChat(player.id, player.chatId)
    await sendHand(mapping.player, mapping.room.game)
  } catch (error) {
    if (isBotError(error)) {
      await ctx.reply(error.message)
      return
    }
    throw error
  }
})

bot.command('state', async (ctx) => {
  try {
    const player = buildRoomPlayer(ctx)
    const mapping = rooms.getRoomByPlayer(player.id)
    if (!mapping) {
      await ctx.reply('Вы не находитесь в комнате.')
      return
    }

    const players = Array.from(mapping.room.players.values())
    rooms.updatePlayerChat(player.id, player.chatId)
    await postPublicState(players, mapping.room.game)
  } catch (error) {
    if (isBotError(error)) {
      await ctx.reply(error.message)
      return
    }
    throw error
  }
})

bot.command('leave', async (ctx) => {
  try {
    const player = buildRoomPlayer(ctx)
    const result = rooms.leaveRoom(player.id)
    if (!result) {
      await ctx.reply('Вы не в комнате.')
      return
    }

    await ctx.reply('Вы покинули комнату.')
    if (result.remaining.length > 0) {
      await Promise.all(
        result.remaining.map((other) =>
          bot.api.sendMessage(other.chatId, 'Ваш соперник покинул комнату — партия завершена.'),
        ),
      )
    }
  } catch (error) {
    if (isBotError(error)) {
      await ctx.reply(error.message)
      return
    }
    throw error
  }
})

const handlePlay = async (player: RoomPlayer, cardId: string): Promise<void> => {
  const mapping = rooms.getRoomByPlayer(player.id)
  if (!mapping) {
    throw new BotError('ROOM_NOT_FOUND', 'Вы не находитесь в комнате.')
  }

  const room = mapping.room
  const storedPlayer = mapping.player
  const players = Array.from(room.players.values())
  const result = playCard(room.game, player.id, cardId)
  if (!result.ok) {
    throw new BotError(result.error.code, result.error.message)
  }

  await Promise.all([postPublicState(players, room.game), sendHand(storedPlayer, room.game)])

  if (room.game.phase === 'finished' && room.game.winnerId) {
    const winner = room.players.get(room.game.winnerId)
    const label = winner ? formatPlayerLabel(winner) : room.game.winnerId
    await Promise.all(
      players.map((p) => bot.api.sendMessage(p.chatId, `Партия завершена. Победитель — ${label}!`)),
    )
    return
  }

  await promptActivePlayer(players, room.game)
}

const handleDraw = async (player: RoomPlayer): Promise<void> => {
  const mapping = rooms.getRoomByPlayer(player.id)
  if (!mapping) {
    throw new BotError('ROOM_NOT_FOUND', 'Вы не находитесь в комнате.')
  }
  const room = mapping.room
  const storedPlayer = mapping.player
  const players = Array.from(room.players.values())

  const drawResult = drawCard(room.game, player.id)
  if (!drawResult.ok) {
    throw new BotError(drawResult.error.code, drawResult.error.message)
  }

  await sendHand(storedPlayer, room.game)
  const drawnCard = drawResult.value.card
  const playable = drawResult.value.isPlayable
    ? `Карта ${formatCard(drawnCard)} подходит — можно сыграть.`
    : `Карта ${formatCard(drawnCard)} не подходит.`
  await bot.api.sendMessage(storedPlayer.chatId, playable)

  await postPublicState(players, room.game)
  await promptActivePlayer(players, room.game)
}

const handlePass = async (player: RoomPlayer): Promise<void> => {
  const mapping = rooms.getRoomByPlayer(player.id)
  if (!mapping) {
    throw new BotError('ROOM_NOT_FOUND', 'Вы не находитесь в комнате.')
  }
  const room = mapping.room
  const players = Array.from(room.players.values())
  const passResult = passTurn(room.game, player.id)
  if (!passResult.ok) {
    throw new BotError(passResult.error.code, passResult.error.message)
  }

  await postPublicState(players, room.game)
  await promptActivePlayer(players, room.game)
}

bot.on('callback_query:data', async (ctx) => {
  try {
    const from = ctx.from
    const player: RoomPlayer = {
      id: getPlayerId(from.id),
      telegramId: from.id,
      chatId: ctx.chat?.id ?? from.id,
      displayName: from.first_name ?? 'Игрок',
      username: from.username ?? undefined,
    }
    if (ctx.chat) {
      rooms.updatePlayerChat(player.id, ctx.chat.id)
    }

    const data = ctx.callbackQuery.data
    if (data.startsWith('play:')) {
      const cardId = data.slice(5)
      await handlePlay(player, cardId)
      await ctx.answerCallbackQuery({ text: 'Карта сыграна.' })
      return
    }
    if (data === 'draw') {
      await handleDraw(player)
      await ctx.answerCallbackQuery({ text: 'Вы взяли карту.' })
      return
    }
    if (data === 'pass') {
      await handlePass(player)
      await ctx.answerCallbackQuery({ text: 'Ход передан.' })
      return
    }

    await ctx.answerCallbackQuery({ text: 'Неизвестное действие.' })
  } catch (error) {
    if (isBotError(error)) {
      await ctx.answerCallbackQuery({ text: error.message, show_alert: true })
      return
    }
    throw error
  }
})

bot.catch((error) => {
  const ctx = error.ctx
  console.error(`Ошибка при обработке обновления ${ctx.update.update_id}:`, error.error)
  if (error.error instanceof GrammyError) {
    console.error('Ошибка Telegram:', error.error.description)
  } else if (error.error instanceof HttpError) {
    console.error('Ошибка сети:', error.error)
  }
})

console.log('Запуск UNO Lite бота...')

// Start bot with manual initialization to skip webhook deletion errors
;(async () => {
  // First, try to remove webhook (ignore errors if it doesn't exist)
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true })
  } catch {
    // Silently ignore - webhook might not exist
  }

  // Initialize bot info
  await bot.init()

  console.log('UNO Lite бот запущен и принимает сообщения!')

  // Start polling manually (this keeps the process alive)
  await bot.start()
})()
