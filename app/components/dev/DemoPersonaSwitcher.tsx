"use client";

import { useState } from "react";
import type { TestPersona } from "@/app/data/testPersonas";

type DemoPersonaSwitcherProps = {
  personas: TestPersona[];
  activePersonaId: string;
  onLoadPersona: (personaId: string) => void | Promise<void>;
};

// Development/demo-only UI for quickly swapping local mock datasets.
// This is not a product account switcher. Loading a persona overwrites local
// IndexedDB data after explicit confirmation.
export function DemoPersonaSwitcher({
  personas,
  activePersonaId,
  onLoadPersona,
}: DemoPersonaSwitcherProps) {
  const [selectedPersonaId, setSelectedPersonaId] = useState(activePersonaId);
  const selectedPersona =
    personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0];

  function confirmAndLoad(personaId: string) {
    const persona = personas.find((item) => item.id === personaId);
    if (!persona) return;

    const confirmed = window.confirm(
      `Load demo data for ${persona.name}? This replaces the current local IndexedDB LifeOS data on this device.`,
    );
    if (!confirmed) return;

    setSelectedPersonaId(personaId);
    void onLoadPersona(personaId);
  }

  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50/80 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Test data
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Demo persona datasets for local UI testing only. Loading overwrites local data.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={selectedPersonaId}
            onChange={(event) => setSelectedPersonaId(event.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700"
          >
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => confirmAndLoad(selectedPersonaId)}
            className="rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white"
          >
            Load persona
          </button>
          <button
            type="button"
            onClick={() => confirmAndLoad(personas[0].id)}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-stone-700"
          >
            Reset default
          </button>
        </div>
      </div>
      <p className="mt-2 truncate text-xs text-stone-500">
        Selected: {selectedPersona.name} - {selectedPersona.description}
      </p>
    </div>
  );
}
