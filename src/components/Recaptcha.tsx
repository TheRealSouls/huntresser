"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

/**
 * Google reCAPTCHA v2 ("I'm not a robot" checkbox), loaded only on pages
 * that render it. The token is handed to `onChange` and is valid for about
 * two minutes and one submission; call `reset()` after a failed submit.
 * The site key is public; the secret belongs wherever the token is checked
 * (for the contact form, that's Formspree).
 */

type Grecaptcha = {
  render(el: HTMLElement, opts: Record<string, unknown>): number;
  reset(id?: number): void;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
    __trophypilotRecaptchaReady?: () => void;
  }
}

let loading: Promise<Grecaptcha> | null = null;

function loadRecaptcha(): Promise<Grecaptcha> {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  loading ??= new Promise((resolve, reject) => {
    window.__trophypilotRecaptchaReady = () => resolve(window.grecaptcha!);
    const s = document.createElement("script");
    s.src = "https://www.google.com/recaptcha/api.js?onload=__trophypilotRecaptchaReady&render=explicit&hl=en";
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error("reCAPTCHA didn't load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export type RecaptchaHandle = { reset(): void };

export function Recaptcha({
  siteKey,
  onChange,
  onError,
  ref,
}: {
  siteKey: string;
  onChange: (token: string | null) => void;
  onError?: (message: string) => void;
  ref?: Ref<RecaptchaHandle>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<number | null>(null);
  // Keep the latest callbacks without re-rendering the widget.
  const cb = useRef({ onChange, onError });
  cb.current = { onChange, onError };

  useImperativeHandle(ref, () => ({
    reset() {
      if (widget.current !== null) window.grecaptcha?.reset(widget.current);
      cb.current.onChange(null);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadRecaptcha()
      .then((g) => {
        if (cancelled || !box.current || widget.current !== null) return;
        widget.current = g.render(box.current, {
          sitekey: siteKey,
          theme: "light",
          callback: (token: string) => cb.current.onChange(token),
          "expired-callback": () => cb.current.onChange(null),
          "error-callback": () => {
            cb.current.onChange(null);
            cb.current.onError?.("reCAPTCHA couldn't connect. Check your connection and try again.");
          },
        });
      })
      .catch(() => cb.current.onError?.("reCAPTCHA couldn't load. Turn off any blocker for google.com and reload the page."));
    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  // Google's iframe carries its own label and keyboard support; this box just holds it.
  return <div ref={box} className="min-h-[78px]" />;
}
