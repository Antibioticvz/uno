# @uno/core — Игровое ядро UNO Lite

`@uno/core` содержит всю доменную логику UNO Lite в чистом TypeScript. Пакет не зависит от Telegram, UI и внешних стореджей, обеспечивая переиспользование в любом окружении.

## Возможности

- Генерация колоды UNO Lite (76 карт, 4 базовых цвета).
- Создание и управление состоянием партии: `createGame`, `joinGame`, `startGame`.
- Проверка ходов: `playCard`, `drawCard`, `passTurn`, `listPlayableCards`.
- Публичные и приватные проекции состояния (`getPublicState`, `getPlayerHand`).
- Reshuffle, объявление победителя, блокировка некорректных действий.

## Тестирование

Библиотека покрыта Vitest-тестами (11 сценариев), проверяющими ключевые ветки правил.

```bash
npm run test -w @uno/core
```

## Сборка

```bash
npm run build -w @uno/core
```

Команда генерирует `dist/` с JS и `.d.ts`, которые импортируются пакетом `@uno/bot` и веб-панелью.

## Использование

```ts
import { createGame, joinGame, startGame, playCard } from '@uno/core'

const game = createGame('ROOM-AAA')
joinGame(game, 'alice')
joinGame(game, 'bob')
startGame(game)
playCard(game, 'alice', 'card-123')
```

## Дизайн и принципы

- **Functional core, imperative shell:** чистые функции + явно возвращаемые `Result<T>`.
- **Type-first:** строгие типы карт, игроков, состояний; опции `noImplicitAny`, `exactOptionalPropertyTypes`.
- **Прозрачность:** отсутствуют побочные эффекты, всё состояние передаётся по ссылке в вызывающий слой.
