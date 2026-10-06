import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { Photo } from "../data/types";
import { PhotoImage } from "./PhotoImage";
import { PostcardStamp } from "./PostcardStamp";
import { postcardBounds, postcardTransform } from "../lib/postcard-motion.js";

const POSTCARD_TILT = -1.8;
const POSTCARD_FRONT = "rotateZ(0deg) rotateY(0deg)";
const POSTCARD_BACK = `rotateZ(${POSTCARD_TILT}deg) rotateY(180deg)`;

export type PostcardSource = {
  rect: DOMRect;
  image: HTMLButtonElement;
  trigger: HTMLButtonElement;
  previewSrc: string;
};

export function PhotoPostcard({
  photo,
  title,
  source,
  onClose,
}: {
  photo: Photo;
  title: string;
  source: PostcardSource;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const turnRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<() => void>(() => {});
  const [showBack, setShowBack] = useState(false);
  const [closing, setClosing] = useState(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const card = cardRef.current;
    const turn = turnRef.current;
    const scrim = scrimRef.current;
    if (!dialog || !card || !turn || !scrim) return;
    let current = true;
    let isClosing = false;
    let flip: Animation | undefined;
    let arrival: Animation | undefined;
    const animations: Animation[] = [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibility = source.image.style.visibility;
    let bounds = postcardBounds(source.rect, { width: window.innerWidth, height: window.innerHeight }, POSTCARD_TILT);
    const layout = () => {
      bounds = postcardBounds(source.rect, { width: window.innerWidth, height: window.innerHeight }, POSTCARD_TILT);
      Object.assign(card.style, {
        left: `${bounds.left}px`, top: `${bounds.top}px`,
        width: `${bounds.width}px`, height: `${bounds.height}px`,
      });
    };
    const animate = (element: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      const animation = element.animate(keyframes, { ...options, fill: "both" });
      animations.push(animation);
      return animation;
    };
    const finishClose = () => {
      if (!current) return;
      source.image.style.visibility = visibility;
      dialog.close();
      if (source.trigger.isConnected) source.trigger.focus({ preventScroll: true });
    };
    closeRef.current = async () => {
      if (isClosing || !current) return;
      isClosing = true;
      setClosing(true);
      setShowBack(false);
      if (reducedMotion.matches) {
        finishClose();
        return;
      }
      try {
        // A close during the turn reverses from its current angle, without a jump.
        if (flip) {
          flip.reverse();
          await flip.finished;
          if (!current) return;
        }
        const from = getComputedStyle(card).transform;
        card.style.transform = from;
        arrival?.cancel();
        const home = source.image.isConnected ? source.image.getBoundingClientRect() : source.rect;
        const departure = animate(card, [
          { transform: from },
          { transform: postcardTransform(home, bounds) },
        ], { duration: 480, easing: "cubic-bezier(0.4, 0, 0.2, 1)" });
        animate(scrim, [{ opacity: getComputedStyle(scrim).opacity }, { opacity: 0 }], { duration: 420 });
        await departure.finished;
        finishClose();
      } catch {
        // Unmounting cancels the in-flight animations.
        if (current) finishClose();
      }
    };

    dialog.showModal();
    layout();
    source.image.style.visibility = "hidden";
    if (reducedMotion.matches) {
      turn.style.transform = POSTCARD_BACK;
      scrim.style.opacity = "1";
      setShowBack(true);
    } else {
      animate(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 480 });
      arrival = animate(card, [
        { transform: postcardTransform(source.rect, bounds) },
        { transform: "translate(0, 0) scale(1)" },
      ], { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      arrival.finished.then(async () => {
        if (!current || isClosing) return;
        flip = animate(turn, [
          { transform: POSTCARD_FRONT },
          { transform: POSTCARD_BACK },
        ], { duration: 700, easing: "cubic-bezier(0.65, 0.05, 0.25, 1)" });
        await flip.finished;
        if (current && !isClosing) setShowBack(true);
      }).catch(() => {});
    }
    const resize = () => {
      if (isClosing) return;
      if (arrival?.playState === "running") arrival.finish();
      if (flip?.playState === "running") flip.finish();
      layout();
    };
    window.addEventListener("resize", resize);
    return () => {
      current = false;
      window.removeEventListener("resize", resize);
      animations.forEach((animation) => animation.cancel());
      source.image.style.visibility = visibility;
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      class="postcard-dialog"
      aria-label={`Postcard: ${title}`}
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }}
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div ref={scrimRef} class="postcard-scrim" aria-hidden="true" />
      <button
        type="button"
        class="postcard-return"
        autoFocus
        aria-disabled={closing}
        onClick={() => closeRef.current()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
        Back to photographs
      </button>
      <div ref={cardRef} class="postcard-stage">
        <div ref={turnRef} class="postcard-turn">
          <div class="postcard-face postcard-front" aria-hidden="true">
            <PhotoImage photo={{ ...photo, src: source.previewSrc, srcset: "" }} alt="" mode="postcard" highPriority />
          </div>
          <article class="postcard-face postcard-back" aria-hidden={!showBack}>
            <div class="postcard-writing" tabIndex={showBack ? 0 : -1} aria-label="Postcard note">
              <PostcardStamp />
              <p>{photo.description}</p>
            </div>
          </article>
        </div>
      </div>
    </dialog>
  );
}
