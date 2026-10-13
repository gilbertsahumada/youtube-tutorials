const views = new Set(["mail", "proposals", "activity", "settings"]);
export function parseRoute(hash = "#/projects") {
  let route;
  try { route = new URL(hash.replace(/^#/, "") || "/projects", "http://local"); } catch { return { view: "projects" }; }
  if (route.pathname === "/connections") return { view: "connections" };
  if (route.pathname === "/projects/new") return { view: "new" };
  const parts = route.pathname.split("/").filter(Boolean);
  if (parts.length === 3 && parts[0] === "projects" && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(parts[1]) && views.has(parts[2])) return { view: parts[2], projectId: parts[1], emailId: route.searchParams.get("email") };
  return { view: "projects" };
}
export function routeFor(view, projectId, emailId) {
  if (view === "connections") return "#/connections";
  if (view === "new") return "#/projects/new";
  if (!projectId || !views.has(view)) return "#/projects";
  return "#/projects/" + encodeURIComponent(projectId) + "/" + view + (emailId ? "?email=" + encodeURIComponent(emailId) : "");
}
