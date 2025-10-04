import { ExternalLink, GamepadIcon, MessageCircle, ServerIcon, Zap } from 'lucide-react'
import { useMemo, type FC } from 'react'

import {
  GameState,
  Result,
  UnoColor,
  createGame,
  getPublicState,
  joinGame,
  startGame,
} from '@uno/core'
import { Button } from './components/ui/button.js'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card.js'
import { ScrollArea } from './components/ui/scroll-area.js'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs.js'

const COLORS: Record<UnoColor, string> = {
  red: '🔴',
  green: '🟢',
  blue: '🔵',
  yellow: '🟡',
}

const unwrap = <T,>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(result.error.message)
  }
  return result.value
}

const createDemoState = (): GameState => {
  const game = createGame('DEMO1', 'alice')
  unwrap(joinGame(game, 'bob'))
  unwrap(startGame(game, () => 0.42))
  game.players[0].hand = game.players[0].hand.slice(0, 5)
  game.players[1].hand = game.players[1].hand.slice(0, 5)
  return game
}

const formatCard = (color: UnoColor, value: number): string => `${COLORS[color]}${value}`

const CommandRow: FC<{ command: string; description: string }> = ({ command, description }) => (
  <div className="flex flex-col gap-1 rounded-lg border border-border bg-card/60 p-4">
    <code className="font-mono text-sm text-primary">{command}</code>
    <span className="text-sm text-muted-foreground">{description}</span>
  </div>
)

const rules = [
  'Колода: 76 карт (0 по одной, 1-9 по две каждого цвета).',
  'Раздача: по 7 карт игрокам, первая карта — в сброс и задаёт цвет/номинал.',
  'Ход: сыграть карту того же цвета или номинала, либо взять одну карту.',
  'После взятия карты можно сразу сыграть её, если подходит, иначе пас.',
  'Побеждает игрок, избавившийся от всех карт.',
  'Если колода кончилась — тасуем сброс (кроме верхней карты).',
]

const architectureCards = [
  {
    title: 'Игровое ядро',
    description:
      'Чистые функции с типами TypeScript. Генерация колоды, валидация ходов, публичные представления.',
    icon: <GamepadIcon className="h-5 w-5 text-primary" />,
  },
  {
    title: 'Telegram-бот',
    description:
      'grammY + inline-кнопки. Управление комнатой, очередностью ходов, рассылка состояния и рук.',
    icon: <MessageCircle className="h-5 w-5 text-primary" />,
  },
  {
    title: 'Web-панель',
    description:
      'Vite + React + Tailwind + shadcn/ui. Документация и демонстрация состояния партии.',
    icon: <ServerIcon className="h-5 w-5 text-primary" />,
  },
]

const App: FC = () => {
  const demoState = useMemo(createDemoState, [])
  const publicState = useMemo(() => getPublicState(demoState), [demoState])

  const cardGroups = demoState.players.map((player) => ({
    playerId: player.id,
    cards: player.hand.map((card) => formatCard(card.color, card.value)),
    count: player.hand.length,
  }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <header className="border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
              UNO Lite
            </span>
            <h1 className="text-3xl font-bold sm:text-4xl">
              Минимальная мультиплеерная UNO для Telegram
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              Двухпользовательский Telegram-бот с игровым ядром на TypeScript и web-панелью. Код
              написан по принципам KISS, DRY и SOLID, без использования <code>any</code>.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a
                  href="https://t.me"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Запустить бота
                </a>
              </Button>
              <Button variant="secondary" asChild>
                <a
                  href="https://github.com/Antibioticvz/uno"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Репозиторий
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-12">
        <section className="grid gap-6 sm:grid-cols-3">
          {architectureCards.map((card) => (
            <Card key={card.title} className="border-border/70 bg-white/80">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  {card.icon}
                </div>
                <div>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </section>

        <Tabs defaultValue="commands" className="w-full">
          <TabsList>
            <TabsTrigger value="commands">Команды</TabsTrigger>
            <TabsTrigger value="rules">Правила</TabsTrigger>
            <TabsTrigger value="demo">Демо-стол</TabsTrigger>
          </TabsList>
          <TabsContent value="commands">
            <ScrollArea className="h-72 rounded-lg border border-border/70 bg-white/80 p-6">
              <div className="grid gap-4">
                <CommandRow
                  command="/create"
                  description="Создать новую комнату и получить код приглашения."
                />
                <CommandRow
                  command="/join <код>"
                  description="Подключиться ко второй позиции с использованием кода комнаты."
                />
                <CommandRow
                  command="/hand"
                  description="Отобразить вашу текущую руку (приватно)."
                />
                <CommandRow
                  command="/play <id>"
                  description="Сыграть карту по идентификатору — доступен также выбор через кнопки."
                />
                <CommandRow
                  command="/draw"
                  description="Взять одну карту из колоды, если нет подходящей."
                />
                <CommandRow command="/pass" description="Передать ход после взятия карты." />
                <CommandRow command="/state" description="Показать публичное состояние стола." />
                <CommandRow
                  command="/leave"
                  description="Покинуть комнату и завершить текущую партию."
                />
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="rules">
            <Card className="border-border/70 bg-white/80">
              <CardHeader>
                <CardTitle>UNO Lite — базовые правила</CardTitle>
                <CardDescription>
                  Сокращённая версия оригинальной UNO, оптимизированная под чат-бота.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                  {rules.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 flex-none rounded-full bg-primary" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="demo">
            <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
              <Card className="border-border/70 bg-white/90">
                <CardHeader>
                  <CardTitle>Стол DEMO1</CardTitle>
                  {publicState.topDiscard ? (
                    <CardDescription>
                      Верхняя карта:{' '}
                      {formatCard(publicState.topDiscard.color, publicState.topDiscard.value)} ·
                      Ходит: {publicState.activePlayerId}
                    </CardDescription>
                  ) : (
                    <CardDescription>Партия готовится к старту.</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="grid gap-4">
                  {cardGroups.map((group) => (
                    <div
                      key={group.playerId}
                      className="rounded-lg border border-border/60 bg-muted/40 p-4"
                    >
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>{group.playerId}</span>
                        <span>{group.count} карт</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-lg">
                        {group.cards.map((card) => (
                          <span key={card} className="rounded-md bg-white px-3 py-1 shadow-sm">
                            {card}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-border/70 bg-white/90">
                <CardHeader>
                  <CardTitle>Технологии</CardTitle>
                  <CardDescription>
                    Ядро переиспользуется между ботом и web-панелью.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <strong>Node.js + TypeScript:</strong> строгие типы, отсутствие <code>any</code>
                    .
                  </p>
                  <p>
                    <strong>grammY:</strong> удобный API бота, inline-кнопки, обработка ошибок.
                  </p>
                  <p>
                    <strong>React + Tailwind + shadcn/ui:</strong> быстрый интерфейс, готовые
                    UI-паттерны.
                  </p>
                  <p>
                    <strong>Vitest:</strong> модульные тесты игрового ядра для гарантии правил.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border/60 bg-white/80">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} UNO Lite. Все права и правила соблюдены.</span>
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            KISS · DRY · SOLID · TypeScript Strict
          </span>
        </div>
      </footer>
    </div>
  )
}

export default App
