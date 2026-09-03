"use client";

import { useEffect, useRef, useState } from "react";

export type PickedSuburb = { id: number; name: string; postcode: string };

/**
 * Type-ahead suburb picker.
 *
 * Free text can't be mapped to Box & Dice reliably ("Yarraville", "yarra
 * ville" and "3013" are three different strings), and buying criteria are only
 * useful if they're searchable. Every selection here carries the CRM's own
 * suburb id, so what the buyer picks is exactly what the CRM searches on.
 *
 * Keyboard: ↓/↑ move, Enter selects, Escape closes, Backspace on an empty box
 * removes the last chip.
 */
export default function SuburbPicker({
  selected,
  onChange,
  max = 8,
}: {
  selected: PickedSuburb[];
  onChange: (next: PickedSuburb[]) => void;
  max?: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedSuburb[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    // Debounced so a fast typist makes one request, not eight.
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suburbs?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setResults(Array.isArray(json?.suburbs) ? json.suburbs : []);
        setActive(0);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const add = (s: PickedSuburb) => {
    if (selected.length >= max || selected.some((x) => x.id === s.id)) return;
    onChange([...selected, s]);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const remove = (id: number) => onChange(selected.filter((s) => s.id !== id));

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && query === "" && selected.length) {
      remove(selected[selected.length - 1].id);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit the form from the suggestion list
      add(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="suburb-picker" ref={boxRef}>
      {selected.length > 0 && (
        <ul className="sp-chips">
          {selected.map((s) => (
            <li key={s.id}>
              {s.name}
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label={`Remove ${s.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        className="field"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => results.length && setOpen(true)}
        placeholder={selected.length >= max ? "That's plenty" : "Start typing a suburb…"}
        disabled={selected.length >= max}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls="suburb-options"
        aria-autocomplete="list"
      />

      {open && results.length > 0 && (
        <ul className="sp-options" id="suburb-options" role="listbox">
          {results.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                add(s);
              }}
            >
              {s.name} <span>{s.postcode}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
