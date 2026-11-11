# BS-102 Add to cart with quantity
- Type: Story
- Status: Ready for test
- Priority: High
- Reporter: Product Owner (fictional)
## Description
As a reader I want to choose how many copies I buy.
## Acceptance criteria
1. On the book page the quantity field accepts whole numbers from 1 to 10. Default is 1.
2. Values outside 1-10, decimals and empty values are rejected with the message "Choose from 1 to 10 copies".
3. After "Add to cart" the page shows "Added to cart" and the cart badge shows the new number of books.
4. Adding the same book again increases its quantity; the total for one book can never exceed 10.
5. The same rules apply to the API (`POST /api/cart/items`, `PATCH /api/cart/items/{bookId}`).
## Notes
The cart badge is the number next to "Cart" in the header.
