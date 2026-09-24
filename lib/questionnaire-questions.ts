import "server-only";
import { createClient } from "@vercel/global-config";
import { DEFAULT_SECTIONS, type Field, type Section } from "./questionnaire-form";

/**
 * The live question set — what vendors are actually asked today.
 *
 * Kept in the store rather than the code so the office can reword a question
 * that confuses people, retire one nobody answers, or add one after a campaign
 * taught them something, without waiting for a deploy. DEFAULT_SECTIONS in
 * questionnaire-form.ts is the seed: what the store holds the first time, and
 * the fallback if it cannot be read.
 *
 * A READ MUST NEVER THROW AND MUST NEVER RETURN NOTHING. A vendor opening their
 * link at nine at night does not care that Global Config is having a moment —
 * so a failed read falls back to the defaults and the form still works. The
 * worst case is a stale question, never a blank page.
 */

const STORE_ID = process.env.GLOBAL_CONFIG_ID ?? "ecfg_y2dshgcsqthztqvi74jh0tqo1uzs";
const TEAM_ID = process.env.VERCEL_TEAM_ID ?? "team_P499DP8ocTP5k7vIJChVJiS1";
const API_TOKEN = process.env.VERCEL_API_TOKEN;
const client = process.env.GLOBAL_CONFIG ? createClient(process.env.GLOBAL_CONFIG) : null;

const KEY = "pq_questions";

export type QuestionSet = {
  sections: Section[];
  updatedAt: string;
  updatedBy: string;
};

/**
 * Structural validation of anything read back or posted in.
 *
 * The editor is staff-only, but this set is rendered to vendors and written
 * into a PDF, so it is checked rather than trusted. A malformed section is
 * dropped rather than allowed to throw halfway through rendering somebody's
 * questionnaire.
 */
const KINDS = new Set(["text", "long", "choice", "multi", "files"]);
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export function cleanSections(raw: unknown): Section[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Section[] = [];

  for (const s of raw) {
    const title = str((s as any)?.title, 80);
    if (!title) continue;
    const fields: Field[] = [];

    for (const f of Array.isArray((s as any)?.fields) ? (s as any).fields : []) {
      const id = str((f as any)?.id, 60).replace(/[^A-Za-z0-9_-]/g, "");
      const kind = String((f as any)?.kind ?? "");
      const q = str((f as any)?.q, 300);
      // An id is how an answer finds its question — a duplicate would make one
      // answer overwrite another, silently.
      if (!id || seen.has(id) || !KINDS.has(kind) || !q) continue;
      seen.add(id);

      const field: Field = { id, kind: kind as Field["kind"], q };
      const help = str((f as any)?.help, 400);
      if (help) field.help = help;
      const label = str((f as any)?.label, 120);
      if (label) field.label = label;
      const monday = str((f as any)?.monday, 80);
      if (monday) field.monday = monday;
      if ((f as any)?.required === true) field.required = true;
      if ((f as any)?.retired === true) field.retired = true;

      if (kind === "choice" || kind === "multi") {
        const options = (Array.isArray((f as any)?.options) ? (f as any).options : [])
          .map((o: unknown) => str(o, 80))
          .filter(Boolean)
          .slice(0, 20);
        // A choice with nothing to choose is not a question.
        if (!options.length) continue;
        field.options = options;
      }

      const showIf = (f as any)?.showIf;
      if (showIf && str(showIf.id, 60) && str(showIf.is, 80)) {
        field.showIf = { id: str(showIf.id, 60), is: str(showIf.is, 80) };
      }

      fields.push(field);
    }

    if (fields.length) {
      const section: Section = { title, fields };
      const blurb = str((s as any)?.blurb, 400);
      if (blurb) section.blurb = blurb;
      out.push(section);
    }
  }

  /**
   * A condition pointing at a question that no longer exists would hide its
   * follow-up forever, with no way to tell from the editor that it had
   * happened. Dropping the condition shows the question instead — visible and
   * fixable beats invisible and not.
   */
  const ids = new Set(out.flatMap((s) => s.fields.map((f) => f.id)));
  for (const s of out) {
    for (const f of s.fields) {
      if (f.showIf && !ids.has(f.showIf.id)) delete f.showIf;
    }
  }

  return out;
}

async function read(): Promise<QuestionSet | null> {
  if (API_TOKEN) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v1/global-config/${STORE_ID}/item/${KEY}?teamId=${encodeURIComponent(TEAM_ID)}`,
        { headers: { Authorization: `Bearer ${API_TOKEN}` }, cache: "no-store" }
      );
      if (res.ok) {
        // An empty 200 is a key that has never been written; res.json() throws
        // on it. Same trap as campaigns.ts.
        const text = await res.text();
        if (!text.trim()) return null;
        const json: any = JSON.parse(text);
        const v = json?.value;
        if (!v?.sections) return null;
        return {
          sections: cleanSections(v.sections),
          updatedAt: String(v.updatedAt ?? ""),
          updatedBy: String(v.updatedBy ?? ""),
        };
      }
      if (res.status !== 404) console.error(`[questions] REST read -> ${res.status}`);
    } catch (err) {
      console.error("[questions] REST read failed", err);
    }
  }
  if (!client) return null;
  try {
    const v = await client.get<any>(KEY);
    if (!v?.sections) return null;
    return {
      sections: cleanSections(v.sections),
      updatedAt: String(v.updatedAt ?? ""),
      updatedBy: String(v.updatedBy ?? ""),
    };
  } catch (err) {
    console.error("[questions] SDK read failed", err);
    return null;
  }
}

/** The set as the editor sees it — retired questions included. */
export async function getQuestionSet(): Promise<QuestionSet> {
  const stored = await read();
  if (stored && stored.sections.length) return stored;
  return { sections: DEFAULT_SECTIONS, updatedAt: "", updatedBy: "" };
}

/**
 * The set a vendor sees: retired questions removed, and any section left empty
 * by that removal removed with it.
 */
export async function getLiveSections(): Promise<Section[]> {
  const { sections } = await getQuestionSet();
  return liveOnly(sections);
}

export function liveOnly(sections: Section[]): Section[] {
  return sections
    .map((s) => ({ ...s, fields: s.fields.filter((f) => !f.retired) }))
    .filter((s) => s.fields.length > 0);
}

export async function saveQuestionSet(sections: Section[], by: string): Promise<QuestionSet> {
  if (!API_TOKEN) throw new Error("VERCEL_API_TOKEN not set — cannot save questions");
  const cleaned = cleanSections(sections);
  if (!cleaned.length) throw new Error("A questionnaire needs at least one question.");

  const value: QuestionSet = {
    sections: cleaned,
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  };

  const res = await fetch(
    `https://api.vercel.com/v1/global-config/${STORE_ID}/items?teamId=${encodeURIComponent(TEAM_ID)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ operation: "upsert", key: KEY, value }] }),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`questions write -> ${res.status} ${await res.text()}`);
  return value;
}
