import { createHash } from "crypto";

export const authEndpoint = "https://accounts.spotify.com/authorize";

export const clientId = "f73730e86de14041b47fc683e619fd8b";
export const scopes = ["user-read-currently-playing"];

export interface TokenResponse {
    access_token: string 
    expires_in: number 
    token_type: string
    scope: string,
    refresh_token: string
}

// PKCE Flow functions
const generateRandomString = (length: number) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
  }

const sha256 = (plain: string) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(plain)
    return createHash('SHA256').update(data).digest()
}

const base64encode = (input: Buffer) => {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

export const generateCodeChallenge = () => {
    const codeVerifier = generateRandomString(64);
    const hashed = sha256(codeVerifier)
    const codeChallenge = base64encode(hashed);
    return {verifier: codeVerifier, challenge: codeChallenge}
}

export const fetchToken = async (code: string, verifier: string, redirectUri: string): Promise<TokenResponse> => {
  
    const url = "https://accounts.spotify.com/api/token"
    const payload = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    }
  
    const body = await fetch(url, payload);
    const response = await body.json() as TokenResponse;
  
    return response;
  }

export const refreshToken = async (refreshToken: string) => {

    const url = "https://accounts.spotify.com/api/token";
 
     const payload = {
       method: 'POST',
       headers: {
         'Content-Type': 'application/x-www-form-urlencoded'
       },
       body: new URLSearchParams({
         grant_type: 'refresh_token',
         refresh_token: refreshToken,
         client_id: clientId
       }),
     }
     const body = await fetch(url, payload);
     const response = await body.json();
 
     return response;
}