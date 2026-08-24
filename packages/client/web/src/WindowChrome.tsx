import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import css from './WindowChrome.module.css'

type WindowState = { maximized: boolean }

type NeonWindowApi = {
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  getState: () => Promise<WindowState>
  onStateChange: (callback: (maximized: boolean) => void) => () => void
}

declare global {
  interface Window {
    neonWindow?: NeonWindowApi
  }
}

function readSessionLabel() {
  if (typeof document === 'undefined') return 'Workspace'
  const current = document.title.trim()
  if (current === '' || current === 'NeonHarness') return 'Workspace'
  const separator = current.indexOf(' — ')
  return separator === -1 ? current : current.slice(0, separator)
}

function WindowControlIcon(props: { kind: 'minimize' | 'maximize' | 'restore' | 'close' }) {
  if (props.kind === 'minimize') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
  }
  if (props.kind === 'maximize') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
  }
  if (props.kind === 'restore') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h10v10H8z" /><path d="M6 16H5V6h10v1" /></svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
}

function WindowChrome(props: { title: string }) {
  const [api] = useState<NeonWindowApi | null>(() => {
    if (typeof window === 'undefined') return null
    return window.neonWindow ?? null
  })
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (api === null) return
    let active = true
    void api.getState().then((state) => {
      if (active) setMaximized(state.maximized)
    }).catch(() => {})
    const unsubscribe = api.onStateChange(setMaximized)
    return () => {
      active = false
      unsubscribe()
    }
  }, [api])

  if (api === null) return null

  return (
    <header className={css.chrome}>
      <div className={css.brand} aria-label="NeonHarness">
        <span className={css.logo} aria-hidden="true">N</span>
        <span className={css.wordmark}><strong>NEON</strong><span>HARNESS</span></span>
      </div>
      <span className={css.separator} aria-hidden="true" />
      <nav className={css.nav} aria-label="Application">
        <span className={css.navItem} aria-current="page"><span className={css.navDot} />Workspace</span>
      </nav>
      <div className={css.title} aria-live="polite" onDoubleClick={api.toggleMaximize}>{props.title}</div>
      <div className={css.status}><span className={css.statusDot} />Desktop runtime</div>
      <div className={css.controls}>
        <button className={css.control} type="button" aria-label="Minimize window" onClick={api.minimize}>
          <WindowControlIcon kind="minimize" />
        </button>
        <button className={css.control} type="button" aria-label={maximized ? 'Restore window' : 'Maximize window'} onClick={api.toggleMaximize}>
          <WindowControlIcon kind={maximized ? 'restore' : 'maximize'} />
        </button>
        <button className={`${css.control} ${css.close}`} type="button" aria-label="Close window" onClick={api.close}>
          <WindowControlIcon kind="close" />
        </button>
      </div>
    </header>
  )
}

export function WindowShell(props: { children: ReactNode }) {
  const [title, setTitle] = useState(readSessionLabel)
  const desktop = typeof window !== 'undefined' && window.neonWindow !== undefined

  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.getPropertyValue('--neon-window-chrome-height')
    root.style.setProperty('--neon-window-chrome-height', desktop ? '52px' : '0px')
    return () => {
      if (previous === '') root.style.removeProperty('--neon-window-chrome-height')
      else root.style.setProperty('--neon-window-chrome-height', previous)
    }
  }, [desktop])

  useEffect(() => {
    const refresh = () => setTitle(readSessionLabel())
    refresh()
    const titleElement = document.querySelector('title')
    if (titleElement === null || typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(refresh)
    observer.observe(titleElement, { childList: true, characterData: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <div className={css.shell}>
      <WindowChrome title={title} />
      <div className={css.content}>{props.children}</div>
    </div>
  )
}
