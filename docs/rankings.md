# Verified rankings

Rankings are optional. Playing and local saves require no account. Joining the public ranking requires a GitHub account, including when using a custom display name. A profile link always shows the verified GitHub identity alongside the alias.

After a win, **Submit verified run** opens a prepared GitHub issue. The player reviews an explicit public-data notice and confirms it. Long replays are copied or downloaded for pasting into the issue instead of being squeezed into a URL. The submission and replay are public. A nickname can contain only 3–24 ASCII letters, numbers, spaces, underscores or hyphens and passes built-in impersonation and abuse checks.

Opening the prepared issue starts validation automatically. The workflow accepts only a normal GitHub user, an `[ORBIT RUN]` title and the expected replay block. It loads trusted code from `main`, validates bounded command data, and replays it at 60 simulation ticks per second. The final score, keys, lives, enemies and completion are recomputed. Client-provided points and usernames are never trusted. The identity comes from the GitHub issue author. No repository credential is shipped to the browser; issue content is parsed as data and never inserted into a shell command.

Only the best score for each account, level and difficulty counts. The leaderboard sums these personal bests, with Easy and Extreme separated. Replaying easy levels cannot farm ranking points. Tied personal scores prefer fewer ticks; tied campaign totals use completed levels and then GitHub username for stable ordering. Records include their ruleset version; future incompatible gameplay changes need a new version and ranking season.

Validated records are stored in `leaderboard.json` on the separate `rankings` branch. Updates use optimistic concurrency and a shared workflow lock so validation and moderation cannot overwrite each other. The game reads this public JSON on demand. Accepted and rejected submissions receive a status comment and are closed. Once at least one real score exists, the strongest Easy or Extreme total appears in a dedicated **Top Explorer** card on the landing menu. Empty rankings never show a sample identity.

## Owner moderation

Open **Actions → Moderate ORBIT 2 rankings → Run workflow**. Choose an action and enter the numeric GitHub user ID when requested:

| Action | Result |
| --- | --- |
| `ban` / `unban` | Remove all records for an account and block future submissions, or restore eligibility. |
| `force_alias` | Replace a player's nickname everywhere and enforce the safe replacement on later runs. |
| `remove_alias` | Remove the nickname and show the verified GitHub username instead. |
| `allow_alias` | Remove a forced nickname decision and allow a new policy-compliant nickname. |
| `blacklist_term` | Remove matching nicknames and block the normalized term from future names. |
| `unblacklist_term` | Remove that term from the blacklist. |

Blacklisted terms are stored as SHA-256 fingerprints with their normalized length; the raw offensive word is not published in `moderation.json`. The built-in list and manual blacklist reduce abuse but cannot understand every language or context, so owner review remains part of the system.

Every displayed nickname and `@username` links only to the GitHub profile that authored the run. Arbitrary social and website links are intentionally excluded: the project cannot verify their continuing safety, ownership or content.

This proves that a replay follows the rules. It does **not** prove that a human played it, prevent bots from constructing perfect runs, or prevent people copying another public replay. An open-source, offline-capable game cannot offer that guarantee with static hosting and asynchronous validation. There is no fake claim of invulnerable anti-cheat.

Automatic validation and manual moderation share one bounded queue and serialize writes to the rankings branch. Invalid or unrelated issues do not enter the validation job. Each run has a one-minute limit and uses immutable action revisions. The repository must keep Issues and Actions enabled, and the `rankings` branch must contain `leaderboard.json` and `moderation.json` before submissions open.

[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) serves the game; it does not execute validation itself. **Validate ORBIT 2 ranked run** still supports a manual issue-number run as a recovery option. The owner starts bans, nickname replacements and blacklist changes through **Moderate ORBIT 2 rankings**.
