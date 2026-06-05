#!/bin/bash
# check-type-tests-evidence.sh
# Verify each type declared in test-map.yaml type_tests has evidence in test-report.md Standards Evidence section

set -e

TEST_MAP=".cube/iterations/$(git rev-parse --abbrev-ref HEAD | tr '/' '-')/test-map.yaml"
TEST_REPORT=".cube/iterations/$(git rev-parse --abbrev-ref HEAD | tr '/' '-')/test-report.md"

if [ ! -f "$TEST_MAP" ]; then
  echo "SKIP: test-map.yaml not found at $TEST_MAP"
  exit 0
fi

if [ ! -f "$TEST_REPORT" ]; then
  echo "FAIL: test-report.md not found at $TEST_REPORT"
  exit 1
fi

# Extract type values from test-map.yaml type_tests section
TYPES=$(grep -A1 "type:" "$TEST_MAP" | grep "^  - type:" | sed 's/.*type: //' | sort -u)

if [ -z "$TYPES" ]; then
  echo "SKIP: no type_tests declared in test-map.yaml"
  exit 0
fi

echo "Types declared in test-map.yaml:"
echo "$TYPES"
echo ""

FAILED=0
while IFS= read -r type; do
  # Check if the test-report.md Standards Evidence section mentions this type
  if grep -q "$type" "$TEST_REPORT"; then
    echo "PASS: type '$type' found in test-report.md"
  else
    echo "FAIL: type '$type' NOT found in test-report.md Standards Evidence"
    FAILED=1
  fi
done <<< "$TYPES"

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "FAIL: Some declared types are missing from test-report.md Standards Evidence section."
  exit 1
fi

echo ""
echo "PASS: All declared types have evidence in test-report.md."
exit 0