# BS-107 Order details API
- Type: Story
- Status: Ready for test
- Priority: High
- Reporter: Product Owner (fictional)
## Description
As a signed-in reader I want to see my orders.
## Acceptance criteria
1. `GET /api/orders` returns only the orders of the signed-in user.
2. `GET /api/orders/{orderId}` returns the order only if it belongs to the signed-in user. For any other order it returns 404, the same as for an order that does not exist.
3. Without a valid token both endpoints return 401.
4. Guests can place orders but `GET /api/orders` returns an empty list for a new guest session.
## Notes
Demo users: `reader.one@example.com` and `reader.two@example.com`. The password is `DEMO_PASSWORD` from your `.env` file.
