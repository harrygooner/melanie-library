"use client";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FlaskConical,
  Gauge,
  Link2,
  PackageCheck,
  Search,
  Thermometer,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import formulasRaw from "@/app/data/formulas.json";
import proceduresRaw from "@/app/data/formula-procedures.json";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type FormulaIngredient = {
  order: number;
  phase: string;
  tradeName: string;
  inci: string;
  function: string;
  supplier: string;
  percentage: string;
  productId: string;
  catalogName: string;
};

export type Formula = {
  id: string;
  title: string;
  code: string;
  year: number;
  sourceFile: string;
  sourceType: string;
  solutionId: string;
  ingredientCount: number;
  linkedIngredientCount: number;
  ingredients: FormulaIngredient[];
};

export type FormulaSolution = {
  id: string;
  title: string;
  description: string;
  formulaCount: number;
};

type FormulaCatalog = {
  meta: {
    formulaCount: number;
    solutionCount: number;
    ingredientLineCount: number;
    linkedIngredientLineCount: number;
    sourceYears: number[];
  };
  solutions: FormulaSolution[];
  formulas: Formula[];
};

type FormulaProcedure = {
  systemType: string;
  basis: "source" | "derived";
  steps: {
    number: number;
    title: string;
    phase: string;
    instruction: string;
    temperature: string;
    mixing: string;
    control: string;
  }[];
  note: string;
};

type ProcedureCatalog = {
  meta: { formulaCount: number; sourceBasedCount: number };
  procedures: Record<string, FormulaProcedure>;
};

export const formulaCatalog = formulasRaw as FormulaCatalog;
const procedureCatalog = proceduresRaw as ProcedureCatalog;

const accents = [
  "from-cyan-500 to-blue-700",
  "from-amber-400 to-orange-600",
  "from-violet-500 to-indigo-700",
  "from-emerald-400 to-teal-700",
  "from-rose-400 to-red-600",
  "from-sky-500 to-cyan-700",
];

const solutionImages: Record<string, { src: string; alt: string }> = {
  "solution-moisture": { src: "/packed/hydration-recovery.webp", alt: "Minh họa giải pháp dưỡng ẩm và phục hồi hàng rào da" },
  "solution-brightening": { src: "/packed/brightening-antiaging.webp", alt: "Minh họa giải pháp làm sáng da" },
  "solution-antiaging": { src: "/packed/brightening-antiaging.webp", alt: "Minh họa giải pháp chống lão hóa" },
  "solution-soothing": { src: "/packed/hydration-recovery.webp", alt: "Minh họa giải pháp làm dịu da" },
  "solution-exfoliation": { src: "/packed/cleansing-acne.webp", alt: "Minh họa giải pháp tẩy tế bào chết" },
  "solution-acne": { src: "/packed/cleansing-acne.webp", alt: "Minh họa giải pháp chăm sóc da mụn" },
  "solution-sun": { src: "/packed/sun-makeup.webp", alt: "Minh họa giải pháp chống nắng" },
  "solution-cleansing": { src: "/packed/cleansing-acne.webp", alt: "Minh họa giải pháp làm sạch" },
  "solution-hair": { src: "/packed/hair-scalp.webp", alt: "Minh họa giải pháp chăm sóc tóc và da đầu" },
  "solution-lip": { src: "/packed/sun-makeup.webp", alt: "Minh họa giải pháp chăm sóc môi" },
  "solution-intimate": { src: "/packed/personal-care.webp", alt: "Minh họa giải pháp chăm sóc cá nhân" },
  "solution-oral": { src: "/packed/personal-care.webp", alt: "Minh họa giải pháp chăm sóc răng miệng" },
  "solution-base": { src: "/packed/personal-care.webp", alt: "Minh họa giải pháp nền công thức" },
};

export function PackedSolutionsView({
  solutionId,
  setSolutionId,
  formulaId,
  setFormulaId,
  onIngredientSelect,
}: {
  solutionId: string;
  setSolutionId: (value: string) => void;
  formulaId: string;
  setFormulaId: (value: string) => void;
  onIngredientSelect: (productId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [unlinked, setUnlinked] = useState<FormulaIngredient | null>(null);
  const activeSolution = formulaCatalog.solutions.find((item) => item.id === solutionId);
  const activeFormula = formulaCatalog.formulas.find((item) => item.id === formulaId);
  const formulas = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return formulaCatalog.formulas.filter((item) => {
      if (solutionId && item.solutionId !== solutionId) return false;
      if (!normalized) return true;
      return `${item.title} ${item.code} ${item.ingredients.map((ingredient) => `${ingredient.tradeName} ${ingredient.inci}`).join(" ")}`.toLowerCase().includes(normalized);
    });
  }, [query, solutionId]);

  function openSolution(id: string) {
    setSolutionId(id);
    setFormulaId("");
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openFormula(id: string) {
    setFormulaId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (activeFormula) {
    const procedure = procedureCatalog.procedures[activeFormula.id];
    const activeImage = solutionImages[activeFormula.solutionId];
    return (
      <section>
        <Breadcrumb items={["Packed Solution", activeSolution?.title ?? "Giải pháp", activeFormula.title]} />
        <button type="button" onClick={() => setFormulaId("")} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-[#026690]/30 hover:text-[#026690]"><ArrowLeft className="size-4" /> Danh sách công thức</button>
        <div className="overflow-hidden rounded-[26px] border border-black/8 bg-white shadow-sm">
          <div className="grid overflow-hidden bg-[#181818] text-white lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="relative flex min-h-72 flex-col justify-center overflow-hidden px-5 py-7 sm:px-8 sm:py-9">
              <div className="absolute -left-24 -top-28 size-64 rounded-full bg-[#026690]/45" /><div className="absolute -bottom-28 right-8 size-56 rounded-full bg-[#ef6f32]/30" />
              <div className="relative"><div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-100"><Badge className="border-0 bg-white/15 text-white">{activeFormula.code || "Prototype"}</Badge><span>•</span><span>{activeFormula.year}</span><span>•</span><span>{activeFormula.sourceType}</span></div>
              <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-tight tracking-[-.035em] sm:text-5xl">{activeFormula.title}</h1>
              <p className="mt-4 text-sm text-cyan-50/85">{activeFormula.ingredientCount} nguyên liệu · {activeFormula.linkedIngredientCount} nguyên liệu đã liên kết với hồ sơ Sapharchem</p>
              <div className="mt-6 flex flex-wrap gap-3"><a href={`/formulas/${activeFormula.id}.pdf`} download={`${activeFormula.code || activeFormula.id}.pdf`} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#181818] shadow-sm transition hover:bg-cyan-50"><Download className="size-4 text-[#026690]" /> Tải PDF công thức</a>{procedure && <span className="inline-flex h-11 items-center rounded-full border border-white/15 bg-white/10 px-4 text-xs font-semibold text-white/80">{procedure.systemType}</span>}</div></div>
            </div>
            {activeImage && <div className="relative min-h-60 overflow-hidden lg:min-h-full"><img src={activeImage.src} alt={activeImage.alt} className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-[#181818]/30 via-transparent to-transparent" /><div className="absolute bottom-5 left-5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#181818] shadow-sm backdrop-blur">{activeSolution?.title}</div></div>}
          </div>
          <div className="p-4 sm:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#ef6f32]">Thành phần công thức</p><h2 className="mt-1 text-xl font-bold">Nguyên liệu & hàm lượng</h2></div><p className="max-w-lg text-xs leading-5 text-slate-500">Nhấn vào nguyên liệu để xem thông tin chi tiết. Dòng có dấu liên kết sẽ mở đúng hồ sơ nguyên liệu và tài liệu kỹ thuật.</p></div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Pha</th><th className="px-4 py-3">Tên thương mại</th><th className="px-4 py-3">INCI</th><th className="px-4 py-3">Chức năng</th><th className="px-4 py-3">Nhà cung cấp</th><th className="px-4 py-3 text-right">%</th><th className="px-4 py-3 text-center">Chi tiết</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {activeFormula.ingredients.map((ingredient) => (
                    <tr key={`${ingredient.order}-${ingredient.tradeName}-${ingredient.inci}`} className="group hover:bg-[#f4fafc]">
                      <td className="px-4 py-3 font-bold text-[#026690]">{ingredient.phase || "—"}</td>
                      <td className="px-4 py-3"><button type="button" onClick={() => ingredient.productId ? onIngredientSelect(ingredient.productId) : setUnlinked(ingredient)} className="max-w-60 text-left font-bold text-slate-800 hover:text-[#026690] hover:underline">{ingredient.tradeName || "—"}</button>{ingredient.catalogName && ingredient.catalogName !== ingredient.tradeName && <span className="mt-1 block text-[11px] text-[#026690]">↳ {ingredient.catalogName}</span>}</td>
                      <td className="max-w-72 px-4 py-3 leading-5 text-slate-600">{ingredient.inci || "—"}</td>
                      <td className="max-w-60 px-4 py-3 leading-5 text-slate-600">{ingredient.function || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{ingredient.supplier || "—"}</td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-800">{ingredient.percentage || "—"}</td>
                      <td className="px-4 py-3 text-center"><button type="button" onClick={() => ingredient.productId ? onIngredientSelect(ingredient.productId) : setUnlinked(ingredient)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${ingredient.productId ? "bg-[#eaf5f8] text-[#026690] hover:bg-[#d9eef5]" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{ingredient.productId ? <Link2 className="size-3.5" /> : <ChevronRight className="size-3.5" />}{ingredient.productId ? "Hồ sơ" : "Xem"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700"><CheckCircle2 className="size-3.5" /> {activeFormula.linkedIngredientCount} nguyên liệu có hồ sơ</span><span className="rounded-full bg-slate-100 px-3 py-1.5">Nguồn nội bộ: {activeFormula.sourceFile}</span></div>
            {procedure && <section className="mt-10 border-t border-slate-200 pt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#ef6f32]">Quy trình phối chế</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Các bước thực hiện chi tiết</h2></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${procedure.basis === "source" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{procedure.basis === "source" ? "Theo tài liệu công thức gốc" : "Quy trình chuẩn hóa đề xuất"}</span></div><div className="mt-6 grid gap-4 lg:grid-cols-2">{procedure.steps.map((step) => <article key={step.number} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[#fbfbfa] p-5"><span className="absolute right-4 top-2 text-6xl font-black tracking-tighter text-[#026690]/7">{String(step.number).padStart(2, "0")}</span><div className="relative"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#026690] text-sm font-black text-white">{step.number}</span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#ef6f32]">{step.phase}</p><h3 className="font-bold text-slate-900">{step.title}</h3></div></div><p className="mt-4 text-sm leading-6 text-slate-600">{step.instruction}</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600"><Thermometer className="size-4 text-[#ef6f32]" /> {step.temperature}</span><span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600"><Gauge className="size-4 text-[#026690]" /> {step.mixing}</span></div><div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-xs leading-5 text-emerald-800"><strong>Điểm kiểm soát:</strong> {step.control}</div></div></article>)}</div><p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800"><strong>Lưu ý:</strong> {procedure.note}</p></section>}
          </div>
        </div>
        <UnlinkedIngredientSheet ingredient={unlinked} onClose={() => setUnlinked(null)} />
      </section>
    );
  }

  if (activeSolution) {
    const activeImage = solutionImages[activeSolution.id];
    return (
      <section>
        <Breadcrumb items={["Packed Solution", activeSolution.title]} />
        <div className="mb-5 overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-sm">
          <div className="grid md:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col justify-center p-5 sm:p-7"><button type="button" onClick={() => setSolutionId("")} className="mb-3 inline-flex w-fit items-center gap-2 text-sm font-bold text-[#026690] hover:underline"><ArrowLeft className="size-4" /> Tất cả giải pháp</button><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{activeSolution.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{activeSolution.description}</p></div><Badge className="bg-[#026690] px-3 py-1.5">{formulas.length} công thức</Badge></div></div>
            {activeImage && <div className="relative min-h-52 overflow-hidden md:min-h-64"><img src={activeImage.src} alt={activeImage.alt} className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" /></div>}
          </div>
        </div>
        <FormulaSearch value={query} setValue={setQuery} />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{formulas.map((formula) => <FormulaCard key={formula.id} formula={formula} onClick={() => openFormula(formula.id)} />)}</div>
      </section>
    );
  }

  return (
    <section>
      <Breadcrumb items={["Packed Solution"]} />
      <div className="relative overflow-hidden rounded-[26px] bg-[#181818] px-5 py-7 text-white sm:px-9 sm:py-10">
        <div className="absolute -right-24 -top-32 size-80 rounded-full bg-[#026690]" /><div className="absolute -bottom-32 right-48 size-64 rounded-full bg-[#ef6f32]" />
        <div className="relative max-w-4xl"><div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-white/55"><PackageCheck className="size-4" /> Formula library</div><h1 className="text-[clamp(2.3rem,5vw,5rem)] font-semibold leading-[.98] tracking-[-.055em]">Packed solutions.<br /><span>Built to formulate.</span></h1><p className="mt-5 max-w-3xl text-sm leading-6 text-white/62 sm:text-base">Chọn một giải pháp, mở công thức tương ứng, sau đó đi đến từng nguyên liệu và hồ sơ kỹ thuật chi tiết.</p><div className="mt-7 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">{[[formulaCatalog.meta.solutionCount, "Giải pháp"], [formulaCatalog.meta.formulaCount, "Công thức"], [formulaCatalog.meta.ingredientLineCount, "Dòng nguyên liệu"], [formulaCatalog.meta.linkedIngredientLineCount, "Đã liên kết"]].map(([value, label]) => <div key={label} className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 backdrop-blur"><div className="text-2xl font-semibold">{Number(value).toLocaleString("vi-VN")}</div><div className="mt-0.5 text-xs text-white/50">{label}</div></div>)}</div></div>
      </div>
      <div className="mt-7"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#ef6f32]">Bước 1</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Chọn giải pháp</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{formulaCatalog.solutions.map((solution, index) => { const visual = solutionImages[solution.id]; return <button key={solution.id} type="button" onClick={() => openSolution(solution.id)} className="group overflow-hidden rounded-[22px] border border-black/8 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-black/20 hover:shadow-xl"><div className="relative h-44 overflow-hidden bg-slate-100">{visual && <img src={visual.src} alt={visual.alt} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />}<div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" /><span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm backdrop-blur"><FlaskConical className="size-3.5 text-[#026690]" /> {solution.formulaCount} công thức</span><span className={`absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r ${accents[index % accents.length]}`} /></div><div className="flex items-start gap-3 p-5"><span className="min-w-0 flex-1"><span className="block text-lg font-bold leading-snug text-slate-900 group-hover:text-[#026690]">{solution.title}</span><span className="mt-2 block text-sm leading-5 text-slate-500">{solution.description}</span></span><ChevronRight className="mt-1 size-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#ef6f32]" /></div></button>; })}</div></div>
    </section>
  );
}

function FormulaCard({ formula, onClick }: { formula: Formula; onClick: () => void }) {
  const visual = solutionImages[formula.solutionId];
  return <button type="button" onClick={onClick} className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:border-[#026690]/35 hover:shadow-xl"><div className="relative h-36 overflow-hidden bg-slate-100">{visual && <img src={visual.src} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}<div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" /><Badge className="absolute left-4 top-4 border-0 bg-white/90 text-[#181818] shadow-sm backdrop-blur">{formula.code || "Prototype"}</Badge><span className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 text-xs font-bold text-white"><CalendarDays className="size-3.5" /> {formula.year}</span></div><div className="flex min-h-52 flex-col p-5"><div className="flex items-start gap-3"><h2 className="min-w-0 flex-1 text-lg font-bold leading-snug text-slate-900 group-hover:text-[#026690]">{formula.title}</h2><ChevronRight className="mt-1 size-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#ef6f32]" /></div><p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500"><FileSpreadsheet className="size-3.5" /> {formula.ingredientCount} nguyên liệu</p><div className="mt-auto pt-5"><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#026690] to-cyan-400" style={{ width: `${Math.max(8, Math.round((formula.linkedIngredientCount / formula.ingredientCount) * 100))}%` }} /></div><div className="mt-2 flex items-center justify-between gap-3 text-xs"><span className="text-slate-400">{formula.linkedIngredientCount}/{formula.ingredientCount} đã liên kết</span><span className="font-bold text-[#026690]">Mở công thức</span></div></div></div></button>;
}

function FormulaSearch({ value, setValue }: { value: string; setValue: (value: string) => void }) {
  return <div className="relative max-w-xl"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Tìm tên công thức, mã, nguyên liệu…" className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm outline-none transition focus:border-[#026690]/50 focus:ring-4 focus:ring-[#026690]/10" />{value && <button type="button" onClick={() => setValue("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button>}</div>;
}

function Breadcrumb({ items }: { items: string[] }) {
  return <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-400">{items.map((item, index) => <span key={`${item}-${index}`} className="contents">{index > 0 && <ChevronRight className="size-3.5" />}<span className={index === items.length - 1 ? "text-[#026690]" : ""}>{item}</span></span>)}</div>;
}

function UnlinkedIngredientSheet({ ingredient, onClose }: { ingredient: FormulaIngredient | null; onClose: () => void }) {
  return <Sheet open={Boolean(ingredient)} onOpenChange={(open) => !open && onClose()}><SheetContent className="w-full overflow-y-auto border-l border-slate-200 bg-white p-0 sm:max-w-xl" side="right">{ingredient && <><div className="bg-[#035f85] px-6 pb-6 pt-7 text-white"><SheetHeader className="p-0 pr-8"><div className="text-xs font-bold uppercase tracking-wide text-cyan-100">Nguyên liệu trong công thức</div><SheetTitle className="mt-3 text-2xl font-bold text-white">{ingredient.tradeName || ingredient.inci || "Nguyên liệu"}</SheetTitle><SheetDescription className="text-cyan-100">Pha {ingredient.phase || "—"} · {ingredient.percentage || "—"}%</SheetDescription></SheetHeader></div><div className="space-y-5 p-6"><Info label="INCI" value={ingredient.inci} /><Info label="Chức năng" value={ingredient.function} /><Info label="Nhà cung cấp" value={ingredient.supplier} /><Info label="Hàm lượng" value={ingredient.percentage ? `${ingredient.percentage}%` : "—"} /><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800"><strong>Chưa liên kết với danh mục Sapharchem.</strong><br />Thông tin trên được lấy trực tiếp từ công thức. Hồ sơ kỹ thuật đầy đủ sẽ xuất hiện khi nguyên liệu được ghép với danh mục.</div></div></>}</SheetContent></Sheet>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <section><h3 className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">{label}</h3><p className="mt-2 text-sm leading-7 text-slate-700">{value || "—"}</p></section>;
}
