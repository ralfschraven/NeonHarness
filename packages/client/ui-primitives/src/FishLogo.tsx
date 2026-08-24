import type { IconProps } from './icons/props.ts'

/**
 * Compatibility wrapper for the shell's historical mark slot. The slot name
 * stays stable for composed plugins, while the visible asset is now the
 * NeonHarness monogram rather than the upstream DeepSeek fish.
 */
export function FishLogo({ size = 24, className }: IconProps) {
  return (
    <img
      width={size}
      height={size}
      className={className}
      src="/neon-harness-mark.png"
      alt=""
      aria-hidden="true"
    />
  )
}
