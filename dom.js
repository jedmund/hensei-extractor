/**
 * @fileoverview DOM utility functions for the Granblue Fantasy Chrome extension.
 * Provides reusable helpers for visibility and class management.
 */

// Element color classes used for theming
const ELEMENT_CLASSES = ["fire", "water", "earth", "wind", "light", "dark"];

/**
 * Shows an element by removing the 'hidden' class
 * @param {HTMLElement} element - The element to show
 */
export function show(element) {
  if (element) element.classList.remove("hidden");
}

/**
 * Hides an element by adding the 'hidden' class
 * @param {HTMLElement} element - The element to hide
 */
export function hide(element) {
  if (element) element.classList.add("hidden");
}

/**
 * Removes all element color classes from an element
 * @param {HTMLElement} element - The element to clear colors from
 */
export function clearElementColors(element) {
  if (!element) return;
  element.classList.remove(...ELEMENT_CLASSES);
}

/**
 * Sets the element color class, removing any existing element colors first
 * @param {HTMLElement} element - The element to set the color on
 * @param {string|null} color - The element color to set, or null to clear
 */
export function setElementColor(element, color) {
  if (!element) return;
  clearElementColors(element);
  if (color && ELEMENT_CLASSES.includes(color)) {
    element.classList.add(color);
  }
}

/**
 * Triggers a shake animation on an element
 * @param {HTMLElement} element - The element to shake
 * @param {number} duration - Animation duration in ms (default: 600)
 */
export function shake(element, duration = 600) {
  if (!element) return;
  // Remove and force reflow to re-trigger animation
  element.classList.remove("shake");
  void element.offsetWidth;
  element.classList.add("shake");
  setTimeout(() => element.classList.remove("shake"), duration);
}
