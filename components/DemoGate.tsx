"use client";

import { useState } from "react";

/**
 * The password on the example marketing approval.
 *
 * A gate, not security. Everything behind it is marketing a stranger could
 * find on realestate.com.au; the password keeps the page out of search results
 * and off the open web, and makes it something a seller is GIVEN rather than
 * something they stumble on.
 *
 * So the copy doesn't scold. Somebody arriving here has been sent a link by
 * their agent, and the only reason they are looking at this box is that they
 * are considering selling with us.
 */
export default function DemoGate() {
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "wrong">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setState("checking");
    try {
      const res = await fetch("/api/marketingapproval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error();
      // A full reload rather than a router refresh: the cookie is what makes
      // the page render, and the server has to see it set.
      window.location.reload();
    } catch {
      setState("wrong");
    }
  }

  return (
    <section className="portal-page">
      <div className="wrap col-signin">
        <div className="eyebrow">Loutakis Real Estate</div>
        <h2>Marketing approval</h2>
        <p className="portal-intro">
          An example of the page you&rsquo;ll use to review and approve your marketing. The password
          is in the email we sent you.
        </p>

        <form className="portal-form" onSubmit={submit} noValidate>
          <label>
            <span>Password</span>
            <input
              className="field"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (state === "wrong") setState("idle");
              }}
              autoComplete="off"
              autoFocus
            />
          </label>
          <button className="btn" disabled={state === "checking"}>
            {state === "checking" ? "Checking…" : "Show me"}
          </button>
          {state === "wrong" && (
            <p className="form-note" role="alert" style={{ color: "#b00020" }}>
              That&rsquo;s not it. Check the email, or call Michael on 0409 438 025.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
