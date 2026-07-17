"use client";

import { useEffect, useState } from "react";

import { CEO_QUOTES, FEATURED_CEO_QUOTES, getRandomCeoQuotes } from "@/lib/ceo-quotes";

export function CeoQuotesCard() {
  const [showAllQuotes, setShowAllQuotes] = useState(false);
  const [featuredQuotes, setFeaturedQuotes] = useState(() => [...FEATURED_CEO_QUOTES]);

  function randomizeFeaturedQuotes() {
    setFeaturedQuotes(getRandomCeoQuotes(4));
  }

  useEffect(() => {
    const randomTimer = window.setTimeout(() => {
      setFeaturedQuotes(getRandomCeoQuotes(4));
    }, 0);

    return () => window.clearTimeout(randomTimer);
  }, []);

  return (
    <>
      <section className="rounded-[28px] border border-emerald-100/80 bg-white/95 p-5 shadow-[0_18px_50px_rgba(20,83,45,0.07)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">CEO Quotes</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">คำคมจาก CEO</h3>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">
            4 / 100
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {featuredQuotes.map((quote, index) => (
            <blockquote
              key={quote}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-700 shadow-sm"
            >
              <span className="mr-2 font-black text-emerald-700">{index + 1}.</span>
              {quote}
            </blockquote>
          ))}
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
            onClick={randomizeFeaturedQuotes}
          >
            สุ่มใหม่ 4/100
          </button>
          <button
            type="button"
            className="min-h-11 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200"
            onClick={() => setShowAllQuotes(true)}
          >
            เปิด 100 CEO Quotes
          </button>
        </div>
      </section>

      {showAllQuotes ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <section className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">CEO Library</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-slate-950">100 CEO Quotes</h3>
              </div>
              <button
                type="button"
                className="grid min-h-11 min-w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={() => setShowAllQuotes(false)}
                aria-label="ปิดคลังคำคม"
              >
                X
              </button>
            </div>

            <div className="max-h-[68vh] overflow-y-auto px-5 py-5">
              <div className="grid gap-3 md:grid-cols-2">
                {CEO_QUOTES.map((quote, index) => (
                  <blockquote key={quote} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
                    <span className="mr-2 font-black text-emerald-700">{index + 1}.</span>
                    {quote}
                  </blockquote>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
