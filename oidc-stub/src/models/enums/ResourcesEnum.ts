/**
 * Enum for TDS's available resources (endpoints).
 */
export enum ResourcesEnum {
	OIDC_TOKEN = "/token",
	OIDC_OPENID_CONFIG_ENDPOINT = "/.well-known/openid-configuration",
	OIDC_AUTHORIZE_ENDPOINT = "/authorize"
}
