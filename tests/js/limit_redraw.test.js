/**
 * Manual vmin/vmax changes reach the frontend without an image_revision bump,
 * so their handlers must redraw. Uploading the re-normalized texture alone
 * leaves the canvas showing the old colour scale until something else draws.
 *
 * The widget needs WebGL2 and a DOM, which vitest does not provide here, so
 * this checks the handler source (as shader_sampling.test.js does).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = readFileSync(join(ROOT, "js/inline_widget.js"), "utf8");

function handlerBody(trait) {
  const match = src.match(
    new RegExp(`model\\.on\\("change:${trait}",\\s*\\(\\)\\s*=>\\s*\\{([^}]*)\\}\\);`),
  );
  expect(match, `change:${trait} handler`).not.toBeNull();
  return match[1];
}

describe.each(["vmin", "vmax"])("change:%s handler", (trait) => {
  it("re-uploads the texture", () => {
    expect(handlerBody(trait)).toMatch(/uploadImage\(\)/);
  });

  it("redraws", () => {
    expect(handlerBody(trait)).toMatch(/\b(scheduleDraw|draw)\(\)/);
  });
});
