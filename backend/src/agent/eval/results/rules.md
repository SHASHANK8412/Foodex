# Ordering agent evaluation: rules

Run 2026-11-13T15:22:14.933Z on 50 requests (38 that a valid cart can satisfy, 12 that none can).

| Metric | Result |
|---|---|
| Overall success | **44/50 (88%)** |
| Valid cart, feasible requests | 34/38 (89.5%) |
| ... on the first proposal | 34/38 (89.5%) |
| ... after re-planning | 0/38 |
| Cart proposed that breaks the request | 6 |
| Feasible request wrongly declined | 0 |
| Infeasible requests correctly declined | 10/12 |
| Latency mean / p50 / p95 | 0.0s / 0.0s / 0.0s |
| Model calls per request (mean) | 0 |
| Requests where the LLM's spec was corrected | 0 |
| Fallbacks to the rule-based planner | 0 |

The oracle agrees with the expected feasibility of every case.

## Failures

- **#14** "Hot and spicy chicken for 2, under ₹700, within 45 min": invalid_cart (Includes chicken: Nothing matching "chicken")
- **#25** "Pepperoni pizza, but I'm vegetarian": invalid_cart (Includes pepperoni: Nothing matching "pepperoni")
- **#38** "Breakfast for the family of 4, nothing fried, south indian": invalid_cart (No fried: Contains fried: Medu Vada)
- **#40** "Three pizzas for a party, under ₹1000": invalid_cart (Enough for 3 people: 1 dishes for 3 people (drinks don't count))
- **#42** "Order 2 masala dosas and 2 filter coffees": invalid_cart (Enough for 2 people: 1 dishes for 2 people (drinks don't count))
- **#49** "Garlic bread for 2, but no garlic please": invalid_cart (Includes garlic bread: Nothing matching "garlic bread")
