import { buildPlan, validateIssue } from "./plan.mjs";
import { matchesSender } from "./filters.mjs";

export function assertBaseline(baseline, repo, issueNumber) {
  if (baseline?.schemaVersion !== 2)
    throw Error("Falta una captura inicial compatible; ejecuta npm run baseline");
  if (baseline.repo !== repo || baseline.issueNumber !== issueNumber)
    throw Error("La captura inicial pertenece a otro repositorio o issue");
}
export async function processEmails({
  baseline,
  emails,
  state,
  publishing,
  sender,
  readIssue,
  analyze,
  publish,
  onPlan,
  persist,
}) {
  const results = [];
  for (const email of emails) {
    if (
      email.id === baseline.initialEmail.id ||
      Date.parse(email.date) <= Date.parse(baseline.initialEmail.date) ||
      state.processed[email.id]
    )
      continue;
    if (!matchesSender(email.from, sender)) continue;
    const issue = await readIssue();
    validateIssue(issue, baseline.project);
    const context = {
      project: baseline.project,
      initialEmail: baseline.initialEmail,
      initialIssue: baseline.initialIssue,
      issue,
      requestEmail: email,
    };
    const analysis = await analyze(context);
    const plan = buildPlan({ baseline, email, issue, analysis, sender });
    await onPlan({ email, context, analysis, plan });
    results.push(plan);
    if (publishing) {
      if (plan.action === "comment") {
        const comment = await publish(plan);
        state.processed[email.id] = {
          action: "comment",
          id: comment.id,
          url: comment.html_url,
        };
      } else state.processed[email.id] = { action: "skip", reason: plan.reason };
      await persist(state);
    }
  }
  return results;
}
