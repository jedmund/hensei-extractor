/**
 * @fileoverview DOM utility functions for the Granblue Fantasy Chrome extension.
 * Provides reusable helpers for pane transitions, visibility, and class management.
 */

// Element color classes used for theming
const ELEMENT_CLASSES = ['fire', 'water', 'earth', 'wind', 'light', 'dark']

/**
 * Shows a sliding pane by adding the 'active' class
 * @param {HTMLElement} pane - The pane element to show
 */
export function showPane(pane) {
  pane?.classList.add('active')
}

/**
 * Hides a sliding pane by removing the 'active' class
 * @param {HTMLElement} pane - The pane element to hide
 */
export function hidePane(pane) {
  pane?.classList.remove('active')
}

/**
 * Sets the main pane to active or inactive state
 * @param {HTMLElement} mainPane - The main pane element
 * @param {boolean} active - Whether the main pane should be active (true) or inactive (false)
 */
export function setMainPaneActive(mainPane, active) {
  mainPane?.classList.toggle('inactive', !active)
}

/**
 * Shows an element by removing the 'hidden' class
 * @param {HTMLElement} element - The element to show
 */
export function show(element) {
  if (element) element.classList.remove('hidden')
}

/**
 * Hides an element by adding the 'hidden' class
 * @param {HTMLElement} element - The element to hide
 */
export function hide(element) {
  if (element) element.classList.add('hidden')
}

/**
 * Sets element classes, optionally removing specified classes first
 * @param {HTMLElement} element - The element to modify
 * @param {string|string[]|null} classesToAdd - Class(es) to add, or null to only remove
 * @param {...string} classesToRemove - Classes to remove before adding
 */
export function setElementClasses(element, classesToAdd, ...classesToRemove) {
  if (!element) return
  if (classesToRemove.length) {
    element.classList.remove(...classesToRemove)
  }
  if (classesToAdd) {
    const classes = Array.isArray(classesToAdd) ? classesToAdd : [classesToAdd]
    element.classList.add(...classes)
  }
}

/**
 * Removes all element color classes from an element
 * @param {HTMLElement} element - The element to clear colors from
 */
export function clearElementColors(element) {
  if (!element) return
  element.classList.remove(...ELEMENT_CLASSES)
}

/**
 * Sets the element color class, removing any existing element colors first
 * @param {HTMLElement} element - The element to set the color on
 * @param {string|null} color - The element color to set, or null to clear
 */
export function setElementColor(element, color) {
  if (!element) return
  clearElementColors(element)
  if (color && ELEMENT_CLASSES.includes(color)) {
    element.classList.add(color)
  }
}

/**
 * Triggers a shake animation on an element
 * @param {HTMLElement} element - The element to shake
 * @param {number} duration - Animation duration in ms (default: 600)
 */
export function shake(element, duration = 600) {
  if (!element) return
  // Remove and force reflow to re-trigger animation
  element.classList.remove('shake')
  void element.offsetWidth
  element.classList.add('shake')
  setTimeout(() => element.classList.remove('shake'), duration)
}
