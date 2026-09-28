import { getCampaign, campaignVendors, outstandingVendors, mode } from "@/lib/campaigns";
import { getMarketingSource } from "@/lib/boxdice";
import { verifyToken } from "@/lib/portal-token";
import { getStaff } from "@/lib/staff-auth";
import { recordOpen, vendorFromToken, AUTHORISATION_WORDING } from "@/lib/vendor";
import { fmtDate } from "@/lib/when";
import VendorApprovalForm from "@/components/VendorApprovalForm";
import VendorFrame from "@/components/vendor/VendorFrame";
import { buildChapters, ChapterSections } from "@/components/vendor/Chapters";

export const metadata = {
  title: "Review your marketing — Loutakis Real Estate",
  robots: { index: false, follow: false, noarchive: true },
};
export const dynamic = "force-dynamic";

function Expired() {
  return (
    <section className="va-expired">
      <div>
        <div className="eyebrow">Loutakis Real Estate</div>
        <h2>That link isn&rsquo;t valid</h2>
        <p>It may have expired. Call Michael on <a href="tel:0409438025">0409&nbsp;438&nbsp;025</a> and we&rsquo;ll send a fresh one.</p>
      </div>
    </section>
  );
}

export default async function ApprovePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { t?: string; preview?: string };
}) {
  const token = searchParams?.t ?? "";
  const payload = verifyToken(token);
  const isVendorToken = payload?.a === "vendor";
  const isPreview = !isVendorToken && searchParams?.preview === "1" && Boolean(getStaff());
  if (!isVendorToken && !isPreview) return <Expired />;

  const c = await getCampaign(params.id);
  if (!c) return <Expired />;
  if (c.status === "draft" && !isPreview) return <Expired />;

  /** Which of them this link was sent to. Null in preview, or on a dud link. */
  const who = isVendorToken ? vendorFromToken(c, payload!.c) : null;
  const vendorOk = Boolean(who);
  if (isVendorToken && !who) return <Expired />;

  const everyone = campaignVendors(c);
  const waitingOn = outstandingVendors(c);
  /** Has the person holding THIS link already signed? */
  const alreadySigned = Boolean(
    who && (c.approvals ?? []).some((a) => a.email.toLowerCase() === who.vendor.email.toLowerCase())
  );
  const needsAll = mode(c) === "all" && everyone.length > 1;

  const source = await getMarketingSource(c.listingId);
  if (vendorOk) await recordOpen(c);

  const fileQ = vendorOk ? `?t=${encodeURIComponent(token)}` : "";
  const approved = c.status === "approved";
  // The chapters are built in one place and rendered identically here and on
  // the password-protected example at /marketingapproval.
  const { chapters, markers, hero } = buildChapters(c, source, fileQ);

  return (
    <div className="va2">
      <VendorFrame address={c.address} markers={markers} approved={approved} />
      {isPreview && <div className="va-preview">Preview — this is what {everyone[0]?.name || "the vendor"} will see. Opens aren&rsquo;t counted.</div>}

      {/* Opening */}
      <section className="vh" style={hero ? { backgroundImage: `url(${hero})` } : undefined}>
        <div className="vh-inner">
          <h1>{c.address}</h1>
        </div>
        <a href={`#${markers[0]?.id ?? "approve"}`} className="vh-scroll" aria-label="Scroll to begin"><i /></a>
      </section>

      <ChapterSections chapters={chapters} />

      <section className="vch vch-approve" id="approve">
        <div className="vch-head">
          <h2>{approved ? "Approved" : alreadySigned ? "Thank you" : "Your approval"}</h2>
          {!approved && !alreadySigned && (
            <p className="vch-blurb">
              If it all looks right, put your name to it and we&rsquo;ll get moving. If something needs changing, say so here and it comes straight to Michael.
              {needsAll &&
                ` Both owners need to approve before anything goes to print, so ${everyone
                  .filter((v) => v.email !== who?.vendor.email)
                  .map((v) => v.name.split(" ")[0])
                  .join(" and ")} will be asked separately.`}
            </p>
          )}
        </div>
        <div className="vch-body">
          {approved ? (
            <div className="vdone">
              <div className="vdone-mark">✓</div>
              <h3>Approved by {c.approvedName}</h3>
              <p>
                On {fmtDate(c.approvedAt!)}. Production is under way.
              </p>
            </div>
          ) : alreadySigned ? (
            /* They have signed and someone else has not. Their own approval is
               done — showing them the form again would invite a second one. */
            <div className="vdone">
              <div className="vdone-mark">✓</div>
              <h3>You&rsquo;ve approved this.</h3>
              <p>
                We&rsquo;re waiting on{" "}
                {waitingOn.map((v) => v.name || v.email).join(" and ")} before anything goes to
                print. We&rsquo;ll let you know as soon as it&rsquo;s done.
              </p>
              <p className="vp-note">Changed your mind? Call Michael on 0409 438 025.</p>
            </div>
          ) : (
            <VendorApprovalForm campaignId={c.id} token={vendorOk ? token : ""} wording={AUTHORISATION_WORDING} preview={isPreview} address={c.address} vendorName={who?.vendor.name ?? (everyone.length === 1 ? everyone[0].name : "")} items={chapters.map((ch) => ch.title)} />
          )}
        </div>
      </section>

      <footer className="vfoot">
        <span>Loutakis Real Estate · 0409 438 025</span>
        <span>It&rsquo;s time to move.</span>
      </footer>
    </div>
  );
}
