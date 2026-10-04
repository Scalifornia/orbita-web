# Boring Office: architecture and design audit

The shipped game is native ES modules plus one Canvas 2D renderer. `engine.mjs` owns deterministic rules and save validation; `input.mjs` owns native keyboard/IME composition; `main.mjs` connects presentation and events. `adventure`, `campaign`, `progress` preserve document order and resumable local state. `documentImport` supports TXT, DOCX, EPUB and selectable PDF, locally. `locale` has five languages. `audio` loads the selected track after a gesture, crossfades, and keeps music/SFX volume separate. `music-store` persists personal audio locally in IndexedDB. Deployment is static GitHub Pages from `codex/orbita-evolution`.

Keep this architecture: no framework migration or backend. Existing save keys remain intact. New profile data has its own version and migration; no document text enters the profile. Adaptive pressure is opt-in at the integration boundary and disabled for the deterministic Daily mode. Boss definitions and original office vocabulary live in data, not renderer branches. All imagery, generated art and procedural retro visuals are local assets.

## Benchmarks and interpretation

- [ZType, original developer](https://phoboslab.org/log/2011/02/game-on-spotlight-z-type): immediate type-to-fire and minimal controls. Preserve one keyboard interaction loop; build an office-specific feedback hierarchy without borrowing art or code.
- [Monkeytype source](https://github.com/monkeytypegame/monkeytype): unobtrusive prompts and meaningful typing feedback. Measure observed input and show compact post-run analysis, not an enterprise dashboard.
- [Nitro Type, official description](https://www.nitrotype.com/about-us): a competitive context makes practice inviting. Use personal-best comparison and unlockable cosmetics, without accounts or punitive streaks.
- [Nitro Type casual mode](https://www.nitrotype.com/news/read/242/friends-race-update-casual-mode-pulls-up-to-the-track): match challenge to ability. Use gradual bounded pressure adjustment, not sudden speed jumps.
- [TypeRacer](https://play.typeracer.com/): clear run objective and immediate replay. Offer named 2-, 5- and 10-minute breaks with active-time limits.
- [The Typing of the Dead, publisher listing](https://store.steampowered.com/app/246580/): themed combat gives words narrative meaning. Our enemies are corporate interruptions, with original behaviours and bosses.
- [Nanotale, Fishing Cactus official trailer](https://www.youtube.com/watch?v=70dtA98aUz8): keyboard interaction can carry an entire world and text/UI languages can differ. Keep the keyboard as controller, keep custom-document language untouched and expose an independent built-in text-language override.

## Implementation strategy

Working vertical increments: measured skill/profile and deterministic missions; engine enemy rules and boss phases; cinematic/retro art and bounded feedback; integrated playable menu, result/profile, privacy, accessibility; regression and browser QA; deploy. No dead mode buttons. Priority: responsive typing, readable words, useful learning, then spectacle.
