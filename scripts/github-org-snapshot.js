#!/usr/bin/env node
/**
 * SNAPSHOT DE GITHUB — TODOS LOS REPOS DE voypati-tech
 *   node scripts/github-org-snapshot.js
 */

import { fetchOrgSnapshot, projectDomains } from "../src/lib/github.js";

const snap = await fetchOrgSnapshot({ save: true });
const domains = projectDomains(snap);
console.log(`✔ github-org-snapshot.json guardado — ${snap.repo_count} repositorios reales de voypati-tech`);
for (const r of snap.repos) {
  if (r.error) console.log(`  · ${r.name}: ERROR (${r.error})`);
  else console.log(`  · ${r.name.padEnd(22)} ${r.pulls_total} PRs (${r.pulls_merged} mergeados) · ${r.commits_recent} commits · ${r.language ?? "—"}`);
}
console.log(`\nProyección por dominio contable:`);
for (const d of domains) console.log(`  · ${d.domain.padEnd(16)} ${d.merged} PRs mergeados · ${d.commits} commits · ${d.label}`);