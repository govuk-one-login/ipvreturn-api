import { randomUUID } from "crypto";
const AUTHORIZATION_CODE = randomUUID();
export const VALID_SESSION = {
	httpMethod: "GET",
	body: "",
	headers: {}, // safe IP address for documentation purposes
	isBase64Encoded: false,
	multiValueHeaders: {},
	multiValueQueryStringParameters: {},
	path: "/session",
	pathParameters: {},
	queryStringParameters: { "code":`${AUTHORIZATION_CODE}` },
	requestContext: {
		accountId: "",
		apiId: "",
		authorizer: {},
		httpMethod: "get",
		identity: {
			accessKey: "",
			accountId: "",
			apiKey: "",
			apiKeyId: "",
			caller: "",
			clientCert: {
				clientCertPem: "",
				issuerDN: "",
				serialNumber: "",
				subjectDN: "",
				validity: { notAfter: "", notBefore: "" },
			},
			cognitoAuthenticationProvider: "",
			cognitoAuthenticationType: "",
			cognitoIdentityId: "",
			cognitoIdentityPoolId: "",
			principalOrgId: "",
			sourceIp: "",
			user: "",
			userAgent: "",
			userArn: "",
		},
		path: "/session",
		protocol: "HTTP/1.1",
		requestId: "c6af9ac6-7b61-11e6-9a41-93e8deadbeef",
		requestTimeEpoch: 1428582896000,
		resourceId: "123456",
		resourcePath: "/session",
		stage: "dev",
	},
	resource: "/session",
	stageVariables: {},
};

export const MISSING_AUTH_CODE = {
	httpMethod: "GET",
	body: "",
	headers: {}, // safe IP address for documentation purposes
	isBase64Encoded: false,
	multiValueHeaders: {},
	multiValueQueryStringParameters: {},
	path: "/session",
	pathParameters: {},
	queryStringParameters: {},
	requestContext: {
		accountId: "",
		apiId: "",
		authorizer: {},
		httpMethod: "get",
		identity: {
			accessKey: "",
			accountId: "",
			apiKey: "",
			apiKeyId: "",
			caller: "",
			clientCert: {
				clientCertPem: "",
				issuerDN: "",
				serialNumber: "",
				subjectDN: "",
				validity: { notAfter: "", notBefore: "" },
			},
			cognitoAuthenticationProvider: "",
			cognitoAuthenticationType: "",
			cognitoIdentityId: "",
			cognitoIdentityPoolId: "",
			principalOrgId: "",
			sourceIp: "",
			user: "",
			userAgent: "",
			userArn: "",
		},
		path: "/session",
		protocol: "HTTP/1.1",
		requestId: "c6af9ac6-7b61-11e6-9a41-93e8deadbeef",
		requestTimeEpoch: 1428582896000,
		resourceId: "123456",
		resourcePath: "/session",
		stage: "dev",
	},
	resource: "/session",
	stageVariables: {},
};

export const INVALID_SESSION = {
	httpMethod: "GET",
	body: "",
	headers: { "X-Forwarded-For": "192.0.2.1" }, // safe IP address for documentation purposes
	isBase64Encoded: false,
	multiValueHeaders: {},
	multiValueQueryStringParameters: {},
	path: "/invalid",
	pathParameters: {},
	queryStringParameters: {},
	requestContext: {
		accountId: "",
		apiId: "",
		authorizer: {},
		httpMethod: "get",
		identity: {
			accessKey: "",
			accountId: "",
			apiKey: "",
			apiKeyId: "",
			caller: "",
			clientCert: {
				clientCertPem: "",
				issuerDN: "",
				serialNumber: "",
				subjectDN: "",
				validity: { notAfter: "", notBefore: "" },
			},
			cognitoAuthenticationProvider: "",
			cognitoAuthenticationType: "",
			cognitoIdentityId: "",
			cognitoIdentityPoolId: "",
			principalOrgId: "",
			sourceIp: "",
			user: "",
			userAgent: "",
			userArn: "",
		},
		path: "/invalid",
		protocol: "HTTP/1.1",
		requestId: "c6af9ac6-7b61-11e6-9a41-93e8deadbeef",
		requestTimeEpoch: 1428582896000,
		resourceId: "123456",
		resourcePath: "/invalid",
		stage: "dev",
	},
	resource: "/invalid",
	stageVariables: {},
};
