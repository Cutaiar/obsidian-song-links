import { TokenResponse, refreshToken } from "spotifyAPI";

const localStorageKey = "obsidian-spotify-token";

export interface StorageToken {
  access_token: string /** Access Token as fetched from from Spotify */;
  expiresAt: number /** When the access token expires in seconds */;
  refresh_token: string /** Refresh Token as fetched from from Spotify */;
}

/** Store the access and refresh tokens, along with an expiration date in local storage. Returns the token that was stored for convenience.  */
export const storeToken = (token: TokenResponse) => {
  const { access_token, refresh_token, expires_in } = token;
  const expiresAt = Math.floor(Date.now() / 1000) + expires_in; // Calculate the epoch time of expiration in seconds
  const authItems: StorageToken = {
    access_token,
    expiresAt,
    refresh_token,
  };
  localStorage.setItem(localStorageKey, JSON.stringify(authItems));
  return authItems;
};

/** Remove the token in local storage */
export const clearToken = () => {
  localStorage.removeItem(localStorageKey);
};

/** Get the token in local storage. If an expired token is retrieve, it will be refreshed and stored before it is returned. May throw SyntaxError or whatever refreshToken throws. Undefined return means no token exists. */
export const getToken = async (): Promise<StorageToken | undefined> => {
  const tokenAsString = localStorage.getItem(localStorageKey);
  if (tokenAsString === null) {
    return undefined;
  }

  let token = JSON.parse(tokenAsString);

  // If any of the values of the retrieved token is undefined or null (via juggling check), bail
  if (Object.values(token).some((value) => value == undefined)) {
    return undefined;
  }

  // If token is expired, refresh it and store the new refreshed version before returning it.
  if (isExpired(token)) {
    const refreshedToken = await refreshToken(token.refresh_token);
    token = refreshedToken ? storeToken(refreshedToken) : token;
  }

  return token;
};

/** Check if we are past a given expiration time */
export const isExpired = (token: StorageToken) => {
  return Math.floor(Date.now() / 1000) > token.expiresAt;
};
