# BlocklyQuiz - Final Sprint TODO

**Today:** December 29, 2025  
**Deadline:** January 16, 2026  
**Days Remaining:** 18 days  
**Working Hours:** 9:00/10:00 - 21:00 (~11h/day)  
**Total Available Hours:** ~198 hours

---

## 📊 Time Allocation Overview

| Task                | Hours | Days   | Period          |
| ------------------- | ----- | ------ | --------------- |
| **Implementation**  | 88h   | 8 days | Dec 29 - Jan 5  |
| **Thesis Writing**  | 88h   | 8 days | Jan 6 - Jan 13  |
| **Buffer & Polish** | 22h   | 2 days | Jan 14 - Jan 15 |
| **Final Review**    | --    | 1 day  | Jan 16          |

---

## 🗓️ Day-by-Day Schedule

### WEEK 1: Implementation Focus (Dec 29 - Jan 5)

#### Day 1 - Sun, Dec 29 
**Focus: Core Bug Fixes & Turtle Polish**
- [ ] Fix TurtleCanvas NaN handling in `$effect`
- [ ] Fix grader typos in `src/lib/graders/turtle.ts`
- [ ] Ensure BlocklyWorkspace export functions work
- [ ] Test complete Turtle flow: blocks → code → execution → grading
- [ ] Review `Canvas2D.svelte.ts` and `Turtle.svelte.ts` state

**Files to touch:**
- `src/lib/components/TurtleCanvas.svelte`
- `src/lib/graders/turtle.ts`
- `src/lib/components/BlocklyWorkspace.svelte`
- `src/lib/canvas/Turtle.svelte.ts`

---

#### Day 2 - Mon, Dec 30
**Focus: Grid Overlay & Path Drawing**
- [ ] Add grid overlay toggle to TurtleCanvas
- [ ] Implement path overlay rendering (teacher-drawn paths)
- [ ] Add target point rendering (apples/goals)
- [ ] Create drawing mode selector (path/target/wall)

**Files to touch:**
- `src/lib/components/TurtleCanvas.svelte`
- `src/lib/components/Canvas2DEditor.svelte` (create)
- `src/lib/canvas/types.ts`

---

#### Day 3 - Tue, Dec 31
**Focus: Exercise Editor (CMS)**
- [ ] Create ExerciseEditor with type selector (turtle/robot)
- [ ] Add title/description with DE/EN tabs
- [ ] Implement visual toolbox builder (checkboxes)
- [ ] Add hint editor (progressive hints)
- [ ] Connect to database save/load

**Files to touch:**
- `src/lib/components/ExerciseEditor.svelte`
- `src/routes/(app)/cms/exercises/[id]/+page.svelte`
- `src/routes/(app)/cms/exercises/new/+page.svelte`

---

#### Day 4 - Wed, Jan 1 (New Year - Light Day)
**Focus: Exercise Player (Student View)**
- [ ] Polish ExercisePlayer component
- [ ] Implement hint reveal system
- [ ] Add success celebration 🎉
- [ ] Add "Next Exercise" navigation
- [ ] Polish result display

**Files to touch:**
- `src/lib/components/exercises/TurtlePlayer.svelte`
- `src/routes/(app)/courses/[courseId]/[exerciseId]/+page.svelte`

---

#### Day 5 - Thu, Jan 2
**Focus: Sandbox Execution & Security**
- [ ] Implement proper iframe sandbox execution
- [ ] Add loop trap injection
- [ ] Create API whitelist for student code
- [ ] Add timeout protection (max 2s)
- [ ] Add command counter (max 10,000 commands)

**Files to create:**
- `src/lib/sandbox/executor.ts`
- `src/lib/sandbox/loop-trap.ts`
- `src/lib/sandbox/restricted-api.ts`

---

#### Day 6 - Fri, Jan 3
**Focus: Create Example Exercises (Turtle)**
- [ ] Exercise 1: Draw a Line (age 6-7, sequence)
- [ ] Exercise 2: Draw a Square (age 7-8, loop)
- [ ] Exercise 3: Draw a Triangle (age 8-9, loop + math)
- [ ] Exercise 4: Follow the Path (age 6-8, sequence)
- [ ] Exercise 5: Reach the Apple (age 7-9, sequence)
- [ ] Exercise 6: Draw a Star (age 9-10, loop + math)
- [ ] Seed database with exercises

**Files to touch:**
- `scripts/seed.ts`
- Exercise JSON definitions

---

#### Day 7 - Sat, Jan 4
**Focus: Course Management & Progress**
- [ ] Implement Course Editor (create/edit courses)
- [ ] Add exercise ordering within courses
- [ ] Implement student progress tracking
- [ ] Create course browser for students
- [ ] Add course assignment to classes

**Files to touch:**
- `src/routes/(app)/cms/courses/+page.svelte`
- `src/routes/(app)/courses/+page.svelte`
- `src/lib/remote/courses.remote.ts`

---

#### Day 8 - Sun, Jan 5
**Focus: Docker & Deployment + Testing**
- [ ] Create Dockerfile
- [ ] Create docker-compose.yml
- [ ] Test full deployment locally
- [ ] Write basic E2E tests (Playwright)
- [ ] Fix any remaining bugs

**Files to create:**
- `Dockerfile`
- `docker-compose.yml`
- `tests/e2e/exercise.spec.ts`

---

### WEEK 2: Thesis Writing (Jan 6 - Jan 13)

#### Day 9 - Mon, Jan 6
**Focus: Chapter 2 - Background & Related Work** (~10 pages)
- [ ] 2.1 Block-Based Programming Environments (Scratch, MakeCode, Blockly, etc.)
- [ ] 2.2 Auto-Grading in Programming Education
- [ ] 2.3 Learning Theory Foundations (Constructionism, Cognitive Load)
- [ ] 2.4 Age-Appropriate Design (6-12 years)
- [ ] 2.5 Privacy and Data Protection (GDPR)

**File:** `report/report/sections/02-background.tex`

---

#### Day 10 - Tue, Jan 7
**Focus: Chapter 3 - Requirements Analysis** (~6 pages)
- [ ] 3.1 Stakeholders (Students, Teachers, IT, Parents)
- [ ] 3.2 Use Cases (Create Exercise, Solve Exercise, Deploy)
- [ ] 3.3 Functional Requirements (FR1-FR5)
- [ ] 3.4 Non-Functional Requirements (Security, Privacy, Usability)

**File:** `report/report/sections/03-requirements.tex`

---

#### Day 11 - Wed, Jan 8
**Focus: Chapter 4 - System Design** (~10 pages)
- [ ] 4.1 Design Decisions (Blockly, SQLite, Svelte 5 runes)
- [ ] 4.2 System Architecture Overview (diagram)
- [ ] 4.3 Exercise Type Framework (Canvas2D, Turtle, Robot)
- [ ] 4.4 Teacher CMS Design
- [ ] 4.5 Security Model (sandbox, CSP)

**File:** `report/report/sections/04-design.tex`

---

#### Day 12 - Thu, Jan 9
**Focus: Chapter 5 - Implementation (Part 1)** (~5 pages)
- [ ] 5.1 Development Environment
- [ ] 5.2 Blockly Integration with Svelte 5
- [ ] 5.3 Reactive Canvas with $state and $effect
- [ ] 5.4 Database Schema (Drizzle + SQLite)

**File:** `report/report/sections/05-implementation.tex`

---

#### Day 13 - Fri, Jan 10
**Focus: Chapter 5 - Implementation (Part 2)** (~5 pages)
- [ ] 5.5 Sandboxed Code Execution
- [ ] 5.6 Grading System (state, path, command)
- [ ] 5.7 Internationalization (i18n)
- [ ] 5.8 Code Examples (Turtle class, Grader)

**File:** `report/report/sections/05-implementation.tex`

---

#### Day 14 - Sat, Jan 11
**Focus: Chapter 6 - Evaluation** (~6 pages)
- [ ] 6.1 Evaluation Goals
- [ ] 6.2 Methodology (Pilot Study Design)
- [ ] 6.3 Metrics (Completion rate, time, hints)
- [ ] 6.4 Results (qualitative observations)
- [ ] 6.5 Analysis

**File:** `report/report/sections/06-evaluation.tex`

⚠️ **Note:** If you haven't conducted the pilot study yet, describe the planned methodology and use placeholder text for results. Consider doing quick informal testing with family/friends.

---

#### Day 15 - Sun, Jan 12
**Focus: Chapter 7 & Chapter 9 - Discussion & Conclusion** (~6 pages)
- [ ] 7.1 Discussion of Results
- [ ] 7.2 Comparison to Research Questions
- [ ] 7.3 Limitations (small sample, limited types)
- [ ] 7.4 Threats to Validity
- [ ] 9.1 Summary
- [ ] 9.2 Future Work
- [ ] 9.3 Closing Remarks

**Files:** 
- `report/report/sections/07-discussion.tex`
- `report/report/sections/09-conclusion.tex`

---

#### Day 16 - Mon, Jan 13
**Focus: Appendix, Figures, References**
- [ ] Add all code listings to appendix
- [ ] Create system architecture diagram
- [ ] Add screenshots (CMS, Student view, Canvas)
- [ ] Complete bibliography (20+ references)
- [ ] Write proper abstract (both DE and EN)

**Files:**
- `report/report/refs.bib`
- `report/report/sections/appendix.tex`
- Capture screenshots from running app

---

### WEEK 3: Buffer & Polish (Jan 14 - Jan 16)

#### Day 17 - Tue, Jan 14
**Focus: Thesis Review & Fixes**
- [ ] Full thesis read-through
- [ ] Fix formatting issues
- [ ] Check all citations
- [ ] Verify figure references
- [ ] Grammar/spell check (German if applicable)

---

#### Day 18 - Wed, Jan 15
**Focus: Final Polish**
- [ ] Final code cleanup
- [ ] Update README.md with final instructions
- [ ] Test Docker deployment one more time
- [ ] Generate final PDF
- [ ] Backup everything

---

#### Day 19 - Thu, Jan 16 (DEADLINE)
**Focus: Submission**
- [ ] Final review
- [ ] Submit thesis
- [ ] Celebrate! 🎉

---

## 📁 File Locations Quick Reference

### Code
| Area           | Location                    |
| -------------- | --------------------------- |
| Canvas Engines | `src/lib/canvas/`           |
| Blockly Setup  | `src/lib/blockly/`          |
| Components     | `src/lib/components/`       |
| Graders        | `src/lib/graders/`          |
| Sandbox        | `src/lib/sandbox/` (create) |
| Database       | `src/lib/server/db/`        |
| CMS Routes     | `src/routes/(app)/cms/`     |
| Student Routes | `src/routes/(app)/courses/` |

### Thesis
| Chapter      | Location                  |
| ------------ | ------------------------- |
| Main         | `report/report/main.tex`  |
| Sections     | `report/report/sections/` |
| Bibliography | `report/report/refs.bib`  |
| Images       | `report/report/images/`   |

---

## ⚡ Priority Items (MVP Must-Haves)

### Code MVP
1. ✅ Blockly workspace renders
2. ✅ Turtle moves on canvas
3. [ ] Teacher can create/save exercises
4. [ ] Student can play and solve exercises
5. [ ] Grading shows pass/fail
6. [ ] 5-10 example exercises
7. [ ] Docker deployment works

### Thesis MVP
1. ✅ Introduction (done)
2. [ ] Background (~10 pages)
3. [ ] Requirements (~6 pages)
4. [ ] Design (~10 pages)
5. [ ] Implementation (~10 pages)
6. [ ] Evaluation (~6 pages)
7. [ ] Conclusion (~4 pages)
8. [ ] ~50 pages total

---

## 🚨 Risk Mitigation

| Risk                    | Mitigation                              |
| ----------------------- | --------------------------------------- |
| Code bugs take too long | Skip Robot type, focus on Turtle only   |
| Thesis takes longer     | Use bullet points first, prose later    |
| No pilot study done     | Describe methodology, use expert review |
| Docker issues           | Host on localhost for demo              |
| Running out of time     | Focus on MVP, cut nice-to-haves         |

---

## 💡 Daily Routine

```
06:00 - Wake up
06:30 - Gym
08:30 - Breakfast, review plan
09:00 - START WORK
12:00 - Lunch break (30min)
12:30 - Continue work
15:00 - Short break (15min)
15:15 - Continue work
18:00 - Dinner break (30min)
18:30 - Final sprint
21:00 - STOP, review progress, plan tomorrow
```

---

## ✅ Completion Tracking

### Week 1 Progress (Implementation)
- [ ] Day 1 complete
- [ ] Day 2 complete
- [ ] Day 3 complete
- [ ] Day 4 complete
- [ ] Day 5 complete
- [ ] Day 6 complete
- [ ] Day 7 complete
- [ ] Day 8 complete

### Week 2 Progress (Thesis)
- [ ] Day 9 complete (Ch. 2)
- [ ] Day 10 complete (Ch. 3)
- [ ] Day 11 complete (Ch. 4)
- [ ] Day 12 complete (Ch. 5.1)
- [ ] Day 13 complete (Ch. 5.2)
- [ ] Day 14 complete (Ch. 6)
- [ ] Day 15 complete (Ch. 7+9)
- [ ] Day 16 complete (Appendix)

### Week 3 Progress (Polish)
- [ ] Day 17 complete
- [ ] Day 18 complete
- [ ] Day 19 - SUBMITTED! 🎓

---

**Good luck! You've got this! 💪**

