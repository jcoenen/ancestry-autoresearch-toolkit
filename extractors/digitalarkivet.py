#!/usr/bin/env python3
"""
Digitalarkivet indexed record extractor.
Searches www.digitalarkivet.no for indexed person records directly via HTTP.
No Playwright needed for text searches — runs in seconds vs. minutes.

Prerequisites: pip install requests beautifulsoup4

ENDPOINTS DISCOVERED:
  Search-links (record types):
    GET https://nye.digitalarkivet.no/api/search-links?sourceId={id}
    → [{sourceId, viewSetId, label, listType}]

  Indexed record search (old site, HTML):
    GET https://www.digitalarkivet.no/search/{viewSetId}/{sourceId}?{params}
    → HTML page, parse with .search-result-container / #searchResultList .unit

  Per-page indexed records (new site, JSON):
    GET https://nye.digitalarkivet.no/api/transcription-link?uuid={uuid}
    → {listType: {eventId: [{event_id, event_date, event_year, person_id,
                              first_name, last_name, gender, role}]}}

  Source page list (new site, JSON):
    GET https://nye.digitalarkivet.no/api/media-file/viewer/{sourceId}/pagination
    → {uuid: {page, filter: [{subset_id, label, field, value}], isRestricted}}

RECORD TYPES (listType → label):
  dp  Fødte og døpte      (baptisms)
  gr  Døde og begravde    (burials)
  vi  Viede               (marriages)
  if  Innflyttede         (immigrants)
  uf  Utflyttede          (emigrants)
  kf  Konfirmerte         (confirmations)
  an  Administrasjon/notat

SEARCH FIELDS (vary by record type, all optional):
  --forenamn    First name (fuzzy by default; --exact for strict)
  --etternamn   Last name
  --fodselsaar  Birth year
  --dodsaar     Death year
  --aar         Event year (burial year, baptism year, etc.)
  --bustad      Residence
  --fodestad    Birthplace
  --sokn        Parish/church

USAGE:
  python3 digitalarkivet.py 9349                           # list record types
  python3 digitalarkivet.py 9349 -t gr --forenamn Lars --fodselsaar 1837
  python3 digitalarkivet.py 9341 -t dp --forenamn Christen --aar 1757
  python3 digitalarkivet.py 9349 -t gr --aar 1837          # all 1837 burials
  python3 digitalarkivet.py 9349 --page-uuid 51214f22-...  # per-page mode
  python3 digitalarkivet.py 9349 -t gr --json              # JSON output
"""

import sys
import json
import argparse
import requests
from bs4 import BeautifulSoup

BASE_NEW = "https://nye.digitalarkivet.no"
BASE_OLD = "https://www.digitalarkivet.no"

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "no,en;q=0.8",
})


# ---------------------------------------------------------------------------
# API calls
# ---------------------------------------------------------------------------

def get_view_sets(source_id: int) -> list[dict]:
    """Return available indexed record types for a source."""
    r = SESSION.get(f"{BASE_NEW}/api/search-links?sourceId={source_id}")
    r.raise_for_status()
    return r.json()


def search_records(source_id: int, view_set_id: int, params: dict, exact: bool = False) -> dict:
    """Search indexed records. Returns parsed results dict."""
    url = f"{BASE_OLD}/search/{view_set_id}/{source_id}"
    search_params = dict(params)
    if exact:
        search_params["no_alias"] = "1"
    r = SESSION.get(url, params=search_params)
    r.raise_for_status()
    return _parse_results_html(r.text)


def get_page_records(uuid: str) -> dict:
    """Return all indexed persons on a specific source image page (by UUID)."""
    r = SESSION.get(f"{BASE_NEW}/api/transcription-link?uuid={uuid}")
    r.raise_for_status()
    return r.json()


def get_source_pages(source_id: int) -> dict:
    """Return {uuid: {page, filter, isRestricted}} for all pages in a source."""
    r = SESSION.get(f"{BASE_NEW}/api/media-file/viewer/{source_id}/pagination")
    r.raise_for_status()
    return r.json()


# ---------------------------------------------------------------------------
# HTML parser
# ---------------------------------------------------------------------------

def _parse_results_html(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")

    # Total hit count
    hits_el = soup.select_one("[data-hits]")
    total_hits = int(hits_el["data-hits"]) if hits_el else 0

    records = []
    for unit in soup.select("#searchResultList .unit"):
        rec = {}

        # Name + person ID from view link  (href like /view/267/pg00000006803848)
        link = unit.select_one("a[href*='/view/']")
        if link:
            rec["name"] = link.get_text(strip=True)
            href = link["href"]
            rec["person_id"] = href.rstrip("/").split("/")[-1]
            rec["url"] = href if href.startswith("http") else f"{BASE_OLD}{href}"

        # Key-value pairs from .generic divs
        for div in unit.select(".generic"):
            badge = div.select_one(".label")
            if badge:
                rec["record_type"] = badge.get_text(strip=True)
                continue
            span = div.select_one("span")
            if not span:
                continue
            label_text = span.get_text(strip=True).rstrip(":")
            full_text = div.get_text(strip=True)
            value = full_text[len(span.get_text(strip=True)):].strip().rstrip("*").strip()
            if label_text and value:
                rec[label_text] = value

        # Source title
        source_link = unit.select_one(".source a")
        if source_link:
            rec["source"] = source_link.get_text(strip=True).replace("\uf105", "").strip()

        if rec:
            records.append(rec)

    # Pagination
    page_items = soup.select(".slim-pagination .pagination li")
    current_page, total_pages = 1, 1
    for li in page_items:
        try:
            n = int(li.get_text(strip=True))
            total_pages = max(total_pages, n)
            if "active" in li.get("class", []):
                current_page = n
        except ValueError:
            pass

    return {
        "total_hits": total_hits,
        "page": current_page,
        "total_pages": total_pages,
        "records": records,
    }


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------

FIELD_ORDER = ["Fødselsår", "Fødested", "Rolle", "Stilling/stand", "Bosted",
               "Sogn/kirke", "Begravelsesdato", "Dødsdato", "Jordfestelsesdato",
               "Dåpsdato", "Viedato", "Årsak", "År", "Merknader"]

def _print_results(results: dict, source_id: int, label: str, params: dict):
    param_str = "  ".join(f"{k}={v}" for k, v in params.items()) if params else "(no filters)"
    print(f"\nSearch: {label} — source {source_id}")
    print(f"Params: {param_str}")
    print(f"Hits:   {results['total_hits']}", end="")
    if results["total_pages"] > 1:
        print(f"  (page {results['page']} of {results['total_pages']})", end="")
    print("\n")

    for i, rec in enumerate(results["records"], 1):
        name = rec.get("name", "(no name)")
        pid = rec.get("person_id", "")
        print(f"  [{i}] {name}  (ID: {pid})")
        skip = {"name", "person_id", "url", "source", "record_type"}
        # Print in preferred order
        for k in FIELD_ORDER:
            if k in rec:
                print(f"       {k}: {rec[k]}")
        # Remaining fields not in preferred order
        for k, v in rec.items():
            if k not in skip and k not in FIELD_ORDER:
                print(f"       {k}: {v}")
        if "source" in rec:
            print(f"       Kilde: {rec['source']}")
        print(f"       URL: {rec.get('url', '')}")
        print()

    if results["total_hits"] == 0:
        print("  (no results)")


def _print_page_records(data: dict, uuid: str):
    if not data:
        print(f"No indexed records on page {uuid}")
        return
    print(f"\nIndexed records on page {uuid}:")
    for list_type, events in data.items():
        print(f"\n  === {list_type} ===")
        for event_id, persons in events.items():
            dates = [p.get("event_date") or p.get("event_year") for p in persons if p.get("event_date") or p.get("event_year")]
            date_str = dates[0] if dates else "?"
            print(f"  Event {event_id}  ({date_str})")
            for p in persons:
                fname = p.get("first_name") or ""
                lname = p.get("last_name") or ""
                role = p.get("role", "?")
                pid = p.get("person_id", "")
                print(f"    [{role}] {fname} {lname}  (ID: {pid})")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description="Search Digitalarkivet indexed records without Playwright",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("USAGE:")[1].strip() if "USAGE:" in __doc__ else "",
    )
    ap.add_argument("source_id", type=int, help="Digitalarkivet source ID (e.g. 9349)")
    ap.add_argument("-t", "--list-type", metavar="TYPE",
                    help="Record type: dp=baptisms, gr=burials, vi=marriages, if=immigrants, uf=emigrants, kf=confirmations")
    ap.add_argument("--forenamn", metavar="NAME", help="First name")
    ap.add_argument("--etternamn", metavar="NAME", help="Last name")
    ap.add_argument("--fodselsaar", metavar="YEAR", help="Birth year")
    ap.add_argument("--dodsaar", metavar="YEAR", help="Death year")
    ap.add_argument("--aar", metavar="YEAR", help="Event year (baptism year, burial year, etc.)")
    ap.add_argument("--bustad", metavar="PLACE", help="Residence")
    ap.add_argument("--fodestad", metavar="PLACE", help="Birthplace")
    ap.add_argument("--sokn", metavar="PARISH", help="Parish/church (sokn_kyrkje)")
    ap.add_argument("--exact", action="store_true",
                    help="Disable fuzzy/variant name matching (no_alias=1)")
    ap.add_argument("--page-uuid", metavar="UUID",
                    help="Get all indexed persons on a specific source image page")
    ap.add_argument("--json", action="store_true", dest="as_json", help="Output as JSON")
    args = ap.parse_args()

    # Per-page records mode
    if args.page_uuid:
        data = get_page_records(args.page_uuid)
        if args.as_json:
            print(json.dumps(data, ensure_ascii=False, indent=2))
        else:
            _print_page_records(data, args.page_uuid)
        return

    # List available record types
    view_sets = get_view_sets(args.source_id)

    if not args.list_type:
        print(f"\nSource {args.source_id} — available indexed record types:")
        for vs in view_sets:
            print(f"  {vs['listType']:4s}  viewSetId={vs['viewSetId']:4d}  {vs['label']}")
        if not view_sets:
            print("  (no indexed records available for this source)")
        return

    # Find matching viewSet
    vs = next((v for v in view_sets if v["listType"] == args.list_type), None)
    if not vs:
        available = ", ".join(v["listType"] for v in view_sets)
        sys.exit(f"Record type '{args.list_type}' not available for source {args.source_id}. "
                 f"Available: {available}")

    # Build search params
    params = {}
    for field, val in [
        ("forenamn", args.forenamn),
        ("etternamn", args.etternamn),
        ("fodselsaar", args.fodselsaar),
        ("dodsaar", args.dodsaar),
        ("aar", args.aar),
        ("bustad", args.bustad),
        ("fodestad", args.fodestad),
        ("sokn_kyrkje", args.sokn),
    ]:
        if val:
            params[field] = val

    results = search_records(args.source_id, vs["viewSetId"], params, exact=args.exact)

    if args.as_json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        _print_results(results, args.source_id, vs["label"], params)


if __name__ == "__main__":
    main()
