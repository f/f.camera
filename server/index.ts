import { capsule, query } from "@spacefast/zero/server";
import { readPhotoCaptions } from "./photo-captions";

export default capsule({
  name: "f.camera",
  queries: {
    photoCaptions: query((ctx) => readPhotoCaptions(ctx.env)),
  },
  collections: {
    media: {
      // Use this Space's native WordPress Media Library, not a second photo store.
      label: "Photos",
      // Zero's content query hook reads this Space's WordPress media anonymously.
      publicRead: true,
      // Native title, caption (post-it), description (postcard), and image metadata suffice.
      fields: {},
    },
  },
});
