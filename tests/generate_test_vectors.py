"""Generate astropy projection test vectors for coordinate alignment validation.

Produces tests/fixtures/projection_vectors.json containing (RA,Dec) ↔ (l,m)
mappings computed by astropy's WCS. These vectors are the single source of
truth — both Python and JS tests validate against them.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from astropy.wcs import WCS


def make_reference_wcs() -> WCS:
    """Create a reference SIN projection WCS matching OVRO-LWA typical parameters."""
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---SIN", "DEC--SIN"]
    w.wcs.crval = [180.0, 45.0]  # Phase center: RA=180°, Dec=+45°
    w.wcs.cdelt = [-0.1, 0.1]    # 0.1°/pixel (6 arcmin), RA negative
    w.wcs.crpix = [129.0, 129.0] # Center of 256×256 image
    w.wcs.cunit = ["deg", "deg"]
    return w


def _view_fov_scales(fov_deg: float, aspect: float) -> tuple[float, float]:
    """Per-axis sin(half-fov) scales matching Aladin Lite and ``projection.js``."""
    fov_rad = np.deg2rad(fov_deg)
    if aspect >= 1.0:
        fov_w = fov_rad
        fov_h = fov_rad / aspect
    else:
        fov_h = fov_rad
        fov_w = fov_rad * aspect
    return float(np.sin(fov_w * 0.5)), float(np.sin(fov_h * 0.5))


def _sin_view_lm_from_screen(
    x: float,
    y: float,
    fov_deg: float,
    aspect: float,
) -> tuple[float, float] | None:
    """View-plane (l, m) from normalized screen coords (matches ``projection.js``)."""
    scale_x, scale_y = _view_fov_scales(fov_deg, aspect)
    l_view = -x * scale_x
    m_view = y * scale_y
    if np.hypot(l_view, m_view) > 1.0:
        return None
    return l_view, m_view


def _sin_view_lm_to_world_deg(
    l_view: float,
    m_view: float,
    view_ra_deg: float,
    view_dec_deg: float,
) -> tuple[float, float] | None:
    """Inverse SIN view plane → (RA, Dec) degrees (matches ``lmToCelestial``)."""
    r = float(np.hypot(l_view, m_view))
    if r > 1.0:
        return None

    ra0 = np.deg2rad(view_ra_deg)
    dec0 = np.deg2rad(view_dec_deg)

    if r == 0.0:
        return view_ra_deg, view_dec_deg

    cosc = float(np.sqrt(max(0.0, 1.0 - r * r)))
    sinc = r
    sin_dec0 = np.sin(dec0)
    cos_dec0 = np.cos(dec0)
    dec_rad = float(
        np.arcsin(cosc * sin_dec0 + (m_view * cos_dec0 * sinc) / r)
    )
    ra_rad = float(
        ra0
        + np.arctan2(
            l_view * sinc,
            r * cos_dec0 * cosc - m_view * sin_dec0 * sinc,
        )
    )
    return float(np.rad2deg(ra_rad)), float(np.rad2deg(dec_rad))


def generate_view_vectors() -> list[dict]:
    """Generate SIN view screen ↔ sky vectors for JS ``screenToCelestial`` tests."""
    view_ra = 180.0
    view_dec = 45.0
    screen_points = [
        (0.0, 0.0),
        (1.0, 0.0),
        (-1.0, 0.0),
        (0.0, 1.0),
        (0.0, -1.0),
        (0.5, 0.5),
        (-0.75, 0.25),
        (0.25, -0.9),
    ]
    outside_points = []  # filled per (fov, aspect) below

    vectors: list[dict] = []
    for fov_deg in (30.0, 60.0):
        for aspect in (1.0, 1.5):
            scale_x, scale_y = _view_fov_scales(fov_deg, aspect)
            x_out = 1.05 / scale_x
            y_out = 1.05 / scale_y
            outside_points = [(x_out, 0.0), (0.0, y_out), (x_out, y_out)]

            for x, y in screen_points:
                lm = _sin_view_lm_from_screen(x, y, fov_deg, aspect)
                if lm is None:
                    continue
                l_view, m_view = lm
                ra_deg, dec_deg = _sin_view_lm_to_world_deg(
                    l_view, m_view, view_ra, view_dec
                )
                vectors.append({
                    "view_ra_deg": view_ra,
                    "view_dec_deg": view_dec,
                    "fov_deg": fov_deg,
                    "aspect": aspect,
                    "x": float(x),
                    "y": float(y),
                    "ra_deg": ra_deg,
                    "dec_deg": dec_deg,
                    "outside_disk": False,
                })

            for x, y in outside_points:
                lm = _sin_view_lm_from_screen(x, y, fov_deg, aspect)
                if lm is not None:
                    continue
                vectors.append({
                    "view_ra_deg": view_ra,
                    "view_dec_deg": view_dec,
                    "fov_deg": fov_deg,
                    "aspect": aspect,
                    "x": float(x),
                    "y": float(y),
                    "outside_disk": True,
                })

    return vectors


def generate_vectors() -> dict:
    """Generate test vectors covering critical coordinate alignment cases."""
    wcs = make_reference_wcs()
    ra0 = wcs.wcs.crval[0]
    dec0 = wcs.wcs.crval[1]

    vectors = {
        "wcs": {
            "ctype": list(wcs.wcs.ctype),
            "crval": list(wcs.wcs.crval),
            "cdelt": list(wcs.wcs.cdelt),
            "crpix": list(wcs.wcs.crpix),
        },
        "forward": [],   # (RA, Dec) → (l, m)
        "inverse": [],   # (l, m) → (RA, Dec)
        "pixel": [],     # pixel → (RA, Dec) → pixel roundtrip
    }

    # Test points: (RA_offset_deg, Dec_offset_deg) from phase center
    offsets = [
        (0, 0),       # Phase center (exact)
        (5, 0),       # Small RA offset
        (0, 5),       # Small Dec offset
        (5, 5),       # Diagonal
        (-5, -5),     # Negative diagonal
        (10, 0),      # Moderate RA
        (0, 10),      # Moderate Dec
        (30, 0),      # Large RA offset
        (0, 30),      # Large Dec offset
        (10, 10),     # Moderate diagonal
        (45, 0),      # Very large RA offset
        (0, 40),      # Near pole (dec0=45 + 40 = 85°)
        (-30, -30),   # Large negative (dec0=45 - 30 = 15°)
    ]

    for dra, ddec in offsets:
        ra = ra0 + dra
        dec = dec0 + ddec

        # Clamp Dec to valid range
        if dec > 89.999 or dec < -89.999:
            continue

        ra_rad = np.radians(ra)
        dec_rad = np.radians(dec)
        ra0_rad = np.radians(ra0)
        dec0_rad = np.radians(dec0)

        # Forward SIN projection
        dra_rad = ra_rad - ra0_rad
        l = np.cos(dec_rad) * np.sin(dra_rad)  # noqa: E741
        m = np.sin(dec_rad) * np.cos(dec0_rad) - np.cos(dec_rad) * np.sin(dec0_rad) * np.cos(dra_rad)

        # Visibility check
        cosc = np.sin(dec_rad) * np.sin(dec0_rad) + np.cos(dec_rad) * np.cos(dec0_rad) * np.cos(dra_rad)
        visible = bool(cosc > 0)

        vectors["forward"].append({
            "ra_deg": float(ra),
            "dec_deg": float(dec),
            "l": float(l),
            "m": float(m),
            "visible": visible,
        })

        # Inverse
        if visible:
            r = np.sqrt(l**2 + m**2)
            if r <= 1.0 and r > 0:
                phi = np.arctan2(l, -m)
                theta = np.arccos(r)

                dec_inv = np.arcsin(
                    np.sin(theta) * np.sin(dec0_rad) +
                    np.cos(theta) * np.cos(dec0_rad) * np.cos(phi)
                )
                ra_inv = ra0_rad + np.arctan2(
                    -np.cos(theta) * np.sin(phi),
                    np.sin(theta) * np.cos(dec0_rad) -
                    np.cos(theta) * np.sin(dec0_rad) * np.cos(phi)
                )

                vectors["inverse"].append({
                    "l": float(l),
                    "m": float(m),
                    "ra_deg": float(np.degrees(ra_inv)),
                    "dec_deg": float(np.degrees(dec_inv)),
                    "original_ra_deg": float(ra),
                    "original_dec_deg": float(dec),
                })

    # Pixel roundtrip tests using astropy WCS
    test_pixels = [
        (129, 129),  # Reference pixel (center)
        (64, 64),    # Bottom-left quadrant
        (192, 192),  # Top-right quadrant
        (1, 1),      # Corner
        (256, 256),  # Opposite corner
        (129, 1),    # Edge
        (1, 129),    # Edge
    ]

    for px, py in test_pixels:
        world = wcs.pixel_to_world(px - 1, py - 1)  # pixel_to_world uses 0-based
        if world is not None:
            ra_out = float(world.ra.deg)
            dec_out = float(world.dec.deg)

            # Roundtrip back to pixel
            pix_back = wcs.world_to_pixel(world)
            vectors["pixel"].append({
                "pixel_x": float(px),  # 1-based FITS convention
                "pixel_y": float(py),
                "ra_deg": ra_out,
                "dec_deg": dec_out,
                "roundtrip_px": float(pix_back[0]) + 1,  # back to 1-based
                "roundtrip_py": float(pix_back[1]) + 1,
            })

    vectors["view"] = generate_view_vectors()

    return vectors


def main():
    vectors = generate_vectors()
    out_path = Path(__file__).parent / "fixtures" / "projection_vectors.json"
    out_path.parent.mkdir(exist_ok=True)
    out_path.write_text(json.dumps(vectors, indent=2))
    print(
        f"Wrote {len(vectors['forward'])} forward, {len(vectors['inverse'])} inverse, "
        f"{len(vectors['pixel'])} pixel, {len(vectors['view'])} view vectors to {out_path}"
    )


if __name__ == "__main__":
    main()
