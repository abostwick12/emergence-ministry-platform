# Team Trivia Guide

Lead Emergence includes a Team Trivia module for staff-hosted youth-room games. Teams join with one phone per team; students do not need accounts and the app does not collect student names.

## Create Or Edit A Game

Open **Games**, then choose **Create Game** or edit an existing EMERGE Trivia set. Set the game title, description, scoring defaults, and whether answer choices should be randomized.

Question timers support **5 to 300 seconds**. Use the preset buttons for 10, 15, 20, 30, 45, 60, 90, or 120 seconds, or enter a custom duration. Each question can override the game-wide default.

## Categories And Themes

Each category has an editable presentation theme:

- background image or graphic
- category icon
- accent style and color
- transition animation
- optional category intro slide

Seeded categories include ready-made defaults for Summer, Ice Cream, Animals, Bible, and Random Knowledge. New categories use a clean default theme until staff customize it. Themes are applied mainly to the presentation screen; phones use a simplified version so answer buttons stay easy to tap.

## Questions

Each MVP question is multiple choice. A question needs at least two answers and exactly one correct answer. Four answers are shown by default. Tie-breakers are marked as host-controlled and are not included in normal flow unless launched by the host.

## Audio

Audio is optional. The game works when no audio is configured or when a browser blocks autoplay.

Supported metadata:

- track name
- file URL
- duration
- intended use: countdown, tie-breaker, final reveal, warning, expired, or winner
- loop setting
- align-to-countdown-end setting
- uploaded by
- created date

Use only locally uploaded, church-owned, properly licensed, royalty-free, or public-domain audio. Do not embed or stream copyrighted songs from YouTube, Spotify, Apple Music, or similar services.

The host must press **Enable Game Audio** once before the session begins. Hosts can mute and adjust volume. Question audio starts with the timer and stops when the question closes. If the host adds time in 15-second increments, the authoritative session timer updates for host, presentation, and phones.

## Launch A Lobby

From **Games**, choose **Host Game**. The host console shows a QR code, join code, PIN, connected team count, team names, and a link to open the presentation screen.

Teams visit `/play/[joinCode]`, enter their team name and PIN, and join the lobby. Team names are unique per session. Reconnection uses a secure browser cookie so refreshing the same phone restores the same team.

## Control A Round

The host controls pacing:

1. Start the game from the lobby.
2. Show the category intro slide.
3. Start the question timer.
4. Watch the answered-team count.
5. Add 15 seconds if needed.
6. Close responses.
7. Reveal the answer.
8. Move to the next question or end the game.

Answers lock after submission. Teams cannot change an accepted answer. Correct answers are not exposed to phones before host reveal.

## Scoring

Default scoring:

- correct base points: 1000
- maximum speed bonus: 300
- incorrect answer: 0
- unanswered question: 0

Speed bonus is calculated server-side:

```text
round(max_speed_bonus * max(0, 1 - response_time_ms / question_duration_ms))
```

The server uses its own timestamp, not a team phone clock.

## Winner Celebration

When the host completes the game, the presentation screen can run a winner reveal with suspense countdown, winning team name, score, top-three podium, confetti, optional fireworks, and optional trophy treatment. Hosts can skip or replay the celebration. Reduced-motion settings are respected, and celebration effects do not affect persisted results.

## Results

Open a game's **Results** page to review completed sessions, final leaderboard, accuracy, correct answers, and question analytics. CSV export is a follow-up because this repository does not yet have a shared export pattern.

## Database Tables

Migration `supabase/migrations/005_games_team_trivia.sql` adds:

- `games`
- `game_audio_tracks`
- `game_categories`
- `game_questions`
- `game_answer_options`
- `game_sessions`
- `game_teams`
- `game_responses`
- `game_score_adjustments`
- `game_session_events`

It also adds a private `app_private.submit_game_response` function for atomic server-authoritative answer submission.

## RLS And Realtime

All new tables have RLS enabled. Authenticated staff can manage games and sessions. Direct anonymous table browsing is denied; public phones should use scoped Next.js route handlers or RPC flows. Realtime channels should be scoped by session ID, such as `game-session:[sessionId]`, and should broadcast state updates only after database writes succeed.

Correct-answer data must not be broadcast to public phones until answer reveal.

## Environment Variables

No new environment variables are required for the local MVP. Supabase and Vercel continue to use the existing project variables.

## Migration Instructions

Review the migration, apply it to the intended Supabase environment, and verify RLS before exposing live data. Do not apply destructive database changes against production without a rollback plan.

## Test Commands

Run:

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

## Manual Youth-Room Checklist

- Host laptop can open the host console.
- Projector can open the presentation screen.
- At least five phones can scan the QR code.
- Duplicate team names are rejected.
- Phone refresh restores the same team.
- Temporary Wi-Fi interruption recovers after refresh.
- Timer is visible from across the room.
- Category intro slides appear before each category.
- Question theme does not reduce readability.
- Answer buttons are easy to tap.
- Submitted answers lock.
- Host can add 15 seconds while a question is open.
- Scores calculate correctly.
- Host can close and reveal manually.
- Winner celebration can be skipped and replayed.
- Audio can be enabled, muted, previewed, and run without breaking the game.
- Final results and analytics are reviewable.

The feature is not operationally approved until it has been tested with multiple real devices on the church Wi-Fi.
