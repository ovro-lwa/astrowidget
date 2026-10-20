"""Lazy selection, vectorized pixel reads and dask integration (#22, #23)."""

from __future__ import annotations

import dask
import dask.array as dsa
import numpy as np
import pytest
import xarray as xr
from dask.callbacks import Callback

from astrowidget import CubeWindow, PreloadedCube, open_dataset


class CountingStore(dict):
    """zarr v2 store that records every data-chunk key read for ``SKY``."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.reads: list[str] = []

    def __getitem__(self, key):
        if key.startswith("SKY/") and not key.split("/")[-1].startswith("."):
            self.reads.append(key)
        return super().__getitem__(key)


class ComputeCounter(Callback):
    """Counts dask graph executions (one ``_start`` per compute call)."""

    def __init__(self):
        super().__init__()
        self.computes = 0

    def _start(self, dsk):
        self.computes += 1


def _cube_data(n_t, n_f, n_p, n_l, n_m, seed=0):
    rng = np.random.default_rng(seed)
    return rng.standard_normal((n_t, n_f, n_p, n_l, n_m)).astype(np.float32)


def _dataset(n_t=3, n_f=4, n_p=2, n_l=40, n_m=36, seed=0):
    data = _cube_data(n_t, n_f, n_p, n_l, n_m, seed)
    return xr.Dataset(
        data_vars={"SKY": (["time", "frequency", "polarization", "l", "m"], data)},
        coords={
            "time": np.linspace(60000.0, 60001.0, n_t),
            "frequency": np.linspace(40e6, 80e6, n_f),
            "polarization": np.arange(n_p),
            "l": np.linspace(-0.5, 0.5, n_l),
            "m": np.linspace(-0.5, 0.5, n_m),
        },
    )


def _zarr_dataset(chunks, open_chunks=None, **kwargs):
    """Write a dataset to a counting in-memory zarr store and reopen it lazily.

    ``open_chunks`` is passed to ``open_dataset`` (default ``{}``: one dask
    chunk per stored chunk).
    """
    ds = _dataset(**kwargs)
    store = CountingStore()
    ds.to_zarr(store, encoding={"SKY": {"chunks": chunks}}, consolidated=False)
    store.reads.clear()
    lazy = open_dataset(
        store, chunks={} if open_chunks is None else open_chunks, consolidated=False
    )
    return ds, lazy, store


def _legacy_slice(ds, t, f, p, sl, sm):
    """Reference implementation of the pre-#22 eager ``_load_slice``."""
    return ds["SKY"].isel(time=t, frequency=f, polarization=p).values[::sl, ::sm]


@pytest.fixture(params=["numpy", "dask"])
def backend_pair(request):
    """(reference numpy dataset, dataset under test) for both array types."""
    if request.param == "numpy":
        ds = _dataset()
        return ds, ds
    ds, lazy, _ = _zarr_dataset((1, 1, 1, 8, 8))
    return ds, lazy


class TestLazySelection:
    def test_lazy_image_stays_dask_and_reads_nothing(self):
        ds, lazy, store = _zarr_dataset((1, 1, 1, 8, 8))
        cube = PreloadedCube(lazy, max_size=16)
        with ComputeCounter() as counter:
            da = cube.lazy_image(1, 2)
        assert isinstance(da.data, dsa.Array)
        assert da.shape == (len(cube.l_vals), len(cube.m_vals))
        assert counter.computes == 0
        assert store.reads == []

    def test_lazy_image_strided_matches_legacy(self, backend_pair):
        ref, ds = backend_pair
        cube = PreloadedCube(ds, max_size=16)
        assert (cube.stride_l, cube.stride_m) == (2, 2)
        got = cube.lazy_image(2, 3).values
        np.testing.assert_array_equal(got, _legacy_slice(ref, 2, 3, 0, 2, 2))

    @pytest.mark.parametrize("max_size", [512, 16, 7])
    def test_image_matches_legacy(self, backend_pair, max_size):
        ref, ds = backend_pair
        cube = PreloadedCube(ds, max_size=max_size)
        for t, f in [(0, 0), (2, 3), (1, 2)]:
            img = cube.image(t, f)
            assert img.dtype == np.float32
            np.testing.assert_array_equal(
                img, _legacy_slice(ref, t, f, 0, cube.stride_l, cube.stride_m)
            )

    def test_image_is_one_compute(self):
        _, lazy, _ = _zarr_dataset((1, 1, 1, 8, 8))
        cube = PreloadedCube(lazy, max_size=16)
        with ComputeCounter() as counter:
            cube.image(0, 1)
            cube.image(0, 1)  # cache hit: no second compute
        assert counter.computes == 1

    def test_image_respects_polarization(self, backend_pair):
        ref, ds = backend_pair
        cube = PreloadedCube(ds, pol=0, max_size=16)
        first = cube.image(1, 1).copy()
        cube.pol = 1
        np.testing.assert_array_equal(cube.image(1, 1), _legacy_slice(ref, 1, 1, 1, 2, 2))
        cube.pol = 0
        np.testing.assert_array_equal(cube.image(1, 1), first)


class TestPixelTraces:
    """spectrum / light_curve / dynamic_spectrum: one point read, one compute."""

    @pytest.mark.parametrize("pix", [(0, 0), (3, 5), (-1, -1), (19, 17)])
    def test_traces_match_legacy_loops(self, backend_pair, pix):
        ref, ds = backend_pair
        cube = PreloadedCube(ds, pol=1, max_size=16)
        sl, sm = cube.stride_l, cube.stride_m
        l_idx, m_idx = pix

        def legacy(t, f):
            return _legacy_slice(ref, t, f, 1, sl, sm)[l_idx, m_idx]

        spec = cube.spectrum(l_idx, m_idx, time_idx=2)
        lc = cube.light_curve(l_idx, m_idx, freq_idx=3)
        dyn = cube.dynamic_spectrum(l_idx, m_idx)
        assert spec.dtype == lc.dtype == dyn.dtype == np.float32
        np.testing.assert_array_equal(spec, [legacy(2, f) for f in range(cube.n_freqs)])
        np.testing.assert_array_equal(lc, [legacy(t, 3) for t in range(cube.n_times)])
        assert dyn.shape == (cube.n_times, cube.n_freqs)
        np.testing.assert_array_equal(
            dyn,
            [[legacy(t, f) for f in range(cube.n_freqs)] for t in range(cube.n_times)],
        )

    @pytest.mark.parametrize("pix", [(20, 0), (0, 18), (-21, 0)])
    def test_out_of_range_pixel_raises(self, backend_pair, pix):
        _, ds = backend_pair
        cube = PreloadedCube(ds, max_size=16)
        with pytest.raises(IndexError):
            cube.spectrum(*pix, time_idx=0)

    def test_dynamic_spectrum_is_single_compute(self):
        _, lazy, _ = _zarr_dataset((1, 1, 1, 8, 8))
        cube = PreloadedCube(lazy, max_size=16)
        with ComputeCounter() as counter:
            cube.dynamic_spectrum(4, 4)
        assert counter.computes == 1

    def test_traces_read_only_the_pixel_chunks(self):
        _, lazy, store = _zarr_dataset((1, 1, 1, 8, 8))
        cube = PreloadedCube(lazy, max_size=16)
        cube.dynamic_spectrum(5, 6)  # full-res pixel (10, 12) → chunk (1, 1)
        n_t, n_f = cube.n_times, cube.n_freqs
        assert len(store.reads) == n_t * n_f
        assert {k.split("/")[-1].split(".")[-2:] == ["1", "1"] for k in store.reads} == {True}

    def test_traces_do_not_evict_slice_cache(self):
        _, lazy, _ = _zarr_dataset((1, 1, 1, 8, 8))
        cube = PreloadedCube(lazy, max_size=16)
        shown = cube.image(0, 0)
        cube.dynamic_spectrum(1, 1)
        assert cube.image(0, 0) is shown
        assert cube._load_slice.cache_info().currsize == 1


class TestCoarseDaskChunks:
    """Dask blocks larger than the stored chunks (e.g. ``chunks="auto"``).

    Each dask block below spans 2 times × 2 frequencies × 16² pixels = 2×2×2×2
    stored chunks; reads must still be issued per stored chunk.
    """

    OPEN = {"time": 2, "frequency": 2, "polarization": 1, "l": 16, "m": 16}

    def _cube(self):
        ref, lazy, store = _zarr_dataset((1, 1, 1, 8, 8), open_chunks=self.OPEN, n_t=4)
        assert lazy["SKY"].data.chunksize == (2, 2, 1, 16, 16)
        return ref, PreloadedCube(lazy, max_size=16), store

    def test_window_aligns_to_stored_chunks(self):
        _, cube, _ = self._cube()
        assert (cube.chunk_l, cube.chunk_m) == (8, 8)
        assert cube.window_for_pixel_bbox(9, 14, 17, 22) == CubeWindow(8, 16, 16, 24, 1, 1)

    def test_window_reads_one_stored_chunk(self):
        ref, cube, store = self._cube()
        img = cube.window_image(1, 2, CubeWindow(8, 16, 16, 24, 1, 1))
        np.testing.assert_array_equal(
            img, ref["SKY"].isel(time=1, frequency=2, polarization=0).values[8:16, 16:24]
        )
        assert [k.split("/")[-1] for k in store.reads] == ["1.2.0.1.2"]

    @pytest.mark.parametrize(
        ("method", "args", "n_reads"),
        [("spectrum", (0,), 4), ("light_curve", (0,), 4), ("dynamic_spectrum", (), 16)],
    )
    def test_traces_read_one_stored_chunk_per_plane(self, method, args, n_reads):
        _, cube, store = self._cube()
        getattr(cube, method)(5, 6, *args)
        assert len(store.reads) == len(set(store.reads)) == n_reads
        assert {tuple(k.split("/")[-1].split(".")[-2:]) for k in store.reads} == {("1", "1")}

    def test_default_auto_chunks_match_numpy(self):
        ref, lazy, _ = _zarr_dataset((1, 1, 1, 8, 8), open_chunks="auto")
        np.testing.assert_array_equal(
            PreloadedCube(lazy, max_size=16).dynamic_spectrum(3, 4),
            PreloadedCube(ref, max_size=16).dynamic_spectrum(3, 4),
        )


class TestCachePerInstance:
    def test_caches_are_independent(self):
        a = PreloadedCube(_dataset(seed=1), max_size=16)
        b = PreloadedCube(_dataset(seed=2), max_size=16)
        a.image(0, 0)
        assert a._load_slice.cache_info().currsize == 1
        assert b._load_slice.cache_info().currsize == 0
        assert not np.array_equal(a.image(0, 0), b.image(0, 0))


class TestWindows:
    def test_window_image_reads_only_overlapping_chunks(self):
        ref, lazy, store = _zarr_dataset((1, 1, 1, 8, 8))
        cube = PreloadedCube(lazy, max_size=16)
        win = CubeWindow(8, 16, 16, 24, 1, 1)
        img = cube.window_image(1, 2, win)
        np.testing.assert_array_equal(
            img, ref["SKY"].isel(time=1, frequency=2, polarization=0).values[8:16, 16:24]
        )
        assert [k.split("/")[-1] for k in store.reads] == ["1.2.0.1.2"]

    def test_full_strided_image_touches_every_spatial_chunk(self):
        """Documents why viewport windows matter: striding cannot skip chunks."""
        _, lazy, store = _zarr_dataset((1, 1, 1, 8, 8))
        cube = PreloadedCube(lazy, max_size=16)
        cube.image(0, 0)
        assert len(set(store.reads)) == 5 * 5

    def test_window_image_full_window_uses_image_cache(self):
        cube = PreloadedCube(_dataset(), max_size=16)
        assert cube.window_image(0, 0, cube.full_window) is cube.image(0, 0)

    def test_window_cache_is_keyed_by_window_and_pol(self):
        cube = PreloadedCube(_dataset(), max_size=16)
        w = CubeWindow(0, 8, 0, 8)
        a = cube.window_image(0, 0, w)
        cube.pol = 1
        b = cube.window_image(0, 0, w)
        assert not np.array_equal(a, b)
        assert cube.window_image(0, 0, CubeWindow(0, 8, 8, 16)).shape == (8, 8)

    def test_window_for_bbox_snaps_to_chunks_and_picks_stride(self):
        _, lazy, _ = _zarr_dataset((1, 1, 1, 8, 8), n_l=64, n_m=64)
        cube = PreloadedCube(lazy, max_size=16)
        assert (cube.chunk_l, cube.chunk_m, cube.stride_l) == (8, 8, 4)
        win = cube.window_for_pixel_bbox(10.2, 13.7, 3.0, 9.0)
        assert win == CubeWindow(8, 16, 0, 16, 1, 1)
        wide = cube.window_for_pixel_bbox(2, 40, 2, 20)
        assert (wide.l_start, wide.l_stop, wide.m_start, wide.m_stop) == (0, 48, 0, 24)
        assert (wide.stride_l, wide.stride_m) == (3, 2)
        assert max(wide.shape) <= 16

    def test_window_for_bbox_none_when_not_sharper_or_off_image(self):
        _, lazy, _ = _zarr_dataset((1, 1, 1, 8, 8), n_l=64, n_m=64)
        cube = PreloadedCube(lazy, max_size=16)
        assert cube.window_for_pixel_bbox(-50, 200, -50, 200) is None
        assert cube.window_for_pixel_bbox(100, 120, 0, 8) is None
        assert cube.window_for_pixel_bbox(-9, -1, 0, 8) is None

    def test_unchunked_window_alignment(self):
        cube = PreloadedCube(_dataset(n_l=1024, n_m=1024, n_t=1, n_f=1, n_p=1), max_size=256)
        assert cube.chunk_l is None
        win = cube.window_for_pixel_bbox(100, 130, 700, 720)
        assert win == CubeWindow(64, 192, 640, 768, 1, 1)


class TestDistributed:
    def test_compute_runs_on_active_client(self):
        distributed = pytest.importorskip("distributed")
        ref, lazy, _ = _zarr_dataset((1, 1, 1, 8, 8))
        cube = PreloadedCube(lazy, max_size=16)
        with distributed.Client(
            processes=False, n_workers=1, threads_per_worker=2, dashboard_address=None
        ) as client:
            with distributed.get_task_stream(client) as stream:
                dyn = cube.dynamic_spectrum(3, 3)
                img = cube.image(1, 1)
            assert len(stream.data) > 0
        np.testing.assert_array_equal(img, _legacy_slice(ref, 1, 1, 0, 2, 2))
        np.testing.assert_array_equal(
            dyn[:, 0], ref["SKY"].isel(polarization=0, l=6, m=6, frequency=0).values
        )

    def test_falls_back_to_local_scheduler_without_client(self):
        _, lazy, _ = _zarr_dataset((1, 1, 1, 8, 8))
        cube = PreloadedCube(lazy, max_size=16)
        with dask.config.set(scheduler="synchronous"):
            assert cube.spectrum(1, 1, 0).shape == (cube.n_freqs,)
