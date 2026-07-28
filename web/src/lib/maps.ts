// Google's cross-platform maps URL. On a phone this hands off to the native
// Google Maps app when it's installed and falls back to the browser when it
// isn't, so the same link works from the desktop app and the home-screen PWA.
export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
