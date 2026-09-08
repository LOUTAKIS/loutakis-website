"use client";

import { useState } from "react";
import SuburbPicker, { type PickedSuburb } from "./SuburbPicker";
import type { ConsultantOption } from "@/lib/boxdice";

const METHODS = ["Auction", "Off market", "Private sale", "Expression of interest", "Need advice on this"];
const TIMEFRAMES = ["0–3 months", "3–6 months", "6 months plus"];
const WHEN = ["Today", "Tomorrow", "This week", "Another day"];
const HEARD = [
  "Social media",
  "Letterbox drop",
  "Website",
  "Neighbour of a recent result",
  "Past client",
  "Friends or family",
  "Other",
];

/**
 * The appraisal request.
 *
 * Long forms lose people, so only a name, the address and an email are
 * required — everything else sharpens the first conversation but never blocks
 * it. The suburb is picked from the CRM's own list rather than typed, because
 * a lead that lands on the right suburb record is worth more than free text.
 */
export default function AppraisalForm({ consultants }: { consultants: ConsultantOption[] }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [suburb, setSuburb] = useState<PickedSuburb[]>([]);
  const [lastSold, setLastSold] = useState("");
  const [neverSold, setNeverSold] = useState(false);
  const [methodOfSale, setMethodOfSale] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [expectedValue, setExpectedValue] = useState("");
  const [improvements, setImprovements] = useState<"" | "Yes" | "No">("");
  const [improvementsDetail, setImprovementsDetail] = useState("");
  const [consultantId, setConsultantId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [when, setWhen] = useState("");
  const [whenOther, setWhenOther] = useState("");
  const [heard, setHeard] = useState<string[]>([]);
  const [company, setCompany] = useState(""); // honeypot

  const toggleHeard = (h: string) =>
    setHeard((list) => (list.includes(h) ? list.filter((x) => x !== h) : [...list, h]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!firstName.trim()) return setError("Please add your first name.");
    if (!street.trim()) return setError("Please add the address of the property.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Please add a valid email address.");

    setState("sending");
    try {
      const res = await fetch("/api/appraisal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          street,
          suburbName: suburb[0]?.name ?? "",
          postcode: suburb[0]?.postcode ?? "",
          lastSold: neverSold ? "Never sold" : lastSold,
          methodOfSale,
          timeframe,
          expectedValue,
          improvements: improvements === "Yes" ? `Yes — ${improvementsDetail || "no detail given"}` : improvements,
          consultantId,
          email,
          phone,
          contactWhen: when === "Another day" ? `Another day — ${whenOther || "unspecified"}` : when,
          heardAbout: heard,
          company,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Something went wrong.");
      setState("done");
    } catch (err: any) {
      setState("idle");
      setError(err?.message || "Couldn't send that just now. Please call 0409 438 025.");
    }
  }

  if (state === "done") {
    return (
      <div className="ap-done">
        <h3>Thank you, {firstName}.</h3>
        <p>
          We have your details for {street}
          {suburb[0] ? `, ${suburb[0].name}` : ""}. Someone will be in touch
          {when && when !== "Another day" ? ` ${when.toLowerCase()}` : " shortly"} — and if it&rsquo;s urgent,
          Michael is on <a href="tel:0409438025">0409 438 025</a>.
        </p>
      </div>
    );
  }

  return (
    <form className="ap-form" onSubmit={submit} noValidate>
      <div className="pf-row">
        <label>
          <span>First name</span>
          <input className="field" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
        </label>
        <label>
          <span>Last name</span>
          <input className="field" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
        </label>
      </div>

      <label className="ap-field">
        <span>What is the address of the property you wish to sell?</span>
        <input
          className="field"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          placeholder="12 Smith Street"
          autoComplete="street-address"
        />
      </label>

      <div className="ap-field">
        <span className="ap-label">Suburb</span>
        {/* One suburb, chosen from the CRM's list so the lead files correctly. */}
        <SuburbPicker selected={suburb} onChange={setSuburb} max={1} />
      </div>

      <div className="ap-field">
        <span className="ap-label">When was the last time you sold?</span>
        <div className="pf-row">
          <input
            className="field"
            value={lastSold}
            onChange={(e) => setLastSold(e.target.value)}
            placeholder="2019, or roughly"
            disabled={neverSold}
          />
          <label className="ap-check">
            <input type="checkbox" checked={neverSold} onChange={(e) => setNeverSold(e.target.checked)} />
            <span>I&rsquo;ve never sold</span>
          </label>
        </div>
      </div>

      <Choice label="What’s your preferred method of sale?" options={METHODS} value={methodOfSale} onChange={setMethodOfSale} name="method" />
      <Choice label="When are you hoping to come onto the market?" options={TIMEFRAMES} value={timeframe} onChange={setTimeframe} name="timeframe" />

      <label className="ap-field">
        <span>What do you think your home is worth?</span>
        <input className="field" value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} placeholder="A range is fine" />
      </label>

      <Choice
        label="Have you made any improvements to the property?"
        options={["Yes", "No"]}
        value={improvements}
        onChange={(v) => setImprovements(v as "Yes" | "No")}
        name="improvements"
      />
      {improvements === "Yes" && (
        <label className="ap-field">
          <span>What have you done?</span>
          <textarea className="field" rows={3} value={improvementsDetail} onChange={(e) => setImprovementsDetail(e.target.value)} />
        </label>
      )}

      <label className="ap-field">
        <span>Is there an agent you&rsquo;d like to speak with?</span>
        <select className="field" value={consultantId} onChange={(e) => setConsultantId(e.target.value)}>
          <option value="">No preference</option>
          {consultants.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.title ? ` — ${c.title}` : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="pf-row">
        <label>
          <span>Your email address</span>
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label>
          <span>Your contact number</span>
          <input className="field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </label>
      </div>

      <Choice label="When would you like us to call?" options={WHEN} value={when} onChange={setWhen} name="when" />
      {when === "Another day" && (
        <label className="ap-field">
          <span>Which day suits?</span>
          <input className="field" type="date" value={whenOther} onChange={(e) => setWhenOther(e.target.value)} />
        </label>
      )}

      <div className="ap-field">
        <span className="ap-label">Where did you hear about us?</span>
        <div className="ap-options">
          {HEARD.map((h) => (
            <label key={h} className={`ap-chip${heard.includes(h) ? " on" : ""}`}>
              <input type="checkbox" checked={heard.includes(h)} onChange={() => toggleHeard(h)} />
              <span>{h}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Hidden from people, irresistible to bots. */}
      <label className="hp" aria-hidden="true">
        Company
        <input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
      </label>

      {error && (
        <p className="form-note" role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}

      <button className="btn" type="submit" disabled={state === "sending"} style={{ marginTop: 26 }}>
        {state === "sending" ? "Sending…" : "Send my details"}
      </button>
      <p className="form-note" style={{ marginTop: 14 }}>
        We&rsquo;ll only use these details to talk to you about selling. Nothing else.
      </p>
    </form>
  );
}

/** A row of choices — radios styled as chips, because a long select hides its options. */
function Choice({
  label,
  options,
  value,
  onChange,
  name,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  return (
    <div className="ap-field">
      <span className="ap-label">{label}</span>
      <div className="ap-options">
        {options.map((o) => (
          <label key={o} className={`ap-chip${value === o ? " on" : ""}`}>
            <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
