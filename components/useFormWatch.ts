"use client";

import { useEffect, useRef } from "react";
import { watchForm, type FormName } from "@/lib/track";

/**
 * Attach the form watch to a form, and tell it when the send succeeded.
 *
 * One hook so four forms don't each grow their own copy of the same refs and
 * effects — and so the teardown is never the thing somebody forgets. Returns
 * the ref to put on the <form>, and `finished()` to call after a successful
 * submit.
 */
export function useFormWatch<T extends HTMLElement = HTMLFormElement>(form: FormName) {
  // Generic because the questionnaire is a <div> of sections rather than a
  // <form> — the watch only needs something that events bubble to.
  const ref = useRef<T | null>(null);
  const watch = useRef<{ finished: () => void; stop: () => void } | null>(null);

  useEffect(() => {
    watch.current = watchForm(ref.current, form);
    return () => watch.current?.stop();
  }, [form]);

  return { ref, finished: () => watch.current?.finished() };
}
