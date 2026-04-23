/**
 * Post-codegen patch: makes `query` parameter in generated hooks accept
 * partial options without requiring `queryKey`. Uses:
 *   Omit<UseQueryOptions<T,E,D>, 'queryKey'> & { queryKey?: QueryKey }
 * so callers can pass just { enabled: boolean } without specifying queryKey
 * (the getQueryOptions functions provide a default key internally, and the
 * & { queryKey?: QueryKey } addition keeps the internal queryOptions?.queryKey
 * access valid since queryKey is now typed as QueryKey | undefined).
 *
 * This is run after Orval codegen via orval.config.ts hooks.afterAllFilesWrite.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generated = path.resolve(
  __dirname, "..", "..", "lib", "api-client-react", "src", "generated", "api.ts"
);

let content = fs.readFileSync(generated, "utf8");

// Revert any previous patch (both variants) to keep the script idempotent.
// Variant A: Omit with 'queryKey' | 'queryFn' (old bad patch)
content = content.replace(
  /query\?: Omit<UseQueryOptions<([\s\S]*?)>, 'queryKey' \| 'queryFn'>;/g,
  "query?: UseQueryOptions<$1>;"
);
// Variant B: correct patch (Omit queryKey only + & { queryKey?: QueryKey })
content = content.replace(
  /query\?: Omit<UseQueryOptions<([\s\S]*?)>, 'queryKey'> & \{ queryKey\?: QueryKey \};/g,
  "query?: UseQueryOptions<$1>;"
);

const occurrences = (content.match(/query\?: UseQueryOptions</g) || []).length;

if (occurrences === 0) {
  console.log("patch-generated.mjs: nothing to patch (pattern not found)");
  process.exit(0);
}

// Replace `query?: UseQueryOptions<...\n  >;`
// with    `query?: Omit<UseQueryOptions<...\n  >, 'queryKey'> & { queryKey?: QueryKey };`
//
// Rationale:
// - Removes `queryKey` from required fields so callers can pass { enabled: boolean }
// - Re-adds `queryKey` as optional via `& { queryKey?: QueryKey }` so the internal
//   `queryOptions?.queryKey` access still compiles (becomes QueryKey | undefined,
//   handled by `?? getXxxQueryKey()` fallback)
content = content.replace(
  /query\?: UseQueryOptions<([\s\S]*?)>;/g,
  "query?: Omit<UseQueryOptions<$1>, 'queryKey'> & { queryKey?: QueryKey };"
);

const patched = (content.match(/query\?: Omit<UseQueryOptions</g) || []).length;

fs.writeFileSync(generated, content, "utf8");
console.log(`patch-generated.mjs: patched ${patched} hook parameter type(s) in ${path.basename(generated)}`);
