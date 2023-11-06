import { PluginSettingTab, App, ButtonComponent } from "obsidian";
import ObsidianSpotifyPlugin from "main";
import { getToken, clearToken } from "localStorageToken";
import { SpotifyProfile, fetchProfile } from "spotifyAPI";

export interface PluginSettings {
	linkFormat?: string; // TODO: Implement this
}

export const DEFAULT_SETTINGS: PluginSettings = {
	linkFormat: undefined
}

export class SettingTab extends PluginSettingTab {
	plugin: ObsidianSpotifyPlugin;
	profile: SpotifyProfile | undefined

	constructor(app: App, plugin: ObsidianSpotifyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async refreshProfile () {
		// TODO: Add some kind of loading state for UX clarity
		const token = await getToken()
		if (token !== undefined && this.profile === undefined) {
			this.profile = await fetchProfile(token.access_token);
			this.display();
		}
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Title for the settings page
		containerEl.createEl('h2', { text: 'Manage your connection to Spotify' });

		// Vertical stacked container for UI
		const stack = containerEl.createDiv({cls: "stack"})

		// Every time we display, grab the token, so we can display a Spotify profile
		this.refreshProfile()

		// If we have a profile to display, show it
		if (this.profile !== undefined) {
			const spotifyProfile = stack.createEl("div", {cls: "profile"} )
			const image = spotifyProfile.createEl("img", {cls: "spotify-profile-img"})
			image.src = this.profile?.images?.[0].url
			spotifyProfile.createEl("span", {text: this.profile.display_name, cls: "display-name"})
		}

		// Container for buttons below
		const buttons = containerEl.createDiv({cls:"buttons"})
		
		// Offer a way to connect
		const buttonMessage = this.profile ?  "Refresh connection" : "Connect Spotify"
		new ButtonComponent(buttons)
			.setButtonText(buttonMessage)
			.onClick(() => {
				this.plugin.openSpotifyAuthModal(() => this.display())
			})

		// Offer a way to disconnect
		if (this.profile !== undefined) {
			new ButtonComponent(buttons)
				.setButtonText("Disconnect Spotify")
				.setWarning()
				.onClick(() => {
					clearToken();
					this.profile = undefined;
					this.display()
				})
		}
	}
}