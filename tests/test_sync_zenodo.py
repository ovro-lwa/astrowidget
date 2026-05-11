"""Tests for scripts/sync_zenodo.py."""

from __future__ import annotations

import json

import pytest
import tomllib

from scripts.sync_zenodo import (
    cff_author_to_pyproject_author,
    cff_author_to_zenodo_creator,
    sync,
)


class TestCffAuthorToZenodoCreator:
    def test_full_author(self):
        author = {
            "given-names": "Cordero",
            "family-names": "Core",
            "orcid": "https://orcid.org/0000-0002-3531-3221",
            "affiliation": "UW Scientific Software Engineering Center",
            "email": "cdcore09@gmail.com",
        }
        result = cff_author_to_zenodo_creator(author)
        assert result == {
            "name": "Core, Cordero",
            "affiliation": "UW Scientific Software Engineering Center",
            "orcid": "0000-0002-3531-3221",
        }

    def test_name_only(self):
        author = {
            "given-names": "Jane",
            "family-names": "Doe",
        }
        result = cff_author_to_zenodo_creator(author)
        assert result == {"name": "Doe, Jane"}

    def test_orcid_bare_id(self):
        """ORCID already a bare ID (no URL prefix)."""
        author = {
            "given-names": "Jane",
            "family-names": "Doe",
            "orcid": "0000-0001-2345-6789",
        }
        result = cff_author_to_zenodo_creator(author)
        assert result["orcid"] == "0000-0001-2345-6789"

    def test_affiliation_without_orcid(self):
        author = {
            "given-names": "Jane",
            "family-names": "Doe",
            "affiliation": "MIT",
        }
        result = cff_author_to_zenodo_creator(author)
        assert result == {"name": "Doe, Jane", "affiliation": "MIT"}


class TestCffAuthorToPyprojectAuthor:
    def test_with_email(self):
        author = {
            "given-names": "Cordero",
            "family-names": "Core",
            "email": "cdcore09@gmail.com",
            "orcid": "https://orcid.org/0000-0002-3531-3221",
            "affiliation": "UW SSEC",
        }
        result = cff_author_to_pyproject_author(author)
        assert dict(result) == {
            "name": "Cordero Core",
            "email": "cdcore09@gmail.com",
        }

    def test_without_email(self):
        author = {"given-names": "Jane", "family-names": "Doe"}
        result = cff_author_to_pyproject_author(author)
        assert dict(result) == {"name": "Jane Doe"}


def _write_fixture_files(tmp_path, *, authors_yaml: str):
    citation = tmp_path / "CITATION.cff"
    citation.write_text(
        "cff-version: 1.2.0\n"
        "title: test\n"
        + authors_yaml
    )
    zenodo = tmp_path / ".zenodo.json"
    zenodo.write_text(
        json.dumps(
            {
                "title": "test project",
                "creators": [{"name": "Old, Author"}],
                "keywords": ["science"],
            },
            indent=2,
        )
    )
    pyproject = tmp_path / "pyproject.toml"
    pyproject.write_text(
        '[project]\n'
        'name = "demo"\n'
        'version = "0.0.1"\n'
        'authors = [\n'
        '    { name = "Placeholder" },\n'
        ']\n'
        '\n'
        '[tool.something]\n'
        'preserved = true\n'
    )
    return citation, zenodo, pyproject


class TestSync:
    def test_updates_zenodo_creators_preserves_other_fields(self, tmp_path):
        _, zenodo, _ = _write_fixture_files(
            tmp_path,
            authors_yaml=(
                "authors:\n"
                "  - given-names: Alice\n"
                "    family-names: Smith\n"
                "    orcid: 'https://orcid.org/0000-0001-2345-6789'\n"
                "    affiliation: MIT\n"
                "  - given-names: Bob\n"
                "    family-names: Jones\n"
            ),
        )

        sync(tmp_path)

        result = json.loads(zenodo.read_text())
        assert result["title"] == "test project"
        assert result["keywords"] == ["science"]
        assert result["creators"] == [
            {
                "name": "Smith, Alice",
                "affiliation": "MIT",
                "orcid": "0000-0001-2345-6789",
            },
            {"name": "Jones, Bob"},
        ]

    def test_updates_pyproject_authors_preserves_other_sections(self, tmp_path):
        _, _, pyproject = _write_fixture_files(
            tmp_path,
            authors_yaml=(
                "authors:\n"
                "  - given-names: Alice\n"
                "    family-names: Smith\n"
                "    email: alice@example.com\n"
                "  - given-names: Bob\n"
                "    family-names: Jones\n"
            ),
        )

        sync(tmp_path)

        data = tomllib.loads(pyproject.read_text())
        assert data["project"]["name"] == "demo"
        assert data["project"]["version"] == "0.0.1"
        assert data["project"]["authors"] == [
            {"name": "Alice Smith", "email": "alice@example.com"},
            {"name": "Bob Jones"},
        ]
        assert data["tool"]["something"]["preserved"] is True

    def test_no_authors_raises(self, tmp_path):
        _write_fixture_files(tmp_path, authors_yaml="")

        with pytest.raises(SystemExit):
            sync(tmp_path)
