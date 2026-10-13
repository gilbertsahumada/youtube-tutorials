import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
test("fixture funciona sin credenciales y nunca publica aunque PUBLISH=true", async () => {
  const root = await mkdtemp(join(tmpdir(), "brain-mail-issue-test-"));
  try {
    for (const name of ["src", "config", "fixtures"])
      await cp(new URL("../" + name, import.meta.url), join(root, name), {
        recursive: true,
      });
    const result = spawnSync(process.execPath, [join(root, "src/main.mjs"), "--fixture"], {
      encoding: "utf8",
      env: {
        ...process.env,
        PUBLISH: "true",
        MODEL_API_KEY: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        GITHUB_REPO: "invalid",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /No se publicó nada/);
    const output = JSON.parse(await readFile(join(root, "output/fixture.json"), "utf8"));
    assert.equal(output.plan.action, "comment");
    assert.ok(!("files" in output.plan));
    assert.match(
      await readFile(join(root, "output/fixture-comment.md"), "utf8"),
      /Pendiente de revisión humana/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
