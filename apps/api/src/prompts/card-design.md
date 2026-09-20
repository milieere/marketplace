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

## Non-negotiables

These exist because the same four mistakes keep ruining otherwise good cards. Satisfy all four before you think about style.

1. **Copy sits on its own surface, never bare on the photograph.** Give `.copy` a solid background, or a gradient that reaches full opacity behind the text, or give `.scrim` a gradient fully opaque where the copy lands. Assume the photo behind is bright, busy and light. A 30-50% wash is not enough.
2. **The headline fits.** `font-size` between 30px and 46px, `line-height` 1.0-1.15, at most three lines. Longer copy takes the smaller end. Keep 24-36px of padding so it never touches an edge.
3. **The photograph is visibly the hero.** Leave at least 40% of the card showing the image, unobstructed and in one continuous area. Never cover the whole photo with a panel, and never leave a large flat region that is neither photo nor a deliberate brand colour field - that reads as a rendering bug, not as space.
4. **The composition fits in 573px of height.** Add up padding, headline, body and price. If it will not fit, reduce type and spacing rather than overflow.

## What to decide

Everything else. Where the copy band sits and how deep it is. Where the lockup goes. How the scrim shapes the photo - a bottom gradient, a side fade, a hard colour block, a tint. How large the price is and whether it is a number, a line or a mark. Which brand colour carries the card. What is rotated, offset, overlapped or bled off an edge.

Put your card beside the other brands'. **With the words blurred out, someone should still tell which brand is which** - from colour, from where the weight sits, from how much air there is. If your card could be recoloured into another brand and still look right, you designed a template.

Negative space is the main tool, but it must look chosen: a brand that talks about slow evenings breathes; a brand that shouts about match day is packed to the edges.

## A card that satisfies all of this

For a warm, airy brand with a serif display face, bottom-anchored:

```css
.card { font-family: Inter, system-ui, sans-serif; }
.scrim { background: linear-gradient(to top, #2B2118 0%, #2B2118 42%, rgba(43,33,24,.72) 58%, rgba(43,33,24,0) 82%); }
.lockup { position: absolute; top: 28px; left: 28px; display: flex; align-items: center; gap: 10px; }
.mark { height: 34px; }
.name { font: 700 15px Fraunces, Georgia, serif; letter-spacing: .18em; text-transform: uppercase; color: #F6EFE6; }
.copy { position: absolute; left: 0; right: 0; bottom: 0; padding: 28px; color: #F6EFE6; }
.headline { font: 800 38px/1.08 Fraunces, Georgia, serif; letter-spacing: -.015em; margin-bottom: 16px; }
.subline { font-size: 15px; font-weight: 600; color: #F2A541; margin-bottom: 10px; }
.body { font-size: 14px; line-height: 1.5; opacity: .85; margin-bottom: 18px; }
.place { font-size: 13px; opacity: .8; margin-bottom: 4px; }
.offer { font-size: 13px; opacity: .7; }
.price { font: 800 30px Fraunces, Georgia, serif; color: #F2A541; margin-top: 6px; }
```

The scrim is fully opaque where text lands, the top 40% of the photo is untouched, the headline is one clear size, the stack is bottom-anchored. **Do not copy this arrangement** - it is one solution. Yours must come from your own brand's direction.

## Rules

- Use only the hex values from the brand's palette, plus transparency of them. No other colour.
- Use only the brand's own typefaces by family name, with the given fallback. Never name a different font.
- **Legibility is the one thing you cannot trade for style.** Every character must be fully readable. The photograph fills the whole card, so any text placed over it needs real protection: give `.scrim` a strong gradient or solid field, or put the copy on an opaque panel. A faint 20% wash is not enough — assume the photo underneath is bright and busy.
- Do not let the headline touch or cross the card edge. It wraps; give it room and a sensible size. A headline so large it needs the full width will collide with the corners.
- Nothing may overflow the card or be clipped. `.card` hides overflow; keep text inside it.
- The card is 430 x 573px portrait and already has its height. Do not set a width, height or aspect-ratio on `.card`.
- Anchor at least one element to an edge or a corner, and leave at least one large area genuinely empty. Do not distribute everything evenly down the middle.
- `.copy` is a flex column and its children always stack in order — you cannot absolutely position them individually, and attempts to are overridden. Compose with `order`, `margin`, `padding`, `gap`, `align-self` and `text-align`. You may freely position `.copy` itself, `.lockup` and `.scrim` anywhere on the card.
- Style only the classes listed above and their children. Do not invent class names, and do not style elements that are absent.
- Do not reposition or resize `.media` or `.photo`: the photograph always fills the card, behind everything, and those rules are enforced. Your only control over it is `.scrim` (and filters on `.photo`). If your design wants the photo to read as a band or a column, achieve that with `.scrim`, not by moving the image.
- No `@import`, no `url(`, no `position:fixed`, no `content:` with text in it, no animations.
- Write plain CSS. It is injected inside the card's own scope, so selectors start at `.card`.

Before you answer, check your stylesheet against the four non-negotiables in order. Then reply with a JSON object holding the stylesheet and one line on the idea behind it.
