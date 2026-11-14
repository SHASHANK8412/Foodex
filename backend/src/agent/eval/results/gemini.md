# Ordering agent evaluation: gemini (gemini-3.5-flash-lite)

Run 2026-11-13T15:47:57.437Z on 50 requests (38 that a valid cart can satisfy, 12 that none can).

| Metric | Result |
|---|---|
| Overall success | **47/50 (94%)** |
| Valid cart, feasible requests | 36/38 (94.7%) |
| ... on the first proposal | 32/38 (84.2%) |
| ... after re-planning | 4/38 |
| Cart proposed that breaks the request | 1 |
| Feasible request wrongly declined | 2 |
| Infeasible requests correctly declined | 11/12 |
| Latency mean / p50 / p95 | 9.1s / 5.0s / 29.3s |
| Model calls per request (mean) | 2.14 |
| Requests where the LLM's spec was corrected | 1 |
| Fallbacks to the rule-based planner | 3 |
| Success on requests the LLM answered itself | 44/47 (93.6%) |

The oracle agrees with the expected feasibility of every case.

## Failures

- **#5** "Quick South Indian breakfast for 4, ₹150 each": missed. Agent: The menu does not contain any item matching the keyword 'breakfast'.
- **#25** "Pepperoni pizza, but I'm vegetarian": invalid_cart (Includes pepperoni: Nothing matching "pepperoni")
- **#43** "Veg meal for 5 under ₹500 in 40 minutes": missed. Agent: Each of the 5 people needs at least one proper dish (excluding beverages and sides), but the available dishes in restaurants delivering within 40 minutes are mostly snacks/beverages or sides, and their combined cost plus delivery and tax exceeds the ₹500 budget.
