import { createHash } from "crypto";

export const authEndpoint = "https://accounts.spotify.com/authorize";

export const clientId = "f73730e86de14041b47fc683e619fd8b";
export const scopes = ["user-read-currently-playing"];

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token: string;
}

// PKCE Flow functions
const generateRandomString = (length: number) => {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

const sha256 = (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return createHash("SHA256").update(data).digest();
};

const base64encode = (input: Buffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
};

export const generateCodeChallenge = () => {
  const codeVerifier = generateRandomString(64);
  const hashed = sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);
  return { verifier: codeVerifier, challenge: codeChallenge };
};

export const fetchToken = async (
  code: string,
  verifier: string,
  redirectUri: string
): Promise<TokenResponse | undefined> => {
  const url = "https://accounts.spotify.com/api/token";
  const payload = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  };

  const body = await fetch(url, payload);

  if (body.ok) {
    return (await body.json()) as TokenResponse;
  }
  return undefined;
};

export const refreshToken = async (
  refreshToken: string
): Promise<TokenResponse | undefined> => {
  const url = "https://accounts.spotify.com/api/token";

  const payload = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  };
  const body = await fetch(url, payload);

  if (body.ok) {
    return await body.json();
  }
  return undefined;
};

/** Return type for a song fetched from spotify */
export type Song = { link: string; name: string };

/**
 * Fetch the current playing song from spotify. Undefined if nothing playing or an error occurred.
 * `token` is expected to be a valid, non-expired, access token.
 */
export const fetchCurrentSong = async (
  token: string
): Promise<Song | undefined> => {
  const response = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (response.ok) {
    try {
      const obj = await response.json();
      if (obj.is_playing) {
        return { link: obj.item?.external_urls.spotify, name: obj.item?.name };
      }
    } catch (e: unknown) {
      console.error("Failed to parse response json in fetchCurrentSong: ", e);
      return undefined;
    }
  }
  return undefined;
};

export interface SpotifyProfile {
  display_name: string;
  external_urls: Record<string, string>;
  images: [{ height: number; width: number; url: string }];
  // There is more we don't care about
  // TODO: Use the spotify types from npm?
}

/**
 * Fetch a user's profile corresponding with accessToken from spotify.
 * @param accessToken is expected to be a valid, non-expired, access token
 * @returns Promise to a profile or undefined if an error occurred
 */
export const fetchProfile = async (
  accessToken: string
): Promise<SpotifyProfile | undefined> => {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });

  if (response.ok) {
    return await response.json();
  }
  return undefined;
};
