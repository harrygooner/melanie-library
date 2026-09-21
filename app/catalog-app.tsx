"use client";

import {
  Award,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  FolderOpen,
  Layers3,
  Leaf,
  LogOut,
  Mail,
  Menu,
  MoonStar,
  PackageCheck,
  Pencil,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  ShieldCheck,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import catalogRaw from "@/app/data/catalog.json";
import { marketReferences, type MarketReference } from "@/app/data/market";
import { formulaCatalog, PackedSolutionsView } from "@/app/packed-solutions";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Ingredient = {
  id: string;
  group: string;
  supplier: string;
  name: string;
  form: string;
  inci: string;
  description: string;
  recommendedUsage?: string;
  recommendedUsageSource?: string;
  certificates: string;
  certificateTags: string[];
  search: string;
};

type PackedSolution = {
  id: string;
  title: string;
  productIds: string[];
  count: number;
};

type Catalog = {
  meta: {
    sourceFile: string;
    sourceModified: string;
    ingredientCount: number;
    groupCount: number;
    supplierCount: number;
    packedSolutionCount: number;
  };
  groups: { name: string; count: number }[];
  suppliers: { name: string; count: number }[];
  certificates: { name: string; count: number }[];
  packedSolutions: PackedSolution[];
  ingredients: Ingredient[];
};

type DocumentRecord = {
  id: string;
  documentType: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedByEmail: string;
  createdAt: string;
};

type DocumentRequestRecord = {
  id: string;
  productId: string;
  productName: string;
  requestedTypes: string;
  note: string;
  requesterEmail: string;
  status: "pending" | "resolved";
  createdAt: string;
  resolvedAt?: string | null;
};

type View = "overview" | "applications" | "packed" | "market";

const catalog = catalogRaw as Catalog;
const MAX_VISIBLE = 72;

const packedAccents = [
  "from-cyan-500 to-blue-700",
  "from-amber-400 to-orange-600",
  "from-violet-500 to-indigo-700",
  "from-emerald-400 to-teal-700",
  "from-rose-400 to-red-600",
  "from-sky-500 to-cyan-700",
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function relationTerms(group: string) {
  const value = normalize(group);
  if (value.includes("nhu hoa") || value.includes("hoa tan")) return ["emulsifier", "solubilizer", "nhũ hóa", "trợ tan"];
  if (value.includes("lam dac") || value.includes("tao dac") || value.includes("do nhot") || value.includes("luu bien")) return ["thickener", "rheology modifier", "polymer", "làm đặc"];
  if (value.includes("chong nang") || value.includes("mang loc uv")) return ["uv filter", "sunscreen", "chống nắng"];
  if (value.includes("duong am")) return ["moisturizer", "hydration", "dưỡng ẩm"];
  if (value.includes("trang da") || value.includes("lam sang")) return ["brightening", "làm sáng"];
  if (value.includes("diu da") || value.includes("phuc hoi")) return ["soothing", "sensitive", "làm dịu"];
  if (value.includes("chong lao hoa") || value.includes("peptide")) return ["anti aging", "peptide", "chống lão hóa"];
  if (value.includes("toc") || value.includes("da dau") || value.includes("conditioning")) return ["hair", "scalp", "hair conditioning", "tóc"];
  if (value.includes("hoat dong be mat") || value.includes("tay rua") || value.includes("tai lang dong")) return ["surfactant", "cleansing", "detergency", "chất hoạt động bề mặt"];
  if (value.includes("tao mang")) return ["film former", "water resistance", "tạo màng"];
  if (value.includes("bao quan")) return ["preservative", "bảo quản"];
  return [];
}

function marketMatches(
  reference: MarketReference,
  query: string,
  saphMatches: Ingredient[],
) {
  const direct = normalize(
    `${reference.name} ${reference.supplier} ${reference.inci} ${reference.function} ${reference.category} ${reference.keywords}`,
  );
  const terms = normalize(query).split(" ").filter(Boolean);
  if (terms.length && terms.every((term) => direct.includes(term))) return true;
  const related = new Set(
    saphMatches.slice(0, 12).flatMap((item) => relationTerms(item.group)).map(normalize),
  );
  return [...related].some((term) => term && direct.includes(term));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function friendlyDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function recommendedUsage(ingredient: Ingredient) {
  if (ingredient.recommendedUsage?.trim()) return ingredient.recommendedUsage.trim();
  const match = ingredient.description.match(/(?:recommended\s+(?:use|dosage|level)|use\s+level|dosage|hàm\s+lượng\s+(?:khuyến\s+nghị|sử\s+dụng))\s*[:：-]?\s*((?:>|<|≥|≤)?\s*\d+(?:[.,]\d+)?\s*%?\s*(?:(?:~|–|—|-|to)\s*\d+(?:[.,]\d+)?\s*%)?)/i);
  return match?.[1]?.trim() || "Đang cập nhật";
}

function CertificateMark({ name }: { name: string }) {
  const value = name.toUpperCase();
  const iconClass = "size-6";
  let icon = <Leaf className={iconClass} />;
  let color = "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "HALAL") { icon = <MoonStar className={iconClass} />; color = "border-teal-200 bg-teal-50 text-teal-700"; }
  else if (value === "KOSHER") { icon = <Star className={iconClass} />; color = "border-blue-200 bg-blue-50 text-blue-700"; }
  else if (value === "REACH") { icon = <ShieldCheck className={iconClass} />; color = "border-sky-200 bg-sky-50 text-sky-700"; }
  else if (value === "PATENTED") { icon = <Award className={iconClass} />; color = "border-orange-200 bg-orange-50 text-orange-700"; }
  return <div className={`flex min-w-24 items-center gap-2 rounded-xl border px-3 py-2 ${color}`}><span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/80">{icon}</span><span className="text-[11px] font-extrabold tracking-wide">{name}</span></div>;
}

export function CatalogApp({
  user,
  isAdmin,
  signOutHref,
}: {
  user: { displayName: string; email: string };
  isAdmin: boolean;
  signOutHref: string;
}) {
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [supplier, setSupplier] = useState("");
  const [certificates, setCertificates] = useState<string[]>([]);
  const [solutionId, setSolutionId] = useState("");
  const [formulaId, setFormulaId] = useState("");
  const [selected, setSelected] = useState<Ingredient | null>(null);
  const [mobileFilters, setMobileFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const normalizedQuery = normalize(query);
  const filtered = useMemo(() => {
    return catalog.ingredients.filter((item) => {
      if (normalizedQuery && !item.search.includes(normalizedQuery)) return false;
      if (group && item.group !== group) return false;
      if (supplier && item.supplier !== supplier) return false;
      if (
        certificates.length &&
        !certificates.every((certificate) => item.certificateTags.includes(certificate))
      ) return false;
      return true;
    });
  }, [certificates, group, normalizedQuery, supplier]);

  const searchMatches = useMemo(() => {
    if (!normalizedQuery) return [];
    return catalog.ingredients.filter((item) => item.search.includes(normalizedQuery));
  }, [normalizedQuery]);

  const marketMatchesList = useMemo(() => {
    if (!normalizedQuery) return marketReferences;
    return marketReferences.filter((item) => marketMatches(item, query, searchMatches));
  }, [normalizedQuery, query, searchMatches]);

  const hasFilters = Boolean(group || supplier || certificates.length);

  function clearFilters() {
    setGroup("");
    setSupplier("");
    setCertificates([]);
  }

  function openGroup(name: string) {
    setView("applications");
    setGroup(name);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigate(next: View) {
    setView(next);
    setQuery("");
    if (next !== "applications") setGroup("");
    if (next === "packed") {
      setSolutionId("");
      setFormulaId("");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await modelContext.registerTool(
        {
          name: "search_sapharchem_catalog",
          title: "Tìm nguyên liệu Sapharchem",
          description: "Tìm theo tên thương mại, INCI, công dụng hoặc chứng nhận và hiển thị kết quả đối chiếu.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute: (input: unknown) => {
            const value = String((input as { query?: unknown })?.query ?? "").trim();
            if (!value) throw new Error("Search query is required");
            setQuery(value);
            setView("overview");
            searchRef.current?.focus();
            return { query: value, status: "shown" };
          },
        },
        { signal: lifecycle.signal },
      );
      await modelContext.registerTool(
        {
          name: "show_packed_solution",
          title: "Mở Packed Solution",
          description: "Mở một giải pháp trong thư viện công thức Packed Solution.",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute: (input: unknown) => {
            const id = String((input as { id?: unknown })?.id ?? "");
            const item = formulaCatalog.solutions.find((solution) => solution.id === id);
            if (!item) throw new Error("Packed solution not found");
            setSolutionId(id);
            setFormulaId("");
            setView("packed");
            setQuery("");
            return { id, title: item.title, formulaCount: item.formulaCount };
          },
        },
        { signal: lifecycle.signal },
      );
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#181818]">
      <div className="min-h-screen w-full overflow-hidden bg-white">
      <header className="sticky top-0 z-40 border-b border-black/8 bg-[#fbfbfa]/95 backdrop-blur-xl">
        <div className="flex h-[76px] items-center gap-5 px-4 sm:px-7 lg:px-9">
          <button type="button" onClick={() => navigate("overview")} className="group flex shrink-0 items-center gap-3 text-left" aria-label="Về trang tổng quan">
            <span className="text-2xl font-semibold tracking-[-.045em] sm:text-3xl">sapharchem<sup className="ml-0.5 text-sm text-[#ef6f32]">°</sup></span>
          </button>
          <nav className="hidden items-center gap-1 rounded-full bg-[#eceeec] p-1 xl:flex" aria-label="Điều hướng chính">
            {[
              ["overview", "Tổng quan"],
              ["applications", "Theo ứng dụng"],
              ["packed", "Packed Solutions"],
              ["market", "Đối chiếu thị trường"],
            ].map(([key, label]) => (
              <button key={key} type="button" onClick={() => navigate(key as View)} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${view === key && !query ? "bg-[#181818] text-white shadow-sm" : "text-black/55 hover:bg-white hover:text-black"}`}>
                {label}
              </button>
            ))}
          </nav>
          <div className="relative ml-auto hidden w-full max-w-[430px] md:block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, INCI, công dụng…" className="h-11 w-full rounded-full border border-black/10 bg-white pl-10 pr-10 text-sm outline-none transition placeholder:text-black/30 focus:border-black/35 focus:ring-4 focus:ring-black/5" aria-label="Tìm kiếm nguyên liệu" />
            {query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label="Xóa tìm kiếm"><X className="size-4" /></button>}
          </div>
          <div className="group relative">
            <button type="button" className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1.5 shadow-sm hover:border-black/25" aria-label="Tài khoản">
              <span className="grid size-8 place-items-center rounded-full bg-[#181818] text-xs font-bold text-white">{initials(user.displayName || user.email)}</span>
              <span className="hidden max-w-36 truncate text-left text-xs font-semibold text-slate-700 sm:block">{user.displayName}</span>
              <Menu className="size-4 text-slate-400" />
            </button>
            <div className="invisible absolute right-0 top-[calc(100%+8px)] w-72 translate-y-1 rounded-2xl border border-slate-200 bg-white p-3 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                <UserRound className="mt-0.5 size-5 text-[#026690]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user.displayName}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                  {isAdmin && <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[#ef6f32]">Quản trị tài liệu</p>}
                </div>
              </div>
              <a href={signOutHref} target="_top" className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"><LogOut className="size-4" /> Đăng xuất</a>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 pb-16 pt-5 sm:px-7 lg:px-9">
        <div className="mb-5 md:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, INCI, công dụng…" className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm outline-none focus:border-[#026690]/50 focus:ring-4 focus:ring-[#026690]/10" aria-label="Tìm kiếm nguyên liệu" />
          </div>
        </div>
        {query ? (
          <SearchComparison query={query} saphResults={searchMatches} marketResults={marketMatchesList} onSelect={setSelected} />
        ) : view === "overview" ? (
          <Overview onGroup={openGroup} onPacked={(id) => { setSolutionId(id); setFormulaId(""); setView("packed"); }} />
        ) : view === "market" ? (
          <MarketLibrary items={marketMatchesList} />
        ) : view === "packed" ? (
          <PackedSolutionsView solutionId={solutionId} setSolutionId={setSolutionId} formulaId={formulaId} setFormulaId={setFormulaId} onIngredientSelect={(productId) => { const ingredient = catalog.ingredients.find((item) => item.id === productId); if (ingredient) setSelected(ingredient); }} />
        ) : (
          <CatalogView filtered={filtered} group={group} setGroup={setGroup} supplier={supplier} setSupplier={setSupplier} certificates={certificates} setCertificates={setCertificates} hasFilters={hasFilters} clearFilters={clearFilters} mobileFilters={mobileFilters} setMobileFilters={setMobileFilters} onSelect={setSelected} />
        )}
      </main>
      <IngredientSheet key={selected?.id ?? "closed"} ingredient={selected} onClose={() => setSelected(null)} isAdmin={isAdmin} userEmail={user.email} />
      <a
        href="/catalog/SPC-HPC-Catalog-2026.pdf"
        download="SPC-HPC-Catalog-2026.pdf"
        className="group fixed bottom-5 right-4 z-30 flex items-center gap-3 rounded-2xl bg-[#181818] px-4 py-3 text-white shadow-[0_16px_40px_rgba(0,0,0,.24)] transition hover:-translate-y-0.5 hover:bg-[#026690] hover:shadow-[0_18px_48px_rgba(2,102,144,.28)] focus:outline-none focus:ring-4 focus:ring-[#026690]/20 sm:bottom-7 sm:right-7"
        aria-label="Tải catalog HPC dạng PDF"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/12 text-[#ef6f32] transition group-hover:bg-white/15 group-hover:text-white"><Download className="size-5" /></span>
        <span className="text-left"><span className="block text-sm font-bold leading-tight">Xuất catalog HPC</span><span className="mt-0.5 block text-[11px] text-white/55 group-hover:text-white/70">PDF · {catalog.meta.ingredientCount.toLocaleString("vi-VN")} sản phẩm</span></span>
      </a>
      </div>
    </div>
  );
}

function Overview({ onGroup, onPacked }: { onGroup: (group: string) => void; onPacked: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-7">
      <section className="relative overflow-hidden rounded-[26px] border border-black/6 bg-[#e8ebea] px-5 py-7 sm:px-9 sm:py-10">
        <div className="absolute inset-y-0 right-0 hidden w-[42%] lg:block">
          <div className="absolute right-[-8%] top-[-32%] size-80 rounded-full bg-[#026690]" />
          <div className="absolute bottom-[-42%] right-[34%] size-64 rounded-full bg-[#ef6f32]/90" />
        </div>
        <div className="relative max-w-4xl">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#026690]"><FlaskConical className="size-4" /> Portfolio intelligence</div>
          <h1 className="max-w-3xl text-[clamp(2.3rem,5vw,5.2rem)] font-semibold leading-[.98] tracking-[-.055em]">Đúng nguyên liệu.<br /><span>Đúng giải pháp.</span></h1>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-black/58 sm:text-base">Khám phá danh mục theo ứng dụng, chứng nhận và bộ giải pháp; mở chi tiết để xem INCI, công dụng và tài liệu kỹ thuật dùng chung.</p>
          <div className="mt-6 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [catalog.meta.ingredientCount.toLocaleString("vi-VN"), "Nguyên liệu"],
              [String(catalog.meta.groupCount), "Nhóm ứng dụng"],
              [String(catalog.meta.supplierCount), "Nhà cung cấp"],
              [String(formulaCatalog.meta.formulaCount), "Công thức"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-black/6 bg-[#fbfbfa]/90 px-4 py-3 shadow-sm backdrop-blur"><div className="text-2xl font-semibold tracking-[-.04em] sm:text-3xl">{value}</div><div className="mt-0.5 text-xs font-semibold text-black/45">{label}</div></div>
            ))}
          </div>
        </div>
      </section>

      <section className="order-2">
        <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#ef6f32]">Packed Solution</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Chọn giải pháp để xem công thức</h2></div><span className="hidden text-sm text-slate-500 sm:block">Giải pháp → Công thức → Nguyên liệu → Chi tiết</span></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {formulaCatalog.solutions.map((solution, index) => (
            <button key={solution.id} type="button" onClick={() => onPacked(solution.id)} className="group overflow-hidden rounded-[22px] border border-black/8 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-lg">
              <div className={`h-1.5 bg-gradient-to-r ${packedAccents[index % packedAccents.length]}`} />
              <div className="flex items-start gap-4 p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#181818] text-white"><PackageCheck className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="block text-base font-bold leading-snug text-slate-900">{solution.title}</span><span className="mt-1.5 block text-sm text-slate-500">{solution.formulaCount.toLocaleString("vi-VN")} công thức</span></span>
                <ChevronRight className="mt-1 size-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#026690]" />
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="order-1">
        <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.15em] text-[#026690]">Danh mục chuyên sâu</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Khám phá theo ứng dụng</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {catalog.groups.map((item, index) => (
            <button key={item.name} type="button" onClick={() => onGroup(item.name)} className="group flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#026690]/30 hover:shadow-md">
              <span className="flex items-start justify-between gap-3"><span className={`grid size-9 place-items-center rounded-xl ${index % 3 === 0 ? "bg-[#e8f4f8] text-[#026690]" : index % 3 === 1 ? "bg-orange-50 text-[#ef6f32]" : "bg-slate-100 text-slate-600"}`}>{index % 3 === 0 ? <FlaskConical className="size-4" /> : index % 3 === 1 ? <Sparkles className="size-4" /> : <Layers3 className="size-4" />}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{item.count}</span></span>
              <span className="mt-4 text-sm font-bold leading-snug text-slate-800 group-hover:text-[#026690]">{item.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function SearchComparison({ query, saphResults, marketResults, onSelect }: { query: string; saphResults: Ingredient[]; marketResults: MarketReference[]; onSelect: (item: Ingredient) => void }) {
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#ef6f32]">Kết quả tìm kiếm</p><h1 className="mt-1 text-2xl font-bold tracking-tight">“{query}”</h1></div><p className="max-w-xl text-xs leading-5 text-slate-500">Cột thị trường là danh sách tham khảo có chức năng hoặc INCI gần; không đồng nghĩa có thể thay thế 1:1. Cần đối chiếu TDS, liều dùng và thử nghiệm công thức.</p></div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-[#026690]/20 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#eaf5f8] px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#026690] text-white"><FlaskConical className="size-4" /></span><div><h2 className="font-bold text-[#034f70]">Giải pháp Sapharchem</h2><p className="text-xs text-slate-500">Danh mục đang phân phối</p></div></div><Badge className="bg-[#026690]">{saphResults.length}</Badge></div>
          <div className="max-h-[68vh] space-y-2 overflow-y-auto p-3 scrollbar-thin">{saphResults.length ? saphResults.slice(0, MAX_VISIBLE).map((item) => <IngredientRow key={item.id} item={item} onSelect={onSelect} />) : <EmptyState title="Chưa có kết quả trong danh mục" text="Thử tên INCI, công dụng hoặc một từ khóa rộng hơn." />}</div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-orange-50 px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#ef6f32] text-white"><BookOpen className="size-4" /></span><div><h2 className="font-bold text-[#b84c18]">Tham khảo thị trường / đối thủ</h2><p className="text-xs text-slate-500">Dữ liệu công khai từ nhà sản xuất</p></div></div><Badge className="bg-[#ef6f32]">{marketResults.length}</Badge></div>
          <div className="max-h-[68vh] space-y-2 overflow-y-auto p-3 scrollbar-thin">{marketResults.length ? marketResults.map((item) => <MarketRow key={item.id} item={item} />) : <EmptyState title="Chưa có đối chiếu phù hợp" text="Thư viện đối chiếu sẽ được tiếp tục cập nhật theo nguồn công khai." />}</div>
        </div>
      </div>
    </section>
  );
}

function CatalogView({ filtered, group, setGroup, supplier, setSupplier, certificates, setCertificates, hasFilters, clearFilters, mobileFilters, setMobileFilters, onSelect }: { filtered: Ingredient[]; group: string; setGroup: (value: string) => void; supplier: string; setSupplier: (value: string) => void; certificates: string[]; setCertificates: (value: string[]) => void; hasFilters: boolean; clearFilters: () => void; mobileFilters: boolean; setMobileFilters: (value: boolean) => void; onSelect: (item: Ingredient) => void }) {
  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#ef6f32]">Danh mục nguyên liệu</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{group || "Theo ứng dụng"}</h1><p className="mt-1 text-sm text-slate-500">{filtered.length.toLocaleString("vi-VN")} nguyên liệu phù hợp</p></div><button type="button" onClick={() => setMobileFilters(!mobileFilters)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm lg:hidden"><SlidersHorizontal className="size-4" /> Bộ lọc</button></div>
      <div className="grid gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className={`${mobileFilters ? "block" : "hidden"} rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-[92px] lg:block lg:self-start`}>
          <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal className="size-4 text-[#026690]" /> Bộ lọc</h2>{hasFilters && <button type="button" onClick={clearFilters} className="text-xs font-bold text-[#ef6f32] hover:underline">Xóa lọc</button>}</div>
          <label className="block border-b border-slate-100 pb-4"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Ứng dụng</span><select value={group} onChange={(event) => setGroup(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#026690]"><option value="">Tất cả ứng dụng</option>{catalog.groups.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}</select></label>
          <label className="block border-b border-slate-100 py-4"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Nhà cung cấp</span><select value={supplier} onChange={(event) => setSupplier(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#026690]"><option value="">Tất cả nhà cung cấp</option>{catalog.suppliers.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}</select></label>
          <div className="pt-4"><span className="mb-3 block text-xs font-bold uppercase tracking-wide text-slate-500">Certificate</span><div className="space-y-2.5">{catalog.certificates.map((item) => { const checked = certificates.includes(item.name); return <label key={item.name} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700"><Checkbox checked={checked} onCheckedChange={(value) => setCertificates(value ? [...certificates, item.name] : certificates.filter((name) => name !== item.name))} /><span className="flex-1">{item.name}</span><span className="text-xs text-slate-400">{item.count}</span></label>; })}</div></div>
        </aside>
        <div>{filtered.length ? <><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.slice(0, MAX_VISIBLE).map((item) => <IngredientCard key={item.id} item={item} onSelect={onSelect} />)}</div>{filtered.length > MAX_VISIBLE && <p className="mt-5 rounded-xl bg-white px-4 py-3 text-center text-sm text-slate-500">Đang hiển thị {MAX_VISIBLE} / {filtered.length.toLocaleString("vi-VN")} kết quả. Dùng bộ lọc để thu hẹp danh sách.</p>}</> : <div className="rounded-2xl border border-slate-200 bg-white p-8"><EmptyState title="Không có nguyên liệu phù hợp" text="Bỏ bớt một chứng nhận hoặc chọn lại ứng dụng/nhà cung cấp." /></div>}</div>
      </div>
    </section>
  );
}

function MarketLibrary({ items }: { items: MarketReference[] }) {
  return <section><div className="mb-5 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#ef6f32]">Market intelligence</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Thư viện đối chiếu thị trường</h1><p className="mt-2 text-sm leading-6 text-slate-500">Nguồn tham khảo công khai từ website nhà sản xuất. Các gợi ý chỉ dùng để định hướng rà soát; cần xác nhận lại TDS, thành phần, liều dùng, chứng nhận và điều kiện thử nghiệm trước khi so sánh kỹ thuật.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#ef6f32]">{item.supplier}</p><h2 className="mt-1 text-lg font-bold">{item.name}</h2></div><Badge variant="outline" className="border-orange-200 bg-orange-50 text-[#b84c18]">{item.category}</Badge></div><p className="mt-4 text-sm leading-6 text-slate-600">{item.function}</p><div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">INCI / hệ tham chiếu</p><p className="mt-1 text-sm leading-5 text-slate-700">{item.inci}</p></div><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#026690] hover:underline">Mở nguồn {item.sourceLabel} <ExternalLink className="size-3.5" /></a></div>)}</div></section>;
}

function SupplierTag({ name, inverse = false }: { name: string; inverse?: boolean }) {
  return <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-[.15em] ${inverse ? "bg-[#ef6f32] text-white shadow-sm" : "bg-[#fff0e8] text-[#b84c18] ring-1 ring-inset ring-[#ef6f32]/25"}`}>{name}</span>;
}

function IngredientCard({ item, onSelect }: { item: Ingredient; onSelect: (item: Ingredient) => void }) {
  return <button type="button" onClick={() => onSelect(item)} className="group flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#026690]/35 hover:shadow-lg"><div className="flex items-start justify-between gap-3"><SupplierTag name={item.supplier} /><ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#ef6f32]" /></div><h3 className="mt-4 text-lg font-bold leading-snug text-slate-900 group-hover:text-[#026690]">{item.name}</h3><p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{item.group}</p><p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{item.inci || "INCI đang cập nhật"}</p><div className="mt-auto flex flex-wrap gap-1.5 pt-4">{item.certificateTags.slice(0, 4).map((certificate) => <Badge key={certificate} variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700"><Check className="size-2.5" />{certificate}</Badge>)}{!item.certificateTags.length && <span className="text-xs text-slate-400">Certificate đang cập nhật</span>}</div></button>;
}

function IngredientRow({ item, onSelect }: { item: Ingredient; onSelect: (item: Ingredient) => void }) {
  return <button type="button" onClick={() => onSelect(item)} className="group w-full rounded-xl border border-transparent p-3 text-left transition hover:border-[#026690]/20 hover:bg-[#f4fafc]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><SupplierTag name={item.supplier} />{item.certificateTags.slice(0, 2).map((tag) => <Badge key={tag} variant="outline" className="h-5 rounded-full border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700">{tag}</Badge>)}</div><h3 className="mt-1 truncate font-bold text-slate-900 group-hover:text-[#026690]">{item.name}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.inci || item.group}</p></div><ChevronRight className="mt-3 size-4 shrink-0 text-slate-300 group-hover:text-[#026690]" /></div></button>;
}

function MarketRow({ item }: { item: MarketReference }) {
  return <div className="rounded-xl border border-transparent p-3 transition hover:border-orange-200 hover:bg-orange-50/50"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-[#b84c18]">{item.supplier}</span><Badge variant="outline" className="h-5 border-orange-200 bg-orange-50 text-[10px] text-[#b84c18]">{item.category}</Badge></div><h3 className="mt-1 font-bold text-slate-900">{item.name}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.inci}</p></div><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm hover:border-orange-300 hover:text-[#ef6f32]" aria-label={`Mở nguồn ${item.name}`}><ExternalLink className="size-3.5" /></a></div></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="grid min-h-52 place-items-center text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Search className="size-5" /></span><p className="mt-3 font-bold text-slate-700">{title}</p><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{text}</p></div></div>;
}

function IngredientSheet({ ingredient, onClose, isAdmin, userEmail }: { ingredient: Ingredient | null; onClose: () => void; isAdmin: boolean; userEmail: string }) {
  const ingredientId = ingredient?.id;
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [documentType, setDocumentType] = useState("TDS");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentRecord | null>(null);
  const [editFilename, setEditFilename] = useState("");
  const [editDocumentType, setEditDocumentType] = useState("TDS");
  const [savingEdit, setSavingEdit] = useState(false);
  const [requests, setRequests] = useState<DocumentRequestRecord[]>([]);
  const [requestTypes, setRequestTypes] = useState<string[]>([]);
  const [requestNote, setRequestNote] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [resolvingId, setResolvingId] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const requestDocumentTypes = ["TDS", "SDS", "COA", "Composition", "COO", "Presentation", "RIS", "Clinical Test", "Product Information", "Certificate", "Other"];

  const loadDocuments = useCallback(async (productId: string) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/documents?productId=${encodeURIComponent(productId)}`);
      const payload = (await response.json()) as { documents?: DocumentRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Không thể tải danh sách tài liệu.");
      setDocuments(payload.documents ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải danh sách tài liệu."); }
    finally { setLoading(false); }
  }, []);

  const loadRequests = useCallback(async (productId: string) => {
    try {
      const response = await fetch(`/api/document-requests?productId=${encodeURIComponent(productId)}`);
      const payload = (await response.json()) as { requests?: DocumentRequestRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Không thể tải yêu cầu tài liệu.");
      setRequests(payload.requests ?? []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể tải yêu cầu tài liệu."); }
  }, []);

  useEffect(() => {
    if (!ingredientId) return;
    const timer = window.setTimeout(() => { void loadDocuments(ingredientId); void loadRequests(ingredientId); }, 0);
    return () => window.clearTimeout(timer);
  }, [ingredientId, loadDocuments, loadRequests]);

  function toggleRequestType(type: string) {
    setRequestTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  async function submitDocumentRequest() {
    if (!ingredient || !requestTypes.length) return;
    setRequesting(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/document-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: ingredient.id, productName: ingredient.name, requestedTypes: requestTypes, note: requestNote }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Không thể gửi yêu cầu.");
      setSuccess("Đã ghi nhận yêu cầu. Email gửi Melanie đã được chuẩn bị.");
      await loadRequests(ingredient.id);
      const subject = encodeURIComponent(`[SPC HPC] Request tài liệu – ${ingredient.name}`);
      const body = encodeURIComponent(`Chào Melanie,\n\nTôi cần bổ sung tài liệu cho nguyên liệu ${ingredient.name}.\nLoại tài liệu: ${requestTypes.join(", ")}\nGhi chú: ${requestNote || "Không có"}\n\nNgười yêu cầu: ${userEmail}\nVui lòng cập nhật lên hệ thống và phản hồi khi hoàn tất.\n\nCảm ơn.`);
      setRequestTypes([]); setRequestNote("");
      window.location.href = `mailto:melanie@sapharchem.com?subject=${subject}&body=${body}`;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể gửi yêu cầu."); }
    finally { setRequesting(false); }
  }

  async function resolveDocumentRequest(item: DocumentRequestRecord) {
    if (!ingredient) return;
    setResolvingId(item.id); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/document-requests/${item.id}`, { method: "PATCH" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Không thể hoàn tất yêu cầu.");
      await loadRequests(ingredient.id);
      setSuccess("Đã đánh dấu hoàn tất. Email phản hồi cho member đã được chuẩn bị.");
      const subject = encodeURIComponent(`[SPC HPC] Đã cập nhật tài liệu – ${ingredient.name}`);
      const body = encodeURIComponent(`Chào bạn,\n\nTài liệu bạn yêu cầu cho nguyên liệu ${ingredient.name} (${item.requestedTypes}) đã được cập nhật trên hệ thống SPC HPC.\n\nBạn có thể đăng nhập để xem và tải tài liệu.\n\nTrân trọng,\nMelanie`);
      window.location.href = `mailto:${encodeURIComponent(item.requesterEmail)}?subject=${subject}&body=${body}`;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể hoàn tất yêu cầu."); }
    finally { setResolvingId(""); }
  }

  async function uploadDocument() {
    if (!ingredient || !file) return;
    setUploading(true); setError(""); setSuccess("");
    const body = new FormData();
    body.set("productId", ingredient.id); body.set("documentType", documentType); body.set("file", file);
    try {
      const response = await fetch("/api/documents", { method: "POST", body });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Tải lên không thành công.");
      setSuccess("Đã thêm tài liệu để cả team cùng xem."); setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await loadDocuments(ingredient.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Tải lên không thành công."); }
    finally { setUploading(false); }
  }

  function startEditingDocument(document: DocumentRecord) {
    setEditingDocument(document);
    setEditFilename(document.filename);
    setEditDocumentType(document.documentType);
    setError(""); setSuccess("");
  }

  async function saveDocumentEdit() {
    if (!ingredient || !editingDocument || !editFilename.trim()) return;
    setSavingEdit(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/documents/${editingDocument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: editFilename.trim(), documentType: editDocumentType }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Không thể cập nhật tài liệu.");
      setSuccess("Đã cập nhật thông tin tài liệu.");
      setEditingDocument(null);
      await loadDocuments(ingredient.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không thể cập nhật tài liệu."); }
    finally { setSavingEdit(false); }
  }

  return (
    <Sheet open={Boolean(ingredient)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto border-l border-slate-200 bg-white p-0 sm:max-w-2xl" side="right">
        {ingredient && <><div className="bg-[#035f85] px-6 pb-6 pt-7 text-white sm:px-8"><SheetHeader className="p-0 pr-8"><div className="flex flex-wrap items-center gap-2"><SupplierTag name={ingredient.supplier} inverse />{ingredient.certificateTags.map((tag) => <span key={tag} className="rounded-full border border-emerald-200/60 bg-emerald-50/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-50">{tag}</span>)}</div><SheetTitle className="mt-3 text-2xl font-bold leading-tight text-white sm:text-3xl">{ingredient.name}</SheetTitle><SheetDescription className="mt-1 text-sm leading-6 text-cyan-100">{ingredient.group}</SheetDescription></SheetHeader></div>
        <div className="space-y-6 p-6 sm:p-8"><DetailBlock label="INCI" value={ingredient.inci || "Đang cập nhật"} />{ingredient.form && <DetailBlock label="Thể chất" value={ingredient.form} />}<DetailBlock label="Đặc điểm – tác dụng" value={ingredient.description || "Đang cập nhật"} /><DetailBlock label="Hàm lượng sử dụng khuyến nghị" value={recommendedUsage(ingredient)} note={ingredient.recommendedUsageSource ? `Nguồn: ${ingredient.recommendedUsageSource}` : undefined} /><DetailBlock label="Certificate" value={ingredient.certificates || "Đang cập nhật"} />{ingredient.certificateTags.length > 0 && <section><h3 className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Biểu tượng chứng nhận</h3><div className="mt-3 flex flex-wrap gap-2">{ingredient.certificateTags.map((tag) => <CertificateMark key={tag} name={tag} />)}</div></section>}
          <section className="border-t border-slate-200 pt-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#ef6f32]">Technical documents</p><h3 className="mt-1 text-lg font-bold">Tài liệu kỹ thuật</h3><p className="mt-1 text-xs leading-5 text-slate-500">Admin tải lên · Mọi thành viên được cấp quyền đều có thể xem và tải xuống.</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{documents.length} file</span></div>
            {loading ? <div className="mt-4 space-y-2">{[0, 1].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div> : documents.length ? <div className="mt-4 space-y-2">{documents.map((document) => <div key={document.id} className="group flex items-center gap-2 rounded-xl border border-slate-200 p-2 transition hover:border-[#026690]/30 hover:bg-[#f4fafc]"><a href={`/api/documents/${document.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-1"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eaf5f8] text-[#026690]"><FileText className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{document.filename}</span><span className="mt-0.5 block text-xs text-slate-400">{document.documentType} · {formatBytes(document.sizeBytes)} · {friendlyDate(document.createdAt)}</span></span><Download className="size-4 text-slate-300 group-hover:text-[#026690]" /></a>{isAdmin && <button type="button" onClick={() => startEditingDocument(document)} className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-[#026690]/30 hover:text-[#026690]" aria-label={`Chỉnh sửa ${document.filename}`}><Pencil className="size-3.5" /></button>}</div>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center"><FolderOpen className="mx-auto size-6 text-slate-400" /><p className="mt-2 text-sm font-bold text-slate-600">Chưa gắn tài liệu</p><p className="mt-1 text-xs text-slate-400">Tài liệu được thêm sẽ hiển thị cho cả team.</p></div>}
            <div className="mt-5 rounded-2xl border border-[#026690]/20 bg-[#f4fafc] p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-bold text-[#026690]"><Mail className="size-4" /> Request thêm tài liệu</div><p className="mt-1 text-xs leading-5 text-slate-500">Chọn tài liệu còn thiếu. Yêu cầu sẽ được lưu và email đến melanie@sapharchem.com.</p></div>{requests.some((item) => item.status === "pending") && <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold text-orange-700">{requests.filter((item) => item.status === "pending").length} đang chờ</span>}</div><div className="mt-3 flex flex-wrap gap-2">{requestDocumentTypes.map((type) => <button type="button" key={type} onClick={() => toggleRequestType(type)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${requestTypes.includes(type) ? "border-[#026690] bg-[#026690] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-[#026690]/40"}`}>{type}</button>)}</div><textarea value={requestNote} onChange={(event) => setRequestNote(event.target.value)} rows={3} maxLength={1000} placeholder="Ghi chú thêm (nếu có): phiên bản mới nhất, certificate cụ thể…" className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#026690]" /><button type="button" disabled={!requestTypes.length || requesting} onClick={submitDocumentRequest} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#026690] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Mail className="size-4" /> {requesting ? "Đang ghi nhận…" : "Gửi request"}</button></div>
            {requests.length > 0 && <div className="mt-4 space-y-2"><p className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Lịch sử request</p>{requests.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold text-slate-800">{item.requestedTypes}</p><p className="mt-1 text-xs text-slate-500">{friendlyDate(item.createdAt)}{isAdmin ? ` · ${item.requesterEmail}` : ""}</p>{item.note && <p className="mt-2 text-xs leading-5 text-slate-600">{item.note}</p>}</div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === "resolved" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>{item.status === "resolved" ? "Đã xử lý" : "Đang chờ"}</span></div>{isAdmin && item.status === "pending" && <button type="button" onClick={() => resolveDocumentRequest(item)} disabled={resolvingId === item.id} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 disabled:opacity-50"><Check className="size-3.5" /> {resolvingId === item.id ? "Đang cập nhật…" : "Đã xử lý & phản hồi member"}</button>}</div>)}</div>}
            {isAdmin && editingDocument && <div className="mt-4 rounded-2xl border border-[#026690]/20 bg-[#f4fafc] p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-bold text-[#026690]"><Pencil className="size-4" /> Chỉnh sửa tài liệu</div><button type="button" onClick={() => setEditingDocument(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"><X className="size-4" /></button></div><div className="mt-3 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]"><Select value={editDocumentType} onValueChange={setEditDocumentType}><SelectTrigger className="h-11 w-full bg-white"><SelectValue /></SelectTrigger><SelectContent>{["TDS", "SDS", "COA", "Composition", "COO", "Presentation", "RIS", "Clinical Test", "Product Information", "Certificate", "Other"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><input value={editFilename} onChange={(event) => setEditFilename(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#026690]" aria-label="Tên tài liệu" /></div><button type="button" disabled={!editFilename.trim() || savingEdit} onClick={saveDocumentEdit} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#026690] px-4 text-sm font-bold text-white disabled:opacity-50"><Check className="size-4" /> {savingEdit ? "Đang lưu…" : "Lưu thay đổi"}</button></div>}
            {isAdmin && <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50/60 p-4"><div className="flex items-center gap-2 text-sm font-bold text-[#b84c18]"><Upload className="size-4" /> Thêm tài liệu cho team</div><div className="mt-3 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]"><Select value={documentType} onValueChange={setDocumentType}><SelectTrigger className="h-11 w-full bg-white"><SelectValue /></SelectTrigger><SelectContent>{["TDS", "SDS", "COA", "Composition", "COO", "Presentation", "RIS", "Clinical Test", "Product Information", "Certificate", "Other"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><input ref={fileInput} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-[#eaf5f8] file:px-3 file:py-1 file:text-xs file:font-bold file:text-[#026690]" /></div><button type="button" disabled={!file || uploading} onClick={uploadDocument} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#ef6f32] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#d95e24] disabled:cursor-not-allowed disabled:opacity-50"><Upload className="size-4" /> {uploading ? "Đang tải lên…" : "Tải lên"}</button><p className="mt-2 text-[11px] leading-5 text-slate-500">Hỗ trợ PDF, Office, ảnh và ZIP; tối đa 15 MB/tệp.</p></div>}
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}{success && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p>}
          </section>
        </div></>}
      </SheetContent>
    </Sheet>
  );
}

function DetailBlock({ label, value, note }: { label: string; value: string; note?: string }) {
  return <section><h3 className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">{label}</h3><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{value}</p>{note && <p className="mt-1 text-xs leading-5 text-slate-400">{note}</p>}</section>;
}
