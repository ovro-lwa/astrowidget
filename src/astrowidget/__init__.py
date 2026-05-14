"""astrowidget — Interactive radio astronomy visualization for Jupyter.

Renders radio images on a rotatable celestial sphere with SIN projection,
reading directly from zarr. No FITS intermediary in the display path.
"""

__version__ = "0.2.0"

from astrowidget.cube import PreloadedCube
from astrowidget.io import DataSourceError, open_dataset
from astrowidget.wcs import adjust_wcs_for_array_stride, get_wcs
from astrowidget.widget import SkyWidget

__all__ = [
    "SkyWidget",
    "open_dataset",
    "PreloadedCube",
    "get_wcs",
    "adjust_wcs_for_array_stride",
    "DataSourceError",
]

# SkyViewer requires Panel — conditional import
try:
    from astrowidget.viewer import SkyViewer

    __all__ += ["SkyViewer"]
except ImportError:
    pass
