"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Field, Section } from "@/lib/questionnaire-form";

/**
 * The question editor.
 *
 * WHAT IT IS FOR: so the office can fix a question that confuses vendors, drop
 * one nobody answers, or add one a campaign taught them to ask — without
 * waiting for a deploy. The form feeds the brochure copy and the vendor
 * statement prep, and it should be tuned by the people who read the answers.
 *
 * EDITS ARE LOCAL UNTIL SAVED. Everything here changes a copy held in the
 * browser; nothing reaches a vendor until Save is pressed. That matters because
 * the halfway state of a reorder is not a form anyone should be sent.
 *
 * RETIRE, NEVER DELETE. An answer is stored against its question's id, so
 * deleting a question would orphan every answer anyone ever gave it. Retiring
 * takes it off new questionnaires and leaves the old ones intact — and a
 * retired question can be brought back, which a deleted one cannot.
 */

const KINDS: { value: Field["kind"]; label: string; hint: string }[] = [
  { value: "long", label: "Long answer", hint: "A paragraph or more — stories, explanations." },
  { value: "text", label: "Short answer", hint: "A line. Names, numbers, one-word replies." },
  { value: "choice", label: "Pick one", hint: "Yes/No, or any list where only one applies." },
  { value: "multi", label: "Pick several", hint: "A list where more than one can be true." },
  { value: "files", label: "File upload", hint: "Documents, plans, certificates." },
];

/** A stable id from the question text — readable in the CRM note and the PDF. */
function idFrom(q: string, taken: Set<string>): string {
  const base =
    q
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
      .join("") || "question";
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}${n++}`;
  return id;
}

type Props = { initial: Section[]; updatedAt: string; updatedBy: string };

export default function QuestionEditor({ initial, updatedAt, updatedBy }: Props) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>(() =>
    JSON.parse(JSON.stringify(initial))
  );
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const takenIds = useMemo(
    () => new Set(sections.flatMap((s) => s.fields.map((f) => f.id))),
    [sections]
  );

  /** Every yes/no or pick-one question above a given field — what it can depend on. */
  function choicesBefore(si: number, fi: number): Field[] {
    const out: Field[] = [];
    sections.forEach((s, i) => {
      s.fields.forEach((f, j) => {
        if (i < si || (i === si && j < fi)) {
          if (f.kind === "choice" && !f.retired) out.push(f);
        }
      });
    });
    return out;
  }

  function mutate(fn: (draft: Section[]) => void) {
    setSections((prev) => {
      const draft: Section[] = JSON.parse(JSON.stringify(prev));
      fn(draft);
      return draft;
    });
    setDirty(true);
    setState("idle");
  }

  const setField = (si: number, fi: number, patch: Partial<Field>) =>
    mutate((d) => {
      d[si].fields[fi] = { ...d[si].fields[fi], ...patch };
    });

  function move(si: number, fi: number, by: number) {
    mutate((d) => {
      const fields = d[si].fields;
      const to = fi + by;
      if (to < 0 || to >= fields.length) return;
      [fields[fi], fields[to]] = [fields[to], fields[fi]];
    });
  }

  function addQuestion(si: number) {
    mutate((d) => {
      const id = idFrom("new question", takenIds);
      d[si].fields.push({ id, kind: "long", q: "" });
    });
    setOpen(`${si}:${sections[si].fields.length}`);
  }

  function addSection() {
    mutate((d) => d.push({ title: "New section", fields: [] }));
  }

  /**
   * A question can only be saved once it has been written. An empty one is a
   * half-finished thought, not a question, and the server would drop it
   * silently — better to say so here.
   */
  const blank = sections.flatMap((s, si) =>
    s.fields.map((f, fi) => ({ f, si, fi })).filter((x) => !x.f.q.trim())
  );

  async function save() {
    if (blank.length) {
      setError("One question has no wording yet — write it or take it away.");
      setState("error");
      setOpen(`${blank[0].si}:${blank[0].fi}`);
      return;
    }
    setState("saving");
    setError("");
    try {
      const res = await fetch("/api/staff/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Couldn't save that.");
      setState("saved");
      setDirty(false);
      router.refresh();
    } catch (e: any) {
      setState("error");
      setError(e?.message || "Couldn't save that.");
    }
  }

  return (
    <div className="qe">
      <div className="qe-bar">
        <p className="form-note" style={{ margin: 0 }}>
          {dirty
            ? "Unsaved changes — vendors still see the old questions until you save."
            : updatedAt
              ? `Last changed by ${updatedBy || "someone"}.`
              : "These are the questions the site started with."}
        </p>
        <div className="qf-actions" style={{ marginTop: 0 }}>
          <button type="button" className="btn" onClick={save} disabled={state === "saving"}>
            {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <p className="qf-error" role="alert">
          {error}
        </p>
      )}

      {sections.map((section, si) => (
        <section className="qe-section" key={si}>
          <div className="qe-section-head">
            <input
              className="field qe-title"
              value={section.title}
              onChange={(e) =>
                mutate((d) => {
                  d[si].title = e.target.value;
                })
              }
              aria-label="Section heading"
            />
            {sections.length > 1 && section.fields.length === 0 && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => mutate((d) => d.splice(si, 1))}
              >
                Remove section
              </button>
            )}
          </div>
          <input
            className="field qe-blurb"
            value={section.blurb ?? ""}
            placeholder="Optional line under the heading"
            onChange={(e) =>
              mutate((d) => {
                d[si].blurb = e.target.value;
              })
            }
            aria-label="Section note"
          />

          <ul className="qe-list">
            {section.fields.map((f, fi) => {
              const key = `${si}:${fi}`;
              const isOpen = open === key;
              const parent = f.showIf
                ? sections.flatMap((s) => s.fields).find((x) => x.id === f.showIf!.id)
                : null;

              return (
                <li key={f.id} className={`qe-item${f.retired ? " retired" : ""}`}>
                  <div className="qe-row">
                    <button
                      type="button"
                      className="qe-open"
                      onClick={() => setOpen(isOpen ? null : key)}
                      aria-expanded={isOpen}
                    >
                      <span className="qe-q">{f.q || "Untitled question"}</span>
                      <span className="qe-meta">
                        {KINDS.find((k) => k.value === f.kind)?.label}
                        {f.required && " · required"}
                        {f.retired && " · retired"}
                        {parent && ` · only if “${parent.q}” is ${f.showIf!.is}`}
                      </span>
                    </button>
                    <div className="qe-moves">
                      <button type="button" onClick={() => move(si, fi, -1)} aria-label="Move up" disabled={fi === 0}>
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(si, fi, 1)}
                        aria-label="Move down"
                        disabled={fi === section.fields.length - 1}
                      >
                        ↓
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="qe-edit">
                      <label className="qf-q">
                        <span className="qf-label">The question</span>
                        <textarea
                          className="field"
                          rows={2}
                          value={f.q}
                          onChange={(e) => setField(si, fi, { q: e.target.value })}
                        />
                      </label>

                      <label className="qf-q">
                        <span className="qf-label">Help text under it — optional</span>
                        <textarea
                          className="field"
                          rows={2}
                          value={f.help ?? ""}
                          onChange={(e) => setField(si, fi, { help: e.target.value })}
                        />
                      </label>

                      <label className="qf-q">
                        <span className="qf-label">
                          What it&rsquo;s called in the email and the PDF — optional
                        </span>
                        <input
                          className="field"
                          value={f.label ?? ""}
                          placeholder={f.q || "Same as the question"}
                          onChange={(e) => setField(si, fi, { label: e.target.value })}
                        />
                        <p className="qf-help">
                          Only worth setting when the question reads oddly out of context — a
                          follow-up called &ldquo;What was done?&rdquo; means nothing in an email.
                        </p>
                      </label>

                      <div className="pf-row">
                        <label className="qf-q">
                          <span className="qf-label">Kind of answer</span>
                          <select
                            className="field"
                            value={f.kind}
                            onChange={(e) => {
                              const kind = e.target.value as Field["kind"];
                              setField(si, fi, {
                                kind,
                                options:
                                  kind === "choice" || kind === "multi"
                                    ? f.options?.length
                                      ? f.options
                                      : ["Yes", "No"]
                                    : undefined,
                              });
                            }}
                          >
                            {KINDS.map((k) => (
                              <option key={k.value} value={k.value}>
                                {k.label}
                              </option>
                            ))}
                          </select>
                          <p className="qf-help">{KINDS.find((k) => k.value === f.kind)?.hint}</p>
                        </label>

                        <label className="qf-q">
                          <span className="qf-label">Only show this if…</span>
                          <select
                            className="field"
                            value={f.showIf ? `${f.showIf.id}::${f.showIf.is}` : ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) return setField(si, fi, { showIf: undefined });
                              const [id, is] = v.split("::");
                              setField(si, fi, { showIf: { id, is } });
                            }}
                          >
                            <option value="">Always show it</option>
                            {choicesBefore(si, fi).flatMap((p) =>
                              (p.options ?? []).map((opt) => (
                                <option key={`${p.id}::${opt}`} value={`${p.id}::${opt}`}>
                                  {p.q} is {opt}
                                </option>
                              ))
                            )}
                          </select>
                          <p className="qf-help">
                            Only questions above this one can be used — a condition can&rsquo;t
                            depend on an answer nobody has given yet.
                          </p>
                        </label>
                      </div>

                      {(f.kind === "choice" || f.kind === "multi") && (
                        <label className="qf-q">
                          <span className="qf-label">The options, one per line</span>
                          <textarea
                            className="field"
                            rows={4}
                            value={(f.options ?? []).join("\n")}
                            onChange={(e) =>
                              setField(si, fi, {
                                options: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean),
                              })
                            }
                          />
                          <p className="qf-help">
                            Changing an option&rsquo;s wording doesn&rsquo;t change answers already
                            given — those keep the words they were given in.
                          </p>
                        </label>
                      )}

                      <div className="qe-toggles">
                        <label className="ap-check">
                          <input
                            type="checkbox"
                            checked={Boolean(f.required)}
                            onChange={(e) => setField(si, fi, { required: e.target.checked })}
                          />
                          <span>Must be answered</span>
                        </label>
                        <label className="ap-check">
                          <input
                            type="checkbox"
                            checked={Boolean(f.retired)}
                            onChange={(e) => setField(si, fi, { retired: e.target.checked })}
                          />
                          <span>Retired — stop asking it</span>
                        </label>
                      </div>

                      <p className="qf-help">
                        Retiring takes the question off new questionnaires. Answers already given
                        stay on the ones that gave them, and you can un-retire it any time.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <button type="button" className="btn ghost" onClick={() => addQuestion(si)}>
            Add a question here
          </button>
        </section>
      ))}

      <div className="qf-actions">
        <button type="button" className="btn ghost" onClick={addSection}>
          Add a section
        </button>
        <button type="button" className="btn" onClick={save} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
