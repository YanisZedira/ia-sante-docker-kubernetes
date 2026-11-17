// Traduction de la plateforme : le français est la source, les autres langues sont des
// dictionnaires { texte français : traduction } appliqués aux nœuds de texte et aux attributs,
// y compris ceux que les démonstrations écrivent ensuite (MutationObserver).
// Les phrases dynamiques ({0}, {1}) passent par des modèles convertis en expressions régulières.

export const LANGS = [
  { code: "fr", label: "Français", short: "FR" },
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "ES" },
  { code: "ar", label: "العربية", short: "AR" },
  { code: "hi", label: "हिन्दी", short: "HI" },
  { code: "zh", label: "中文", short: "中文" },
] as const;
type Code = (typeof LANGS)[number]["code"];

const FONTS: Partial<Record<Code, string>> = {
  ar: "Noto+Sans+Arabic:wght@400;500;600;700",
  hi: "Noto+Sans+Devanagari:wght@400;500;600;700",
  zh: "Noto+Sans+SC:wght@400;500;700",
};

const loaders: Record<string, () => Promise<{ default: Record<string, string> }>> = {
  en: () => import("./i18n/en.json"),
  es: () => import("./i18n/es.json"),
  ar: () => import("./i18n/ar.json"),
  hi: () => import("./i18n/hi.json"),
  zh: () => import("./i18n/zh.json"),
};

function pick(): Code {
  const codes = LANGS.map((l) => l.code) as readonly string[];
  const q = new URLSearchParams(location.search).get("lang");
  if (q && codes.includes(q)) {
    try { localStorage.setItem("ia-sante-lang", q); } catch { /* navigation privée */ }
    return q as Code;
  }
  try {
    const s = localStorage.getItem("ia-sante-lang");
    if (s && codes.includes(s)) return s as Code;
  } catch { /* ignoré */ }
  return "fr";
}

export const lang: Code = pick();

let dict: Record<string, string> = {};
let templates: { re: RegExp; out: string }[] = [];
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function t(src: string): string {
  const k = norm(src);
  if (!k) return src;
  let out = dict[k];
  if (out === undefined) {
    for (const tp of templates) {
      const m = tp.re.exec(k);
      if (m) { out = tp.out.replace(/\{(\d)\}/g, (_, i) => (m[+i + 1] ?? "").replace(/(\d),(\d)/g, "$1.$2")); break; }
    }
  }
  if (out === undefined) return src;
  const lead = src.match(/^\s*/)![0], trail = src.match(/\s*$/)![0];
  return lead + out + trail;
}

const ATTRS = ["alt", "aria-label", "title", "placeholder"];
const done = new WeakMap<Node, string>(); // dernière valeur écrite par nous, pour ne pas boucler

function skip(el: Element | null) {
  return !el || !!el.closest("script,style,svg,.lang,.w,[data-i18n-skip]");
}

function textNode(n: Text) {
  if (skip(n.parentElement) || done.get(n) === n.nodeValue) return;
  const v = n.nodeValue || "";
  if (!v.trim()) return;
  const out = t(v);
  done.set(n, out);
  if (out !== v) n.nodeValue = out;
}

function attrs(el: Element) {
  if (skip(el)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && v.trim()) { const o = t(v); if (o !== v) el.setAttribute(a, o); }
  }
}

function walk(root: Node) {
  if (root.nodeType === 3) return textNode(root as Text);
  if (root.nodeType !== 1) return;
  const el = root as Element;
  attrs(el);
  el.querySelectorAll("[alt],[aria-label],[title],[placeholder]").forEach(attrs);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) textNode(w.currentNode as Text);
}

function loadFont(code: Code) {
  const f = FONTS[code];
  if (!f) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = `https://fonts.googleapis.com/css2?family=${f}&display=swap`;
  document.head.appendChild(l);
}

function switcher() {
  const nav = document.getElementById("nav");
  if (!nav) return;
  const cur = LANGS.find((l) => l.code === lang)!;
  const box = document.createElement("div");
  box.className = "lang";
  box.innerHTML =
    `<button type="button" class="lang__btn" aria-haspopup="true" aria-expanded="false" aria-label="Langue / Language">` +
    `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 12h18M12 3c2.6 2.8 3.9 5.8 3.9 9s-1.3 6.2-3.9 9c-2.6-2.8-3.9-5.8-3.9-9S9.4 5.8 12 3z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>` +
    `<span>${cur.short}</span></button>` +
    `<ul class="lang__menu" role="menu">` +
    LANGS.map((l) => `<li role="none"><a role="menuitem" lang="${l.code}" href="?lang=${l.code}"${l.code === lang ? ' aria-current="true"' : ""}>${l.label}</a></li>`).join("") +
    `</ul>`;
  const cta = nav.querySelector(".nav__cta");
  nav.insertBefore(box, cta);
  const btn = box.querySelector("button")!;
  const close = () => { box.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = box.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  box.querySelectorAll<HTMLAnchorElement>(".lang__menu a").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const code = a.getAttribute("lang")!;
      try { localStorage.setItem("ia-sante-lang", code); } catch { /* ignoré */ }
      (window as unknown as { gtag?: (...x: unknown[]) => void }).gtag?.("event", "ia_sante_langue", { langue: code });
      const u = new URL(location.href);
      if (code === "fr") u.searchParams.delete("lang"); else u.searchParams.set("lang", code);
      location.href = u.toString();
    }),
  );
}

/** À attendre avant tout le reste : traduit la page statique, puis suit les changements. */
export async function initI18n() {
  switcher();
  if (lang === "fr") return;
  document.documentElement.lang = lang;
  if (lang === "ar") document.documentElement.dir = "rtl";
  document.documentElement.classList.add("i18n");
  loadFont(lang);
  try {
    dict = (await loaders[lang]()).default;
  } catch {
    return;
  }
  templates = Object.keys(dict)
    .filter((k) => /\{\d\}/.test(k))
    .sort((a, b) => b.length - a.length)
    .map((k) => ({
      re: new RegExp("^" + esc(k).replace(/\\\{(\d)\\\}/g, "(.+?)") + "$"),
      out: dict[k],
    }));
  document.title = t(document.title);
  walk(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") textNode(m.target as Text);
      else if (m.type === "attributes") attrs(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
