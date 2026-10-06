/** @typedef {{ identifier: number, clientX: number, clientY: number }} Contact */

export function createPhotoSwipe() {
  /** @type {Contact | null} */
  let start = null;
  let horizontal = false;

  const cancel = () => {
    start = null;
    horizontal = false;
  };

  /** @param {ArrayLike<Contact>} contacts @param {number} scale */
  const move = (contacts, scale = 1) => {
    if (!start) return 0;
    const contact = contacts[0];
    if (contacts.length !== 1 || contact.identifier !== start.identifier || scale > 1.01) {
      cancel();
      return 0;
    }
    const x = contact.clientX - start.clientX;
    const y = contact.clientY - start.clientY;
    if (!horizontal && Math.max(Math.abs(x), Math.abs(y)) < 10) return 0;
    // Once a gesture turns vertical, leave it to the browser for its entire lifetime.
    if (Math.abs(x) <= Math.abs(y) * 1.3) {
      cancel();
      return 0;
    }
    horizontal = true;
    return x;
  };

  return {
    /** @param {ArrayLike<Contact>} contacts @param {number} scale */
    begin(contacts, scale = 1) {
      cancel();
      if (contacts.length === 1 && scale <= 1.01) {
        const { identifier, clientX, clientY } = contacts[0];
        start = { identifier, clientX, clientY };
      }
    },
    move,
    /** @param {ArrayLike<Contact>} contacts @param {number} remaining @param {number} scale */
    end(contacts, remaining = 0, scale = 1) {
      const distance = remaining === 0 ? move(contacts, scale) : 0;
      cancel();
      return Math.abs(distance) >= 50 ? (distance < 0 ? 1 : -1) : 0;
    },
    cancel,
  };
}
