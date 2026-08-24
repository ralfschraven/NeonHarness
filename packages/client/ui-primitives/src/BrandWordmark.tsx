import type { CSSProperties } from 'react'
import type { IconProps } from './icons/props.ts'
import css from './BrandWordmark.module.css'

/**
 * NeonHarness product wordmark. The mark is a real bundled asset so the same
 * identity can be reused by the web shell, desktop rail, and app chrome.
 */
export function BrandWordmark({ size = 24, className }: IconProps) {
  const style = {
    '--neon-brand-mark-size': `${size}px`,
    '--neon-brand-type-size': `${Math.max(16, Math.round(size * 0.92))}px`,
  } as CSSProperties

  return (
    <span className={[css.root, className].filter(Boolean).join(' ')} style={style} aria-hidden="true">
      <img className={css.mark} src="/neon-harness-mark.png" alt="" />
      <span className={css.wordmark}>
        <span className={css.neon}>Neon</span>
        <span>Harness</span>
      </span>
    </span>
  )
}
