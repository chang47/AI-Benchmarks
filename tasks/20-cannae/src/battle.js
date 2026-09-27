// Battle runner: plays the deterministic sim forward, keeps checkpoints so any time can be revisited
// exactly (scrubbing back re-simulates from the nearest checkpoint), and exposes the test contract.
(function (root) {
  "use strict";
  const Sim = root.CannaeSim, R = Sim.RULES;
  const CHECK_EVERY = 20; // seconds of battle time between checkpoints

  const clone = (s) => {
    const { byId, ...rest } = s;
    const c = structuredClone(rest);
    c.byId = Object.fromEntries(c.units.map((u) => [u.id, u]));
    return c;
  };

  function Battle() {
    let cur = Sim.create();
    const checkpoints = new Map([[0, clone(cur)]]); // battle-time second → state
    let computedTo = 0;
    let finalEvents = null;

    let ahead = clone(cur); // a second copy that runs ahead in idle time, filling checkpoints

    const nearestCheckpoint = (t) => {
      for (let k = Math.floor(t / CHECK_EVERY) * CHECK_EVERY; k >= 0; k -= CHECK_EVERY) if (checkpoints.has(k)) return checkpoints.get(k);
      return checkpoints.get(0);
    };
    const record = (s) => {
      computedTo = Math.max(computedTo, s.t);
      if (Math.abs(s.t % CHECK_EVERY) < 1e-9 && !checkpoints.has(s.t)) checkpoints.set(s.t, clone(s));
      if (s.t >= R.duration && !finalEvents) finalEvents = s.events.slice();
    };

    /** Move the live state to battle time t (exact: the sim is deterministic, so replaying gives identical states). */
    function stepTo(t) {
      t = Math.max(0, Math.min(R.duration, Math.round(t / R.dt) * R.dt));
      const cp = nearestCheckpoint(t);
      if (t < cur.t - 1e-9 || cp.t > cur.t + 1e-9) cur = clone(cp); // jump back, or skip ahead via a checkpoint
      while (cur.t + 1e-9 < t) { Sim.step(cur); record(cur); }
      return cur;
    }

    /** Run the look-ahead copy for a few ms (call every frame) so later seeks are cheap. */
    function precompute(budgetMs = 6) {
      const t0 = performance.now();
      while (ahead.t < R.duration && performance.now() - t0 < budgetMs) { Sim.step(ahead); record(ahead); }
      return ahead.t < R.duration;
    }

    return {
      get state() { return cur; },
      get computedTo() { return computedTo; },
      stepTo, precompute,
      /** Events of the whole battle (for timeline markers) — computes to the end if needed. */
      allEvents() {
        if (!finalEvents) { const keep = cur.t; stepTo(R.duration); finalEvents = cur.events.slice(); stepTo(keep); }
        return finalEvents;
      },
    };
  }

  root.CannaeBattle = { Battle, CHECK_EVERY };
})(typeof window !== "undefined" ? window : globalThis);
