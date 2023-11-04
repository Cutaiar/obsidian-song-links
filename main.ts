import electron from 'electron'
import { App, ButtonComponent, Editor, MarkdownView, Notice, Plugin, PluginSettingTab } from 'obsidian';
import { TokenResponse, authEndpoint, clientId, generateCodeChallenge, fetchToken, scopes } from 'auth';

interface PluginSettings {
	linkFormat?: string; // TODO: Implement this
}

const DEFAULT_SETTINGS: PluginSettings = {
	linkFormat: undefined
}

/** Return type for a song fetched from spotify */
type Song = { link: string, name: string }

export default class ObsidianSpotifyPlugin extends Plugin {
	settings: PluginSettings;
	localStorageKey = "obsidian-spotify-access-token"

	// TODO: A way to detect a refresh the token
	// Inspired by: https://stackoverflow.com/questions/73636861/electron-how-to-get-an-auth-token-from-browserwindow-to-the-main-electron-app
	// And: https://authguidance.com/desktop-apps-overview/
	// And: https://stackoverflow.com/questions/64530295/what-redirect-uri-should-i-use-for-an-authorization-call-used-in-an-electron-app
	openSpotifyAuthModal = (onComplete?: () => void) => {
		// Build connect link
		// TODO: Not sure if this is a valid redirect URI (network tab has failure) but this works
		const redirectUri = "obsidian://callback";
		const {verifier, challenge} = generateCodeChallenge()
		const authUrl = new URL(authEndpoint) 
		const params =  {
			response_type: 'code',
			client_id: clientId,
			scope: scopes.join("%20"), // TODO do we need to encode %20? or will urlsearchaparams do it?
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
			this.storeToken(token)
			authWindow.destroy()
			onComplete?.();
			// TODO: Add onfail?
		});
	}

	/** Store the token in local storage */
	storeToken = (token: TokenResponse) => {
		const expiresAt = (Date.now() / 1000) + token.expires_in;
		localStorage.setItem("access-token-expires-at", expiresAt.toString())
		localStorage.setItem(this.localStorageKey, token.access_token)
	}

	/** Remove the token in local storage */
	clearToken = () => {
		localStorage.removeItem(this.localStorageKey)
	}

	/** Get the token in local storage */
	getToken = () => {
		return localStorage.getItem(this.localStorageKey)
	}

	// TODO catch errors
	/** Fetch the current playing song from spotify. Undefined if nothing playing */
	fetchCurrentSong = async (): Promise<Song | undefined> => {
		const token = this.getToken();

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
		const token = this.getToken()

		// Handle the case where the function is used without being authed
		// Also, we should handle if the token is expired here
		if (token === null) {
			// Either open settings and have the user sign in there OR
			// Open the sign in right here and (todo) wait for it to finish before calling insert song link again
			// await this.openSpotifyAuthModal()
			// this.insertSongLink(editor, view)
			new Notice('❌ Could not get song link');
		}

		const song = await this.fetchCurrentSong();
		if (song === undefined) {
			new Notice('❌ No song playing');
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
			name: 'Add song link',
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
	profile: SpotifyProfile | undefined

	constructor(app: App, plugin: ObsidianSpotifyPlugin) {
		super(app, plugin);
		this.plugin = plugin;

		// Check for token and fetch profile if we have one
		// TODO: We should also check expiration here
		const token = this.plugin.getToken();
		if (token) {
			fetchProfile(token).then((p) => this.profile = p);
		}

	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Manage your connection to Spotify' });
		const stack = containerEl.createDiv({cls: "stack"})
		const token = this.plugin.getToken(); // TODO: Check expiration

		// When we display, if there is a token, but not profile, fetch the profile
		if (token !== null && this.profile === undefined) {
			fetchProfile(token).then((p) => {
				this.profile = p
				this.display()
			});
		}

		// If we have a profile to display, show it
		if (this.profile !== undefined) {
			const spotifyProfile = stack.createEl("div", {cls: "profile"} )
			const image = spotifyProfile.createEl("img", {cls: "spotify-profile-img"})
			image.src = this.profile.images[0].url
			spotifyProfile.createEl("span", {text: this.profile.display_name, cls: "display-name"})
		}

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
					this.plugin.clearToken();
					this.profile = undefined;
					this.display()
				})
		}
	}
}

// Profile fetching code
interface SpotifyProfile {
	display_name: string;
	external_urls: Record<string, string>
	images: [{height: number, width: number, url: string}]
	// There is more we don't care about
}

const fetchProfile = async (accessToken: string): Promise<SpotifyProfile> => {
	const response = await fetch('https://api.spotify.com/v1/me', {
		headers: {
			Authorization: 'Bearer ' + accessToken
		}
	});
  
	const data = await response.json();
	return data;
}