# Tactical Arena Pro - Improvement Plan

## Executive Summary

Tactical Arena Pro is a sophisticated real-time strategy game for TikTok Live streaming with excellent architecture, comprehensive testing, and robust CI/CD. The codebase demonstrates strong engineering practices with TypeScript strict mode, event-driven architecture, and extensive test coverage. However, several areas can be improved for maintainability, performance, and scalability.

---

## 1. Architecture & Code Organization

### 1.1 Reduce Global State Coupling (High Priority)
**Issue**: `src/core/GameState.ts` exports a massive mutable `state` object (1600+ lines) that creates tight coupling across 30+ modules.

**Improvements**:
- Split `state` into domain-specific stores (GameStore, PlayerStore, SeasonStore, TelemetryStore)
- Use a lightweight state management pattern (signals, observables, or context)
- Make state updates explicit through actions/reducers rather than direct mutation
- Add TypeScript `readonly` where possible to prevent accidental mutations

### 1.2 Extract Simulation Logic from Rendering (Medium Priority)
**Issue**: `Simulation.ts` (1267 lines) mixes game logic, physics, and rendering in a single class.

**Improvements**:
- Separate `SimulationEngine` (pure logic, testable without Canvas) from `SimulationRenderer`
- Extract unit AI, pathfinding, and combat resolution into pure functions
- Enable headless simulation for testing and server-side validation

### 1.3 Modularize EventBus Event Types (Low Priority)
**Issue**: All event types defined in single `GameEvents` interface in `EventBus.ts`.

**Improvements**:
- Split into domain-specific event maps (CombatEvents, SocialEvents, SystemEvents)
- Use TypeScript module augmentation for extensibility

---

## 2. Performance Optimization

### 2.1 Object Pooling for High-Frequency Allocations (High Priority)
**Issue**: `Simulation.update()` creates many short-lived objects (particles, projectiles, effects) every frame causing GC pressure.

**Improvements**:
- Implement object pools for: `Particle`, `Projectile`, `Bomb`, `Meteor`, `Shockwave`, `FloatBadge`, `ConfettiPiece`
- Pre-allocate pools at startup based on `CAPS` constants
- Reuse objects instead of creating new ones

### 2.2 Spatial Partitioning for Collision Detection (Medium Priority)
**Issue**: O(n²) collision checks in `Simulation.update()` for units vs projectiles vs towers.

**Improvements**:
- Implement uniform grid or quadtree for broad-phase collision detection
- Only check nearby entities for narrow-phase
- Critical for scaling beyond current unit limits

### 2.3 Biome Renderer Static Layer Caching (Done ✓)
**Status**: Already implemented with `ensureStaticLayer()` caching - good work!

### 2.4 Avatar Cache Optimization (Low Priority)
**Issue**: `AvatarCache.ts` creates new canvas for each monogram; LRU eviction could be more efficient.

**Improvements**:
- Use `OffscreenCanvas` for avatar generation (non-blocking)
- Batch avatar loads with `requestIdleCallback`
- Consider WebP format for smaller data URLs

---

## 3. Testing Enhancements

### 3.1 Increase Unit Test Coverage (High Priority)
**Current State**: ~15 test files, good coverage for core systems but gaps in:
- `Simulation.ts` (only resilience tests)
- `BiomeRenderer.ts` (no tests)
- `SettingsPanel.ts` (no tests)
- `ArenaRuntime.ts` (only basic tests)

**Target**: 80%+ line coverage for all `src/` modules

### 3.2 Add Integration Tests (Medium Priority)
**Improvements**:
- Test full round lifecycle: `beginRound → deployOrder → update → finalizeRound`
- Test World Cup bracket progression
- Test persistence save/load cycles with schema migrations

### 3.3 Visual Regression Testing (Low Priority)
**Improvements**:
- Add Playwright visual snapshots for biome rendering
- Test UI states (victory overlay, telemetry modal, settings panel)
- Catch CSS regressions automatically

### 3.4 Property-Based Testing (Low Priority)
**Improvements**:
- Use `fast-check` for ElixirSystem invariants (elixir bounds, queue ordering)
- Test GiftMapper routing with generated gift IDs/names
- Fuzz test persistence sanitization functions

---

## 4. Developer Experience & Tooling

### 4.1 Add Development Scripts (Medium Priority)
**Improvements**:
```json
// package.json additions
"dev:debug": "vite --debug",
"test:watch": "vitest watch",
"test:coverage": "vitest run --coverage",
"lint:fix": "eslint src --fix",
"typecheck": "tsc --noEmit",
"analyze:bundle": "vite build --mode analyze"
```

### 4.2 Improve TypeScript Configuration (Low Priority)
**Current**: `noUnusedLocals: false`, `noUnusedParameters: false`, `verbatimModuleSyntax: false`

**Recommended**:
```json
{
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "verbatimModuleSyntax": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

### 4.3 Add API Documentation (Low Priority)
**Improvements**:
- Generate TypeDoc documentation for public APIs
- Document EventBus event payloads
- Create architecture decision records (ADRs) for major choices

---

## 5. Game Systems & Balance

### 5.1 Balance Analytics Dashboard (Medium Priority)
**Current**: `BalanceAnalytics.ts` computes stats but only shown in telemetry modal.

**Improvements**:
- Real-time balance dashboard in SettingsPanel
- Per-biome win rate alerts with configurable thresholds
- Gift usage heatmap visualization
- Export balance reports for community review

### 5.2 Dynamic Difficulty / AI Director Improvements (Medium Priority)
**Current**: `ElixirSystem` auto-deploys based on simple thresholds.

**Improvements**:
- Implement MCTS or behavior trees for AI Director
- Adaptive difficulty based on player engagement metrics
- Configurable AI personalities (aggressive, defensive, balanced)

### 5.3 Season Pass & Progression Polish (Low Priority)
**Improvements**:
- Weekly/daily challenges with unique rewards
- Cosmetic preview in SettingsPanel
- Social features: share progress, compare with friends

---

## 6. Infrastructure & Deployment

### 6.1 Bundle Size Optimization (Medium Priority)
**Current**: Single-file build with `vite-plugin-singlefile` - convenient but large.

**Improvements**:
- Code-split by route/feature (SettingsPanel, Telemetry, League modal)
- Lazy-load heavy systems (WorldCup, BiomeRenderer, SynthEngine)
- Analyze bundle with `rollup-plugin-visualizer`
- Target < 500KB gzipped for initial load

### 6.2 Service Worker Enhancement (Low Priority)
**Current**: Basic `public/sw.js` for offline caching.

**Improvements**:
- Cache-first strategy for static assets
- Stale-while-revalidate for game data
- Background sync for telemetry when offline
- Push notifications for live events (if PWA)

### 6.3 CI/CD Pipeline Enhancements (Low Priority)
**Current**: Good pipeline with lint, test, build, e2e, CodeQL.

**Improvements**:
- Add dependency license scanning
- Automated performance benchmarks (Lighthouse CI)
- Bundle size regression detection
- Automated changelog generation from conventional commits

---

## 7. Accessibility & UX

### 7.1 Accessibility Audit (High Priority)
**Current**: Some ARIA labels but incomplete.

**Improvements**:
- Full WCAG 2.1 AA compliance audit
- Keyboard navigation for all modals/panels
- Screen reader announcements for game events
- High contrast mode support
- Reduced motion preference respect

### 7.2 Mobile/Responsive Support (Medium Priority)
**Current**: Fixed 390px design width with scaling.

**Improvements**:
- Responsive layout for tablet/desktop
- Touch-friendly controls for mobile viewers
- Adaptive canvas sizing
- PWA manifest for "install as app"

---

## 8. Security & Privacy

### 8.1 Content Security Policy (Medium Priority)
**Current**: No CSP headers (single-file HTML limits this).

**Improvements**:
- Add CSP meta tag for inline scripts/styles
- Use nonce-based script loading
- Restrict external connections (WebSocket, fetch)

### 8.2 Data Privacy Compliance (Low Priority)
**Improvements**:
- Document data collected (localStorage only, no PII)
- Add data export/delete controls in SettingsPanel
- GDPR/CCPA compliance notes in README

---

## Priority Matrix

| Priority | Category | Items |
|----------|----------|-------|
| **P0 - Critical** | Architecture | Reduce global state coupling |
| **P0 - Critical** | Performance | Object pooling for particles/projectiles |
| **P0 - Critical** | Testing | Increase unit test coverage to 80%+ |
| **P0 - Critical** | Accessibility | WCAG 2.1 AA audit |
| **P1 - High** | Architecture | Separate simulation logic from rendering |
| **P1 - High** | Performance | Spatial partitioning for collisions |
| **P1 - High** | Testing | Integration tests for round lifecycle |
| **P1 - High** | Game Systems | Balance analytics dashboard |
| **P2 - Medium** | Architecture | Modularize EventBus types |
| **P2 - Medium** | Performance | Avatar cache with OffscreenCanvas |
| **P2 - Medium** | DevEx | Development scripts & stricter TS config |
| **P2 - Medium** | Game Systems | AI Director improvements |
| **P2 - Medium** | Infrastructure | Bundle size optimization & code splitting |
| **P2 - Medium** | UX | Mobile/responsive support |
| **P2 - Medium** | Security | Content Security Policy |
| **P3 - Low** | Testing | Visual regression & property-based tests |
| **P3 - Low** | DevEx | API documentation & ADRs |
| **P3 - Low** | Game Systems | Season Pass polish |
| **P3 - Low** | Infrastructure | Service Worker & CI/CD enhancements |
| **P3 - Low** | Security | Data privacy compliance |

---

## Recommended Implementation Order

### Phase 1: Foundation (Weeks 1-3)
1. [ ] Refactor global state into domain stores
2. [ ] Implement object pooling in Simulation
3. [ ] Add spatial partitioning for collisions
4. [ ] Increase unit test coverage to 60%+

### Phase 2: Quality & Testing (Weeks 4-5)
5. [ ] Add integration tests for core game loops
6. [ ] Accessibility audit & fixes
7. [ ] Stricter TypeScript config
8. [ ] Development scripts & tooling

### Phase 3: Features & Polish (Weeks 6-8)
9. [ ] Balance analytics dashboard
10. [ ] AI Director improvements
11. [ ] Bundle optimization & code splitting
12. [ ] Mobile/responsive support

### Phase 4: Advanced (Weeks 9+)
13. [ ] Visual regression testing
14. [ ] Property-based testing
15. [ ] Service Worker enhancements
16. [ ] API documentation

---

## Metrics for Success

| Metric | Current | Target |
|--------|---------|--------|
| TypeScript strictness | Partial | Full strict mode |
| Unit test coverage | ~45% | >80% |
| Integration test coverage | 0% | >50% of critical paths |
| Bundle size (gzipped) | ~800KB | <500KB |
| Frame time (p95) | Unknown | <16.67ms (60fps) |
| GC pauses per minute | Unknown | <5 |
| Accessibility score | Unknown | WCAG 2.1 AA |
| CI pipeline time | ~8 min | <5 min |

---

## Conclusion

Tactical Arena Pro has a **strong foundation** with excellent architecture patterns, comprehensive game systems, and robust testing infrastructure. The primary opportunities are:

1. **Decoupling global state** for maintainability
2. **Performance optimization** via object pooling and spatial partitioning
3. **Test coverage expansion** for confidence in changes
4. **Accessibility compliance** for inclusive streaming

These improvements will position the project for long-term scalability, easier onboarding of new contributors, and a better experience for streamers and viewers alike.