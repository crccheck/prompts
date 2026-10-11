# Scraper / ingester / downloader UX

These patterns apply to any paginating process that fetches from a 3rd party.

## Graceful shutdown on SIGINT

The first ^C sets a stop flag: finish the current page, then exit cleanly.
The second ^C terminates immediately (default SIGINT behavior).

Print a clear message when the first ^C is received:

```
^C received — stopping after current page (^C again to force quit)
```

Check the flag at the end of each page loop iteration before fetching the next page.

## Stop when there's nothing to do

Stop pagination when a page yields no actionable work — e.g. all items already
exist, are already up to date, or fall outside the target criteria. This assumes
the source is ordered such that if one page is all-done, subsequent pages will
be too (newest-first APIs, for example).

Log the reason clearly:

```
Page 4: 0 new items — stopping (all already ingested)
```

## --max-pages argument

All paginators must accept a `--max-pages` (or `max_pages`) argument that stops
after fetching that many pages. Default: unlimited.

Useful for dry runs, testing, and partial backfills.
