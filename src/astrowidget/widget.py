"""SkyWidget — anywidget-based celestial sphere renderer.

Displays radio astronomy images on a rotatable celestial sphere using
WebGL2 fragment shader SIN projection. Image data is transferred as
raw float32 bytes — no FITS serialization.
"""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

import anywidget
import numpy as np
import traitlets

if TYPE_CHECKING:
    import astropy.units as u
    from astropy.coordinates import SkyCoord
    from astropy.wcs import WCS

_STATIC = Path(__file__).parent / "static"
_JS_PATH = _STATIC / "widget.js"


class SkyWidget(anywidget.AnyWidget):
    """Interactive celestial sphere widget with SIN projection.

    Renders a 2D radio image on a rotatable sphere. Pan by dragging,
    zoom with scroll wheel. Image data is sent as raw float32 bytes
    via anywidget's binary comm channel.

    Parameters
    ----------
    All parameters are traitlets that sync bidirectionally with the
    JavaScript frontend.

    Examples
    --------
    >>> from astrowidget import SkyWidget
    >>> from astropy.wcs import WCS
    >>> import numpy as np
    >>> widget = SkyWidget()
    >>> widget.set_image(np.random.randn(256, 256).astype(np.float32), wcs)
    >>> widget  # displays in notebook
    """

    _esm = _JS_PATH.read_text()
    _css = ""

    # --- Binary image data (raw float32 bytes, no JSON) ---
    image_data = traitlets.Bytes(b"").tag(sync=True)
    image_shape = traitlets.Tuple((0, 0)).tag(sync=True)

    # --- WCS parameters (float64 precision, transferred losslessly) ---
    crval = traitlets.Tuple((0.0, 0.0)).tag(sync=True)  # (RA, Dec) of phase center in degrees
    cdelt = traitlets.Tuple((0.0, 0.0)).tag(sync=True)  # pixel scale in degrees
    crpix = traitlets.Tuple((0.0, 0.0)).tag(sync=True)  # reference pixel (1-based FITS convention)

    # --- View state ---
    view_ra = traitlets.Float(0.0).tag(sync=True)   # current view center RA in degrees
    view_dec = traitlets.Float(0.0).tag(sync=True)  # current view center Dec in degrees
    view_fov = traitlets.Float(180.0).tag(sync=True) # field of view in degrees

    invert_horizontal_pan = traitlets.Bool(True).tag(sync=True)  # map-style horizontal pan (default)

    # --- Display options ---
    colormap = traitlets.Unicode("inferno").tag(sync=True)
    stretch = traitlets.Unicode("linear").tag(sync=True)
    vmin = traitlets.Float(0.0).tag(sync=True)
    vmax = traitlets.Float(1.0).tag(sync=True)
    opacity = traitlets.Float(1.0).tag(sync=True)

    # --- Grid overlay ---
    show_grid = traitlets.Bool(True).tag(sync=True)

    # --- HiPS background ---
    background_survey = traitlets.Unicode("").tag(sync=True)  # empty = no background
    background_opacity = traitlets.Float(1.0).tag(sync=True)

    # --- Click events (JS → Python) ---
    clicked_coord = traitlets.Tuple((0.0, 0.0)).tag(sync=True)  # (RA, Dec) in degrees
    clicked_lm = traitlets.Tuple((0.0, 0.0)).tag(sync=True)     # (l, m) direction cosines
    # Monotonic counter so every canvas click notifies Python even if (l, m) is unchanged.
    click_tick = traitlets.Int(0).tag(sync=True)

    # --- Slice indices (wired to PreloadedCube) ---
    time_idx = traitlets.Int(0).tag(sync=True)
    freq_idx = traitlets.Int(0).tag(sync=True)

    # Monotonic counter: JS redraws the image layer only when this changes so
    # image_data and WCS traits stay aligned (binary comm can arrive out of order).
    image_revision = traitlets.Int(0).tag(sync=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._wcs = None
        self._current_data = None
        self._cube = None
        self._ds = None
        self._var = "SKY"
        self._display_wcs = None
        self._aladin = None
        self._suppress_slice_observer = False
        self.observe(self._on_slice_change, names=["time_idx", "freq_idx"])

    def _update_display_wcs(self) -> None:
        """Rebuild display WCS for the current time slice (strided to cube resolution)."""
        from astrowidget.wcs import adjust_wcs_for_array_stride, get_wcs

        if self._ds is None or self._cube is None:
            return
        wcs = get_wcs(self._ds, var=self._var, time_idx=self.time_idx)
        self._display_wcs = adjust_wcs_for_array_stride(
            wcs, self._cube.stride_l, self._cube.stride_m
        )

    def _refresh_slice(self, *, update_wcs: bool = False) -> None:
        """Load the current slice once and push a single image update to JS."""
        if self._cube is None:
            return
        if update_wcs:
            self._update_display_wcs()
        if self._display_wcs is None:
            return
        self._push_image_frame(
            self._cube.image(self.time_idx, self.freq_idx),
            self._display_wcs,
        )

    def _percentile_limits(
        self,
        data: np.ndarray,
        percentile_low: float,
        percentile_high: float,
    ) -> tuple[float, float] | None:
        finite = data[np.isfinite(data)]
        if finite.size == 0:
            return None
        lo, hi = np.percentile(finite, [percentile_low, percentile_high])
        return float(lo), float(hi)

    def _push_image_frame(
        self,
        data: np.ndarray,
        wcs: WCS,
        *,
        percentile_low: float = 1.0,
        percentile_high: float = 99.0,
        center: SkyCoord | None = None,
        fov: u.Quantity | None = None,
    ) -> None:
        """Send image bytes, WCS, scaling, and optional view in one frontend draw."""
        from astropy.wcs import WCS as AstropyWCS

        import astropy.units as u

        if not isinstance(wcs, AstropyWCS):
            raise TypeError("wcs must be an astropy.wcs.WCS object")
        if not wcs.has_celestial:
            raise ValueError("wcs must have celestial axes (RA/Dec)")
        if data.ndim != 2:
            raise ValueError(f"data must be 2D, got {data.ndim}D")

        if data.dtype != np.float32:
            data = data.astype(np.float32)

        self._wcs = wcs
        self._current_data = data

        limits = self._percentile_limits(data, percentile_low, percentile_high)
        cel = wcs.celestial
        with self.hold_trait_notifications():
            self.crval = (float(cel.wcs.crval[0]), float(cel.wcs.crval[1]))
            self.cdelt = (float(cel.wcs.cdelt[0]), float(cel.wcs.cdelt[1]))
            self.crpix = (float(cel.wcs.crpix[0]), float(cel.wcs.crpix[1]))
            self.image_shape = tuple(int(x) for x in data.shape)
            self.image_data = data.tobytes()
            if limits is not None:
                self.vmin, self.vmax = limits
            if center is not None:
                self.view_ra = float(center.icrs.ra.deg)
                self.view_dec = float(center.icrs.dec.deg)
            if fov is not None:
                self.view_fov = float(fov.to(u.deg).value)
            self.image_revision += 1

    def _on_slice_change(self, change) -> None:
        """Observer: update displayed image when time_idx or freq_idx changes."""
        if self._suppress_slice_observer or self._cube is None:
            return
        self._refresh_slice(update_wcs=change.get("name") == "time_idx")

    def set_image(self, data: np.ndarray, wcs: WCS) -> None:
        """Send a 2D numpy array to the widget for display on the sphere.

        Parameters
        ----------
        data : np.ndarray
            2D float array (image pixels). Will be converted to float32.
        wcs : astropy.wcs.WCS
            Celestial WCS for SIN projection parameters.

        Raises
        ------
        TypeError
            If wcs is not an astropy WCS object.
        ValueError
            If wcs lacks celestial axes or data is not 2D.
        """
        from astropy.wcs import WCS as AstropyWCS

        if not isinstance(wcs, AstropyWCS):
            raise TypeError("wcs must be an astropy.wcs.WCS object")
        if not wcs.has_celestial:
            raise ValueError("wcs must have celestial axes (RA/Dec)")
        if data.ndim != 2:
            raise ValueError(f"data must be 2D, got {data.ndim}D")

        self._push_image_frame(data, wcs)

    def goto(self, target: SkyCoord, fov: u.Quantity | None = None) -> None:
        """Navigate the view to a celestial target.

        Parameters
        ----------
        target : astropy.coordinates.SkyCoord
            Target position on the sky.
        fov : astropy.units.Quantity, optional
            Field of view (e.g., ``10 * u.deg``). If None, keeps current FOV.
        """
        import astropy.units as u

        self.view_ra = float(target.icrs.ra.deg)
        self.view_dec = float(target.icrs.dec.deg)
        if fov is not None:
            self.view_fov = float(fov.to(u.deg).value)

    def set_dataset(self, ds, var: str = "SKY", pol: int = 0, max_size: int = 512) -> None:
        """Load a zarr-backed dataset for interactive exploration.

        Creates a PreloadedCube for cached slice access and displays
        the initial slice.

        Parameters
        ----------
        ds : xr.Dataset
            Dataset with dimensions (time, frequency, polarization, l, m).
        var : str, default "SKY"
            Data variable name.
        pol : int, default 0
            Polarization index.
        max_size : int, default 512
            Maximum spatial dimension for display.
        """
        from astrowidget.cube import PreloadedCube
        from astrowidget.wcs import get_wcs

        self._ds = ds
        self._var = var
        self._cube = PreloadedCube(ds, var=var, pol=pol, max_size=max_size)
        self.time_idx = 0
        self.freq_idx = 0
        self._update_display_wcs()

        # Display initial slice
        self.set_image(self._cube.image(0, 0), self._display_wcs)

        # Navigate to phase center with FOV fitted to image extent (full-res WCS)
        import astropy.units as u
        from astropy.coordinates import SkyCoord

        wcs = get_wcs(ds, var=var, time_idx=0)
        phase_center = SkyCoord(
            ra=wcs.wcs.crval[0], dec=wcs.wcs.crval[1],
            unit="deg", frame="fk5",
        )
        # Image angular extent ≈ max(npix * |cdelt|) across both axes
        n_l = ds.sizes.get("l", ds.sizes.get("x", 256))
        n_m = ds.sizes.get("m", ds.sizes.get("y", 256))
        extent_deg = max(
            n_l * abs(wcs.wcs.cdelt[0]),
            n_m * abs(wcs.wcs.cdelt[1]),
        )
        # Use 90% of the extent as FOV so the image fills the view with margin
        fov = min(extent_deg * 0.9, 180.0)
        self.goto(phase_center, fov=fov * u.deg)

    def update_slice(
        self,
        time_idx: int,
        freq_idx: int,
        *,
        center: SkyCoord | None = None,
        fov: u.Quantity | None = None,
        percentile_low: float | None = None,
        percentile_high: float | None = None,
    ) -> None:
        """Update the displayed image to a different time/frequency slice.

        Requires ``set_dataset()`` to have been called first.

        Optional ``center`` and ``fov`` update the view in the same atomic
        frontend redraw as the new slice (avoids a transient WCS/image mismatch).
        ``percentile_low`` / ``percentile_high`` override the default display
        scaling for this slice.

        Parameters
        ----------
        time_idx : int
            Time index.
        freq_idx : int
            Frequency index.
        center : SkyCoord, optional
            Recenter the view on this target after loading the slice.
        fov : Quantity, optional
            Field of view for ``center`` (e.g. ``8 * u.deg``).
        percentile_low, percentile_high : float, optional
            Percentile limits for ``vmin``/``vmax`` on this slice.
        """
        if not hasattr(self, "_cube") or self._cube is None:
            raise RuntimeError("Call set_dataset() before update_slice()")
        time_changed = int(time_idx) != int(self.time_idx)
        scale_low = 1.0 if percentile_low is None else float(percentile_low)
        scale_high = 99.0 if percentile_high is None else float(percentile_high)
        self._suppress_slice_observer = True
        try:
            with self.hold_trait_notifications():
                self.time_idx = int(time_idx)
                self.freq_idx = int(freq_idx)
            if time_changed or self._display_wcs is None:
                self._update_display_wcs()
            if self._display_wcs is None:
                return
            self._push_image_frame(
                self._cube.image(self.time_idx, self.freq_idx),
                self._display_wcs,
                percentile_low=scale_low,
                percentile_high=scale_high,
                center=center,
                fov=fov,
            )
        finally:
            self._suppress_slice_observer = False

    def overlay(self, survey: str = "DSS", height: int = 600):
        """Display this widget overlaid on HiPS survey tiles.

        Returns an ipywidgets container with Aladin Lite behind and
        the SkyWidget on top. The radio image pixels are transparent
        where there's no data, so the survey tiles show through.

        Parameters
        ----------
        survey : str, default "DSS"
            Survey preset name or HiPS URL.
        height : int, default 600
            Container height in pixels.

        Returns
        -------
        ipywidgets.GridBox
            Container with both widgets stacked.
        """
        import ipywidgets as widgets

        aladin = self.create_background(survey)

        # Signal JS to use transparent canvas background
        self.background_survey = survey

        # Stack using CSS Grid — both widgets in the same grid cell
        self.layout = widgets.Layout(grid_area="1 / 1")
        aladin.layout = widgets.Layout(grid_area="1 / 1")

        container = widgets.GridBox(
            children=[aladin, self],
            layout=widgets.Layout(
                width="100%",
                grid_template_columns="1fr",
                grid_template_rows=f"{height}px",
            ),
        )
        self._aladin = aladin
        return container

    def create_background(self, survey: str = "CDS/P/DSS2/color", fov: float | None = None):
        """Create an ipyaladin widget synced to this widget's view.

        Returns an Aladin widget that can be displayed alongside the
        SkyWidget. The Aladin widget shows HiPS survey tiles as a
        reference background.

        Parameters
        ----------
        survey : str, default "CDS/P/DSS2/color"
            HiPS survey URL or preset name.
        fov : float, optional
            Field of view in degrees. Defaults to this widget's current FOV.

        Returns
        -------
        ipyaladin.Aladin
            The Aladin widget instance.
        """
        from astropy.coordinates import SkyCoord
        from ipyaladin import Aladin

        PRESETS = {
            "DSS": "CDS/P/DSS2/color",
            "2MASS": "CDS/P/2MASS/color",
            "WISE": "CDS/P/allWISE/color",
            "Planck": "CDS/P/PLANCK/R2/HFI/color",
            "SDSS": "CDS/P/SDSS9/color",
            "Mellinger": "CDS/P/Mellinger/color",
            "Fermi": "CDS/P/Fermi/color",
            "Haslam408": "CDS/P/HI4PI/NHI",
        }
        hips_url = PRESETS.get(survey, survey)
        view_fov = fov if fov is not None else self.view_fov

        target = SkyCoord(ra=self.view_ra, dec=self.view_dec, unit="deg", frame="fk5")
        aladin = Aladin(
            target=target,
            fov=view_fov,
            survey=hips_url,
            projection="SIN",
            show_coo_grid=True,
            height=600,
        )
        return aladin

    def auto_scale(
        self,
        percentile_low: float = 1,
        percentile_high: float = 99,
        *,
        bump_revision: bool = True,
    ) -> None:
        """Set vmin/vmax from data percentiles.

        Parameters
        ----------
        percentile_low : float
            Lower percentile for vmin (default 1).
        percentile_high : float
            Upper percentile for vmax (default 99).
        bump_revision : bool, default True
            When True, trigger one frontend redraw after updating scaling.
        """
        if self._current_data is None:
            return
        limits = self._percentile_limits(
            self._current_data,
            percentile_low,
            percentile_high,
        )
        if limits is None:
            return
        with self.hold_trait_notifications():
            self.vmin, self.vmax = limits
            if bump_revision:
                self.image_revision += 1
