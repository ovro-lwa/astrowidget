/**
 * Tests for SIN projection math.
 *
 * Validates JS projection functions against astropy-generated test vectors.
 * Regenerate fixtures: pixi run vectors
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  celestialToLM,
  lmToCelestial,
  screenToCelestial,
  celestialToScreen,
  panViewByScreenDrag,
  viewFovAxes,
  maxSinViewFov,
  measureViewPlaneScales,
  screenToViewLM,
  viewLMToScreen,
  formatRA,
  formatDec,
  DEG2RAD,
  RAD2DEG,
} from "../../js/projection.js";

const ARCSEC = 1 / 3600; // 1 arcsecond in degrees
const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/projection_vectors.json"
);
const FIXTURES = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

// Reference WCS (matches generate_test_vectors.py)
const RA0 = 180.0 * DEG2RAD;
const DEC0 = 45.0 * DEG2RAD;

describe("SIN projection forward", () => {
  it("phase center maps to (0, 0)", () => {
    const { l, m, visible } = celestialToLM(RA0, DEC0, RA0, DEC0);
    expect(l).toBeCloseTo(0, 10);
    expect(m).toBeCloseTo(0, 10);
    expect(visible).toBe(true);
  });

  it("small RA offset produces expected l", () => {
    const dra = 5 * DEG2RAD;
    const { l, m, visible } = celestialToLM(RA0 + dra, DEC0, RA0, DEC0);
    const expected_l = Math.cos(DEC0) * Math.sin(dra);
    expect(l).toBeCloseTo(expected_l, 10);
    expect(visible).toBe(true);
  });

  it("small Dec offset produces expected m", () => {
    const ddec = 5 * DEG2RAD;
    const { l, m, visible } = celestialToLM(RA0, DEC0 + ddec, RA0, DEC0);
    const expected_m =
      Math.sin(DEC0 + ddec) * Math.cos(DEC0) -
      Math.cos(DEC0 + ddec) * Math.sin(DEC0);
    expect(m).toBeCloseTo(expected_m, 10);
    expect(visible).toBe(true);
  });

  it("opposite hemisphere is not visible", () => {
    const { visible } = celestialToLM(RA0 + Math.PI, DEC0, RA0, DEC0);
    expect(visible).toBe(false);
  });
});

describe("SIN projection roundtrip", () => {
  const testCases = [
    { dra: 0, ddec: 0, label: "phase center" },
    { dra: 5, ddec: 0, label: "5° RA offset" },
    { dra: 0, ddec: 5, label: "5° Dec offset" },
    { dra: 10, ddec: 10, label: "10° diagonal" },
    { dra: -5, ddec: -5, label: "negative diagonal" },
    { dra: 30, ddec: 0, label: "30° RA offset" },
    { dra: 0, ddec: 30, label: "30° Dec offset" },
  ];

  testCases.forEach(({ dra, ddec, label }) => {
    it(`roundtrip: ${label}`, () => {
      const ra = RA0 + dra * DEG2RAD;
      const dec = DEC0 + ddec * DEG2RAD;

      const { l, m, visible } = celestialToLM(ra, dec, RA0, DEC0);
      if (!visible) return;

      const result = lmToCelestial(l, m, RA0, DEC0);
      expect(result).not.toBeNull();

      const raDiff = Math.abs(result.ra - ra) * RAD2DEG;
      const decDiff = Math.abs(result.dec - dec) * RAD2DEG;

      expect(raDiff).toBeLessThan(ARCSEC);
      expect(decDiff).toBeLessThan(ARCSEC);
    });
  });
});

describe("screenToCelestial", () => {
  it("center of screen maps to view center", () => {
    const result = screenToCelestial(0, 0, RA0, DEC0, 60 * DEG2RAD, 1);
    expect(result).not.toBeNull();
    expect(result.ra * RAD2DEG).toBeCloseTo(180, 5);
    expect(result.dec * RAD2DEG).toBeCloseTo(45, 5);
  });

  it("returns null outside the SIN disk", () => {
    const fov = 60 * DEG2RAD;
    const { scaleX } = viewFovAxes(fov, 1);
    const x = 1.01 / scaleX;
    expect(screenToCelestial(x, 0, RA0, DEC0, fov, 1)).toBeNull();
  });

  it.each(FIXTURES.view.filter((v) => !v.outside_disk))(
    "matches fixture at (x=$x, y=$y) fov=$fov_deg° aspect=$aspect",
    (v) => {
      const result = screenToCelestial(
        v.x,
        v.y,
        v.view_ra_deg * DEG2RAD,
        v.view_dec_deg * DEG2RAD,
        v.fov_deg * DEG2RAD,
        v.aspect
      );
      expect(result).not.toBeNull();
      const raDiff = Math.abs(result.ra * RAD2DEG - v.ra_deg);
      const decDiff = Math.abs(result.dec * RAD2DEG - v.dec_deg);
      expect(raDiff).toBeLessThan(ARCSEC);
      expect(decDiff).toBeLessThan(ARCSEC);
    }
  );

  it.each(FIXTURES.view.filter((v) => v.outside_disk))(
    "returns null outside disk at (x=$x, y=$y) fov=$fov_deg°",
    (v) => {
      expect(
        screenToCelestial(
          v.x,
          v.y,
          v.view_ra_deg * DEG2RAD,
          v.view_dec_deg * DEG2RAD,
          v.fov_deg * DEG2RAD,
          v.aspect
        )
      ).toBeNull();
    }
  );
});

describe("SIN view roundtrip", () => {
  const offsets = [1, 5, 10, 30];
  const fovs = [30, 60];

  for (const fovDeg of fovs) {
    for (const offsetDeg of offsets) {
      for (const [dra, ddec, label] of [
        [offsetDeg, 0, "RA"],
        [0, offsetDeg, "Dec"],
        [offsetDeg, offsetDeg, "diagonal"],
      ]) {
        it(`fov=${fovDeg}° ${label} offset ${offsetDeg}°`, () => {
          const ra = RA0 + dra * DEG2RAD;
          const dec = DEC0 + ddec * DEG2RAD;
          const fov = fovDeg * DEG2RAD;
          const aspect = 1.0;

          const screen = celestialToScreen(ra, dec, RA0, DEC0, fov, aspect);
          expect(screen).not.toBeNull();

          const back = screenToCelestial(
            screen.x,
            screen.y,
            RA0,
            DEC0,
            fov,
            aspect
          );
          expect(back).not.toBeNull();

          expect(Math.abs(back.ra - ra) * RAD2DEG).toBeLessThan(ARCSEC);
          expect(Math.abs(back.dec - dec) * RAD2DEG).toBeLessThan(ARCSEC);
        });
      }
    }
  }
});

describe("maxSinViewFov", () => {
  it("keeps unit-aspect corners inside the SIN disk", () => {
    const maxFov = maxSinViewFov(1.0);
    const { scaleX, scaleY } = viewFovAxes(maxFov, 1.0);
    expect(Math.hypot(scaleX, scaleY)).toBeLessThanOrEqual(1.0 + 1e-9);
    const over = viewFovAxes(maxFov * 1.01, 1.0);
    expect(Math.hypot(over.scaleX, over.scaleY)).toBeGreaterThan(1.0);
  });

  it("limits wide-aspect views below 180°", () => {
    const maxFov = maxSinViewFov(1.5);
    expect(maxFov * RAD2DEG).toBeLessThan(180);
    const { scaleX, scaleY } = viewFovAxes(maxFov, 1.5);
    expect(Math.hypot(scaleX, scaleY)).toBeLessThanOrEqual(1.0 + 1e-9);
  });
});

describe("panViewByScreenDrag", () => {
  it("Dec drag keeps grabbed sky point under the cursor", () => {
    const fov = 30 * DEG2RAD;
    const aspect = 1.5;
    const s1x = 0;
    const s1y = 0.4;
    const s2x = 0;
    const s2y = 0.15;
    const grabbed = screenToCelestial(s1x, s1y, RA0, DEC0, fov, aspect);
    expect(grabbed).not.toBeNull();
    const panned = panViewByScreenDrag(
      s1x, s1y, s2x, s2y, RA0, DEC0, fov, aspect
    );
    expect(panned).not.toBeNull();
    const atCursor = screenToCelestial(
      s2x, s2y, panned.viewRA, panned.viewDec, fov, aspect
    );
    expect(atCursor).not.toBeNull();
    expect(Math.abs(atCursor.ra - grabbed.ra) * RAD2DEG).toBeLessThan(ARCSEC);
    expect(Math.abs(atCursor.dec - grabbed.dec) * RAD2DEG).toBeLessThan(ARCSEC);
  });

  it("horizontal drag changes RA with minimal Dec coupling", () => {
    const fov = 20 * DEG2RAD;
    const aspect = 1.0;
    const grabbed = screenToCelestial(-0.3, 0.1, RA0, DEC0, fov, aspect);
    const panned = panViewByScreenDrag(-0.3, 0.1, 0.2, 0.1, RA0, DEC0, fov, aspect);
    const atCursor = screenToCelestial(0.2, 0.1, panned.viewRA, panned.viewDec, fov, aspect);
    expect(Math.abs(atCursor.dec - grabbed.dec) * RAD2DEG).toBeLessThan(1);
  });
});

describe("view rotation", () => {
  it("maps screen-left to north in view plane at +90° position angle", () => {
    const fov = 90 * DEG2RAD;
    const { scaleX, scaleY } = viewFovAxes(fov, 1);
    const rot = -90 * DEG2RAD;
    const { l, m } = screenToViewLM(-1, 0, scaleX, scaleY, rot);
    expect(l).toBeCloseTo(0, 6);
    expect(m).toBeCloseTo(scaleX, 6);

    const scr = celestialToScreen(0, 45 * DEG2RAD, 0, 0, fov, 1, null, rot);
    expect(scr).not.toBeNull();
    const back = screenToCelestial(scr.x, scr.y, 0, 0, fov, 1, null, rot);
    expect(back.dec * RAD2DEG).toBeCloseTo(45, 3);
  });

  it("roundtrips with rotation", () => {
    const fov = 45 * DEG2RAD;
    const rot = -45 * DEG2RAD;
    const screen = celestialToScreen(2.1, 0.5, 2.0, 0.4, fov, 1.5, null, rot);
    expect(screen).not.toBeNull();
    const back = screenToCelestial(screen.x, screen.y, 2.0, 0.4, fov, 1.5, null, rot);
    expect(back).not.toBeNull();
    expect(back.ra * RAD2DEG).toBeCloseTo(2.1 * RAD2DEG, 3);
    expect(back.dec * RAD2DEG).toBeCloseTo(0.5 * RAD2DEG, 3);
  });
});

describe("measureViewPlaneScales", () => {
  it("derives scales from pix2world offsets", () => {
    const viewRA = 180 * DEG2RAD;
    const viewDec = 45 * DEG2RAD;
    const width = 800;
    const height = 600;
    const fov = 30 * DEG2RAD;
    const { scaleX, scaleY } = viewFovAxes(fov, width / height);
    const px = 16;
    const py = 16;
    const cx = width / 2;
    const cy = height / 2;

    function worldAt(x, y) {
      const ndcX = (x / (width / 2)) - 1;
      const ndcY = -((y / (height / 2)) - 1);
      const coord = screenToCelestial(ndcX, ndcY, viewRA, viewDec, fov, width / height);
      return [coord.ra * RAD2DEG, coord.dec * RAD2DEG];
    }

    const aladin = {
      getRaDec: () => [180, 45],
      pix2world: (x, y) => worldAt(x, y),
    };

    const measured = measureViewPlaneScales(aladin, width, height, viewRA, viewDec);
    expect(measured.scaleX).toBeCloseTo(scaleX, 6);
    expect(measured.scaleY).toBeCloseTo(scaleY, 6);
  });

  it("derives rotation-aware scales from pix2world offsets", () => {
    const viewRA = 180 * DEG2RAD;
    const viewDec = 45 * DEG2RAD;
    const width = 800;
    const height = 600;
    const fov = 30 * DEG2RAD;
    const rotationRad = -45 * DEG2RAD;
    const { scaleX, scaleY } = viewFovAxes(fov, width / height);
    const px = 16;
    const py = 16;
    const cx = width / 2;
    const cy = height / 2;

    function worldAt(x, y) {
      const ndcX = (x / (width / 2)) - 1;
      const ndcY = -((y / (height / 2)) - 1);
      const coord = screenToCelestial(
        ndcX,
        ndcY,
        viewRA,
        viewDec,
        fov,
        width / height,
        null,
        rotationRad
      );
      return [coord.ra * RAD2DEG, coord.dec * RAD2DEG];
    }

    const aladin = {
      getRaDec: () => [180, 45],
      pix2world: (x, y) => worldAt(x, y),
    };

    const measured = measureViewPlaneScales(
      aladin,
      width,
      height,
      viewRA,
      viewDec,
      rotationRad
    );
    expect(measured.scaleX).toBeCloseTo(scaleX, 5);
    expect(measured.scaleY).toBeCloseTo(scaleY, 5);
  });
});

describe("coordinate formatting", () => {
  it("formats RA correctly", () => {
    const s = formatRA(180);
    expect(s).toContain("12h");
    expect(s).toContain("00m");
  });

  it("formats Dec correctly", () => {
    const s = formatDec(45);
    expect(s).toContain("+45°");
    expect(s).toContain("00'");
  });

  it("formats negative Dec", () => {
    const s = formatDec(-30.5);
    expect(s).toContain("-30°");
    expect(s).toContain("30'");
  });
});
