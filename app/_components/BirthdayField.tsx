"use client";

import { useState } from "react";

// Champ date de naissance avec placeholder maison.
// iOS + `appearance:none` (nécessaire pour que le champ ne déborde pas) n'affiche
// PAS le masque natif "jj/mm/aaaa" quand le champ est vide → on superpose notre
// propre libellé, masqué dès qu'une date est saisie.
export default function BirthdayField() {
  const [value, setValue] = useState("");
  return (
    <div className="date-wrap">
      <input
        name="birthday"
        type="date"
        autoComplete="bday"
        className={value ? undefined : "date-empty"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {!value && <span className="date-ph" aria-hidden="true">Date de naissance</span>}
    </div>
  );
}
