# Verified rankings

Rankings are optional. Playing and local saves require no account. Joining the public ranking requires a GitHub account, including when using a custom display name. A profile link always shows the verified GitHub identity alongside the alias.

After a win, **Submit verified run** opens a prepared GitHub issue. The player reviews and confirms it. Long replays are copied or downloaded for pasting into the issue instead of being squeezed into a URL. The submission and replay are public.

GitHub Actions loads trusted code from `main`, validates bounded command data, and replays it at 60 simulation ticks per second. The final score, keys, lives, enemies and completion are recomputed. Client-provided points and usernames are never trusted. The identity comes from the GitHub issue author. No repository credential is shipped to the browser; issue content is never executed as code.

Only the best score for each account, level and difficulty counts. The leaderboard sums these personal bests, with Easy and Extreme separated. Replaying easy levels cannot farm ranking points. Tied personal scores prefer fewer ticks; tied campaign totals use completed levels and then GitHub username for stable ordering. Records include their ruleset version; future incompatible gameplay changes need a new version and ranking season.

Validated records are stored in `leaderboard.json` on the separate `rankings` branch. Updates use optimistic concurrency so simultaneous submissions cannot overwrite each other. The game reads this public JSON on demand. Accepted and rejected submissions receive a status comment and are closed automatically.

This proves that a replay follows the rules. It does **not** prove that a human played it, prevent bots from constructing perfect runs, or prevent people copying another public replay. An open-source, offline-capable game cannot offer that guarantee with static hosting and asynchronous validation. There is no fake claim of invulnerable anti-cheat.

The workflow runs on issue creation only. A manual run exercises validator and storage tests without publishing a player's score. The repository must keep Issues and Actions enabled, and the `rankings` branch must be initialized before submissions open.

Implementation uses GitHub's [issue workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issues). [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) serves the game; it does not execute validation itself.
