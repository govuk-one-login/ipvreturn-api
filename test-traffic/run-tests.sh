#!/usr/bin/env bash

set -eu

remove_quotes () {
  echo "$1" | tr -d '"'
}

declare error_code
# shellcheck disable=SC2154
#The CFN variables seem to include quotes when used in tests these must be removed before assigning them.
export API_TEST_SESSION_EVENTS_TABLE=$(remove_quotes $CFN_SessionEventsTable)
export GOV_NOTIFY_API=$(remove_quotes $CFN_GovNotifyAPIURL)
export DEV_IPR_TEST_HARNESS_URL=$(remove_quotes $CFN_IpvReturnTestHarnessURL)

# disabling error_check to allow report generation for successful + failed tests
set +e
cd /src;
echo "Waiting for 5 minutes before starting traffic tests"
sleep 300
echo "Running Traffic tests"
for i in {1..10}
do
  echo "Test# $i"
  npm run test:api 
done  
error_code=$?
# cp -rf results $TEST_REPORT_ABSOLUTE_DIR
if [ $error_code -ne 0 ]
then
  exit $error_code
fi
