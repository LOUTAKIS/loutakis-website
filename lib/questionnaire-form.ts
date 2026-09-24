/**
 * The vendor questionnaire — the questions themselves.
 *
 * Lifted from Maree's "Property Information Form" on monday.com, question for
 * question — and then made editable, so the office can change a question
 * without changing the code.
 *
 * THIS FILE HOLDS THE SHAPE AND THE SEED, NOT THE LIVE SET. The types below
 * are what a question IS; DEFAULT_SECTIONS is where the live set started. What
 * vendors actually answer is read from the store by
 * lib/questionnaire-questions.ts, and edited at /staff/questionnaires/questions.
 *
 * One definition still drives everything: the page renders from it, the API
 * validates against it, and the email, the CRM note and the PDF are written out
 * of it in this order. There is no second list to keep in step.
 *
 * ISHOWN AND MISSINGREQUIRED ARE SHARED ON PURPOSE. The form uses them to
 * decide what to show and what to nag about; the server uses the same two
 * functions to decide what to accept and what to print. If they ever disagreed,
 * a vendor could be shown a question the server then refuses, or be marked
 * complete with a required answer missing.
 *
 * DELIBERATELY FREE OF IMPORTS. The form is a client component and needs these
 * definitions; anything server-only in here would drag the CRM client into the
 * browser bundle. Nothing in this file touches the network or the environment.
 *
 * `monday` on each field records the column it came from. Nothing reads it
 * today — answers go to Box & Dice and to the agent — but it is the provenance
 * of every question here, and it is what a write-back to the board would need.
 *
 * Three changes from the monday.com version, all agreed with Michael:
 *
 *   1. "an body corporation" was a typo, and the same three questions called it
 *      both "body corporation" and "Owners Corporation". In Victoria it is an
 *      Owners Corporation, so that is what it is called throughout.
 *   2. Renovations and re-wiring both had a follow-up worded "If yes, let us
 *      know what has been completed". That reads fine underneath its own
 *      question and means nothing in an email, so each one now names its
 *      subject. THE LABEL IS WHAT THE OFFICE READS, not what the vendor does.
 *   3. Re-stumping is back. The board still carries the columns; the live form
 *      had stopped asking. On weatherboard through Yarraville, Newport and
 *      Kingsville it is the first thing a building inspector writes up, and the
 *      vendor's answer is worth having before the report lands.
 */

export type Field = {
  id: string;
  /**
   * Retired questions stop appearing on new questionnaires but are never
   * deleted. An answer is stored against its question's id, so removing a
   * question outright would orphan every answer anyone ever gave it — the
   * record would quietly lose the fact that the question was asked at all.
   */
  retired?: boolean;
  /** The column this came from on the monday.com board. Provenance, not logic. */
  monday?: string;
  kind: "text" | "long" | "choice" | "multi" | "files";
  q: string;
  help?: string;
  options?: string[];
  required?: boolean;
  /** Shown only when another field holds this answer. */
  showIf?: { id: string; is: string };
  /** Overrides `q` when the answer is written into an email or a CRM note. */
  label?: string;
};

export type Section = { title: string; blurb?: string; fields: Field[] };

const YES_NO = ["Yes", "No"];

/**
 * THE STARTING POINT, NOT THE LIVE SET.
 *
 * These questions seed the store the first time anyone opens the editor, and
 * they are what the site falls back to if that store cannot be read. The live
 * set — the one vendors actually answer — comes from
 * lib/questionnaire-questions.ts. Editing this file changes what a brand new
 * account would start with; it does not change what is on the site today.
 */
export const DEFAULT_SECTIONS: Section[] = [
  {
    title: "Your story",
    blurb:
      "This is the part buyers remember. Nobody else can write it, and it is what we build the brochure around.",
    fields: [
      {
        id: "story",
        monday: "long_textqoxk9rtp",
        kind: "long",
        q: "Tell us what you love about the home.",
        help: "We use this to write the Vendors' Story on your brochure — so write it the way you'd say it, not the way you think an ad sounds.",
        required: true,
      },
      {
        id: "favourites",
        monday: "long_textps9cgdql",
        kind: "long",
        q: "What are your favourite spots in the house, indoors and out, and why?",
      },
      {
        id: "standout",
        monday: "long_textdcneou8c",
        kind: "long",
        q: "Is there a standout feature that always gets compliments from guests?",
      },
    ],
  },
  {
    title: "The home",
    fields: [
      {
        id: "heatcool",
        monday: "long_textqi1a0ewa",
        kind: "long",
        q: "What heating and cooling is in the home?",
      },
      {
        id: "renos",
        monday: "single_selectdl1kxfj",
        kind: "choice",
        q: "Have any renovations or modifications been completed on the property?",
        options: YES_NO,
      },
      {
        id: "renosDetail",
        monday: "long_textxdfw5ozq",
        kind: "long",
        q: "What was done?",
        label: "Renovations — what was done",
        showIf: { id: "renos", is: "Yes" },
      },
      {
        id: "rewire",
        monday: "single_selectvrcoodk",
        kind: "choice",
        q: "Has any re-wiring been completed?",
        options: YES_NO,
      },
      {
        id: "rewireDetail",
        monday: "long_text2j7jsfvc",
        kind: "long",
        q: "What was done?",
        label: "Re-wiring — what was done",
        showIf: { id: "rewire", is: "Yes" },
      },
      {
        id: "restump",
        monday: "single_selecto8e9nv3",
        kind: "choice",
        q: "Has any re-stumping been completed?",
        options: YES_NO,
      },
      {
        id: "restumpDetail",
        monday: "long_textz3z9d9yz",
        kind: "long",
        q: "What was done, and roughly when?",
        label: "Re-stumping — what was done",
        showIf: { id: "restump", is: "Yes" },
      },
      {
        id: "services",
        monday: "multi_selectzu9j0mxe",
        kind: "multi",
        q: "What services are connected?",
        options: ["Electricity", "Water", "Gas", "NBN", "Telephone"],
      },
      {
        id: "keys",
        monday: "short_textwstr6g53",
        kind: "text",
        q: "Do you have spare keys for all locks — doors, windows, garages, sheds?",
      },
    ],
  },
  {
    title: "Things we need to know",
    blurb:
      "Better from you now than from a buyer's solicitor later. Nothing here goes in the advertising — it tells us what to prepare for.",
    fields: [
      {
        id: "disputes",
        monday: "long_textieeaopvm",
        kind: "long",
        q: "Are there any disputes with neighbours — fencing, trees, boundaries?",
      },
      {
        id: "council",
        monday: "long_textbg5bvn19",
        kind: "long",
        q: "Are there any council notices or orders on the property?",
      },
      {
        id: "negatives",
        monday: "long_text1o37f3z8",
        kind: "long",
        q: "Is there anything that may affect the sale in a negative way?",
      },
    ],
  },
  {
    title: "Owners Corporation",
    fields: [
      {
        id: "oc",
        monday: "single_selecti8ugdph",
        kind: "choice",
        q: "Is there an Owners Corporation on the property?",
        options: YES_NO,
      },
      {
        id: "ocFees",
        monday: "long_textu6uhmrfd",
        kind: "long",
        q: "What are the fees per annum?",
        label: "Owners Corporation — fees per annum",
        showIf: { id: "oc", is: "Yes" },
      },
      {
        id: "ocFiles",
        monday: "filealv1ezsr",
        kind: "files",
        q: "Any Owners Corporation documents — AGM minutes, certificates, by-laws.",
        label: "Owners Corporation documents",
        showIf: { id: "oc", is: "Yes" },
      },
    ],
  },
  {
    title: "Anything else",
    fields: [
      {
        id: "files",
        monday: "file3r5fhdam",
        kind: "files",
        q: "Any other files relevant to the campaign.",
        help: "Plans, permits, service records, old photographs — anything you think we should see.",
        label: "Campaign files",
      },
    ],
  },
];

export type Answers = Record<string, string | string[]>;

/** Every field in a set, in the order they are asked. */
export function fieldsOf(sections: Section[]): Field[] {
  return sections.flatMap((s) => s.fields);
}

export function fieldsById(sections: Section[]): Record<string, Field> {
  return Object.fromEntries(fieldsOf(sections).map((f) => [f.id, f]));
}

/**
 * Whether a conditional field is currently in play.
 *
 * Used twice and it has to agree with itself both times: the form uses it to
 * decide what to show, and the writer uses it to decide what to print. A
 * "Renovations — what was done" line under a "No" would be nonsense, and so
 * would validating a hidden field.
 */
export function isShown(f: Field, answers: Answers): boolean {
  if (!f.showIf) return true;
  return String(answers[f.showIf.id] ?? "") === f.showIf.is;
}

/** How a field's answer reads once it is out of the form. */
export function answerText(f: Field, answers: Answers): string {
  const v = answers[f.id];
  if (Array.isArray(v)) return v.join(", ");
  return String(v ?? "").trim();
}

/** The heading an answer is filed under, away from the question it sat below. */
export function fieldLabel(f: Field): string {
  return f.label ?? f.q;
}

/**
 * Answered enough to be worth sending?
 *
 * The story is the one required question, as it is on the monday.com form. A
 * questionnaire is not a compliance document — a vendor who writes three
 * paragraphs about the garden and skips the heating has still given us the
 * thing we could not have found out ourselves.
 */
export function missingRequired(sections: Section[], answers: Answers): Field[] {
  return fieldsOf(sections).filter(
    (f) => f.required && isShown(f, answers) && !answerText(f, answers)
  );
}
