import { mkdir, writeFile } from "node:fs/promises";

const user = "SriVishnu230707";
const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "profile-stats-workflow",
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
  return response.json();
}

const repos = [];
for (let page = 1; page <= 10; page++) {
  const batch = await github(`/users/${user}/repos?type=owner&per_page=100&page=${page}`);
  repos.push(...batch);
  if (batch.length < 100) break;
}

const projects = repos.filter((repo) => !repo.fork && !repo.archived && repo.name !== user && repo.size > 0);
const stars = projects.reduce((total, repo) => total + repo.stargazers_count, 0);
const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
const active = projects.filter((repo) => new Date(repo.pushed_at).getTime() >= cutoff).length;
const languages = new Map();
for (const repo of projects) {
  if (repo.language) languages.set(repo.language, (languages.get(repo.language) ?? 0) + 1);
}
const topLanguages = [...languages].sort((a, b) => b[1] - a[1]).slice(0, 5);
const maxLanguage = Math.max(1, ...topLanguages.map(([, count]) => count));
const updated = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[char]);

const stats = [
  ["PUBLIC PROJECTS", projects.length, "#38bdf8"],
  ["TOTAL STARS", stars, "#fbbf24"],
  ["ACTIVE · 30 DAYS", active, "#a78bfa"],
  ["LANGUAGES", languages.size, "#fb7185"],
];
const statCards = stats.map(([label, value, color], index) => {
  const x = 36 + index * 259;
  return `<g>
    <rect x="${x}" y="100" width="244" height="105" rx="15" fill="#13223e" stroke="#263b60"/>
    <rect x="${x}" y="100" width="244" height="3" rx="2" fill="${color}"/>
    <text x="${x + 18}" y="137" class="label">${label}</text>
    <text x="${x + 18}" y="184" class="value" fill="${color}">${value}</text>
  </g>`;
}).join("");

const palette = ["#38bdf8", "#a78bfa", "#fb7185", "#fbbf24", "#34d399"];
const languageRows = topLanguages.map(([language, count], index) => {
  const y = 256 + index * 28;
  const width = Math.round((count / maxLanguage) * 300);
  return `<g>
    <text x="46" y="${y + 13}" class="language">${escape(language)}</text>
    <rect x="202" y="${y}" width="300" height="15" rx="7" fill="#1b3152"/>
    <rect x="202" y="${y}" width="${width}" height="15" rx="7" fill="${palette[index]}"/>
    <text x="518" y="${y + 13}" class="count">${count}</text>
  </g>`;
}).join("");

const recent = [...projects].sort((a, b) => (b.pushed_at ?? "").localeCompare(a.pushed_at ?? "")).slice(0, 3);
const recentRows = recent.map((repo, index) => {
  const y = 268 + index * 42;
  const name = repo.name.length > 28 ? repo.name.slice(0, 27) + "…" : repo.name;
  const date = repo.pushed_at.slice(0, 10);
  return `<g>
    <circle cx="634" cy="${y - 5}" r="5" fill="${palette[index]}"/>
    <text x="650" y="${y}" class="repo">${escape(name)}</text>
    <text x="1024" y="${y}" text-anchor="end" class="date">${date}</text>
  </g>`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="430" viewBox="0 0 1100 430" role="img" aria-labelledby="title desc">
<title id="title">Sri Vishnu's live GitHub dashboard</title>
<desc id="desc">Public projects: ${projects.length}. Total stars: ${stars}. Projects active in 30 days: ${active}. Languages: ${languages.size}. Updated ${updated}.</desc>
<defs>
  <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#09152a"/><stop offset="1" stop-color="#191c3b"/></linearGradient>
  <linearGradient id="line" x2="1" y2="0"><stop stop-color="#38bdf8"/><stop offset=".5" stop-color="#a78bfa"/><stop offset="1" stop-color="#fb7185"/></linearGradient>
  <style>
    .heading{font:700 25px Arial,sans-serif;fill:#f8fafc}
    .label{font:700 11px Arial,sans-serif;letter-spacing:1.5px;fill:#94a3b8}
    .value{font:700 42px Arial,sans-serif}
    .section{font:700 15px Arial,sans-serif;fill:#dbeafe}
    .language,.repo{font:14px Arial,sans-serif;fill:#e2e8f0}
    .count,.date,.footer{font:12px Arial,sans-serif;fill:#94a3b8}
    .pulse{animation:pulse 2.2s ease-in-out infinite}
    @keyframes pulse{50%{opacity:.25}}
    @media (prefers-reduced-motion:reduce){.pulse{animation:none}}
  </style>
</defs>
<rect width="1100" height="430" rx="22" fill="url(#bg)"/>
<rect x="1" y="1" width="1098" height="428" rx="21" fill="none" stroke="#355079"/>
<path d="M24 73H1076" stroke="url(#line)" stroke-width="2"/>
<text x="36" y="48" class="heading">THE BUILD LOG</text>
<circle cx="1040" cy="39" r="7" fill="#34d399" class="pulse"/>
<text x="1018" y="44" text-anchor="end" class="label">LIVE</text>
${statCards}
<text x="36" y="237" class="section">LANGUAGES BY ORIGINAL REPOSITORY</text>
<text x="620" y="237" class="section">LATEST PROJECT PUSHES</text>
${languageRows}
${recentRows}
<path d="M36 397H1064" stroke="#263b60"/>
<text x="36" y="415" class="footer">Public, non-fork repositories · refreshed about every 6 hours</text>
<text x="1064" y="415" text-anchor="end" class="footer">UPDATED ${updated}</text>
</svg>\n`;

await mkdir("assets", { recursive: true });
await writeFile("assets/profile-stats.svg", svg, "utf8");
console.log(`Generated dashboard from ${projects.length} original repositories.`);
