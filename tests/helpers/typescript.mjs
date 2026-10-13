import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

/** Execute the shipped TypeScript module with only its browser boundaries replaced. */
export function loadTypeScript(file, globals) {
  const script=ts.transpileModule(readFileSync(file,'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
  }).outputText;
  const exports={};
  vm.runInNewContext(script,{exports,...globals},{filename:fileURLToPath(file)});
  return exports;
}

export const flush=()=>new Promise(resolve=>setImmediate(resolve));
