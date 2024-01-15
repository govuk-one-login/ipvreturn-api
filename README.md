# di-ipvreturn-api

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




