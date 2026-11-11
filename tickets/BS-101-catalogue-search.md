# BS-101 Catalogue search
- Type: Story
- Status: Ready for test
- Priority: High
- Reporter: Product Owner (fictional)
## Description
As a reader I want to search the catalogue so that I find a book fast.
## Acceptance criteria
1. The search box is on the catalogue page and has the label "Search books".
2. Search matches title and author, ignoring upper and lower case.
3. Results update while typing, after a short pause.
4. If nothing matches, the page shows "No books found" and a "Clear search" link.
5. An empty search shows all books.
6. Search text longer than 100 characters is cut to 100 characters.
## Notes
API: `GET /api/books?q=` (see `openapi/bookshelf.openapi.yaml`).
