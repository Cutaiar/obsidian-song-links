# Releasing

1. Update your `minAppVersion` in your `manifest.json` with the new minimum Obsidian version required for your new release (if any).
2. Use `npm version <major|minor|patch>`. This will:
   -  Bump the version in `manifest.json`, `package.json`, and `package-lock.json`
   -  Add an entry to `versions.json` indicating that this new version relies on the `minAppVersion` of Obsidian in your `manifest.json`
   -  Create a commit and annotated tag corresponding with the new version
   -  Log the new version in the terminal

3. Push this tag with `git push origin <new version>`. A github workflow will then run and create a draft release.
4. On Github, find the draft in "Releases", add release notes, and select "Publish release".