#!/usr/bin/env bash

set -eu

remove_quotes () {
  echo "$1" | tr -d '"'
}

declare error_code
# shellcheck disable=SC2154
#The CFN variables seem to include quotes when used in tests these must be removed before assigning them.
export GOVUKNOTIFYAPI=$(remove_quotes $CFN_GovNotifyAPIURL)
export API_TEST_SQS_TXMA_CONSUMER_QUEUE=$(remove_quotes $CFN_MockTxMASQSQueue)
export API_TEST_GOV_NOTIFY_SQS_QUEUE=$(remove_quotes $CFN_GovNotifySQSQueue)
export API_TEST_SESSION_EVENTS_TABLE=$(remove_quotes $CFN_SessionEventsTable)
export DEV_IPR_TEST_HARNESS_URL=$(remove_quotes $CFN_IpvReturnTestHarnessURL)

cd /src; npm run test:api
error_code=$?

cp -rf results $TEST_REPORT_ABSOLUTE_DIR

exit $error_code
