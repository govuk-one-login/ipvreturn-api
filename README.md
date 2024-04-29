# di-ipvreturn-api - test

# Gov Notify Templates
The gov-notify-templates directory contains the templates required for sending email notification to the user. The name of the file matches the name of the template in the Gov notify portal for "IPVReturn Production" service. The content of the file has the subject line and the message which should be copied without any changes as it includes gov notify formatting markdown.

If you need the reserved concurrencies set in DEV then add `ApplyReservedConcurrencyInDev=\"true\"` in to the `--parameter-overrides`.
Please only do this whilst you need them, if lots of stacks are deployed with these in DEV then deployments will start failing.

## Local development

For local development deploy a custom stack:
1. `cd /deploy`
2. In samconfig.toml change `stack_name` to a custom stack name of your choice
3. Log in using AWS SSO
4. Deploy by running `sam build && sam deploy --config-env dev --resolve-s3`

Note: When deploying custom stacks in dev NotLocalTestStack will prevent the deploy of Custom Domains and OIDCProvider unless the stackname is ipvreturn-api
If you require a BE stack with those capabilities please use the "Deploy Main to Dev Env" Github Workflow with your branch to deploy your changes to the main Dev Stack

### Code Owners

This repo has a `CODEOWNERS` file in the root and is configured to require PRs to reviewed by Code Owners.

## Pre-Commit Checking / Verification

There is a `.pre-commit-config.yaml` configuration setup in this repo, this uses [pre-commit](https://pre-commit.com/) to verify your commit before actually committing, it runs the following checks:

- Check Json files for formatting issues
- Fixes end of file issues (it will auto correct if it spots an issue - you will need to run the git commit again after it has fixed the issue)
- It automatically removes trailing whitespaces (again will need to run commit again after it detects and fixes the issue)
- Detects aws credentials or private keys accidentally added to the repo
- runs cloud formation linter and detects issues
- runs checkov and checks for any issues
- runs detect-secrets to check for secrets accidentally added - where these are false positives, the `.secrets.baseline` file should be updated by running `detect-secrets scan > .secrets.baseline`

### Dependency Installation

To use this locally you will first need to install the dependencies, this can be done in 2 ways:

#### Method 1 - Python pip

Run the following in a terminal:

```
sudo -H pip3 install checkov pre-commit cfn-lint
```

this should work across platforms

#### Method 2 - Brew

If you have brew installed please run the following:

```
brew install pre-commit ;\
brew install cfn-lint ;\
brew install checkov
```

### Post Installation Configuration

once installed run:

```
pre-commit install
```

To update the various versions of the pre-commit plugins, this can be done by running:

```
pre-commit autoupdate && pre-commit install
```

This will install / configure the pre-commit git hooks, if it detects an issue while committing it will produce an output like the following:

```
 git commit -a
check json...........................................(no files to check)Skipped
fix end of files.........................................................Passed
trim trailing whitespace.................................................Passed
detect aws credentials...................................................Passed
detect private key.......................................................Passed
AWS CloudFormation Linter................................................Failed
- hook id: cfn-python-lint
- exit code: 4
W3011 Both UpdateReplacePolicy and DeletionPolicy are needed to protect Resources/PublicHostedZone from deletion
core/deploy/dns-zones/template.yaml:20:3
Checkov..............................................(no files to check)Skipped
- hook id: checkov
```

