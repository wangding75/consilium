#!/usr/bin/env bash
# check-type-tests-evidence.sh — Verify each type_tests entry in test-map.yaml
# has corresponding evidence in test-report.md Standards Evidence section.

set -euo pipefail

TEST_MAP="test-map.yaml"
TEST_REPORT="test-report.md"

if [[ ! -f "$TEST_MAP" ]]; then
  echo "SKIP: no test-map.yaml"
  exit 0
fi

if [[ ! -f "$TEST_REPORT" ]]; then
  echo "FAIL: test-report.md not found"
  exit 1
fi

# Extract unique type values from type_tests section in test-map.yaml
# Only match lines with "- type:" (the type_tests entries), not "task_type:"
TYPES=$(grep -E '^\s+- type:\s+' "$TEST_MAP" | sed 's/.*type:\s*//' | sort -u)

FAILED=0
for type in $TYPES; do
  if ! grep -q "$type" "$TEST_REPORT"; then
    echo "FAIL: type '$type' declared in test-map.yaml but no evidence found in test-report.md Standards Evidence"
    FAILED=1
  fi
done

if [[ $FAILED -eq 1 ]]; then
  exit 1
fi

echo "ok — all type_tests entries have evidence in test-report.md"