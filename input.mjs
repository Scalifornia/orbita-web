// Keep the real text field intact so mobile keyboards can manage their own IME.
// Compare graphemes without accents/case: changing "a" to "á" is not a new shot.
function characters(value, exact = false) {
  return Array.from(value.normalize("NFC"), (text) => ({
    text,
    key: exact ? text : text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase(),
  })).reduce((result, character) => {
    if (!character.key && result.length) result[result.length - 1].text += character.text;
    else if (character.key) result.push(character);
    return result;
  }, []);
}

function insertedText(previousValue, nextValue, exact = false) {
  const previous = characters(previousValue, exact);
  const next = characters(nextValue, exact);
  let start = 0;
  while (start < previous.length && start < next.length && previous[start].key === next[start].key) start++;
  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (previousEnd > start && nextEnd > start && previous[previousEnd - 1].key === next[nextEnd - 1].key) {
    previousEnd--;
    nextEnd--;
  }
  return next.slice(start, nextEnd).map((character) => character.text).join("");
}

function appendedLatinText(previousValue, nextValue) {
  const previous = characters(previousValue);
  const next = characters(nextValue);
  if (next.length < previous.length || previous.some((character, index) => character.key !== next[index].key)) {
    return null;
  }
  const appended = next.slice(previous.length).map((character) => character.text).join("");
  return /^[\p{Script=Latin}\p{Mark}\s]*$/u.test(appended) ? appended : null;
}

export class TypingInput {
  constructor(inputElement, onText) {
    this.input = inputElement;
    this.onText = onText;
    this.exact = false;
    this.previousValue = inputElement.value;
    this.composing = false;
    this.compositionDeferred = false;
    this.discardComposition = false;
    this.discardedCommitValue = null;
    this.pendingFormat = null;
    this.compositionTail = null;

    this.handleCompositionStart = () => {
      this.composing = true;
      this.compositionDeferred = false;
      this.discardComposition = false;
      this.discardedCommitValue = null;
      this.compositionTail = null;
    };
    this.handleCompositionEnd = () => {
      this.composing = false;
      this.compositionDeferred = false;
      if (this.discardComposition) {
        this.discardComposition = false;
        this.discardedCommitValue = this.input.value;
        this.input.value = "";
        this.previousValue = "";
        this.pendingFormat = null;
        return;
      }
      // Keep the final value until the keyboard's possible trailing input event.
      this.commit(false, false, true);
    };
    this.handleInput = (event) => {
      if (this.compositionTail && !event.isComposing) {
        const tail = this.compositionTail;
        this.compositionTail = null;
        if (this.input.value === tail.raw) {
          this.input.value = tail.formatted;
          this.previousValue = tail.formatted;
          return;
        }
        if (this.input.value.startsWith(tail.raw) && !this.input.value.startsWith(tail.formatted)) {
          this.previousValue = tail.raw;
        }
      }
      if (this.composing || event.isComposing) {
        this.composing = true;
        this.streamComposition();
        return;
      }
      if (this.discardedCommitValue !== null) {
        const discardedValue = this.discardedCommitValue;
        this.discardedCommitValue = null;
        if (this.input.value === discardedValue || /Composition/.test(event.inputType || "")) {
          this.input.value = "";
          this.previousValue = "";
          return;
        }
      }
      this.commit(event.inputType?.startsWith("delete"));
    };

    inputElement.addEventListener("input", this.handleInput);
    inputElement.addEventListener("compositionstart", this.handleCompositionStart);
    inputElement.addEventListener("compositionend", this.handleCompositionEnd);
  }

  streamComposition() {
    if (this.exact || this.discardComposition || this.compositionDeferred) return;
    const value = this.input.value;
    const appended = appendedLatinText(this.previousValue, value);
    if (appended === null) {
      // Candidate replacements and non-Latin composition wait for commitment.
      // Letters already fired cannot be rolled back if a candidate changes them.
      this.compositionDeferred = true;
      return;
    }
    // Gboard may keep a whole Latin word composing: shoot each added letter now.
    // Preserve its field and baseline so accent rewrites/final input cannot replay it.
    this.previousValue = value;
    if (appended) this.onText(appended);
  }

  commit(deleting = false, allowCleanup = true, compositionEnd = false) {
    const value = this.input.value;
    const inserted = deleting ? "" : insertedText(this.previousValue, value, this.exact);
    this.previousValue = value;
    // A word boundary with the caret at the end is safe for bounded cleanup.
    // Never clear after each letter; that breaks long-press accents and IMEs.
    if (allowCleanup && value.length > 256 && /\s$/u.test(value) &&
        this.input.selectionStart === value.length && this.input.selectionEnd === value.length) {
      this.input.value = "";
      this.previousValue = "";
    }
    if (inserted) this.onText(inserted);
    this.applyFormat(compositionEnd);
  }

  // The game supplies its accepted transcript, including automatic word spaces.
  // During an IME composition only the visible echo is formatted; the native
  // buffer is updated after commitment so Gboard can keep composing normally.
  format(value) { this.pendingFormat = String(value); }

  applyFormat(compositionEnd = false) {
    if (this.composing || this.pendingFormat === null) return;
    const raw = this.input.value;
    const formatted = this.pendingFormat;
    this.pendingFormat = null;
    if (raw === formatted) return;
    this.input.value = formatted;
    this.previousValue = formatted;
    this.input.setSelectionRange?.(formatted.length, formatted.length);
    if (compositionEnd) this.compositionTail = { raw, formatted };
  }

  reset() {
    // A restart during composition must not send the old commit into a new game.
    this.discardComposition = this.composing;
    this.compositionDeferred = false;
    this.discardedCommitValue = null;
    this.pendingFormat = null;
    this.compositionTail = null;
    this.input.value = "";
    this.previousValue = "";
  }

  destroy() {
    this.input.removeEventListener("input", this.handleInput);
    this.input.removeEventListener("compositionstart", this.handleCompositionStart);
    this.input.removeEventListener("compositionend", this.handleCompositionEnd);
  }
}
