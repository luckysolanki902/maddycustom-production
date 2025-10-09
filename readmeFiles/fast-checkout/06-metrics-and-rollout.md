# Fast Checkout: Metrics & Rollout

## Metrics
- `time_to_orderform_open` (ms)
- `time_to_next_enabled` (ms)
- `cpo_duration_total` and per-endpoint durations
- `cpo_state_counts`: ready/partial/failed
- Order failure rate due to stock or coupon mismatch (should not increase)

## Logs / Events
- `cpo_start`, `cpo_ready`, `cpo_partial`, `cpo_failed`, `cpo_refresh`
- Include `signature`, `cart_size`, `has_coupon`, `ttl_age_ms`.

## Dashboards
- UX funnel with P50/P95 for both timings.
- Error heatmap by endpoint.

## Rollout
- Feature flag `fastCheckoutPrefetch`.
- Start at 5%, compare against control.
- Ramp to 25%, then 100% if green.

## Alerting
- Alert if `time_to_next_enabled_p95 > 1500ms` for 10 min.
- Alert if stock-related order failures rise > 10% from baseline.
