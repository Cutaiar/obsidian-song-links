import electron from 'electron'
import { App, ButtonComponent, Editor, MarkdownView, Notice, Plugin, PluginSettingTab } from 'obsidian';
import { TokenResponse, authEndpoint, clientId, generateCodeChallenge, fetchToken, scopes, refreshToken, fetchProfile, SpotifyProfile, fetchCurrentSong } from 'spotifyAPI';
import { clearToken, getToken, isExpired, storeToken } from 'localStorageToken';

interface PluginSettings {
	linkFormat?: string; // TODO: Implement this
}

const DEFAULT_SETTINGS: PluginSettings = {
	linkFormat: undefined
}

export default class ObsidianSpotifyPlugin extends Plugin {
	settings: PluginSettings;

	// TODO: A way to detect a refresh the token
	// Inspired by: https://stackoverflow.com/questions/73636861/electron-how-to-get-an-auth-token-from-browserwindow-to-the-main-electron-app
	// And: https://authguidance.com/desktop-apps-overview/
	// And: https://stackoverflow.com/questions/64530295/what-redirect-uri-should-i-use-for-an-authorization-call-used-in-an-electron-app
	openSpotifyAuthModal = (onComplete?: () => void) => {
		// Build connect link
		const redirectUri = "obsidian://callback"; // Not sure if this is a reasonable redirect URI but this works
		const {verifier, challenge} = generateCodeChallenge()
		const authUrl = new URL(authEndpoint) 
		const params =  {
			response_type: 'code',
			client_id: clientId,
			scope: scopes.join(" "),
			code_challenge_method: 'S256',
			code_challenge: challenge,
			redirect_uri: redirectUri,
		}
		authUrl.search = new URLSearchParams(params).toString();

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
		authWindow.loadURL(authUrl.toString());
		authWindow.show();
		// authWindow.webContents.openDevTools();

		// TODO: Not sure i need this
		// const defaultSession = electron.remote.session.defaultSession;

		// When the user accepts, grab the auth code, exchange for an access token, and send that to the main window
		// TODO: url is deprecated apparently: https://github.com/electron/electron/blob/main/docs/api/web-contents.md#event-will-navigate
		authWindow.webContents.on("will-navigate", async (event: Event, url: string) => {
			const code = new URL(url).searchParams.get('code');

			// If we didn't get an auth code, error out
			if (code === null) {
				new Notice('❌ Could not get song link');
				authWindow.destroy();
				return;
			}

			// Exchange auth code for an access token response
			// TODO: Error checking
			const tokenResponse = await fetchToken(code, verifier, redirectUri)

			// Send access token and related information to main window
			electron.ipcRenderer.send("access-token-response", tokenResponse)
		})

		electron.remote.ipcMain.on("access-token-response", (event: Event, token: TokenResponse) => {
			// TODO: This happens more often than it should. Add a console log to see.
			storeToken(token)
			authWindow.destroy()
			onComplete?.();
			// TODO: Add onfail?
		});
	}




	/** This is an `editorCallback` function which fetches the current song an inserts it into the editor. */
	insertSongLink = async (editor: Editor, view: MarkdownView) => {
		let token = getToken()

		// Handle case of expired token
		if (token !== undefined && isExpired(token)) {
			const tokenResponse = await refreshToken(token.refresh_token); // TODO: Catch errors 
			token = storeToken(tokenResponse)
		}

		// Handle the case where the function is used without being authed
		if (token === undefined) {
			// Either open settings and have the user sign in there
			new Notice('❌ Connect Spotify in Plugin Settings');
			return;
		}

		const song = await fetchCurrentSong(token.access_token);

		// Handle case of no song playing
		if (song === undefined) {
			new Notice('❌ No song playing');
			return
		}

		// If we get here, we are good to insert the song link
		editor.replaceSelection(`[${song.name}](${song.link})`);
		new Notice('✅ Added song link')
	};

	/**
	 * onload for the plugin. Simply load settings, add the plugins command, and register a SettingTab
	 */
	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'add-song-link',
			name: 'Add song link',
			editorCallback: this.insertSongLink
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
	}

	/**
	 * onunload for the plugin. TODO: Anything?
	 */
	onunload() {
	}

	/**
	 * Default loadSettings from docs
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	/**
	 * Default saveSettings from docs
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}
}


class SettingTab extends PluginSettingTab {
	plugin: ObsidianSpotifyPlugin;
	profile: SpotifyProfile | undefined

	constructor(app: App, plugin: ObsidianSpotifyPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		// Check for token and fetch profile if we have one
		// TODO: We should also check expiration here
		const token = getToken();
		if (token !== undefined) {
			fetchProfile(token.access_token).then((p) => this.profile = p);
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
		// TODO: Check expiration?
		const token = getToken();

		// When we display, if there is a token, but not profile, fetch the profile
		if (token !== undefined && this.profile === undefined) {
			fetchProfile(token.access_token).then((p) => {
				this.profile = p
				this.display()
			});
		}

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

