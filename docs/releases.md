# Versions and releases

The initial game version is **0.1.0**, currently unreleased. Use [Semantic Versioning](https://semver.org/) with three components. `package.json` is the version source; `package-lock.json`, the version log and release tag must agree. Vite inserts the package version into the main menu and renders `CHANGELOG.md` into the Version log dialog. The build rejects a missing changelog entry for the current version.

## Version policy

| Change | During 0.x | After 1.0 |
| --- | --- | --- |
| Compatible bug fix, visual polish or wording correction | Patch, e.g. 0.1.1 | Patch |
| New chapters, mechanics or substantial compatible features | Minor, e.g. 0.2.0 | Minor |
| Intentional break to saved data, shared artifacts or gameplay rules | Minor, with an explicit migration and release note | Major |

Major zero signals early development; the patch/minor distinction above is this project's convention. Use `1.0.0` when the gameplay and compatibility contract are ready for a stable release. The public compatibility surface is saved progress, shared puzzle/creation artifacts, stable puzzle identifiers and their rules. Changing a displayed title, chapter order or view layout should preserve those contracts. All exact valid solutions remain accepted.

App version, save schema (`1`), rules (`vine-1`) and engine (`AngouriMath-2.5.0`) describe different things. Do not increment the schema/rules or change storage keys just because the app version changes. A change in one of those contracts requires its own compatibility decision, migration/validation checks and documentation. Never renumber old puzzle IDs to match chapter order.

Use explicit prereleases, such as `0.2.0-dev.1` or `0.2.0-rc.1`, for ongoing development after a version is released. Default-branch pushes deploy continuously once Pages Actions is enabled, so a public development build needs a distinguishable version. Do not publish changed code repeatedly under an already released version or move a published release tag.

## Prepare locally

1. Confirm the intended source branch and review the complete diff. Source lives in `web/`, `kernel/`, `bridge/` and `tests/`; `dist/` is a generated artifact. The repository currently calls its default branch `gh-pages`; the workflow follows whichever branch is default. See [deployment setup](deployment.md).
2. Set the intended version without creating a tag: `npm version 0.1.0 --no-git-tag-version` for the first release (skip if it is already 0.1.0). Add or update its `CHANGELOG.md` entry. Keep release notes focused on what changes for players, including compatibility changes when present.
3. Refresh the shared community content with `npm run sync:community`, inspect the snapshot diff and include it with the release. See [community content](community.md).
4. Run the commands below. Review desktop, compact portrait and short landscape; check chapter boundaries, a completed throw in every view, notes, saved progress, shared links and About. Record what actually ran in `docs/verification.md`.

```sh
npm ci
npm run test:content
npm run test:kernel
npm run build
npx playwright install chromium firefox webkit
npx playwright test
```

The kernel checker uses an independent exact arithmetic oracle. Browser checks use one worker. CI installs the Chromium browser and system dependencies on Linux; local runs can exercise all three browser engines. Existing FSharp.Core trimming warnings are documented; do not silently dismiss new warnings or failed checks.

Before the release commit, replace `Unreleased` in the version's heading with the actual release date. Do not invent a date before publication is planned. Commit the source, content snapshot, manifests and changelog. `npm run build:pages` stages an optional local preview at the root; those generated copies are not the source for the Actions deployment and must not be hand edited. The Actions artifact comes only from a clean `dist/` build.

## Publish when authorized

Publishing the game is a separate step from preparing these files. No game branch, tag, GitHub Release or Pages setting has been changed by the local implementation. The shared community content has been merged and pushed separately to the organization profile, as recorded in [verification.md](verification.md).

1. Enable the workflow as described in [deployment setup](deployment.md), then merge the reviewed release into the default branch. Check that the exact merged commit's build, mathematical tests, content checks and browser checks pass, and that Pages deployment succeeds.
2. Verify `angouri.org`: the version log, a first puzzle, a saved/reloaded recipe and About. Confirm the custom domain and HTTPS settings remain correct.
3. Create an annotated tag `v0.1.0` pointing to that verified commit, push the tag and create the GitHub Release with the same version's changelog text. For a prerelease, use the matching prerelease tag and mark the GitHub Release as a prerelease. Record the deployment run and its community snapshot SHA. Tags do not trigger another deployment.
4. Start the next change with a new version and changelog entry. Keep previous release entries and tags immutable.

For a GitHub Release body, write the intended Markdown to a temporary file and pass `gh release create ... --notes-file <path> --verify-tag`; do not build a multiline shell string. Specify the already verified commit when creating the tag, rather than assuming the current branch head is still the deployed commit.

If a deployment is broken, revert the offending change on the default branch and let the same tested workflow deploy the correction. Keep tags intact and issue a new patch release. A rollback involving changed save or puzzle rules needs explicit compatibility review; reverting code alone may not restore old data.
