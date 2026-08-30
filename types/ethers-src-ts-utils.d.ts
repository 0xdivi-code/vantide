/**
 * Type shim for the deep import `ethers/src.ts/utils`.
 *
 * `@orderly.network/core@2.10.1` imports `BigNumberish` from
 * `ethers/src.ts/utils` in its bundled type declarations. That path points at
 * ethers v5's legacy TypeScript *source* directory (not the compiled `lib/`
 * types), which pulls raw .ts files into the program and fails `tsc` under
 * `isolatedModules` (TS1205).
 *
 * The `paths` mapping in tsconfig.json redirects that specifier here, so tsc
 * resolves it to the public ethers types instead. Runtime code is unaffected —
 * esbuild/vite never see this file.
 */

export type { BigNumberish } from "ethers";
