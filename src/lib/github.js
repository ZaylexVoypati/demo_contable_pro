/**
 * GITHUB ORG-WIDE — TODOS LOS REPOS DE voypati-tech
 * =================================================
 * Lista TODOS los repositorios de la organización voypati-tech y lee su
 * actividad real (PRs, commits). Proyecta cada repo sobre un dominio contable.
 *
 * Token: GITHUB_TOKEN | GH_TOKEN | credenciales de git (`git credential fill`).
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(__dirname, "..", "..", "data", "github-org-snapshot.json");

export function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    const out = execSync("git credential fill", {
      input: "protocol=https\nhost=github.com\n",
      stdio: ["pipe", "pipe", "ignore"],
      encoding: "utf8",
    });
    const m = out.match(/^password=(.+)$/m);
    if (m && m[1]) return m[1].trim();
  } catch { /* sin credenciales */ }
  return null;
}

async function gh(pathname, token, per_page = 100) {
  const url = `https://api.github.com${pathname}${pathname.includes("?") ? "&" : "?"}per_page=${per_page}`;
  const headers = { "User-Agent": "voypati-demo-contable-pro", Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status} en ${pathname}`);
  return res.json();
}

/** Clasifica cada repo por dominio contable (palabras clave del nombre). */
export function domainOf(repoName) {
  const n = repoName.toLowerCase();
  if (n.includes("core")) return { domain: "core", label: "Núcleo / Referidos / IAM", weight: "infraestructura" };
  if (n.includes("express")) return { domain: "express", label: "Envíos / Billeteras de conductores / Contabilidad corporativa", weight: "mensajería" };
  if (n.includes("proveedores") || n.includes("provider")) return { domain: "providers", label: "Negocios / Órdenes / Finanzas por negocio", weight: "órdenes" };
  if (n.includes("mercado")) return { domain: "mercado", label: "Marketplace / Gastos / Caja", weight: "órdenes" };
  if (n.includes("panel_mercado")) return { domain: "panel_mercado", label: "Panel financiero de mercado (consolidado)", weight: "finanzas" };
  if (n.includes("panel_servicio")) return { domain: "panel_servicio", label: "Panel de servicio", weight: "finanzas" };
  if (n.includes("conductor")) return { domain: "app_conductor", label: "App conductor", weight: "mensajería" };
  if (n.includes("proveedor")) return { domain: "app_proveedor", label: "App proveedor", weight: "órdenes" };
  if (n.includes("voypati_app")) return { domain: "app", label: "App móvil cliente", weight: "ventas" };
  if (n.includes("voypati") && !n.includes("vpt")) return { domain: "otros", label: "Otros repos VoyPati", weight: "infraestructura" };
  return { domain: "otros", label: "Sin clasificar", weight: "infraestructura" };
}

async function getRepo(repo, token) {
  const [meta, pulls, commits] = await Promise.all([
    gh(`/repos/${repo}`, token),
    gh(`/repos/${repo}/pulls?state=all`, token),
    gh(`/repos/${repo}/commits`, token, 30),
  ]);
  const merged = pulls.filter((p) => p.merged_at).length;
  const { domain, label, weight } = domainOf(meta.name);
  return {
    repo,
    name: meta.name,
    domain,
    domain_label: label,
    domain_weight: weight,
    private: meta.private,
    language: meta.language,
    created_at: meta.created_at,
    updated_at: meta.updated_at,
    pulls_total: pulls.length,
    pulls_open: pulls.filter((p) => p.state === "open").length,
    pulls_merged: merged,
    commits_recent: commits.length,
    last_commit: commits[0]?.commit?.message.split("\n")[0],
    last_commit_date: commits[0]?.commit?.author?.date,
  };
}

export async function fetchOrgSnapshot({ save = false } = {}) {
  const token = getToken();
  const orgRepos = await gh("/orgs/voypati-tech/repos", token, 100);
  const repos = [];
  for (const r of orgRepos) {
    try {
      repos.push(await getRepo(r.full_name, token));
    } catch (err) {
      repos.push({ repo: r.full_name, name: r.name, error: err.message });
    }
  }
  repos.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const snapshot = {
    generated_at: new Date().toISOString(),
    source: "GitHub API v3 — GET /orgs/voypati-tech/repos (todos los repos)",
    token_source: token ? (process.env.GITHUB_TOKEN ? "GITHUB_TOKEN env" : "git credential fill") : "sin token (solo públicos)",
    org: "voypati-tech",
    repo_count: repos.length,
    repos,
  };
  if (save) writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
  return snapshot;
}

export function loadOrgSnapshot() {
  return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
}

/** Proyección de actividad real de GitHub sobre dominios contables. */
export function projectDomains(snapshot) {
  const byDomain = {};
  for (const r of snapshot.repos.filter((x) => !x.error)) {
    byDomain[r.domain] = byDomain[r.domain] || { repos: 0, prs: 0, merged: 0, commits: 0, label: r.domain_label };
    byDomain[r.domain].repos += 1;
    byDomain[r.domain].prs += r.pulls_total;
    byDomain[r.domain].merged += r.pulls_merged;
    byDomain[r.domain].commits += r.commits_recent;
  }
  return Object.entries(byDomain)
    .map(([domain, v]) => ({ domain, ...v }))
    .sort((a, b) => b.merged - a.merged);
}