/** Style for a number box that grows with what is typed in it, so a big quantity is never cut off. The extra
 * room covers the box's side padding and the browser's up/down arrows. */
export const numberWidth = (value: number | string, min = 2): { width: string } => ({
  width: `calc(${Math.max(min, String(value ?? '').length)}ch + 2.75rem)`,
});
