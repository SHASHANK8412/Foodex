# Ordering agent evaluation: groq (openai/gpt-oss-120b)

Run 2026-11-13T15:44:50.473Z on 50 requests (38 that a valid cart can satisfy, 12 that none can).

| Metric | Result |
|---|---|
| Overall success | **46/50 (92%)** |
| Valid cart, feasible requests | 36/38 (94.7%) |
| ... on the first proposal | 35/38 (92.1%) |
| ... after re-planning | 1/38 |
| Cart proposed that breaks the request | 4 |
| Feasible request wrongly declined | 0 |
| Infeasible requests correctly declined | 10/12 |
| Latency mean / p50 / p95 | 26.9s / 21.7s / 63.6s |
| Model calls per request (mean) | 1.62 |
| Requests where the LLM's spec was corrected | 0 |
| Fallbacks to the rule-based planner | 25 |

The oracle agrees with the expected feasibility of every case.

## Failures

- **#25** "Pepperoni pizza, but I'm vegetarian": invalid_cart (Includes pepperoni: Nothing matching "pepperoni")
- **#38** "Breakfast for the family of 4, nothing fried, south indian": invalid_cart (No fried: Contains fried: Medu Vada)
- **#40** "Three pizzas for a party, under ₹1000": invalid_cart (Enough for 3 people: 1 dishes for 3 people (drinks don't count))
- **#49** "Garlic bread for 2, but no garlic please": invalid_cart (Includes garlic bread: Nothing matching "garlic bread")
