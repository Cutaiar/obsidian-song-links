# Releasing

## For Each Release
- Update your `manifest.json` with your new version number and the minimum Obsidian version required for your latest release.
-  Use `npm version <patch|minor|major>` bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`.
- Use the following commands to create an annotated tag with your new version number.
  
    ```cmd
    git tag -a <version> -m "<version>"
    git push origin <version>
    ```
    A github workflow will then run and create a draft release.
- Find the draft in "releases", add release notes to let users know what happened in this release, and then select Publish release.

## Adding the plugin to the community plugin list

- Check https://github.com/obsidianmd/obsidian-releases/blob/master/plugin-review.md
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.``