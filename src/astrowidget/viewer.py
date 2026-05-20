"""SkyViewer — Panel dashboard wrapper for SkyWidget.

Composes the interactive sphere widget with controls (time, frequency,
colormap, stretch) and linked Bokeh line plots (spectrum, light curve)
that update on click.
"""

from __future__ import annotations

from collections.abc import MutableMapping
from pathlib import Path
from typing import TYPE_CHECKING, Any

import param

if TYPE_CHECKING:
    import xarray as xr

__all__ = ["SkyViewer"]

SURVEY_HIPS = {
    "DSS": "CDS/P/DSS2/color",
    "2MASS": "CDS/P/2MASS/color",
    "WISE": "CDS/P/allWISE/color",
    "Planck": "CDS/P/PLANCK/R2/HFI/color",
    "SDSS": "CDS/P/SDSS9/color",
    "Mellinger": "CDS/P/Mellinger/color",
    "Fermi": "CDS/P/Fermi/color",
    "Haslam408": "CDS/P/HI4PI/NHI",
}


def _linked_bokeh_line_pane(
    title: str,
    xlabel: str,
    ylabel: str,
    *,
    line_color: str = "#3182bd",
) -> tuple[Any, Any, Any]:
    """Strip chart as Bokeh figure + CDS + Panel pane (plain string line_color for Bokeh 3)."""
    import panel as pn
    from bokeh.models import ColumnDataSource
    from bokeh.plotting import figure as bk_figure

    cds = ColumnDataSource(data=dict(x=[], y=[]))
    fig = bk_figure(
        title=title,
        height=250,
        sizing_mode="stretch_width",
        x_axis_label=xlabel,
        y_axis_label=ylabel,
        tools="pan,wheel_zoom,box_zoom,reset,save",
    )
    fig.toolbar.logo = None
    fig.line("x", "y", source=cds, line_width=2, line_color=line_color)
    pane = pn.pane.Bokeh(fig, sizing_mode="stretch_width")
    return fig, cds, pane


def _time_coord_as_mjd_for_plot(time_vals: Any) -> Any:
    """Convert dataset time coordinates to plain float MJD for Bokeh axes.

    ``astype(float)`` on ``datetime64`` yields nanoseconds since epoch (~1e18) while
    ``y`` is ~1e0, so the line is effectively invisible even though the data range updates.

    Numeric times with magnitudes typical of **Unix seconds** (~1e9) or **milliseconds /
    nanoseconds** are converted via ``astropy.time.Time``; values already in a plausible
    MJD range (|x| < 1e7) are left as-is.
    """
    import numpy as np
    from astropy.time import Time

    tv = np.asarray(time_vals)
    if tv.dtype == object:
        return np.asarray(Time(tv.tolist()).mjd, dtype=np.float64)
    if np.issubdtype(tv.dtype, np.datetime64):
        return np.asarray(Time(tv, format="datetime64").mjd, dtype=np.float64)

    out = tv.astype(np.float64, copy=False)
    finite = out[np.isfinite(out)]
    if finite.size == 0:
        return out
    amx = float(np.nanmax(np.abs(finite)))
    # Plausible MJD / day-number range (modern dates ~6e4; allow large safety margin).
    if amx < 1.0e7:
        return out

    # Large numeric epoch: treat as Unix s/ms/ns and convert to MJD.
    if amx > 1.0e15:
        unix_s = out / 1.0e9
    elif amx > 1.0e12:
        unix_s = out / 1.0e3
    else:
        unix_s = out
    return np.asarray(Time(unix_s, format="unix").mjd, dtype=np.float64)


class SkyViewer(param.Parameterized):
    """Interactive sky viewer dashboard with linked spectrum/light curve panels.

    Parameters
    ----------
    ds : xr.Dataset
        Dataset with dimensions (time, frequency, polarization, l, m).
    var : str, default "SKY"
        Data variable name.
    pol : int, default 0
        Polarization index.
    max_size : int, default 512
        Maximum display resolution per spatial axis.

    Examples
    --------
    >>> viewer = SkyViewer(ds)
    >>> viewer.panel()  # displays in Jupyter

    >>> viewer = SkyViewer.from_zarr("path/to/data.zarr")
    >>> viewer.panel()
    """

    time_idx = param.Integer(default=0, bounds=(0, None), doc="Time slice index")
    freq_idx = param.Integer(default=0, bounds=(0, None), doc="Frequency slice index")
    cmap = param.Selector(
        default="inferno",
        objects=["inferno", "viridis", "plasma", "magma", "grayscale"],
        doc="Colormap",
    )
    stretch = param.Selector(
        default="linear",
        objects=["linear", "log", "sqrt", "asinh"],
        doc="Stretch function",
    )
    show_grid = param.Boolean(default=True, doc="Show RA/Dec grid overlay")
    invert_horizontal_pan = param.Boolean(
        default=True,
        doc="Map-style horizontal pan (drag right moves view east); False = legacy direction",
    )
    background_survey = param.Selector(
        default="",
        objects=["", "DSS", "2MASS", "WISE", "Planck", "SDSS", "Mellinger", "Fermi", "Haslam408"],
        doc="HiPS background survey (empty = none)",
    )
    background_opacity = param.Number(default=1.0, bounds=(0.0, 1.0), doc="Background opacity")

    def __init__(self, ds: xr.Dataset, var: str = "SKY", pol: int = 0, max_size: int = 512, **kwargs):
        super().__init__(**kwargs)
        from astrowidget.cube import PreloadedCube
        from astrowidget.widget import SkyWidget

        self._cube = PreloadedCube(ds, var=var, pol=pol, max_size=max_size)

        # Set time/freq bounds from data
        self.param.time_idx.bounds = (0, self._cube.n_times - 1)
        self.param.freq_idx.bounds = (0, self._cube.n_freqs - 1)

        # Create widget
        self._widget = SkyWidget()
        self._widget.invert_horizontal_pan = self.invert_horizontal_pan
        self._widget.set_dataset(ds, var=var, pol=pol, max_size=max_size)
        # set_dataset() navigates to phase center with fitted FOV.

    @classmethod
    def from_zarr(
        cls,
        source: str | Path | MutableMapping,
        var: str = "SKY",
        pol: int = 0,
        max_size: int = 512,
        **open_kwargs,
    ) -> SkyViewer:
        """Create a SkyViewer from a zarr store in one line.

        Parameters
        ----------
        source : str, Path, or MutableMapping
            Zarr store path or in-memory store.
        var : str, default "SKY"
            Data variable name.
        pol : int, default 0
            Polarization index.
        max_size : int, default 512
            Maximum display resolution.
        **open_kwargs
            Additional arguments passed to ``open_dataset()``.

        Returns
        -------
        SkyViewer
        """
        from astrowidget.io import open_dataset

        ds = open_dataset(source, **open_kwargs)
        return cls(ds, var=var, pol=pol, max_size=max_size)

    @param.depends("time_idx", "freq_idx", watch=True)
    def _on_slice_change(self):
        self._widget.update_slice(self.time_idx, self.freq_idx)

    @param.depends("cmap", watch=True)
    def _on_cmap_change(self):
        self._widget.colormap = self.cmap

    @param.depends("stretch", watch=True)
    def _on_stretch_change(self):
        self._widget.stretch = self.stretch

    @param.depends("show_grid", watch=True)
    def _on_grid_change(self):
        self._widget.show_grid = self.show_grid

    @param.depends("invert_horizontal_pan", watch=True)
    def _on_invert_horizontal_pan_change(self):
        self._widget.invert_horizontal_pan = self.invert_horizontal_pan

    @param.depends("background_survey", watch=True)
    def _on_bg_survey_change(self):
        self._widget.background_survey = self.background_survey

    @param.depends("background_opacity", watch=True)
    def _on_bg_opacity_change(self):
        self._widget.background_opacity = self.background_opacity

    def _display_indices_at_click(self) -> tuple[int, int]:
        """Downsampled display pixel for the last sky click (RA/Dec)."""
        ra_deg, dec_deg = (float(x) for x in self._widget.clicked_coord)
        wcs = self._widget._display_wcs
        if wcs is not None:
            try:
                return self._cube.display_indices_from_radec(ra_deg, dec_deg, wcs)
            except ValueError:
                pass
        l_val, m_val = self._widget.clicked_lm
        return self._cube.nearest_lm_idx(l_val, m_val)

    def _format_radec_label(self, ra_deg: float, dec_deg: float) -> str:
        from astropy.coordinates import Angle
        import astropy.units as u

        ra = Angle(ra_deg, unit=u.deg).to_string(unit=u.hourangle, precision=1, pad=True)
        dec = Angle(dec_deg, unit=u.deg).to_string(
            unit=u.deg, precision=1, alwayssign=True, pad=True
        )
        return f"RA={ra}, Dec={dec}"

    def _on_click(self, change):
        """Handle click events — update spectrum and light curve panels."""
        if not hasattr(self, "_spectrum_pane"):
            return
        ra_deg, dec_deg = (float(x) for x in self._widget.clicked_coord)
        l_idx, m_idx = self._display_indices_at_click()
        coord_label = self._format_radec_label(ra_deg, dec_deg)

        def _apply_click_plots() -> None:
            import numpy as np
            from panel.io.notebook import push_notebook

            spec = self._cube.spectrum(l_idx, m_idx, self.time_idx)
            self._spectrum_cds.data = {
                "x": np.asarray(self._cube.freq_mhz, dtype=float),
                "y": np.asarray(spec, dtype=float),
            }
            self._spectrum_fig.title.text = f"Spectrum at {coord_label}"

            lc = self._cube.light_curve(l_idx, m_idx, self.freq_idx)
            self._lightcurve_cds.data = {
                "x": _time_coord_as_mjd_for_plot(self._cube.time_vals),
                "y": np.asarray(lc, dtype=float),
            }
            self._lightcurve_fig.title.text = (
                f"Light curve at {coord_label}, "
                f"{self._cube.freq_mhz[self.freq_idx]:.1f} MHz"
            )

            # Notebook / JupyterLab: updates triggered from ipywidgets comm do not
            # automatically flush Bokeh patches. Push the displayed layout root —
            # nested panes often have no comm in state._views by themselves.
            root = getattr(self, "_panel_root", None)
            if root is not None:
                push_notebook(root)
            else:
                push_notebook(self._spectrum_pane, self._lightcurve_pane)

        # schedule="auto" avoids always-deferred execute under Lab; push_notebook flushes Bokeh.
        import panel as pn

        pn.state.execute(_apply_click_plots, schedule="auto")

    def panel(self):
        """Create and return the Panel dashboard layout.

        Returns
        -------
        pn.viewable.Viewable
        """
        import panel as pn

        # Sky widget pane
        sky_pane = pn.pane.IPyWidget(self._widget, sizing_mode="stretch_both")

        # Controls
        controls = pn.Column(
            pn.widgets.IntSlider.from_param(self.param.time_idx, name="Time"),
            pn.widgets.IntSlider.from_param(self.param.freq_idx, name="Frequency"),
            pn.widgets.Select.from_param(self.param.cmap, name="Colormap"),
            pn.widgets.Select.from_param(self.param.stretch, name="Stretch"),
            pn.widgets.Checkbox.from_param(self.param.show_grid, name="Grid"),
            pn.widgets.Checkbox.from_param(
                self.param.invert_horizontal_pan, name="Map-style H pan",
            ),
            "---",
            pn.widgets.Select.from_param(self.param.background_survey, name="Background"),
            pn.widgets.FloatSlider.from_param(self.param.background_opacity, name="BG Opacity", step=0.05),
            width=250,
        )

        # Linked strip charts: raw Bokeh (plain string line_color; avoids Param-wrapped values).
        self._spectrum_fig, self._spectrum_cds, self._spectrum_pane = _linked_bokeh_line_pane(
            "Click on image for spectrum",
            "Frequency (MHz)",
            "Intensity (Jy/beam)",
        )
        self._lightcurve_fig, self._lightcurve_cds, self._lightcurve_pane = _linked_bokeh_line_pane(
            "Click on image for light curve",
            "Time (MJD)",
            "Intensity (Jy/beam)",
        )

        linked_views = pn.Column(
            self._spectrum_pane,
            self._lightcurve_pane,
            min_width=350,
        )

        if not getattr(self, "_skyviewer_click_observed", False):
            # click_tick: notifies every click even when coordinates are unchanged.
            # clicked_coord: RA/Dec (deg) from the canvas click (primary for linked plots).
            self._widget.observe(self._on_click, names=["click_tick", "clicked_coord"])
            self._skyviewer_click_observed = True

        self._panel_root = pn.Row(
            controls,
            sky_pane,
            linked_views,
            sizing_mode="stretch_width",
        )
        return self._panel_root
