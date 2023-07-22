
/** Electron wrapper for localStorage.getItem(). TODO: Not returning value? Type this. */
export const getFromLocalStorage = async (window: any, key: string) => {
    window.webContents.executeJavaScript(`localStorage.getItem("${key}")`).then((value: string) => value);
}

/** Electron wrapper for localStorage.setItem(). TODO: Type this. */
export const setInLocalStorage = (window: any, key: string, value: string) => {
    window.webContents.executeJavaScript(`localStorage.setItem("${key}", "${value}")`);
}