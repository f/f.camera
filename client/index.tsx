import { createPortal } from "preact/compat";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { GalleryState, PhotoGallery } from "./components/Gallery";
import { PhotoDialog } from "./components/PhotoDialog";
import { PhotoPostcard, type PostcardSource } from "./components/PhotoPostcard";
import { PersonalIntro, SiteFooter, SiteHeader } from "./components/SiteChrome";
import { loadPhotoMedia, normalizePhotos, photoTitle } from "./data/photos";
import { loadPhotoCaptions } from "./data/photo-captions.js";
import { loadWithRetry } from "./lib/load-retry.js";
import type { Photo, WpMedia } from "./data/types";

function Head() {
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <link rel="stylesheet" href="/style.css?v=public-media-1" />
      <link rel="icon" href="/assets/favicon.svg?v=aperture-logo-1" />
      <link
        rel="preload"
        href="/assets/manrope-regular.ttf"
        as="font"
        type="font/ttf"
        crossOrigin="anonymous"
      />
      <link
        rel="preload"
        href="/assets/caveat-variable.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <meta name="theme-color" content="#ffffff" />
    </>,
    document.head,
  );
}

function PhotoCollection() {
  const [media, setMedia] = useState<WpMedia[] | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const mediaReady = Array.isArray(media);
  const [timedOut, setTimedOut] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [postcard, setPostcard] = useState<{
    photo: Photo;
    source: PostcardSource;
  } | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadWithRetry(async (signal) => {
      const value = await loadPhotoMedia("", signal);
      // A malformed photo must also retry, rather than fail later during render.
      normalizePhotos(value);
      return value;
    }, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setMedia(value); })
      .catch(() => { /* Unmount cancels the retry loop. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!mediaReady) return;
    const controller = new AbortController();
    loadWithRetry((signal) => loadPhotoCaptions("", signal), controller.signal)
      .then((value) => { if (!controller.signal.aborted) setCaptions(value); })
      .catch(() => { /* Unmount cancels the retry loop. */ });
    return () => controller.abort();
  }, [mediaReady]);

  useEffect(() => {
    if (media !== null) return;
    const timeout = window.setTimeout(() => setTimedOut(true), 18000);
    return () => window.clearTimeout(timeout);
  }, [media]);

  const photos = useMemo(
    () => media === null ? null : normalizePhotos(media, captions),
    [media, captions],
  );

  const openPhoto = useCallback((photo: Photo, button: HTMLButtonElement) => {
    opener.current = button;
    setSelectedId(photo.id);
  }, []);
  const closePhoto = useCallback(() => {
    setSelectedId(null);
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
  }, []);
  const selectedIndex = photos?.findIndex((photo) => photo.id === selectedId) ?? -1;
  const selected = selectedIndex >= 0 ? photos?.[selectedIndex] || null : null;
  const movePhoto = (direction: number) => {
    if (!photos?.length || selectedIndex < 0) return;
    setSelectedId(photos[(selectedIndex + direction + photos.length) % photos.length].id);
  };

  if (photos === null) {
    return (
      <GalleryState
        heading="Loading photographs…"
        detail={timedOut ? "Taking a little longer. Retrying automatically…" : ""}
      />
    );
  }
  if (!photos.length)
    return <GalleryState heading="No photographs yet." detail="Check back soon." />;

  return (
    <>
      <PhotoGallery
        photos={photos}
        onOpen={openPhoto}
        onPostcard={(photo, source) => setPostcard({ photo, source })}
      />
      <PhotoDialog
        photo={selected}
        index={selectedIndex}
        count={photos.length}
        onMove={movePhoto}
        onClose={closePhoto}
      />
      {postcard && (
        <PhotoPostcard
          photo={postcard.photo}
          title={photoTitle(postcard.photo, photos.findIndex((photo) => photo.id === postcard.photo.id))}
          source={postcard.source}
          onClose={() => setPostcard(null)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <>
      <Head />
      <a class="skip-link" href="#collection">
        Skip to photographs
      </a>
      <div class="page-shell">
        <SiteHeader />
        <main id="collection" tabIndex={-1}>
          <PersonalIntro />
          <h2 id="gallery-title" class="sr-only">
            Photographs
          </h2>
          <PhotoCollection />
          <noscript>
            <p class="noscript-note">Please enable JavaScript to view the photographs.</p>
          </noscript>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
