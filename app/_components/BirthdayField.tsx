"use client";

import { useState } from "react";

// Birthday field with a custom placeholder.
// iOS + `appearance:none` (needed so the field does not overflow) does NOT show
// the native date mask while empty → we overlay our own label, hidden as soon
// as a date is entered.
export default function BirthdayField() {
  const [value, setValue] = useState("");
  return (
    <div className="date-wrap">
      <input
        name="birthday"
        type="date"
        autoComplete="bday"
        aria-label="Birthday (optional)"
        className={value ? undefined : "date-empty"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {!value && <span className="date-ph" aria-hidden="true">Birthday (optional)</span>}
    </div>
  );
}
