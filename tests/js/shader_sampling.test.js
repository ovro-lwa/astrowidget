/**
 * Guards the sky → texture mapping in the GLSL fragment shaders.
 *
 * GLSL cannot run under vitest, so these tests check the shader source:
 * 0-based pixel p must sample uv = (p + 0.5) / size (texel centers). Using
 * p / size draws every image half a display pixel off — 0.5 × stride
 * full-resolution pixels for downsampled cubes.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe.each(["js/inline_widget.js", "js/renderer.js"])("%s shader", (file) => {
  const src = readFileSync(join(ROOT, file), "utf8").replace(/\s+/g, "");

  it("samples texel centers", () => {
    expect(src).toContain("vec2uv=vec2((py+0.5)/u_imageSize.x,(px+0.5)/u_imageSize.y);");
  });

  it("does not use the edge-anchored mapping", () => {
    expect(src).not.toContain("vec2(py/u_imageSize.x,px/u_imageSize.y)");
  });
});
