/**
 * Contact form enhancement — Part 1, Option B.
 *
 * This file is a layer, not a prerequisite. With it blocked, the browser's own
 * constraint validation still refuses to submit an incomplete form, still
 * reports the problems, and the stylesheet still colours the fields through
 * :user-invalid and :user-valid. Nothing here is load-bearing.
 *
 * What it adds:
 *   - specific wording in place of "Please fill out this field"
 *   - a summary that says how many fields need attention
 *   - focus moved to the first problem field
 *   - a JSON log of every error the reader ran into, submitted with the form
 *
 * novalidate is never set. The only native behaviour suppressed is the error
 * bubble, so it does not duplicate the message written into each <output>.
 */

const form = document.querySelector('form[name="contact"]');

if (form) {
  enhance(form);
}

function enhance(form) {
  const summary = form.querySelector("#form-summary");
  const errorField = form.querySelector("#form-errors");

  /**
   * Fields are discovered from the markup: every <output class="field-error">
   * names the control it reports on, so adding a field to the template needs
   * no change here.
   */
  const fields = Array.from(form.querySelectorAll("output.field-error"))
    .map((output) => {
      const id = output.getAttribute("for");
      return { control: id ? form.querySelector(`#${CSS.escape(id)}`) : null, output };
    })
    .filter((pair) => pair.control);

  /** Every validation error the reader has hit, newest last. */
  const errorLog = [];

  /**
   * True while this script calls checkValidity() itself, for example on blur.
   * Those passes should write messages but must not steal focus.
   */
  let selfChecking = false;

  let pendingInvalid = [];
  let flushScheduled = false;

  // `invalid` does not bubble, so listen in the capture phase on the form.
  form.addEventListener(
    "invalid",
    (event) => {
      const control = event.target;

      // Suppress the native bubble only. The constraint still holds and the
      // form still will not submit.
      event.preventDefault();

      report(control);

      if (selfChecking) return;

      pendingInvalid.push(control);
      if (!flushScheduled) {
        flushScheduled = true;
        // A task, not a microtask: the browser fires every invalid event for
        // a submission attempt inside one task, so this runs once, after the
        // whole pass, with the complete list.
        setTimeout(flushInvalidBatch, 0);
      }
    },
    true,
  );

  for (const { control } of fields) {
    // Validate on blur so a reader learns about a problem when they leave the
    // field, not only when they try to send.
    control.addEventListener("blur", () => {
      if (control.value === "" && !control.matches(":user-invalid")) return;
      selfChecking = true;
      control.checkValidity();
      selfChecking = false;
      if (control.validity.valid) clearMessage(control);
    });

    // Reading .validity never fires an invalid event, so this is free.
    control.addEventListener("input", () => {
      if (control.validity.valid) clearMessage(control);
    });
  }

  // Only fires when the form actually passes validation.
  form.addEventListener("submit", () => {
    summary.textContent = "";
  });

  /* ------------------------------ helpers ------------------------------ */

  function outputFor(control) {
    return fields.find((pair) => pair.control === control)?.output ?? null;
  }

  function labelFor(control) {
    const label = form.querySelector(`label[for="${CSS.escape(control.id)}"]`);
    return label ? label.textContent.trim() : control.name || "This field";
  }

  /** The first failing constraint, used as the machine-readable error type. */
  function errorTypeOf(control) {
    const validity = control.validity;
    const keys = [
      "valueMissing",
      "typeMismatch",
      "patternMismatch",
      "tooShort",
      "tooLong",
      "rangeUnderflow",
      "rangeOverflow",
      "stepMismatch",
      "badInput",
    ];
    return keys.find((key) => validity[key]) ?? "invalid";
  }

  /** Specific, human wording. Falls back to the browser's own phrasing. */
  function messageFor(control) {
    const validity = control.validity;
    const label = labelFor(control);

    if (validity.valueMissing) {
      return `${label} is required.`;
    }
    if (validity.typeMismatch) {
      return control.type === "email"
        ? "Enter an email address in the form name@example.com."
        : `${label} is not in the expected format.`;
    }
    if (validity.patternMismatch) {
      return control.title || `${label} is not in the expected format.`;
    }
    if (validity.tooShort) {
      return `${label} needs at least ${control.minLength} characters — you have ${control.value.length}.`;
    }
    if (validity.tooLong) {
      return `${label} must be ${control.maxLength} characters or fewer — you have ${control.value.length}.`;
    }
    return control.validationMessage;
  }

  /**
   * Writes the message into the field's <output> and logs it.
   * textContent, never innerHTML: the reader's own input ends up in some of
   * these strings, and it must never be parsed as markup.
   */
  function report(control) {
    const message = messageFor(control);
    const output = outputFor(control);
    if (output) output.textContent = message;
    logError(control, errorTypeOf(control), message);
  }

  function clearMessage(control) {
    const output = outputFor(control);
    if (output) output.textContent = "";
  }

  function logError(control, type, message) {
    // Blur and submit can both flag the same problem moments apart. Only log a
    // repeat if the field's most recent entry was a different failure.
    const previous = errorLog.findLast((entry) => entry.field === control.name);
    if (previous && previous.type === type) return;

    errorLog.push({
      field: control.name,
      type,
      message,
      timestamp: new Date().toISOString(),
    });

    if (errorField) errorField.value = JSON.stringify(errorLog);
  }

  function flushInvalidBatch() {
    flushScheduled = false;
    const failed = pendingInvalid;
    pendingInvalid = [];
    if (failed.length === 0) return;

    summary.textContent =
      failed.length === 1
        ? "One field needs attention before this can be sent."
        : `${failed.length} fields need attention before this can be sent.`;

    // The browser validates in tree order, so this is the first problem.
    failed[0].focus();
  }
}
