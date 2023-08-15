# di-ipvreturn-api

# Gov Notify Templates
The gov-notify-templates directory contains the templates required for sending email notification to the user. The name of the file matches the name of the template in the Gov notify portal for "IPVReturn Production" service. The content of the file has the subject line and the message which should be copied without any changes as it includes gov notify formatting markdown.

If you need the reserved concurrencies set in DEV then add `ApplyReservedConcurrencyInDev=\"true\"` in to the `--parameter-overrides`.
Please only do this whilst you need them, if lots of stacks are deployed with these in DEV then deployments will start failing.
