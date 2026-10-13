/** View transitions stay off unless the browser supports them and motion is allowed. */
export function allowViewTransition(input: {
  reduceMotion: boolean;
  prefersReduced: boolean;
  supported: boolean;
}) {
  return input.supported && !input.reduceMotion && !input.prefersReduced;
}
