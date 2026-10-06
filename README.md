# f.camera

My small photography site, built with [Spacefast](https://spacefast.com) and [Spacefast Zero](https://spacefast.com/docs/zero-runtime/).

[See it live](https://f.camera) · [Use this theme with an agent](docs/CLONE_PROMPT.md)

The site has a responsive masonry gallery, small handwritten notes, and a photo viewer with camera settings and location maps. You can reuse the theme for your own photos.

## How it works

The frontend is a JSX app built with Zero's native Preact runtime. `pages/index.tsx` declares the interactive home page and renders the app from `client/index.tsx`. Components and hooks manage the gallery, photo viewer, and metadata. Spacefast compiles and mounts the page; there is no separate frontend framework or bundler to configure.

The gallery uses Zero's `contentQueryOptions` and `useQuery` to read the space's WordPress media. These hooks share Zero's query cache and lifecycle. A small capsule in `server/index.ts` declares the native media collection as publicly readable. It does not create a second photo database.

Photos belong to the space's WordPress media library. They are not copied into this repository. Publishing a code change updates the theme; it does not replace the media library. The small image under `tests/fixtures/` is only an EXIF test fixture.

| File | What it does |
| --- | --- |
| `pages/index.tsx` | Native Zero client page for `/` |
| `client/index.tsx` | Zero app entry and page composition |
| `client/components/` | JSX components for the bio, gallery, photo viewer, and map |
| `client/data/` | Typed WordPress query, photo normalization, and safe caption text |
| `client/lib/` | Date selection, newest-first order, and original-image EXIF |
| `style.css` | Layout, masonry spacing, notes, and photo viewer |
| `server/index.ts` | Zero capsule and public media collection |
| `sf.jsonc` | Zero entries, page metadata, and public asset build |
| `sample-details.json` | Sourced metadata for the example collection; no photo files |

## Run locally

Use Node.js 22 or newer. No Spacefast login is needed for the local preview.

```sh
git clone https://github.com/f/f.camera.git
cd f.camera
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. The development command starts the real `sf dev` runtime, which compiles and serves the JSX app. A local adapter supplies a small WordPress-shaped sample response. Sample image requests are read from the public f.camera media library, so displaying the photos and reading their EXIF requires an internet connection. The photos are not downloaded into the repository.

To preview your own space's public media instead:

```sh
npm run dev -- --wp-origin https://YOUR-SPACE.view.fast
```

The preview only reads public media. It does not upload photos or edit WordPress. You can use another port with `npm run dev -- --port 4174`.

Run the checks and compile the Zero project:

```sh
npm test
npm run typecheck
npm run build
```

The adapter only supplies the public media endpoint and image reads that a hosted WordPress site provides. The UI, client imports, and local runtime come from Zero. There is no local WordPress installation, so Content editing still happens on your Space. `npm run build` uses the same Zero compiler to create the deployment artifact.

## Manage photos

Open the space's Content area and edit its WordPress media library. The gallery uses these native fields:

| WordPress field | On the site |
| --- | --- |
| Title | Photo title |
| Alternative text | Image description for screen readers |
| Caption | Caption and photographer credits in the photo viewer |
| Description | Optional handwritten note over the gallery photo |

Leave Description empty for no note. Keep notes to one to three short lines; longer text is visually clipped. Line breaks are kept, while HTML formatting is removed. Notes appear only in the gallery. Keep credits in Caption so they remain available in the photo viewer.

The current gallery reads up to 100 image attachments. A new photo or an updated title, note, or caption appears on the next page load without a code deployment.

## Dates, EXIF, and maps

Photos are sorted newest first using the capture timestamp WordPress extracted from EXIF. The example photos can fall back to a verified `takenOn` date in `sample-details.json`. When neither is available, the WordPress upload date is used and labeled **Added**. Equal dates use the attachment ID, newest first. Opening a photo does not reorder the gallery.

The photo viewer reads camera, lens, exposure, capture time, and GPS from the same-origin original image. WordPress metadata fills missing fields. Original reads happen on demand, are cached for the page session, and are limited to 20 MiB and 20 seconds. Unsupported files and missing values do not get invented settings.

GPS locations show a marker on a small OpenStreetMap preview. Sourced locations for the example collection are labeled as approximate areas. A photo without a location gets no map. The map keeps its attribution and has an **Open map** link. Use the arrow keys to move between photos and Escape to close the viewer.

## Make it yours

Edit the bio, website, Instagram link, and camera kit in the JSX components under `client/components/`. Set the page title and description in `sf.jsonc`. Adjust colors, spacing, and note styles in `style.css`. Change the project name in `sf.jsonc` and `server/index.ts` when you create your own site.

For a new collection, set `sample-details.json` to `{}`. Its existing entries describe the example photos on f.camera and should not be applied to your photos. Upload your own images through your space's media library, with their titles, alt text, and credits.

Zero builds the client bundle and its platform imports. The custom stylesheet is linked from the app's head component; update its `?v=` value when changing CSS.

## Publish from GitHub

1. Fork this repository or push your copy to a repository you own.
2. Create a Spacefast space with Content enabled, or choose your existing content-managed space.
3. In the space's Builds page, connect GitHub, grant the Spacefast GitHub App access to your repository, and select it.
4. Use the repository root and `main` as the production branch. Keep the Zero runtime configured in `sf.jsonc` and enable automatic production deploys.
5. Run the first build, then upload your photos through the space's WordPress media library. Connect your custom domain in the space settings if you have one.

Later pushes to the connected production branch build and publish through Spacefast. This setup uses Spacefast's native GitHub connection. No deployment token or GitHub Actions publishing workflow is needed in this repository. See [Publish from Git](https://spacefast.com/docs/git/) for connection options.

## License and photo credits

The authored theme source is available under the [MIT license](LICENSE). Bundled Manrope and Caveat fonts keep their SIL Open Font License files. The bundled `exifr` reader keeps its MIT license. See [third-party notices](THIRD_PARTY_NOTICES.md) for the full list and example photo sources.

The example photos belong to their credited photographers. They are not photographs by me, and the theme's MIT license does not grant rights to those images. Their WordPress captions link to the original sources. Use your own photos or follow each photo's applicable terms when making your own collection.
