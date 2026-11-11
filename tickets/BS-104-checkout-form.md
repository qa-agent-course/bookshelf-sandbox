# BS-104 Checkout form
- Type: Story
- Status: Ready for test
- Priority: High
- Reporter: Product Owner (fictional)
## Description
As a reader I want to enter my delivery details and place the order.
## Acceptance criteria
1. Fields: full name (2-80 chars), email, street, city, postcode (3-10 chars), delivery option. All are required.
2. Invalid fields show an error text next to the field when the reader leaves the field and on "Place order".
3. The form meets WCAG 2.2 level AA: every field has a visible label, errors are announced as text, the whole form works with the keyboard.
4. "Place order" creates exactly one order and opens the order page.
5. After a successful order the cart is empty.
## Notes
Page: `/checkout`. API: `POST /api/orders`.
