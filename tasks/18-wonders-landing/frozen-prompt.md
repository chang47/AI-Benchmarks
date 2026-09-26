# Wonders of the Universe — an immersive scroll-story landing page

Build a one-page website called **Wonders of the Universe**. Visitors should feel the page is mystical, wonderful and beautiful: a slow, fluid journey from a swirling galaxy down to ocean waves, where scrolling drives the story.

## Deliverable

- ONE self-contained file: `src/index.html` (HTML + CSS + JavaScript inline).
- It must work opened directly from disk via `file://` with **no network requests of any kind**: no CDNs, no web fonts, no images, video or audio files. Every visual must be drawn in code (canvas, WebGL, SVG, CSS). Libraries are allowed only if you inline them yourself.
- Zero console errors. Never call `alert()`, `confirm()` or `prompt()`.
- It must look good and work at 1440px, 768px and 375px wide.

## Sections (in this order, each with its `data-section` value)

1. `hero` — A swirling **spiral galaxy** of glowing particles filling the screen, which reacts to the mouse. The title and subtitle animate in on load.
2. `meteors` — A starry night sky above a **mountain** silhouette, with a continuous **meteor shower**.
3. `volcano` — A **volcano eruption driven by scroll**: while this section is on screen it stays pinned, and scrolling down makes the volcano erupt (glow, lava, fire, ash). Scrolling back up rewinds it. At the start of the section nothing has erupted; at the end the eruption is at its peak.
4. `waterfall` — A **waterfall** pouring into a **lush forest**. The forest is built from layers that move at different speeds as you scroll (parallax).
5. `wonders` — A pinned **horizontal strip** of wonder cards that slides sideways as you scroll down. At least these six cards, each with its own small drawn visual: Aurora, Nebula, Coral reef, Singing dunes, Lightning, Glowing bay.
6. `ocean` — **Ocean waves** at sunset, with a number that counts up from 0 to `2,000,000,000,000` when it comes into view.
7. `voices` — A **carousel** of quotes with previous/next buttons. It auto-advances every few seconds and pauses while hovered.
8. `join` — A signup **form** with one email field and inline validation (no page reload).

Also required:

- **A magical cursor.** A custom glowing cursor follows the mouse and leaves a sparkle/stardust trail. It visibly changes (e.g. grows) when over a link or button. Disable it on touch devices (`(pointer: coarse)`) and under reduced motion; the normal cursor is used there.
- **A sticky navigation bar** with one link per section that smooth-scrolls to it. Below 768px it collapses behind a menu button that opens and closes it.
- **Reveal on scroll.** Text in every section fades and slides in as it enters the viewport.
- **Reduced motion.** Under `prefers-reduced-motion: reduce`: no scroll-driven or ambient animation, no custom cursor, and all content visible immediately without scrolling to reveal it.
- **Performance.** Keep scrolling smooth. Animated scenes must stop their animation loops while they are off screen.

## Copy (use this text exactly)

- Navigation labels, in order: Galaxy, Sky, Volcano, Waterfall, Wonders, Ocean, Voices, Join
- hero — title: `Wonders of the Universe` · subtitle: `A journey from the edge of the galaxy to the waves at your feet.` · button: `Begin the journey` (scrolls to the next section)
- meteors — heading: `Where the sky falls` · text: `On the highest ridges the night opens up, and every few seconds a grain of ancient dust burns across it.`
- volcano — heading: `The earth breathes fire` · text: `Scroll to wake the mountain. Deep below, rock melts into rivers of light.`
- waterfall — heading: `Water that never stops` · text: `A river leaps from the cliff and becomes mist, rain, and forest.`
- wonders — heading: `More wonders` · cards (title — caption):
  - Aurora — `Curtains of charged light over the poles.`
  - Nebula — `Clouds where new stars are born.`
  - Coral reef — `A city built by living stone.`
  - Singing dunes — `Sand that hums when the wind moves it.`
  - Lightning — `Five times hotter than the surface of the sun.`
  - Glowing bay — `Waves that shine blue when you touch them.`
- ocean — heading: `The tide remembers the moon` · counter: `2,000,000,000,000` · label: `galaxies in the observable universe`
- voices — heading: `What people felt` · quotes (quote — name):
  - `I forgot I was looking at a screen.` — Mira, stargazer
  - `It felt like the night sky was breathing.` — Kenji, photographer
  - `I scrolled back up just to watch the volcano again.` — Ana, geologist
  - `Quiet, strange, and beautiful. Like the universe.` — Theo, student
- join — heading: `Get the wonder letter` · text: `One strange and beautiful thing from the universe, every month.` · email label: `Email address` · button: `Send me wonders`
  - empty submit → `Please enter your email.`
  - invalid email → `That email doesn't look right.`
  - valid email → `Welcome aboard. Your first wonder letter is on its way.`
- footer: `Made with code, light, and curiosity.`

## Test contract (automated checks rely on this — follow it exactly)

- Each section element has `data-section="<id>"` with the ids above.
- Each section's heading block (heading + text) has `data-anim="<section id>-text"`, e.g. `data-anim="meteors-text"`; the hero uses `data-anim="hero-title"`.
- The custom cursor element has `data-cursor`; the element or canvas that draws its trail has `data-cursor-trail`.
- The counter element has `data-counter`.
- The carousel root has `data-carousel`; its buttons have `data-prev` and `data-next`; each quote has `data-slide`, and the currently shown quote has `aria-hidden="false"` (all others `aria-hidden="true"`).
- The form has `data-form`; the message element has `data-form-message` and gets `data-state="error"` or `data-state="success"`.
- The mobile menu button has `data-menu-button` and `aria-expanded="true|false"`.
- Forest parallax layers have `data-depth="<number>"`.
- Expose a global object, callable at any time:
  ```js
  window.__wonder = {
    progress(id), // 0..1: how far the scroll-driven animation of section `id` has advanced ("volcano", "wonders")
    playing(id),  // true while the animation loop of scene `id` is running ("galaxy", "meteors", "waterfall", "ocean")
  };
  ```
