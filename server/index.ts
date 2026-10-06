import { capsule } from "@spacefast/zero/server";

export default capsule({
  name: "f.camera",
  collections: {
    media: {
      // Use this Space's native WordPress Media Library, not a second photo store.
      label: "Photos",
      // Zero's content query hook reads this Space's WordPress media anonymously.
      publicRead: true,
      // Native title, caption, description (photo note), and image metadata suffice.
      fields: {},
    },
  },
});
