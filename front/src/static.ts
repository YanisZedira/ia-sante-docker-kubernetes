import { MODELS, STUDIES, ACTORS, SOURCES } from "./content";
import { fr, pct, DATA } from "./util";

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export function renderStatic() {
  $("#studies").innerHTML = STUDIES.map((s) => `
    <article class="card study"><img class="study__icon" src="${DATA}img/${s.img}.webp" alt="" width="72" height="72" loading="lazy" /><span class="big">${esc(s.big)}</span><span class="big__sub">${esc(s.sub)}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>
    <cite><a href="${s.url}" rel="noopener" target="_blank">${esc(s.cite)}</a></cite></article>`).join("");

  // acteurs en France : onglets public / associatif / privé
  const tabs = $("#actor-tabs"), list = $("#actors");
  const keys = Object.keys(ACTORS) as (keyof typeof ACTORS)[];
  const show = (k: keyof typeof ACTORS) => {
    tabs.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.k === k;
      b.setAttribute("aria-checked", String(on)); b.setAttribute("aria-selected", String(on));
    });
    list.innerHTML = ACTORS[k].items.map((a) => `<a class="actor" href="${a.url}" rel="noopener" target="_blank">
      <span class="actor__logo">${a.logo ? `<img src="${DATA}logos/${a.logo}" alt="Logo ${esc(a.name)}" loading="lazy" />` : `<b>${esc(a.name)}</b>`}</span>
      <b>${esc(a.name)}</b><p>${esc(a.text)}</p></a>`).join("");
  };
  tabs.innerHTML = keys.map((k) => `<button type="button" role="tab" class="chip" data-k="${k}">${ACTORS[k].label}</button>`).join("");
  tabs.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.addEventListener("click", () => show(b.dataset.k as keyof typeof ACTORS)));
  show("public");

  $("#models").innerHTML = (["mammo", "pcam"] as const).map((k) => {
    const m = MODELS[k];
    return `<article class="model"><p class="kicker">${k === "mammo" ? "IA n°1 · mammographie" : "IA n°2 · ganglion"}</p><h3>${esc(m.tache)}</h3>
      <p class="model__auc">${fr(m.auc, 3)}<small>AUC, de 0,5 (hasard) à 1 (parfait)</small></p>
      <dl><dt>Testée sur</dt><dd>${esc(m.test)}</dd><dt>Au seuil choisi</dt><dd>repère ${pct(m.sens)} des cancers, écarte ${pct(m.spec)} des cas sains</dd>
      <dt>Modèle</dt><dd>${esc(m.archi)}</dd><dt>Données</dt><dd>${esc(m.donnees)}</dd><dt>Intervalle à 95 %</dt><dd>${fr(m.ic[0], 3)} à ${fr(m.ic[1], 3)}</dd><dt>Détail</dt><dd>${esc(m.detail)}</dd><dt>Poids</dt><dd>${m.poids}, format ONNX</dd></dl></article>`;
  }).join("");

  $("#sources-list").innerHTML = SOURCES.map((g) => `<div><h3>${g.titre}</h3><ul>${g.items.map(([t, u]) =>
    `<li>${u ? `<a href="${u}" rel="noopener" target="_blank">${esc(t)}</a>` : esc(t)}</li>`).join("")}</ul></div>`).join("");

  const m = MODELS.mammo, p = MODELS.pcam;
  $("#errors-lead").textContent =
    `Sur 704 lésions de mammographie testées, notre première IA s'est trompée ${232} fois. Sur 32 768 petits carrés de ganglion, la seconde s'est trompée ${(3368).toLocaleString("fr-FR")} fois. Voici de vraies erreurs.`;
  $("#mammo-score-text").textContent =
    `Testée sur 704 lésions qu'elle n'avait jamais vues, cette IA repère environ ${pct(m.sens)} des cancers et écarte ${pct(m.spec)} des lésions bénignes. Utile comme second regard, pas plus. Sur les lames de ganglion, la seconde IA fait beaucoup mieux : ${pct(p.sens)} et ${pct(p.spec)}.`;
}
