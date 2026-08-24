/** Tasks view: a calm overview of the active run, queued work, and live actions. */

import { useEffect, useMemo, useState } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { TrajectorySnapshot } from './trajectory-contract.ts'
import css from './TasksView.module.css'

type TaskStatus = 'idle' | 'queued' | 'running'
type FeedStatus = 'complete' | 'active' | 'queued' | 'error'

export interface TaskFeedItem {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly status: FeedStatus
  readonly time: number | null
}

export interface TaskQueueItem {
  readonly id: string
  readonly title: string
  readonly position: number
}

export interface TaskSummary {
  readonly status: TaskStatus
  readonly title: string
  readonly phase: string
  readonly progress: number
  readonly etaMs: number | null
  readonly totalEtaMs: number | null
  readonly activeElapsedMs: number
  readonly queue: readonly TaskQueueItem[]
  readonly feed: readonly TaskFeedItem[]
  readonly estimateSource: 'history' | 'initial'
}

const MIN_ESTIMATE_MS = 15_000
const INITIAL_ESTIMATE_MS = 120_000
const MAX_VISIBLE_FEED_ITEMS = 8

function textFromContent(content: readonly { type: string; text?: string }[]): string {
  return content
    .filter(block => block.type === 'text' && block.text !== undefined)
    .map(block => block.text ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function shorten(value: string, max = 96): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trimEnd()}…`
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const ordered = [...values].sort((left, right) => left - right)
  const first = ordered[0]
  if (first === undefined) return null
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0
    ? Math.round(((ordered[middle - 1] ?? first) + (ordered[middle] ?? first)) / 2)
    : ordered[middle] ?? first
}

function requestDuration(request: TrajectorySnapshot['requests'][number]): number | null {
  if (request.completedAt === null || request.completedAt < request.startedAt) return null
  return request.completedAt - request.startedAt
}

function requestHistory(trajectory: TrajectorySnapshot | undefined): readonly number[] {
  return (trajectory?.requests ?? [])
    .filter(request => request.status === 'complete')
    .map(requestDuration)
    .filter((duration): duration is number => duration !== null)
}

function taskTitle(snapshot: ConversationSnapshot, queue: readonly TaskQueueItem[]): string {
  const latestPrompt = [...snapshot.nodes].reverse().find(node => node.kind === 'user' || node.kind === 'steering')
  if (latestPrompt !== undefined) {
    const text = textFromContent(latestPrompt.content)
    if (text !== '') return shorten(text, 120)
  }
  return queue[0]?.title ?? (snapshot.running ? 'Working on the current task' : 'No active task')
}

function feedFromNode(node: ConversationSnapshot['nodes'][number]): TaskFeedItem | null {
  switch (node.kind) {
    case 'user':
      return {
        id: `user-${node.seq}`,
        label: 'Task received',
        detail: shorten(textFromContent(node.content) || 'A new instruction was accepted.'),
        status: 'complete',
        time: node.time,
      }
    case 'steering':
      return {
        id: `steering-${node.seq}`,
        label: 'Queued instruction admitted',
        detail: shorten(textFromContent(node.content) || 'A queued instruction entered the active run.'),
        status: 'complete',
        time: node.time,
      }
    case 'assistant':
      return {
        id: `assistant-${node.seq}`,
        label: 'Response generated',
        detail: `Step ${node.turn}.${node.step} completed`,
        status: 'complete',
        time: node.time,
      }
    case 'tool-result':
      return {
        id: `tool-${node.seq}`,
        label: node.call?.name === null || node.call?.name === undefined
          ? 'Tool action completed'
          : `${node.call.name} completed`,
        detail: node.isError ? 'The tool reported an error.' : 'Result received from the computer.',
        status: node.isError ? 'error' : 'complete',
        time: node.time,
      }
    case 'command':
      return {
        id: `command-${node.seq}`,
        label: node.name === null ? 'Command completed' : `${node.name} completed`,
        detail: node.outcome?.kind === 'error' ? 'The command reported an error.' : 'Command result received.',
        status: node.outcome?.kind === 'error' ? 'error' : 'complete',
        time: node.time,
      }
    case 'model-retry':
      return {
        id: `retry-${node.seq}`,
        label: node.retryState === 'scheduled' ? 'Retry scheduled' : 'Retry processed',
        detail: node.retryState === 'cancelled' ? 'The retry was cancelled.' : 'The model request will be tried again.',
        status: node.retryState === 'cancelled' ? 'error' : 'complete',
        time: node.time,
      }
    case 'turn-error':
      return {
        id: `turn-error-${node.seq}`,
        label: 'Task step failed',
        detail: shorten(node.message || 'The current step reported an error.'),
        status: 'error',
        time: node.time,
      }
    case 'turn-max-tokens':
      return {
        id: `turn-max-${node.seq}`,
        label: 'Output limit reached',
        detail: 'The task stopped at the configured output limit.',
        status: 'error',
        time: node.time,
      }
    case 'compaction':
      return {
        id: `compaction-${node.seq}`,
        label: 'Context compacted',
        detail: node.shadowedItemCount === null
          ? 'The model context was refreshed.'
          : `${node.shadowedItemCount} earlier items summarized`,
        status: 'complete',
        time: node.time,
      }
    case 'context':
      return {
        id: `context-${node.seq}`,
        label: 'Context loaded',
        detail: node.provenance.label ?? 'Context source',
        status: 'complete',
        time: node.time,
      }
    case 'unknown':
      return {
        id: `unknown-${node.seq}`,
        label: 'New activity received',
        detail: node.type,
        status: 'complete',
        time: node.time,
      }
  }
}

function feedItems(
  snapshot: ConversationSnapshot,
  trajectory: TrajectorySnapshot | undefined,
): readonly TaskFeedItem[] {
  const active = snapshot.runningCalls.map(call => ({
    id: `running-${call.callId}`,
    label: `Running ${call.name}`,
    detail: call.argsRaw === '' ? 'Tool call in progress' : shorten(call.argsRaw),
    status: 'active' as const,
    time: call.time,
  }))
  const request = (trajectory?.requests ?? []).find(item => item.status === 'running')
  if (request !== undefined) {
    active.unshift({
      id: `request-${request.startSeq}`,
      label: 'Model is working',
      detail: request.purpose === 'compaction' ? 'Refreshing the working context' : `Step ${request.turn}.${request.step}`,
      status: 'active',
      time: request.startedAt,
    })
  }
  const history = snapshot.nodes
    .slice(-MAX_VISIBLE_FEED_ITEMS)
    .reverse()
    .map(feedFromNode)
    .filter((item): item is TaskFeedItem => item !== null)
  return [...active, ...history].slice(0, MAX_VISIBLE_FEED_ITEMS)
}

function phaseOf(
  snapshot: ConversationSnapshot,
  trajectory: TrajectorySnapshot | undefined,
): { label: string; progress: number } {
  const requestRunning = (trajectory?.requests ?? []).some(request => request.status === 'running')
  if (snapshot.runningCalls.length > 0) return { label: 'Running tools', progress: 68 }
  if (snapshot.partial !== null) return { label: 'Generating response', progress: 48 }
  if (requestRunning) return { label: 'Working through the task', progress: 32 }
  if (snapshot.running) return { label: 'Preparing the next action', progress: 20 }
  return { label: 'Waiting for input', progress: 0 }
}

export function deriveTaskSummary(snapshot: ConversationSnapshot, now = Date.now()): TaskSummary {
  const queue = snapshot.queue
    .filter(row => row.placement === 'queued')
    .map((row, index) => ({ id: String(row.id), title: shorten(row.preview || 'Queued task'), position: index + 1 }))
  const trajectory = snapshot.views.get('trajectory')
  const historyEstimate = median(requestHistory(trajectory))
  const estimate = historyEstimate === null ? INITIAL_ESTIMATE_MS : Math.max(MIN_ESTIMATE_MS, historyEstimate)
  const request = (trajectory?.requests ?? []).find(item => item.status === 'running')
  const activeElapsedMs = request === undefined ? 0 : Math.max(0, now - request.startedAt)
  const active = snapshot.running || snapshot.partial !== null || snapshot.runningCalls.length > 0 || request !== undefined
  const phase = phaseOf(snapshot, trajectory)
  const activeRemaining = active ? Math.max(MIN_ESTIMATE_MS, estimate - activeElapsedMs) : 0
  const totalQueueEta = queue.length === 0 && !active ? null : activeRemaining + queue.length * estimate

  return {
    status: active ? 'running' : queue.length > 0 ? 'queued' : 'idle',
    title: taskTitle(snapshot, queue),
    phase: active ? phase.label : queue.length > 0 ? 'Queued' : phase.label,
    progress: active ? phase.progress : 0,
    etaMs: active ? activeRemaining : queue.length > 0 ? queue.length * estimate : null,
    totalEtaMs: totalQueueEta,
    activeElapsedMs,
    queue,
    feed: feedItems(snapshot, trajectory),
    estimateSource: historyEstimate === null ? 'initial' : 'history',
  }
}

function formatEta(value: number | null): string {
  if (value === null) return '—'
  if (value < 60_000) return `~${Math.max(1, Math.ceil(value / 1_000))} sec`
  return `~${Math.ceil(value / 60_000)} min`
}

function formatTime(value: number | null): string {
  if (value === null) return ''
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(value)
}

function phaseClass(status: FeedStatus): string {
  return status === 'active' ? (css.feedDotActive ?? '') : status === 'error' ? (css.feedDotError ?? '') : (css.feedDot ?? '')
}

export function TasksView({ useSession }: ConvViewProps) {
  const running = useSession(snapshot => snapshot.running)
  const snapshot = useSession(value => value)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(() => { setNow(Date.now()) }, 1_000)
    return () => { clearInterval(timer) }
  }, [running])

  const summary = useMemo(() => deriveTaskSummary(snapshot, now), [now, snapshot])
  const steps = useMemo(() => [
    { label: 'Plan', active: summary.progress >= 20 },
    { label: 'Execute', active: summary.progress >= 32 },
    { label: 'Verify', active: summary.progress >= 68 },
    { label: 'Complete', active: summary.status === 'idle' && summary.feed.length > 0 },
  ], [summary.feed.length, summary.progress, summary.status])

  return (
    <div className={css.root} data-conversation-composer-overlay="" data-testid="tasks-view">
      <div className={css.shell}>
        <header className={css.hero}>
          <div>
            <div className={css.eyebrow}>TASK CONTROL</div>
            <h1 className={css.title}>{summary.title}</h1>
            <p className={css.subtitle}>
              {summary.status === 'running'
                ? 'The computer is working through this task now.'
                : summary.status === 'queued'
                  ? 'The next task is ready and will start after the active run.'
                  : 'Start a task to see its live progress here.'}
            </p>
          </div>
          <div className={summary.status === 'running' ? css.statusActive : css.statusIdle}>
            <span className={css.statusDot} aria-hidden />
            {summary.status === 'running' ? 'Active' : summary.status === 'queued' ? 'Queued' : 'Idle'}
          </div>
        </header>

        <section className={css.progressPanel} aria-label="Task progress">
          <div className={css.progressHeader}>
            <div>
              <span className={css.panelLabel}>CURRENT PHASE</span>
              <strong>{summary.phase}</strong>
            </div>
            <div className={css.eta}>
              <span className={css.panelLabel}>ESTIMATED TIME</span>
              <strong>{formatEta(summary.totalEtaMs)}</strong>
            </div>
          </div>
          <div className={css.progressTrack} aria-label={`${summary.progress}% complete`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.progress}>
            <div className={css.progressValue} style={{ width: `${summary.progress}%` }} />
          </div>
          <div className={css.progressFooter}>
            <span>{summary.progress === 0 ? 'Waiting to begin' : `${summary.progress}% phase progress`}</span>
            <span>{summary.estimateSource === 'history' ? 'Based on recent runs' : 'Initial estimate'}</span>
          </div>
          <ol className={css.steps} aria-label="Task phases">
            {steps.map(step => (
              <li key={step.label} className={step.active ? css.stepActive : css.step}>
                <span className={css.stepMark} aria-hidden />
                {step.label}
              </li>
            ))}
          </ol>
        </section>

        <div className={css.grid}>
          <section className={css.panel} aria-labelledby="task-queue-heading">
            <div className={css.panelHeader}>
              <div>
                <span className={css.panelLabel}>UP NEXT</span>
                <h2 id="task-queue-heading">Task queue</h2>
              </div>
              <span className={css.count}>{summary.queue.length}</span>
            </div>
            {summary.queue.length === 0
              ? <p className={css.empty}>No queued tasks. New instructions will appear here while this session is busy.</p>
              : (
                <ol className={css.queueList}>
                  {summary.queue.map(item => (
                    <li key={item.id} className={css.queueItem}>
                      <span className={css.queueNumber}>{String(item.position).padStart(2, '0')}</span>
                      <span className={css.queueTitle}>{item.title}</span>
                      <span className={css.queueEta}>{formatEta(summary.etaMs)}</span>
                    </li>
                  ))}
                </ol>
              )}
          </section>

          <section className={css.panel} aria-labelledby="task-feed-heading">
            <div className={css.panelHeader}>
              <div>
                <span className={css.panelLabel}>LIVE SIGNAL</span>
                <h2 id="task-feed-heading">What the computer is doing</h2>
              </div>
              {summary.status === 'running' && <span className={css.liveLabel}>LIVE</span>}
            </div>
            {summary.feed.length === 0
              ? <p className={css.empty}>The activity feed will fill as the task starts.</p>
              : (
                <ol className={css.feed}>
                  {summary.feed.map(item => (
                    <li key={item.id} className={css.feedItem}>
                      <span className={phaseClass(item.status)} aria-hidden />
                      <div className={css.feedCopy}>
                        <strong>{item.label}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <time>{formatTime(item.time)}</time>
                    </li>
                  ))}
                </ol>
              )}
          </section>
        </div>
      </div>
    </div>
  )
}
