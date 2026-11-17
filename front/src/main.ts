import "./styles.css";
import "./v3.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { initMammo } from "./mammo";
import { initQuiz, initErrors, initStainLab } from "./tissue";
import { renderStatic } from "./static";
import { preloadModels } from "./preload";
import { initOrb } from "./orb";
import { initI18n } from "./i18n";
import { showStats } from "./api";

await initI18n(); // traduit la page avant le découpage des titres

gsap.registerPlugin(ScrollTrigger);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------------------------------------------------------- suivi (balise du site) */
document.addEventListener("click", (e) => {
  const a = (e.target as Element).closest<HTMLElement>("[data-track]");
  if (!a) return;
  (window as unknown as { gtag?: (...x: unknown[]) => void }).gtag?.("event", "ia_sante_clic", { cible: a.dataset.track });
});

/* ---------------------------------------------------------------- titres découpés en mots */
document.querySelectorAll<HTMLElement>("[data-split]").forEach((el) => {
  el.setAttribute("aria-label", el.textContent!.replace(/\s+/g, " ").trim());
  const words = el.textContent!.trim().split(/[ \n\t\r]+/); // garde les espaces insécables
  el.innerHTML = words.map((w) => `<span class="w" aria-hidden="true"><span>${w}</span></span>`).join(" ");
});

/* ---------------------------------------------------------------- défilement doux */
if (!reduce) {
  const lenis = new Lenis({ lerp: 0.12 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href")!;
      if (id.length < 2) return;
      e.preventDefault();
      lenis.scrollTo(id, { offset: -80, duration: 1.3 });
      history.replaceState(null, "", id);
    }),
  );
}

/* ---------------------------------------------------------------- navigation : se cache en descendant */
const nav = document.getElementById("nav")!;
let lastY = 0;
addEventListener("scroll", () => {
  const y = scrollY;
  if (y > 300 && y > lastY + 2) nav.classList.add("is-hidden");
  if (y < lastY - 2 || y < 300) nav.classList.remove("is-hidden");
  lastY = y;
}, { passive: true });

/* ---------------------------------------------------------------- mouvement */
if (!reduce) {
  const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
  intro.from(".hero .eyebrow", { y: 14, opacity: 0, duration: .9 }, .05)
    .from(".hero .display .w > span", { yPercent: 110, duration: 1.2, stagger: .045 }, .1)
    .from(".hero .lead", { y: 18, opacity: 0, duration: 1 }, .55)
    .from(".hero__actions", { y: 18, opacity: 0, duration: 1 }, .7)
    .from(".hero__art", { y: 24, scale: .9, opacity: 0, duration: 1.8 }, 0);

  // l'illustration d'ouverture s'éloigne doucement au défilement
  gsap.to(".hero__art", { rotate: 14, scale: 1.1, ease: "none", immediateRender: false,
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

  document.querySelectorAll<HTMLElement>(".section .title, .cta .title").forEach((t) =>
    gsap.from(t.querySelectorAll(".w > span"), { yPercent: 110, duration: 1.1, ease: "expo.out", stagger: .04,
      scrollTrigger: { trigger: t, start: "top 86%" } }));

  gsap.from(".stat", { y: 30, opacity: 0, duration: 1, ease: "expo.out", stagger: .08, scrollTrigger: { trigger: ".stats", start: "top 88%" } });

  document.querySelectorAll<HTMLElement>(".section__head .lead, .steps li, .card, .lab, .quiz, .method, .cta__box").forEach((el) =>
    gsap.from(el, { y: 34, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%" } }));

  // les illustrations s'ouvrent comme un rideau, puis respirent au défilement
  document.querySelectorAll<HTMLElement>(".art").forEach((a) => {
    gsap.from(a, { clipPath: "inset(10% 10% 10% 10% round 28px)", duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: a, start: "top 85%" } });
    const img = a.querySelector("img");
    if (img) gsap.fromTo(img, { scale: 1.08 }, { scale: 1, ease: "none", scrollTrigger: { trigger: a, start: "top bottom", end: "bottom top", scrub: true } });
  });
}

/* ---------------------------------------------------------------- bouton flottant « Essayer l'IA » :
   visible après l'ouverture, caché quand on est déjà dans les démonstrations */
const floatCta = document.getElementById("float-cta")!;
const zones = ["#essayer", "#microscope", "#a-vous", "#erreurs"].map((s) => document.querySelector(s)!);
const inDemo = new Set<Element>();
let pastHero = false;
const syncFloat = () => floatCta.classList.toggle("is-on", pastHero && inDemo.size === 0);
new IntersectionObserver((en) => { pastHero = !en[0].isIntersecting && en[0].boundingClientRect.top < 0; syncFloat(); }).observe(document.querySelector(".hero__actions")!);
const zio = new IntersectionObserver((en) => { en.forEach((e) => (e.isIntersecting ? inDemo.add(e.target) : inDemo.delete(e.target))); syncFloat(); }, { rootMargin: "-30% 0px -30% 0px" });
zones.forEach((z) => zio.observe(z));

/* ---------------------------------------------------------------- chapitres */
initOrb(document.getElementById("orb")!);
preloadModels();
renderStatic();
initMammo();
initQuiz();
initErrors();
initStainLab();
// la lame (OpenSeadragon) ne se charge qu'à l'approche de son chapitre
new IntersectionObserver((en, o) => {
  if (!en[0].isIntersecting) return;
  o.disconnect();
  import("./scan").then((m) => m.initScan());
}, { rootMargin: "1500px 0px" }).observe(document.getElementById("microscope")!);

addEventListener("load", () => ScrollTrigger.refresh());
showStats(); // compteur servi par le microservice back (masqué s'il ne répond pas)
document.fonts?.ready.then(() => ScrollTrigger.refresh());
