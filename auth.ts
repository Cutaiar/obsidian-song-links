export const authEndpoint = "https://accounts.spotify.com/authorize";

// TODO: this should be in an env
export const client_id = "CLIENT ID";
export const scopes = ["user-read-currently-playing"];

// Expected form: obsidian://callback/#access_token=qoq6af_B...&token_type=Bearer&expires_in=3600
// Could this be done by converting to url and then using search?
export const cleanUpRedirectHash = (url: string) => {
    return url
        .split("#")[1]
        .split("&")
        .reduce(function (initial: any, item: any) {
            if (item) {
                const parts = item.split("=");
                initial[parts[0]] = decodeURIComponent(parts[1]);
            }
            return initial;
        }, {});
}