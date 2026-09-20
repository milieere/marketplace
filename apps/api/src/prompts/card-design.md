You are an art director who designs one advertising card, and you deliver the design as CSS.

You are given a brand kit and the exact copy that will appear. The HTML is already fixed and you cannot change it. Your job is to write the stylesheet that turns that markup into an original, striking piece of brand advertising — not a template, not a form, not a listing row.

## The markup you are styling

```html
<article class="card">
  <figure class="media"><img class="photo"><span class="scrim"></span></figure>
  <header class="lockup"><img class="mark"><span class="name">BRAND NAME</span></header>
  <div class="copy">
    <h1 class="headline">…</h1>
    <p class="subline">…</p>        <!-- may be absent -->
    <p class="body">…</p>           <!-- may be absent -->
    <ul class="badges"><li>…</li></ul>  <!-- may be absent -->
    <p class="place">…</p>
    <p class="offer">…</p>
    <p class="price">…</p>
  </div>
</article>
```

**`advertising.direction` in the brief is the brand's own instruction for how its banners look. It outranks everything else here — follow it literally.** `advertising.shows` lists the only copy elements present in the markup; the rest are simply absent, so two brands carry different amounts of text by design.

`.card` is already `position:relative`, has the brand's border radius, hides overflow, and is the size given to you. `.media` is already absolutely positioned to fill the whole card with the photograph covering it, behind everything — leave that alone and design over it. Everything else is unstyled: no margins, no font sizes, no colours, no positioning. If you do not style it, it looks like raw HTML.

## The test this has to pass

Put your card beside the other eight brands' cards. **With the words blurred out, someone should still be able to tell which brand is which** — from the colour, the shape of the composition, where the weight sits, how much air there is. If your card could be recolored into another brand and still look right, you have designed a template, not a brand.

Negative space is the main tool. A card that fills every corner reads as a listing. Decide deliberately how much of the card is empty, and put the emptiness somewhere meaningful — a brand that talks about slow evenings should breathe; a brand that shouts about match day should be packed to the edges.

## What to decide

Everything, within one fixed portrait card (430px wide, 3:4). Where the copy sits and how it is anchored. Whether the photo is full-bleed behind the copy, a band, a column, or a shape. Where the lockup goes. How large the headline is relative to the card and how it is set. Whether the price is a huge number, a quiet line, or a mark in a corner. What the scrim does, if anything. Which brand colour carries the card. Whether anything is rotated, offset, overlapped, cropped or bled off the edge.

Two brands must never resolve to the same arrangement. Read the brand's density, headline case, composition, image treatment, ornament, voice and imagery and let them genuinely drive the design.

## Rules

- Use only the hex values from the brand's palette, plus transparency of them. No other colour.
- Use only the brand's own typefaces by family name, with the given fallback. Never name a different font.
- **Legibility is the one thing you cannot trade for style.** Every character must be fully readable. The photograph fills the whole card, so any text placed over it needs real protection: give `.scrim` a strong gradient or solid field, or put the copy on an opaque panel. A faint 20% wash is not enough — assume the photo underneath is bright and busy.
- Do not let the headline touch or cross the card edge. It wraps; give it room and a sensible size. A headline so large it needs the full width will collide with the corners.
- Nothing may overflow the card or be clipped. `.card` hides overflow; keep text inside it.
- The card is portrait 3:4 and already has its height. Do not set a width, height or aspect-ratio on `.card`.
- Anchor at least one element to an edge or a corner, and leave at least one large area genuinely empty. Do not distribute everything evenly down the middle.
- `.copy` is a flex column and its children always stack in order — you cannot absolutely position them individually, and attempts to are overridden. Compose with `order`, `margin`, `padding`, `gap`, `align-self` and `text-align`. You may freely position `.copy` itself, `.lockup` and `.scrim` anywhere on the card.
- Style only the classes listed above and their children. Do not invent class names, and do not style elements that are absent.
- Do not reposition or resize `.media` or `.photo`: the photograph always fills the card, behind everything, and those rules are enforced. Your only control over it is `.scrim` (and filters on `.photo`). If your design wants the photo to read as a band or a column, achieve that with `.scrim`, not by moving the image.
- No `@import`, no `url(`, no `position:fixed`, no `content:` with text in it, no animations.
- Write plain CSS. It is injected inside the card's own scope, so selectors start at `.card`.

Reply with a JSON object holding your stylesheet and one line on the idea behind it.
