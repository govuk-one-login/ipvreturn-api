# Identity Proving Return Service

Identity Proving Return Service

## How to run build

From `src` folder run `sam build` 

## How to run tests

### Unit tests

To run all unit tests, run `npm run test:unit`. This will compile and run all the unit tests in the `/tests` directory.

### Infra tests

To run the infra tests, run `npm run test:infra`.

### API tests

To run the API tests, run `npm run test:api`. Note that these tests need to inject items on to the Mock TXMA consumer queue directly hence need to be run in an environment which has active AWS credentials.

The API tests also require the following env vars to be set:

- `API_TEST_SESSION_EVENTS_TABLE` - table name for the Session Events table to check

These are set automatically by `./run-tests-locally.sh <AWS_Stack_Name>`.

### How to perform lint checks an individual test file

To check if there are any linting issues, run `npm lint`. If there are any critical errors, this command 
will fail prompting developer to fix those issues. The report will be present under `reports` folder as an
html file. Once those critical errors are fixed, re running `npm lint` should not return any errors.
In order to fix some simple formatting issues, one can run `npm lint:fix` which should fix most of those automatically.

### How to test your custom OIDC stub

If you have your custom OIDC stub deployed and would like to connect your BE stack to your OIDC stub, then update the URLs in OIDCDNS and OIDCURL in the template.yaml file before deploying your custom BE stack.

### Quality Gate Tags

All API tests should be tagged with `@QualityGateIntegrationTest`. If a test runs in our pipelines (ie in Build), and tests live features, we should tag them with `@QualityGateRegressionTest`.
If the test is for an in-development feature, we should tag it with `@QualityGateNewFeatureTest`.

Once a feature goes live, `@QualityGateNewFeatureTest` tags need to be updated to `@QualityGateRegressionTest`.
To facilitate this update, API tests for in-development work should be placed in their own feature files, if possible, so the tests can be tagged at the Feature level rather than the Scenario level.
Ideally, tests tagged with `@QualityGateNewFeatureTest` should be marked with a TODO and reference a post-go-live clean-up ticket so they can be easily identified and updated.
