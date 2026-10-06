# Make your own version

Copy the prompt below into your coding agent. Fill in your details first. You can leave optional fields blank.

```text
I want my own photography site based on https://github.com/f/f.camera.

My name:
Short bio:
Website:
Instagram:
Camera kit:
Site name:
Custom domain, if I have one:
My GitHub repository, if I already have one:
My Spacefast space, if I already have one:

Clone the repository into a new project and read its README. Keep its simple design, responsive masonry gallery, handwritten post-its, secret postcards, and photo viewer with keyboard and mobile swipe navigation. Replace the example name, bio, links, camera kit, page title, description, and branding with my details. Do not invent a camera model or personal details. Remove optional links I leave blank.

Keep the native Spacefast Zero JSX/Preact structure. Use reusable components, hooks, and Zero's contentQueryOptions/useQuery for WordPress media. Let Zero compile and mount the client. The photos must live in my space's WordPress media library, with the frontend reading that space's same-origin media endpoint. Use a new content-managed space unless I named an existing one. Do not copy the example site's photo files or connect my site to f.camera's library.

Set sample-details.json to {} for my collection. Use WordPress Title for the photo title and Alternative text for its accessible description. Use Caption for an optional handwritten post-it: show it over the gallery photo and show its full text below the title in the viewer. Use Description for an optional postcard message. When Description has text, clicking the photo's title in the gallery should center and enlarge the photo, then flip it to reveal the message on a postcard with a faint stamp watermark. The postcard should return to the gallery with its back button or Escape. Clicking the gallery image opens the regular details viewer, where the title stays plain text and the full post-it sits below it. Keep both note fields as safe multiline plain text. Do not automatically copy existing content between Caption and Description. Include any required photo credits. Keep newest-first ordering, honest date fallbacks, EXIF details when available, and OpenStreetMap locations when coordinates exist. Keep the font, library, and map attribution notices.

Keep the app-owned Zero caption reader and configure its server-only WordPress credential as documented. Post-its must use the actual saved caption, never WordPress's generated rendered-caption fallback. An empty caption means no post-it, even when Description has text. Never expose the credential to the browser or commit it to Git. Keep the public-media allowlist so the query returns captions only for publicly visible photos.

Follow the documented local setup and run the checks. Verify the gallery at desktop and mobile widths, with and without post-its and postcard messages. Check the postcard animation, long messages, mobile swipes, keyboard navigation, reduced motion, credits, and the empty state. If I have not supplied photos yet, leave the honest empty state and explain where I can upload them.

Connect my GitHub repository to my Spacefast space through the native GitHub connection so pushes to the production branch deploy the theme. Keep photos in WordPress and credentials out of Git. Use my custom domain if I supplied one. When the site is live, give me its URL and the short instructions for adding photos and notes.
```

The theme source is MIT licensed. That license does not cover the example photos; see the [license and credits section](../README.md#license-and-photo-credits).
