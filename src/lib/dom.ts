/**
 * DOM utility functions for the Granblue Fantasy Chrome extension.
 * Provides reusable helpers for visibility and class management.
 */

const ELEMENT_CLASSES = [
  'fire',
  'water',
  'earth',
  'wind',
  'light',
  'dark'
] as const

export type ElementClass = (typeof ELEMENT_CLASSES)[number]

export function show(element: HTMLElement | null): void {
  if (element) element.classList.remove('hidden')
}

export function hide(element: HTMLElement | null): void {
  if (element) element.classList.add('hidden')
}

export function clearElementColors(element: HTMLElement | null): void {
  if (!element) return
  element.classList.remove(...ELEMENT_CLASSES)
}

export function setElementColor(
  element: HTMLElement | null,
  color: string | null
): void {
  if (!element) return
  clearElementColors(element)
  if (color && (ELEMENT_CLASSES as readonly string[]).includes(color)) {
    element.classList.add(color)
  }
}

export function shake(element: HTMLElement | null, duration = 600): void {
  if (!element) return
  element.classList.remove('shake')
  void element.offsetWidth
  element.classList.add('shake')
  setTimeout(() => element.classList.remove('shake'), duration)
}
