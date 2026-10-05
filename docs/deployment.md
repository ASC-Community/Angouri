# GitHub Pages deployment

The repository currently uses `gh-pages` as its default branch and publishes the repository root through the legacy **Deploy from a branch** setting. The custom domain is `angouri.org`.

The [Pages workflow](../.github/workflows/pages.yml) replaces branch-output publishing with a source build. It installs Node.js 24 and the .NET SDK selected by `global.json`, installs `wasm-tools`, refreshes and checks the local community snapshot, runs the exact kernel tests, builds the F#/WebAssembly and TypeScript site, and runs the browser suite in Chromium. Only a successful build from the current default branch can upload and deploy `dist/`.

## Activate the workflow

1. Merge the workflow and the `sync:community` script into the default branch.
2. Open **Settings**, then **Pages**, then **Build and deployment**, and change **Source** from **Deploy from a branch** to **GitHub Actions**.
3. Keep `angouri.org` in **Custom domain**. The build copies `web/public/CNAME` into `dist/`, and CI rejects an artifact whose CNAME differs. Keep **Enforce HTTPS** enabled once GitHub confirms the domain.
4. Run **Build and deploy Pages** on the default branch with **Run workflow**, or let the next default-branch push start it. Confirm that the `github-pages` environment deployment completes and that its reported URL serves the new build.

If the `github-pages` environment has custom deployment-branch protection, allow the repository's default branch before the first run. No deployment or Settings change is performed by adding these files.

## Trigger behavior

| Event | Result |
| --- | --- |
| Pull request | Clean build, kernel tests, artifact checks, and Chromium tests; no deployment |
| Push to the default branch | Build and tests, then artifact upload and deployment |
| Push to another branch | Workflow is recognized, but build and deployment jobs are skipped |
| Manual run on the default branch | Build, tests, and deployment |
| Manual run on another branch | Build and tests only |
| Release tag push | No workflow run and no second deployment |

The workflow compares its ref with `github.event.repository.default_branch`; it does not hard-code `gh-pages`. A future default-branch rename to `main` therefore needs no workflow edit, although repository protection and the `github-pages` environment rules should be reviewed after a rename. This task does not rename the branch.

The build job has read-only repository permission. The deploy job receives only `pages: write` and `id-token: write`, and deployments are serialized. The community sync changes only the temporary checkout used for the build; the workflow does not commit generated output, push a publishing branch, or write to another repository. `dist/` is uploaded directly with GitHub's official Pages artifact action.

## Local builds and releases

Use `npm run build` for the same clean `dist/` build used by CI. `npm run build:pages` invokes the older `--stage` convenience path, which also copies the generated site into the repository root for local inspection of the legacy branch layout. It is not the workflow's publication path, and its staged output should not be committed as a deployment step.

Version adoption and release tagging are documented in [releases.md](releases.md). Release tags do not deploy independently; publication follows a successful default-branch build.

The workflow structure follows GitHub's [custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
