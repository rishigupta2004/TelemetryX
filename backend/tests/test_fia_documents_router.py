import asyncio

from api.routers import fia_documents as router


_CHAMPIONSHIP_HTML = """
<html><body>
  <select id="facetapi_select_facet_form_3">
    <option value="/documents/championships/fia-formula-one-world-championship-14/season/season-2024-2043">SEASON 2024</option>
    <option value="/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071">SEASON 2025</option>
  </select>
</body></html>
"""


_SEASON_HTML = """
<html><body>
  <select id="facetapi_select_facet_form_2">
    <option value="0">Event</option>
    <option value="/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Abu%20Dhabi%20Grand%20Prix">Abu Dhabi Grand Prix</option>
    <option value="/documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071/event/Bahrain%20Grand%20Prix">Bahrain Grand Prix</option>
  </select>
</body></html>
"""


_EVENT_HTML = """
<div class="decision-document-list">
  <ul class="event-wrapper">
    <li>
      <div class="event-title active">Abu Dhabi Grand Prix</div>
      <ul class="document-type-wrapper open data-id-55060">
        <li>
          <ul class="document-row-wrapper non-categorised">
            <li class="document-row key-2">
              <a href="/system/files/decision-document/2025_abu_dhabi_grand_prix_-_race_directors_event_notes_.pdf" download target="_blank">
                <div class="title">Doc 2 - Race Directors Event Notes</div>
                <div class="published">Published on <span class="date-display-single">04.12.25 16:16</span> CET</div>
              </a>
            </li>
            <li class="document-row key-1">
              <a href="/system/files/decision-document/2025_abu_dhabi_grand_prix_-_decision_-_car_4.pdf" download target="_blank">
                <div class="title">Doc 1 - Decision - Car 4</div>
                <div class="published">Published on <span class="date-display-single">04.12.25 15:00</span> CET</div>
              </a>
            </li>
          </ul>
        </li>
      </ul>
    </li>
  </ul>
</div>
"""


def test_parse_documents_extracts_rows_and_categories():
    event_name, docs = router._parse_documents(_EVENT_HTML)

    assert event_name == "Abu Dhabi Grand Prix"
    assert len(docs) == 2
    assert docs[0]["doc_number"] == 2
    assert docs[0]["category"] == "race_director_note"
    assert docs[1]["doc_number"] == 1
    assert docs[1]["category"] == "stewards_decision"
    assert docs[0]["published_at"] is not None


def test_get_fia_documents_end_to_end(monkeypatch):
    async def _fake_fetch(url: str) -> str:
        if url.endswith("/documents/championships/fia-formula-one-world-championship-14"):
            return _CHAMPIONSHIP_HTML
        if "season-2025-2071/event/Abu%20Dhabi%20Grand%20Prix" in url:
            return _EVENT_HTML
        if "season-2025-2071" in url:
            return _SEASON_HTML
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(router, "_fetch_text", _fake_fetch)

    payload = asyncio.run(router.get_fia_documents(2025, "Abu-Dhabi-Grand-Prix", force_refresh=True))

    assert payload["event_name"] == "Abu Dhabi Grand Prix"
    assert payload["year"] == 2025
    assert payload["total_documents"] == 2
    assert payload["category_counts"]["race_director_note"] == 1
    assert payload["category_counts"]["stewards_decision"] == 1
    assert payload["documents"][0]["doc_number"] == 2


def test_get_fia_document_events(monkeypatch):
    async def _fake_fetch(url: str) -> str:
        if url.endswith("/documents/championships/fia-formula-one-world-championship-14"):
            return _CHAMPIONSHIP_HTML
        if "season-2025-2071" in url:
            return _SEASON_HTML
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(router, "_fetch_text", _fake_fetch)

    payload = asyncio.run(router.get_fia_document_events(2025))

    assert payload["year"] == 2025
    assert payload["n_events"] == 2
    assert payload["events"][0]["name"] == "Abu Dhabi Grand Prix"


def test_get_fia_document_seasons(monkeypatch):
    async def _fake_fetch(url: str) -> str:
        if url.endswith("/documents/championships/fia-formula-one-world-championship-14"):
            return _CHAMPIONSHIP_HTML
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(router, "_fetch_text", _fake_fetch)

    payload = asyncio.run(router.get_fia_document_seasons(force_refresh=True))

    assert payload["n_seasons"] == 2
    assert payload["seasons"][0]["year"] == 2024
    assert payload["seasons"][1]["year"] == 2025
