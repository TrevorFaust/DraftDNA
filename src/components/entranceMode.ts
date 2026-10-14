/**
 * Which first-load intro is on screen.
 *
 * 'runner' — the Rive running back crosses, then the Draft DNA card fades in
 * 'pane' — a lineman pushes a sideline board off the page
 * 'ball' — the sketch football spin, then the title card
 *
 * The other intros stay in the repo. Flip this constant to switch back.
 */
export const ENTRANCE_MODE = 'runner' as 'runner' | 'pane' | 'ball';
