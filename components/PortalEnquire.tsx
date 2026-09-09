"use client";

import { useState } from "react";
import EnquiryForm from "./EnquiryForm";

/**
 * The Enquire button on a row of the private list.
 *
 * The list itself stays a list — street, suburb, rooms, land, nothing more.
 * This is the one thing on the row that does anything, and what it does is the
 * only thing the page is for: start a conversation about a house whose details
 * are deliberately not published.
 *
 * The button and the form are SIBLINGS, not nested, because the row is a CSS
 * grid: the button takes the last column, and the form takes a full-width
 * track underneath it. Nesting them would trap the form in a 90px column.
 *
 * Only one row's form is open at a time by construction — each row owns its own
 * state, and opening one does not close another, which is right: a buyer
 * comparing two houses may well want to ask about both.
 */
export default function PortalEnquire({
  listingId,
  listingAddress,
  agentNames,
}: {
  listingId: string;
  /** The FULL address, number included — this reaches the office, not the page. */
  listingAddress: string;
  agentNames: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="pl-cta"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close" : "Enquire"}
      </button>

      {open && (
        <div className="pl-form">
          <EnquiryForm
            listingId={listingId}
            listingAddress={listingAddress}
            agentNames={agentNames}
          />
        </div>
      )}
    </>
  );
}
