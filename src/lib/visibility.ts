/** Party visibility values the API takes: 1 anyone, 2 unlisted, 3 private. */
export const PRIVATE_VISIBILITY = 3

/**
 * The visibility a party import uses: the one the user picked for this
 * import, else their account's default import visibility, else private.
 */
export function importVisibility(
  choice: number | null,
  accountDefault: number | undefined
): number {
  return choice ?? (accountDefault || PRIVATE_VISIBILITY)
}
