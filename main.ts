import { App, ButtonComponent, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { authEndpoint, cleanUpRedirectHash, client_id, scopes } from 'auth';
// import { getFromLocalStorage, setInLocalStorage } from 'electron-local-storage';
import electron from 'electron'

interface PluginSettings {
	token: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	token: "" // should i use undefined?
}

/** Return type for a song fetched from spotify */
type Song = { link: string, name: string }

export default class ObsidianSpotifyPlugin extends Plugin {
	settings: PluginSettings;
	tokenKey = "spotifytoken"

	// TODO: A way to detect a refresh the token
	// Inspired by: https://stackoverflow.com/questions/73636861/electron-how-to-get-an-auth-token-from-browserwindow-to-the-main-electron-app
	// And: https://authguidance.com/desktop-apps-overview/
	// And: https://stackoverflow.com/questions/64530295/what-redirect-uri-should-i-use-for-an-authorization-call-used-in-an-electron-app
	openSpotifyAuthModal = () => {
		// Build connect link
		// TODO: Not sure if this is a valid redirect URI (network tab has failure) but this works
		const redirectUri = "obsidian://callback";
		const connectToSpotifyLink = `${authEndpoint}?client_id=${client_id}&redirect_uri=${encodeURIComponent(
			redirectUri
		)}&scope=${scopes.join("%20")}&response_type=token&show_dialog=true`;


		// Open an auth window
		const authWindow = new electron.remote.BrowserWindow({
			width: 800,
			height: 600,
			show: false,
			webPreferences: {
				nodeIntegration: false,
				webSecurity: false
			}
		});
		authWindow.loadURL(connectToSpotifyLink);
		authWindow.show();
		// authWindow.webContents.openDevTools();

		// TODO: Not sure i need this
		// const defaultSession = electron.remote.session.defaultSession;

		// When the user accepts, grab the auth token and send it to the main window
		authWindow.webContents.on("will-navigate", (event: Event, url: string) => {
			// TODO: url is deprecated apparently: https://github.com/electron/electron/blob/main/docs/api/web-contents.md#event-will-navigate
			const tokenResponse = cleanUpRedirectHash(url)
			const token = tokenResponse.access_token;
			electron.ipcRenderer.send("authtoken", token)
		})

		electron.remote.ipcMain.on("authtoken", (event: Event, token: string) => {

			// There are errors but the token is stored...
			// Also this happens like 20 times...
			// setInLocalStorage(electron.remote.getCurrentWindow(), this.tokenKey, token)
			this.settings.token = token;
			this.saveSettings()
			authWindow.destroy()
		});
	}

	// TODO catch errors
	/** Fetch the current playing song from spotify. Undefined if nothing playing */
	fetchCurrentSong = async (): Promise<Song | undefined> => {

		// TODO: DO NOT use settings for token
		// const token = getFromLocalStorage(electron.remote.getCurrentWindow(), this.tokenKey)
		const token = this.settings.token;

		const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
			headers: {
				'Authorization': `Bearer ${token}`,
			},
		});
		const obj = await response.json();
		if (obj.is_playing) {
			return { link: obj.item?.external_urls.spotify, name: obj.item?.name };
		} else {
			return undefined;
		}
	}

	/** This is an `editorCallback` function which fetches the current song an inserts it into the editor. */
	insertSongLink = async (editor: Editor, view: MarkdownView) => {

		// Handle the case where the function is used without being authed
		// Also, we should handle if the token is expired here
		if (this.settings.token === "") {
			// Either open settings and have the user sign in there OR
			// Open the sign in right here and (todo) wait for it to finish before calling insert song link again
			// await this.openSpotifyAuthModal()
			// this.insertSongLink(editor, view)
			new Notice('❌ Could not get song link');
		}

		const song = await this.fetchCurrentSong();
		if (song === undefined) {
			new Notice('❌ Could not get song link');
			return
		}
		editor.replaceSelection(`[${song.name}](${song.link})`);
		new Notice('✅ Added song link')
	};

	// Main onLoad for the plugin
	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'add-song-link',
			name: 'Add Song Link',
			editorCallback: this.insertSongLink
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
	}

	onunload() {
		// TODO: anything?
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}



class SettingTab extends PluginSettingTab {
	plugin: ObsidianSpotifyPlugin;

	constructor(app: App, plugin: ObsidianSpotifyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Manage your connection to spotify' });

		// This is temporary
		new Setting(containerEl)
			.setName('Token')
			.setDisabled(true)
			.setDesc('This should not be here')
			.addText(text => text
				.setPlaceholder('No token yet')
				.setValue(this.plugin.settings.token)
				.onChange(async (value) => {
					this.plugin.settings.token = value;
					await this.plugin.saveSettings();
				}));

		const buttonMessage = this.plugin.settings.token === "" ? "Sign into Spotify" : "Refresh sign in"
		new ButtonComponent(containerEl)
			.setButtonText(buttonMessage)
			.onClick(() => {
				this.plugin.openSpotifyAuthModal()
				// After the token is fetched, it does not show in the field above. But we are removing that setting anyway
			})

		// Offer a way to disconnect
		if (this.plugin.settings.token !== "") {
			new ButtonComponent(containerEl)
				.setButtonText("Disconnect Spotify")
				.setWarning()
				.onClick(() => {
					this.plugin.settings.token = "";
					this.plugin.saveSettings();
					// TODO refresh settings
				})
		}
	}
}
