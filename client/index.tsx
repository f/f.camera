import { useQuery } from "@spacefast/zero/client";
import { createPortal } from "preact/compat";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { GalleryState, PhotoGallery } from "./components/Gallery";
import { PhotoDialog } from "./components/PhotoDialog";
import { PhotoPostcard, type PostcardSource } from "./components/PhotoPostcard";
import { PersonalIntro, SiteFooter, SiteHeader } from "./components/SiteChrome";
import { createPhotosQuery, loadSampleDetails, normalizePhotos, photoTitle } from "./data/photos";
import type { Photo, SampleDetails } from "./data/types";

function Head() {
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <link rel="stylesheet" href="/style.css?v=photo-postcard-3" />
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

function PhotoCollection({ attempt, onRetry }: { attempt: number; onRetry: () => void }) {
  const query = useMemo(() => createPhotosQuery(attempt), [attempt]);
  const media = useQuery(query);
  const captions = useQuery<Record<string, string>>("photoCaptions");
  const [samples, setSamples] = useState<Record<string, SampleDetails> | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [postcard, setPostcard] = useState<{
    photo: Photo;
    source: PostcardSource;
  } | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let mounted = true;
    loadSampleDetails().then((details) => {
      if (mounted) setSamples(details);
    });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (media !== undefined && samples !== null) return;
    const timeout = window.setTimeout(() => setTimedOut(true), 18000);
    return () => window.clearTimeout(timeout);
  }, [media, samples]);

  const photos = useMemo(() => {
    if (!Array.isArray(media) || samples === null) return null;
    try {
      return normalizePhotos(media, samples, captions);
    } catch {
      return null;
    }
  }, [media, samples, captions]);

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

  if (media === undefined || samples === null) {
    return timedOut ? (
      <GalleryState
        heading="Could not load photographs."
        detail="Please try again in a moment."
        onRetry={onRetry}
      />
    ) : (
      <GalleryState heading="Loading photographs…" />
    );
  }
  if (!photos)
    return (
      <GalleryState
        heading="Could not load photographs."
        detail="Please try again in a moment."
        onRetry={onRetry}
      />
    );
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
  const [attempt, setAttempt] = useState(0);
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
          <PhotoCollection
            key={attempt}
            attempt={attempt}
            onRetry={() => setAttempt((value) => value + 1)}
          />
          <noscript>
            <p class="noscript-note">Please enable JavaScript to view the photographs.</p>
          </noscript>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
