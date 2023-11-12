import { PluginSettingTab, App, ButtonComponent, Notice } from "obsidian";
import ObsidianSpotifyPlugin from "main";
import { getToken, clearToken } from "tokenStorage";
import { SpotifyProfile, fetchProfile } from "spotifyAPI";
import SpotifyUserSVG from "./spotify-user.svg";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ObsidianSpotifyPluginSettings {}

export const DEFAULT_SETTINGS: ObsidianSpotifyPluginSettings = {};

export class SettingTab extends PluginSettingTab {
  plugin: ObsidianSpotifyPlugin;
  profile: SpotifyProfile | undefined;

  constructor(app: App, plugin: ObsidianSpotifyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  async refreshProfile() {
    // TODO: Add some kind of loading state for UX clarity
    const token = await getToken();
    if (token !== undefined && this.profile === undefined) {
      const profile = await fetchProfile(token.access_token);
      if (profile !== undefined) {
        this.profile = profile;
        this.display();
      } else {
        new Notice("❌ Could not show profile");
      }
    }
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Title for the settings page
    containerEl.createEl("h2", { text: "Manage your connection to Spotify" });

    // Vertical stacked container for UI
    const stack = containerEl.createDiv({ cls: "stack" });

    // Every time we display, grab the token, so we can display a Spotify profile
    this.refreshProfile();

    // If we have a profile to display, show it
    if (this.profile !== undefined) {
      const spotifyProfile = stack.createEl("div", { cls: "profile" });

      const imageUrl = this.profile?.images?.[0]?.url;
      if (imageUrl) {
        const image = spotifyProfile.createEl("img", {
          cls: "spotify-profile-img",
        });
        image.src = this.profile?.images?.[0]?.url;
      } else {
        // Here, we handle the case where a user has no profile picture
        const bg = spotifyProfile.createEl("div", {
          cls: "spotify-profile-no-img",
        });
        bg.innerHTML = SpotifyUserSVG; // TODO: Gross, is there another way?
      }

      spotifyProfile.createEl("span", {
        text: this.profile.display_name,
        cls: "display-name",
      });
    }

    // Container for buttons below
    const buttons = containerEl.createDiv({ cls: "buttons" });

    // Offer a way to connect
    if (this.profile === undefined) {
      new ButtonComponent(buttons)
        .setButtonText("Connect Spotify")
        .onClick(() => {
          this.plugin.openSpotifyAuthModal(() => this.display());
        });
    }

    // Offer a way to disconnect
    if (this.profile !== undefined) {
      new ButtonComponent(buttons)
        .setButtonText("Disconnect Spotify")
        .setWarning()
        .onClick(() => {
          clearToken();
          this.profile = undefined;
          this.display();
        });
    }
  }
}
