import { cubicOut } from 'svelte/easing'
import type { TransitionConfig } from 'svelte/transition'

export function slideRight(
  _node: Element,
  { duration = 300, easing = cubicOut }: { duration?: number; easing?: (t: number) => number } = {}
): TransitionConfig {
  return {
    duration,
    easing,
    css: (t) =>
      `transform: translateX(${(1 - t) * 100}%); box-shadow: ${t < 1 ? `-4px 0 12px rgba(0, 0, 0, ${0.16 * t})` : 'none'}`
  }
}
