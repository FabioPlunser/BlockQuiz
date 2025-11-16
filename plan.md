Compressed realistic timeline


- Week 1 (this week): Repo + DB schema + 1 demo exercise running end-to-end (I/O grading works)

- Week 2: Turtle engine + grading

- Week 3: CMS minimal (CRUD + linter)

- Week 4: Content (10 exercises DE/EN) + tests

- Week 5: Polish (accessibility, performance, UI)

- Week 6: Pilot (run + analyze)

- Week 7: Thesis write + figures

This week (4 days, assume you're catching up from illness)

Focus: Just get RUN + CHECK working on one I/O task. Nothing else.


- [ ]  Clone repo or init fresh SvelteKit project (5min)

- [ ] Add Drizzle + SQLite, write schema.ts from earlier gist (30min)

- [ ]  Run drizzle-kit push to create DB + seed 1 demo exercise JSON (15min)

- [ ] Create /exercise/[id] route, load exercise from DB (15min)

- [ ] Render Blockly workspace with per-exercise toolbox (1h)

- [ ] Implement RUN button → postMessage to iframe, capture output (45min)

- [ ] Implement I/O grader + CHECK button, show pass/fail (45min)

- [ ] Test on one task end-to-end, commit (15min)

Total: ~4 hours of focused work

Next week: Add Turtle, same approach—one task end-to-end.

Scope cuts if you fall behind


- Skip accounts entirely; stay guest-mode only.

- CMS can be barebones (no UI; edit JSON manually or basic form).

- Only 5 I/O exercises + 2 Turtle exercises (7 instead of 10).

- Skip visual regression tests; rely on manual checks.

- Pilot: 3–4 kids instead of 6.

- Plugin API: document as "future work," don't code.

Starting TODAY


1. Set up project in 1 hour.

2. Get Blockly rendering in 2 hours.

3. Wire RUN/CHECK in 1–2 hours.

4. Commit by end of day.

5. Move to Turtle tomorrow.
