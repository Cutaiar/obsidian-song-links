import electron from 'electron'
import { Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import { TokenResponse, authEndpoint, clientId, generateCodeChallenge, fetchToken, scopes, fetchCurrentSong } from 'spotifyAPI';
import { getToken, storeToken } from 'localStorageToken';
import { DEFAULT_SETTINGS, PluginSettings, SettingTab } from 'settings';



export default class ObsidianSpotifyPlugin extends Plugin {
	settings: PluginSettings;

	// Inspired by: 
	// - https://stackoverflow.com/questions/73636861/electron-how-to-get-an-auth-token-from-browserwindow-to-the-main-electron-app
	// - https://authguidance.com/desktop-apps-overview/
	// - https://stackoverflow.com/questions/64530295/what-redirect-uri-should-i-use-for-an-authorization-call-used-in-an-electron-app
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
			const tokenResponse = await fetchToken(code, verifier, redirectUri)

			// If there was an issue fetching the token, error out
			if (tokenResponse === undefined) {
				new Notice('❌ Could not get song link');
				authWindow.destroy();
				return;
			}

			// Send access token and related information to main window
			electron.ipcRenderer.send("access-token-response", tokenResponse)
		})

		electron.remote.ipcMain.once("access-token-response", (event: Event, token: TokenResponse) => {
			storeToken(token)
			authWindow.destroy()
			onComplete?.();
			// TODO: Add onFail?
			// TODO: It's possible that we set up this one time listener and the signal is never sent (b/c of an error above). 
			// In this case, we might later set up duplicate listeners. Address this.

		});
	}

	/** This is an `editorCallback` function which fetches the current song an inserts it into the editor. */
	insertSongLink = async (editor: Editor, view: MarkdownView) => {
		const token = await getToken()

		// Handle the case where the function is used without first having logged in
		if (token === undefined) {
			// TODO Open settings and have the user sign in there
			new Notice('❌ Connect Spotify in Plugin Settings');
			return;
		}

		const song = await fetchCurrentSong(token.access_token);
		// TODO: Add some kind of loading state for UX clarity

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