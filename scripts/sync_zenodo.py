"""Sync .zenodo.json and pyproject.toml from CITATION.cff.

CITATION.cff is the single source of truth for author/contributor metadata.
This script propagates the author list to:

- ``.zenodo.json`` ``creators`` (used by the Zenodo GitHub integration)
- ``pyproject.toml`` ``[project] authors`` (used by the built Python package)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import tomlkit
import yaml

ORCID_URL_PREFIX = "https://orcid.org/"


def cff_author_to_zenodo_creator(author: dict) -> dict:
    """Map a CITATION.cff author entry to a Zenodo creator entry."""
    creator: dict = {
        "name": f"{author['family-names']}, {author['given-names']}",
    }
    if "affiliation" in author:
        creator["affiliation"] = author["affiliation"]
    if "orcid" in author:
        orcid = author["orcid"]
        if orcid.startswith(ORCID_URL_PREFIX):
            orcid = orcid[len(ORCID_URL_PREFIX):]
        creator["orcid"] = orcid
    return creator


def cff_author_to_pyproject_author(author: dict) -> tomlkit.items.InlineTable:
    """Map a CITATION.cff author entry to a pyproject.toml author entry.

    PEP 621 ``[project] authors`` only supports ``name`` and ``email``.
    """
    entry = tomlkit.inline_table()
    entry["name"] = f"{author['given-names']} {author['family-names']}"
    if "email" in author:
        entry["email"] = author["email"]
    return entry


def sync_zenodo(repo_root: Path, cff_authors: list[dict]) -> None:
    """Write CITATION.cff authors into .zenodo.json creators."""
    zenodo_path = repo_root / ".zenodo.json"

    with open(zenodo_path) as f:
        zenodo = json.load(f)

    zenodo["creators"] = [cff_author_to_zenodo_creator(a) for a in cff_authors]

    with open(zenodo_path, "w") as f:
        json.dump(zenodo, f, indent=2)
        f.write("\n")


def sync_pyproject(repo_root: Path, cff_authors: list[dict]) -> None:
    """Write CITATION.cff authors into pyproject.toml [project] authors."""
    pyproject_path = repo_root / "pyproject.toml"

    with open(pyproject_path) as f:
        pyproject = tomlkit.parse(f.read())

    authors_array = tomlkit.array()
    authors_array.multiline(True)
    for author in cff_authors:
        authors_array.append(cff_author_to_pyproject_author(author))

    pyproject["project"]["authors"] = authors_array

    with open(pyproject_path, "w") as f:
        f.write(tomlkit.dumps(pyproject))


def sync(repo_root: Path) -> None:
    """Read CITATION.cff and propagate authors to dependent files."""
    citation_path = repo_root / "CITATION.cff"

    with open(citation_path) as f:
        cff = yaml.safe_load(f)

    authors = cff.get("authors")
    if not authors:
        print("Error: no authors found in CITATION.cff", file=sys.stderr)
        sys.exit(1)

    sync_zenodo(repo_root, authors)
    sync_pyproject(repo_root, authors)


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parent.parent
    sync(repo_root)
