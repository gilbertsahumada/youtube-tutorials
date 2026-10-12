import test from "node:test";
import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  writeFile,
  readFile,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("CLI completa: inbox → baseline → preview real simulado → comentario único y contexto conservado", async () => {
  const root = await mkdtemp(join(tmpdir(), "brain-integration-"));
  const json = async (p) => JSON.parse(await readFile(join(root, p), "utf8"));
  try {
    for (const name of ["src", "config", "fixtures"])
      await cp(new URL("../" + name, import.meta.url), join(root, name), {
        recursive: true,
      });
    await mkdir(join(root, ".private"));
    await mkdir(join(root, "bin"));
    await writeFile(
      join(root, ".private/gmail-token.json"),
      JSON.stringify({ refresh_token: "fake" }),
    );
    await writeFile(
      join(root, "mock-state.json"),
      JSON.stringify({ withRequest: false, comments: [], calls: [] }),
    );
    // Fail closed: every fetch is intercepted, and any unrecognized endpoint throws.
    await writeFile(
      join(root, "mock-fetch.mjs"),
      `
      import fs from 'node:fs';
      const root=process.env.TEST_ROOT;
      const read=p=>JSON.parse(fs.readFileSync(root+'/'+p,'utf8'));
      globalThis.fetch=async(input,options={})=>{
        const url=new URL(input),state=read('mock-state.json');
        state.calls.push({kind:'fetch',path:url.href});fs.writeFileSync(root+'/mock-state.json',JSON.stringify(state));
        let data;
        if(url.href==='https://oauth2.googleapis.com/token')data={access_token:'fake'};
        else if(url.hostname==='model.invalid') {
          const context=JSON.parse(JSON.parse(options.body).messages[1].content);
          data={choices:[{message:{content:JSON.stringify(read(context.requestEmail?'fixtures/analysis.json':'fixtures/initial-analysis.json'))}}]};
        } else if(url.hostname==='gmail.googleapis.com') {
          if(url.pathname.endsWith('/labels'))data={labels:[{id:'demo-label',name:'demo'}]};
          else if(url.pathname.endsWith('/messages'))data={messages:[{id:'initial-csv'},...(state.withRequest?[{id:'request-pdf'}]:[])]};
          else if(/\\/messages\\/(initial-csv|request-pdf)$/.test(url.pathname)) {
            const mail=read(url.pathname.endsWith('initial-csv')?'fixtures/initial-email.json':'fixtures/email.json');
            data={id:mail.id,internalDate:Date.parse(mail.date),payload:{mimeType:'text/plain',headers:[{name:'From',value:mail.from},{name:'Subject',value:mail.subject}],body:{data:Buffer.from(mail.text).toString('base64url')}}};
          } else throw Error('Unexpected Gmail endpoint '+url.href);
        } else throw Error('External network forbidden '+url.href);
        return {ok:true,status:200,json:async()=>data};
      };
    `,
    );
    await writeFile(
      join(root, "bin/gh"),
      `#!/usr/bin/env node
      const fs=require('node:fs'),root=process.env.TEST_ROOT;
      const read=p=>JSON.parse(fs.readFileSync(root+'/'+p,'utf8'));
      const state=read('mock-state.json'),path=process.argv[3],index=process.argv.indexOf('--method'),method=process.argv[index+1];
      state.calls.push({kind:'github',path,method});let data;
      if(method==='GET'&&path==='user')data={id:99};
      else if(method==='GET'&&path==='repos/demo/sandbox/issues/1')data=read('fixtures/issue.json');
      else if(method==='GET'&&path.startsWith('repos/demo/sandbox/issues/1/comments?'))data=state.comments;
      else if(method==='POST'&&path==='repos/demo/sandbox/issues/1/comments') {
        const body=JSON.parse(fs.readFileSync(0,'utf8')).body;
        data={id:8,body,user:{id:99},html_url:'https://example.com/comment/8'};state.comments.push(data);
      } else throw Error('Unexpected GitHub operation '+method+' '+path);
      fs.writeFileSync(root+'/mock-state.json',JSON.stringify(state));console.log(JSON.stringify(data));
    `,
      { mode: 0o700 },
    );
    const env = {
      ...process.env,
      TEST_ROOT: root,
      PATH: join(root, "bin") + ":" + process.env.PATH,
      GOOGLE_CLIENT_ID: "fake",
      GOOGLE_CLIENT_SECRET: "fake",
      GMAIL_LABEL: "demo",
      GMAIL_AFTER: "2026-01-01T00:00:00Z",
      ALLOWED_SENDER: "client@example.com",
      GMAIL_INITIAL_MESSAGE_ID: "initial-csv",
      GITHUB_REPO: "demo/sandbox",
      GITHUB_ISSUE_NUMBER: "1",
      MODEL_BASE_URL: "https://model.invalid/v1",
      MODEL_ID: "fake",
      MODEL_API_KEY: "fake",
      PUBLISH: "false",
    };
    const run = (command, extra = {}) => {
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          join(root, "mock-fetch.mjs"),
          join(root, "src/main.mjs"),
          command,
        ],
        { encoding: "utf8", env: { ...env, ...extra } },
      );
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    assert.match(run("--inbox"), /initial-csv/);
    const goodAnalysis = await json("fixtures/initial-analysis.json");
    const badAnalysis = { ...goodAnalysis, initialEvidence: "CSV" };
    await writeFile(
      join(root, "fixtures/initial-analysis.json"),
      JSON.stringify(badAnalysis),
    );
    const rejected = spawnSync(
      process.execPath,
      [
        "--import",
        join(root, "mock-fetch.mjs"),
        join(root, "src/main.mjs"),
        "--baseline",
      ],
      { encoding: "utf8", env },
    );
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /3 caracteres; debe tener al menos 20/);
    assert.match(rejected.stderr, /output\/initial-context.json/);
    assert.deepEqual(
      (await json("output/initial-context.json")).analysis,
      badAnalysis,
    );
    await assert.rejects(access(join(root, ".private/baseline.json")));
    assert.equal((await json("mock-state.json")).comments.length, 0);
    await writeFile(
      join(root, "fixtures/initial-analysis.json"),
      JSON.stringify(goodAnalysis),
    );
    assert.match(run("--baseline"), /Contexto inicial capturado: CSV/);
    const before = await json(".private/baseline.json");
    let remote = await json("mock-state.json");
    remote.withRequest = true;
    await writeFile(join(root, "mock-state.json"), JSON.stringify(remote));
    assert.match(run("--once"), /no publicado/);
    assert.equal((await json("mock-state.json")).comments.length, 0);
    await assert.rejects(access(join(root, ".private/state.json")));
    assert.match(
      run("--once", { PUBLISH: "true" }),
      /Comentario creado o recuperado/,
    );
    run("--once", { PUBLISH: "true" });
    remote = await json("mock-state.json");
    assert.equal(remote.comments.length, 1);
    assert.equal(
      remote.calls.filter((c) => c.kind === "github" && c.method !== "GET")
        .length,
      1,
    );
    assert.deepEqual(await json(".private/baseline.json"), before);
    assert.match(
      (await json("fixtures/issue.json")).body,
      /Formato actual: CSV/,
    );
    assert.match(remote.comments[0].body, /Pendiente de revisión humana/);
    assert.equal(
      (await json(".private/state.json")).processed["request-pdf"].id,
      8,
    );
    const changed = spawnSync(
      process.execPath,
      [
        "--import",
        join(root, "mock-fetch.mjs"),
        join(root, "src/main.mjs"),
        "--once",
      ],
      { encoding: "utf8", env: { ...env, GITHUB_REPO: "other/sandbox" } },
    );
    assert.notEqual(changed.status, 0);
    assert.match(changed.stderr, /otro repositorio/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
