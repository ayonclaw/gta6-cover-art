// Fixed screenshot scenes: the same query parameters also make judging renders repeatable.
const VALID_PHOTOS = new Set(['boulevard', 'pier']);
const VALID_SIZES = new Set(['square', 'portrait', 'wide', 'link']);

export function readShotSettings(search) {
  const query = new URLSearchParams(search);
  const requestedPhoto = (query.get('photo') ?? 'boulevard').replace(/\.jpg$/i, '');
  const requestedSize = query.get('size') ?? 'square';
  return {
    shot: query.get('shot') ?? '',
    photo: VALID_PHOTOS.has(requestedPhoto) ? requestedPhoto : 'boulevard',
    caption: query.get('caption') ?? 'SUNSET HEIST',
    size: VALID_SIZES.has(requestedSize) ? requestedSize : 'square',
  };
}

export function markShotReady(ready) {
  window.__shotReady = Boolean(ready);
}
