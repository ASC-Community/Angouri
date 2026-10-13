# Community and releases

Mandatory contract from the [Angouri working guidance](../../AGENTS.md) whenever a change affects community links, About, brand export, build checks, deployment or releases. Code paths are repository-relative. The wordmark itself is in [garden-brand](garden-brand.md); menu interaction also requires [focus-keyboard](focus-keyboard.md) and [layout](layout.md).

## Community and releases

The main menu contains Discord, the actual game repository on GitHub, and a version-log button. Settings contains playback preferences and the confirmed progress reset. Back from the version log returns to the main menu and restores focus. Render the log from CHANGELOG.md and take the version from package.json. Version 0.1.0 expresses early development; source directories are web/, kernel/, bridge/ and tests/, not a prototype folder. App versions are independent of saved-data and puzzle-rule versions.

The full organization profile README is the editorial source for About: introduction, etymology, projects, people and contributions. Use scripts/sync-community.mjs to refresh content/community.json; render the saved snapshot at build time with local branding, artwork and navigation. Merge useful content upstream instead of maintaining another hand-written About copy. Normal builds stay offline after dependencies are installed; the deployment workflow refreshes upstream content before building. Avoid bidirectional synchronization or runtime GitHub requests. Keep original links and biographies unless the user requests edits.

The organization README uses the same dotted-cucumber wordmark. Export it offline with scripts/export-brand.mjs, then review and copy the SVGs and notice to the organization repository's profile/branding directory. The export and Vite HTML share the same outlined font paths, canonical cucumber and reviewed metrics; do not draw a second logo or depend on GitHub loading fonts. Supply light/dark lettering variants through a picture element. Content sync omits that README-only heading because About already has its shared web wordmark.

GitHub Actions builds and checks dist/ from source before deploying from the default branch. It does not push generated files to a publishing branch. The optional --stage output is a local legacy-layout preview. Preparing workflows or releases does not itself authorize changing Pages settings or publishing the game. Follow [docs/releases.md](../releases.md) and [docs/deployment.md](../deployment.md).
