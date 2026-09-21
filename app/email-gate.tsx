"use client";

import { ArrowRight, Check } from "lucide-react";
import { FormEvent, useState } from "react";

export function EmailGate() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/email-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Không thể đăng nhập.");
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đăng nhập.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#cfceca] p-3 text-[#181818] sm:p-6 lg:p-10">
      <div className="mx-auto min-h-[calc(100vh-1.5rem)] max-w-[1380px] overflow-hidden rounded-[28px] bg-[#fbfbfa] shadow-[0_24px_80px_rgba(29,28,26,.12)] sm:min-h-[calc(100vh-3rem)] lg:min-h-[calc(100vh-5rem)]">
        <header className="flex items-center justify-between border-b border-black/8 px-5 py-4 sm:px-8">
          <div className="text-2xl font-semibold tracking-[-.04em]">sapharchem<sup className="ml-0.5 text-[#ef6f32]">°</sup></div>
          <span className="rounded-full bg-[#eceeec] px-4 py-2 text-xs font-semibold uppercase tracking-[.12em] text-black/60">Internal library</span>
        </header>
        <div className="grid min-h-[calc(100vh-8.5rem)] lg:grid-cols-[.92fr_1.08fr]">
          <section className="flex flex-col justify-between px-6 py-10 sm:px-10 lg:px-14 lg:py-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#026690]">Sapharchem portfolio</p>
              <h1 className="mt-5 max-w-2xl text-[clamp(2.8rem,6vw,6.4rem)] font-semibold leading-[.96] tracking-[-.065em]">Solutions for every formula.<br /><span>For SPC HPC.</span></h1>
              <p className="mt-7 max-w-lg text-base leading-7 text-black/58">Thư viện nguyên liệu, packed solutions, công thức và tài liệu kỹ thuật dành cho đội ngũ Sapharchem.</p>
            </div>
            <form onSubmit={submit} className="mt-12 max-w-xl">
              <label className="text-sm font-semibold" htmlFor="access-email">Email được cấp quyền</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input id="access-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="h-14 min-w-0 flex-1 rounded-full border border-black/15 bg-white px-5 text-base outline-none transition placeholder:text-black/30 focus:border-black focus:ring-4 focus:ring-black/5" />
                <button type="submit" disabled={submitting} className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#181818] px-6 text-sm font-bold text-white transition hover:bg-[#026690] disabled:opacity-50">{submitting ? "Đang mở…" : "Vào thư viện"}<ArrowRight className="size-4" /></button>
              </div>
              {error && <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
              <p className="mt-3 flex items-center gap-2 text-xs text-black/42"><Check className="size-3.5" /> Không cần mật khẩu · Chỉ email trong danh sách mới truy cập được</p>
            </form>
          </section>
          <section className="relative m-3 min-h-[520px] overflow-hidden rounded-[24px] bg-[#eef0f1] sm:m-5 lg:m-6">
            <img src="/images/login-molecular-visual.png" alt="Minh họa phân tử mỹ phẩm" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/22 via-transparent to-white/10" />
            <div className="absolute left-5 top-5 rounded-full border border-white/70 bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[.12em] text-[#026690] shadow-sm backdrop-blur sm:left-8 sm:top-8">Portfolio intelligence</div>
            <p className="absolute bottom-6 left-6 max-w-sm text-sm font-medium leading-6 text-white drop-shadow-md sm:bottom-8 sm:left-8">Khám phá giải pháp, nguyên liệu và tài liệu kỹ thuật trong cùng một không gian.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
