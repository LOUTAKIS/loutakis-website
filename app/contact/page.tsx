import EnquiryForm from "@/components/EnquiryForm";

export const metadata = {
  title: "Contact — Loutakis Real Estate",
  description:
    "Get in touch with Loutakis Real Estate in Kingsville VIC. Buying, selling, or just after honest advice — we'd love to hear from you.",
};

export default function ContactPage() {
  return (
    <section>
      <div className="wrap contact-page">
        <div className="contact-head">
          <div className="eyebrow">Contact us</div>
          <h1 className="lead">It&rsquo;s time to move.</h1>
          <p>
            If you&rsquo;re looking for real estate with a community-focused, modern twist, you&rsquo;re
            in the right place. Send a message below and we&rsquo;ll be in touch shortly.
          </p>
        </div>

        {/* The form leads and the details sit beside it. Two equal halves of a
            full-width page left the right column holding thirty-character
            lines across eight hundred pixels, which is where the emptiness
            came from. */}
        <div className="contact-grid">
          <EnquiryForm />

          <aside className="contact-details">
            <h3>Visit us</h3>
            <p>
              62A Williamstown Road,<br />Kingsville VIC 3012
            </p>
            <p>
              <a href="tel:0409438025">0409 438 025</a><br />
              <a href="mailto:michael@loutakis.com.au">michael@loutakis.com.au</a>
            </p>

            <h3>Hours</h3>
            <p>
              Monday &ndash; Friday: 9am &ndash; 5pm<br />Saturday: 10am &ndash; 2pm
            </p>

            <h3>Follow our journey</h3>
            <p className="contact-social">
              <a href="https://www.instagram.com/loutakisrealestate/">Instagram</a>{"  ·  "}
              <a href="https://www.youtube.com/@LoutakisRealEstate">YouTube</a>{"  ·  "}
              <a href="https://www.realestate.com.au/agency/loutakis-real-estate-YGFUOB">realestate.com.au</a>
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
