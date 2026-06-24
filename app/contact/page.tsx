import EnquiryForm from "@/components/EnquiryForm";

export const metadata = {
  title: "Contact — Loutakis Real Estate",
  description:
    "Get in touch with Loutakis Real Estate in Kingsville VIC. Buying, selling, or just after honest advice — we'd love to hear from you.",
};

export default function ContactPage() {
  return (
    <section>
      <div className="wrap">
        <div className="eyebrow">Contact us</div>
        <h1 className="lead">It&rsquo;s time to move.</h1>
        <p style={{ maxWidth: 640, color: "var(--muted)", marginTop: 18 }}>
          If you&rsquo;re looking for real estate with a community-focused, modern twist, you&rsquo;re
          in the right place. Send a message below and we&rsquo;ll be in touch shortly.
        </p>

        <div className="intro-grid" style={{ marginTop: 48, alignItems: "start" }}>
          <div>
            <EnquiryForm />
          </div>

          <div>
            <h3 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 20, marginBottom: 12 }}>
              Visit us
            </h3>
            <p style={{ color: "var(--muted)" }}>
              62A Williamstown Road,<br />Kingsville VIC 3012
            </p>
            <p style={{ marginTop: 16 }}>
              <a href="tel:0409438025">0409 438 025</a><br />
              <a href="mailto:michael@loutakis.com.au">michael@loutakis.com.au</a>
            </p>

            <h3 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 20, margin: "30px 0 12px" }}>
              Hours
            </h3>
            <p style={{ color: "var(--muted)" }}>
              Monday – Saturday: 9am – 6pm<br />Sunday: 10am – 3pm
            </p>

            <h3 style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: 20, margin: "30px 0 12px" }}>
              Follow our journey
            </h3>
            <p style={{ letterSpacing: ".04em" }}>
              <a href="https://www.instagram.com/loutakisrealestate/">Instagram</a>{"  ·  "}
              <a href="https://www.youtube.com/@LoutakisRealEstate">YouTube</a>{"  ·  "}
              <a href="https://www.realestate.com.au/agency/loutakis-real-estate-YGFUOB">realestate.com.au</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
