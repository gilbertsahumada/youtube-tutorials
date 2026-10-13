import { digest } from "./hash.mjs";

/** La versión del contenido permite detener una aprobación si GitHub cambió durante la revisión. */
export const issueDigest = (issues) =>
  digest(
    [...issues]
      .sort((a, b) => a.number - b.number)
      .map((issue) => [issue.number, issue.title, issue.body, issue.state]),
  );
export const issueVersion = (issue) => digest([issue.number, issue.title, issue.body, issue.state]);
