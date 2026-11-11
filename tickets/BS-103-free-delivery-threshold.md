# BS-103 Free delivery threshold
- Type: Story
- Status: Ready for test
- Priority: High
- Reporter: Product Owner (fictional)
## Description
As a reader I want free delivery on bigger orders.
## Acceptance criteria
1. Standard delivery costs 4.90 EUR.
2. Standard delivery is free when the subtotal after discount is 30.00 EUR or more.
3. Pickup point delivery is always free.
4. The cart shows "Free delivery" or "Delivery: 4.90 EUR" next to the total.
5. Below 30.00 EUR the cart shows "Add X EUR more for free delivery", where X is the missing amount.
## Notes
Book prices are in `data/books.json`. Money is calculated in cents.
