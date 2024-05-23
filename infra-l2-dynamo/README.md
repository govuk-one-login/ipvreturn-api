# IPV Return Infra L2 Dynamo

This repo contains the infrastructure required for the dynamo DB tables used by the ipvreturn-api stack. There are currently two tables:
- session-events-ipvreturn-ddb used to store data about individual user sessions
- auth-events-ipvreturn-ddb used to store AUTH_IPV_AUTHORISATION_REQUESTED events by user ID (a single user has many AUTH_IPV_AUTHORISATION_REQUESTED events and IPR doesn't care about all of them, we have put them in their own table for performance reasons documented [here](https://govukverify.atlassian.net/wiki/spaces/FTFCRI/pages/4022927872/Performance))

Please note that any changes to this repo should be made in separate PRs from changes to the ipvreturn-api stack to avoid deployment conflicts.

### Documentation
- [Stack Heirachy](https://govukverify.atlassian.net/wiki/spaces/PLAT/pages/3487432789/Dev+Platform+Stack+Hierarchy) for more information about layers
