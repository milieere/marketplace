import type { Location, Photo } from "@marketplace/contracts/brand-record";
import type { Intent, Need } from "@marketplace/contracts/intent";

function people(party: Intent["party"]): string | undefined {
  if (!party) return undefined;
  if (party.kids) return "family";
  if (party.size === 1) return "solo";
  return party.size === 2 ? "couple" : "group";
}

// Never show an amenity the location lacks, even after relaxing
function contradicts(photo: Photo, location?: Location): boolean {
  if (!location) return false;
  return (photo.attributes.amenities ?? []).some((a) => !location.attributes.amenities?.includes(a));
}

// Zero score still ranks: any usable photo beats the gradient
export function rankPhotos(photos: Photo[], party: Intent["party"], needs: Need[], location?: Location): Photo[] {
  const who = people(party);
  const wanted = needs.flatMap((n) => [n.required, n.preferred]);
  const score = (photo: Photo) =>
    (who && photo.attributes.people?.includes(who) ? 2 : 0) +
    wanted.reduce((sum, attrs) => sum + Object.entries(attrs).filter(([k, vs]) => vs.some((v) => photo.attributes[k]?.includes(v))).length, 0);
  return photos
    .filter((p) => !contradicts(p, location))
    .map((p, i) => ({ p, s: score(p), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p);
}
