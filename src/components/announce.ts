/** Sends a short message to the screen-reader live region and the visible toast. */
export const announce = (message: string) => window.dispatchEvent(new CustomEvent("nr:announce", { detail: message }));
