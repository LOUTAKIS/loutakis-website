"use client";

/**
 * Enquiry form — emails Michael directly. It does NOT write to Box & Dice.
 * (Read-only site: no records are ever created in the CRM.)
 */
export default function EnquiryForm({ listingId }: { listingId?: string }) {
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const subject = encodeURIComponent(
      "Website enquiry" + (listingId ? ` (listing ${listingId})` : "")
    );
    const body = encodeURIComponent(
      `Name: ${f.get("name")}\nEmail: ${f.get("email")}\nPhone: ${f.get("phone")}\n\n${f.get("message")}`
    );
    window.location.href = `mailto:michael@loutakis.com.au?subject=${subject}&body=${body}`;
  }

  return (
    <form onSubmit={onSubmit}>
      <input className="field" name="name" placeholder="Your name" required />
      <input className="field" name="email" type="email" placeholder="Email" required />
      <input className="field" name="phone" placeholder="Phone" />
      <textarea className="field" name="message" placeholder="I'd like to know more…" required />
      <button className="btn" style={{ width: "100%" }}>Enquire &rarr;</button>
      <p className="form-note">We&rsquo;ll be in touch shortly.</p>
    </form>
  );
}
