"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SECTIONS,
  FIELDS,
  isShown,
  missingRequired,
  type Answers,
  type Field,
} from "@/lib/questionnaire-form";

/**
 * The vendor's questionnaire.
 *
 * ONE PAGE, NOT A WIZARD. A wizard hides how much is left, which is the single
 * most common reason a form like this gets abandoned half way — and it turns
 * every answer into a round trip. Sections with headings do the same work of
 * breaking it up, while a vendor can still see the end from the beginning and
 * skip to the parts they can answer tonight.
 *
 * DRAFTS LIVE IN THE BROWSER. Every keystroke is kept in localStorage, which is
 * instant, free and cannot fail; the server is written to only when they press
 * "Save and finish later" or "Send". The store behind this is Vercel Global
 * Config — rate-limited, and roughly ten seconds behind its own writes — so
 * autosaving to it on every keystroke would be both slow and a way to lose
 * answers. A vendor coming back on the same device gets their draft; one
 * switching to a different device gets whatever they last saved deliberately,
 * which is why that button exists and says what it says.
 */

const MAX_TOTAL = 3_500_000; // Vercel caps a request body at ~4.5 MB.

function bytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1000))} KB`;
}

export default function QuestionnaireForm({
  id,
  token,
  address,
  vendorName,
  saved,
  savedAt,
}: {
  id: string;
  token: string;
  address: string;
  vendorName: string;
  saved: Answers;
  savedAt: string | null;
}) {
  const draftKey = `pq-${id}`;

  const [answers, setAnswers] = useState<Answers>(saved);
  const [name, setName] = useState(vendorName);
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [state, setState] = useState<"idle" | "saving" | "sending" | "saved" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const restored = useRef(false);

  /**
   * A local draft wins over the server copy, because it is by definition the
   * more recent of the two: the server only ever holds what was deliberately
   * saved, and the draft holds everything typed since.
   */
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && typeof d === "object") {
        if (d.answers && typeof d.answers === "object") setAnswers(d.answers);
        if (typeof d.name === "string" && d.name) setName(d.name);
      }
    } catch {
      // A blocked or full localStorage is not a reason to stop — the form
      // works perfectly well without a draft, it just doesn't remember.
    }
  }, [draftKey]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ answers, name }));
    } catch {
      /* see above */
    }
  }, [answers, name, draftKey]);

  const set = (fieldId: string, value: string | string[]) =>
    setAnswers((a) => ({ ...a, [fieldId]: value }));

  const totalBytes = useMemo(
    () => Object.values(files).flat().reduce((n, f) => n + f.size, 0),
    [files]
  );
  const overBudget = totalBytes > MAX_TOTAL;

  /** Everything still to do, so "you've missed something" can say what. */
  function check(): boolean {
    const gaps = missingRequired(answers).map((f) => f.id);
    if (!name.trim()) gaps.unshift("__name");
    setMissing(gaps);
    if (gaps.length) {
      const first = document.getElementById(`q-${gaps[0]}`) ?? document.getElementById("q-name");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      (first as HTMLElement | null)?.focus?.();
      return false;
    }
    return true;
  }

  async function save() {
    setState("saving");
    setError("");
    try {
      const res = await fetch(`/api/questionnaire/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, action: "save", answers }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "We couldn't save that just now.");
      setState("saved");
    } catch (e: any) {
      setState("error");
      setError(e?.message || "We couldn't save that just now.");
    }
  }

  async function send() {
    if (!check()) return;
    if (overBudget) {
      setError(
        `Those files come to ${bytes(totalBytes)}, which is more than we can take in one go. Take some off and email them to us instead.`
      );
      return;
    }
    setState("sending");
    setError("");
    try {
      // Multipart, because files. The answers ride along as one JSON field so
      // the server reads them exactly as the JSON path does.
      const body = new FormData();
      body.append("t", token);
      body.append("name", name);
      body.append("answers", JSON.stringify(answers));
      for (const [fieldId, list] of Object.entries(files)) {
        for (const f of list) body.append(`file:${fieldId}`, f, f.name);
      }
      const res = await fetch(`/api/questionnaire/${id}`, { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Something went wrong.");
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* nothing to clean up */
      }
      setState("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setState("error");
      setError(e?.message || "Something went wrong. Please call 0409 438 025.");
    }
  }

  if (state === "done") {
    return (
      <div className="portal-done" role="status">
        <h3>Thank you, {name.trim().split(/\s+/)[0]}.</h3>
        <p>
          That&rsquo;s everything we needed. Your answers are with us now, and the story you told us
          about {address.split(",")[0]} is where the brochure copy starts.
        </p>
        <p>Anything you forgot or want to change — call Michael on 0409 438 025.</p>
      </div>
    );
  }

  return (
    <div className="qf">
      <label className="qf-q" htmlFor="q-name">
        <span className="qf-label">Your full name</span>
        <input
          id="q-name"
          className={`field${missing.includes("__name") ? " qf-missing" : ""}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </label>

      {SECTIONS.map((section) => {
        const live = section.fields.filter((f) => isShown(f, answers));
        if (!live.length) return null;
        return (
          <section className="qf-section" key={section.title}>
            <h2>{section.title}</h2>
            {section.blurb && <p className="qf-blurb">{section.blurb}</p>}
            {live.map((f) => (
              <Question
                key={f.id}
                field={f}
                value={answers[f.id]}
                onChange={(v) => set(f.id, v)}
                files={files[f.id] ?? []}
                onFiles={(list) => setFiles((x) => ({ ...x, [f.id]: list }))}
                missing={missing.includes(f.id)}
              />
            ))}
          </section>
        );
      })}

      {totalBytes > 0 && (
        <p className={`form-note${overBudget ? " qf-warn" : ""}`}>
          {bytes(totalBytes)} of files attached.
          {overBudget && " That's more than we can take in one go — take some off and email the rest to us."}
        </p>
      )}

      {error && (
        <p className="qf-error" role="alert">
          {error}
        </p>
      )}
      {missing.length > 0 && !error && (
        <p className="qf-error" role="alert">
          {missing.includes("__name")
            ? "We just need your name before this can be sent."
            : "One question still needs an answer — it's marked above."}
        </p>
      )}

      <div className="qf-actions">
        <button
          type="button"
          className="btn"
          onClick={send}
          disabled={state === "sending" || state === "saving"}
        >
          {state === "sending" ? "Sending…" : "Send it to us"}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={save}
          disabled={state === "sending" || state === "saving"}
        >
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save and finish later"}
        </button>
      </div>
      <p className="form-note">
        {state === "saved"
          ? "Saved. Come back to this same link on any device and it will be here."
          : savedAt
            ? "You've saved this once already — it's safe to stop and come back."
            : "Your answers are kept in this browser as you type. Save to pick it up somewhere else."}
      </p>
    </div>
  );
}

function Question({
  field,
  value,
  onChange,
  files,
  onFiles,
  missing,
}: {
  field: Field;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  files: File[];
  onFiles: (f: File[]) => void;
  missing: boolean;
}) {
  const id = `q-${field.id}`;
  const cls = `field${missing ? " qf-missing" : ""}`;
  const selected = Array.isArray(value) ? value : [];

  return (
    <div className="qf-q">
      <label className="qf-label" htmlFor={id}>
        {field.q}
        {field.required && <span className="qf-req"> — required</span>}
      </label>
      {field.help && <p className="qf-help">{field.help}</p>}

      {field.kind === "long" && (
        <textarea
          id={id}
          className={cls}
          rows={field.required ? 6 : 3}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.kind === "text" && (
        <input
          id={id}
          className={cls}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.kind === "choice" && (
        <div className="ap-options" id={id}>
          {(field.options ?? []).map((opt) => (
            <label key={opt} className={`ap-chip${value === opt ? " on" : ""}`}>
              <input
                type="radio"
                name={field.id}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {field.kind === "multi" && (
        <div className="ap-options" id={id}>
          {(field.options ?? []).map((opt) => (
            <label key={opt} className={`ap-chip${selected.includes(opt) ? " on" : ""}`}>
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() =>
                  onChange(
                    selected.includes(opt)
                      ? selected.filter((x) => x !== opt)
                      : [...selected, opt]
                  )
                }
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {field.kind === "files" && (
        <>
          <input
            id={id}
            type="file"
            className="qf-file"
            multiple
            onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
          />
          {files.length > 0 && (
            <p className="form-note">{files.map((f) => f.name).join(", ")}</p>
          )}
        </>
      )}
    </div>
  );
}
