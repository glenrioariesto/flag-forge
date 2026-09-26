/**
 * Canonical flag image URL.
 *
 * Two renderers need flags (the Pixi sprite and the chat header thumbnail) and
 * both used to hand-roll the CDN host and the lowercase normalization
 * separately, so a host change or a normalization change had to be made twice
 * with nothing enforcing agreement. Size stays a caller decision on purpose:
 * the sprite and the thumbnail need different resolutions, which is a
 * different rule, not a duplicate one.
 */
export function flagUrl(country: string, width: number, height: number): string {
  return `https://flagcdn.com/${width}x${height}/${country.toLowerCase()}.png`;
}
