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

Clone the repository into a new project and read its README. Keep its simple design, responsive masonry gallery, handwritten notes, and keyboard photo viewer. Replace the example name, bio, links, camera kit, page title, description, and branding with my details. Do not invent a camera model or personal details. Remove optional links I leave blank.

Use Spacefast and Spacefast Zero as the project already does. The photos must live in my space's WordPress media library, with the frontend reading that space's same-origin media endpoint. Use a new content-managed space unless I named an existing one. Do not copy the example site's photo files or connect my site to f.camera's library.

Set sample-details.json to {} for my collection. Use the WordPress Title, Alternative text, and Caption fields for photo titles, accessible descriptions, and credits. Use Description for optional short handwritten notes. Keep newest-first ordering, honest date fallbacks, EXIF details when available, and OpenStreetMap locations when coordinates exist. Keep the font, library, and map attribution notices.

Follow the documented local setup and run the checks. Verify the gallery at desktop and mobile widths, with and without notes. Check keyboard navigation, credits, and the empty state. If I have not supplied photos yet, leave the honest empty state and explain where I can upload them.

Connect my GitHub repository to my Spacefast space through the native GitHub connection so pushes to the production branch deploy the theme. Keep photos in WordPress and credentials out of Git. Use my custom domain if I supplied one. When the site is live, give me its URL and the short instructions for adding photos and notes.
```

The theme source is MIT licensed. That license does not cover the example photos; see the [license and credits section](../README.md#license-and-photo-credits).
