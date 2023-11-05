import { TokenResponse } from "spotifyAPI";

const localStorageKey = "obsidian-spotify-token"

export interface StorageToken {
	access_token: string,
	expiresAt: number,
	refresh_token: string
}

/** Store the access and refresh tokens, along with an expiration date in local storage. Returns the token that was stored for convenience.  */
export const storeToken = (token: TokenResponse) => {
    const {access_token, refresh_token, expires_in} = token
    const expiresAt = Math.floor(Date.now() / 1000) + expires_in;
    const authItems: StorageToken = {
        access_token,
        expiresAt,
        refresh_token
    }
    localStorage.setItem(localStorageKey, JSON.stringify(authItems))
    return authItems;
}

/** Remove the token in local storage */
export const clearToken = () => {
    localStorage.removeItem(localStorageKey)
}

/** Get the token in local storage. May throw SyntaxError. Null return means no token exists. */
export const getToken = (): StorageToken | undefined => {
    const token = localStorage.getItem(localStorageKey)
    if (token === null) {
        return undefined;
    }

    // TODO: implement the refresh flow here

    return JSON.parse(token);
    
}

/** Check if we are past a given expiration time */
export const isExpired = (token: StorageToken) => {
    return Date.now() > token.expiresAt;
    // return true; // Uncomment to test this
}