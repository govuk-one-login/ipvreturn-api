const axios = require ("axios");
const { aws4Interceptor } = require ("aws4-axios");
const { fromNodeProviderChain } = require("@aws-sdk/credential-providers"); 

const axiosInstance = axios.create({ baseURL: "https://ipvreturn-test-harness-ccooling-1-testharness.return.dev.account.gov.uk" });

// console.log("process.env.AWS_ACCESS_KEY_ID", process.env.AWS_ACCESS_KEY_ID);
// console.log("process.env.AWS_SECRET_ACCESS_KEY", process.env.AWS_SECRET_ACCESS_KEY);
// console.log("process.env.AWS_SESSION_TOKEN", process.env.AWS_SESSION_TOKEN);

const credentials = fromNodeProviderChain({
	timeout: 1000,
	maxRetries: 0,
});

console.log("CREDENTIALS", credentials);

const executedCredentialsFunc = async () => {
  const awaitedCreds = await credentials()
  console.log("CREDENTIALS executed", awaitedCreds);
}

const finalCreds = executedCredentialsFunc();

const awsSigv4Interceptor = aws4Interceptor({
	options: {
		region: "eu-west-2",
		service: "execute-api",
	},
  credentials: finalCreds
});

axiosInstance.interceptors.request.use(awsSigv4Interceptor);

const tableName = "session-events-ipvreturn-ddb"
const userId = "741dc399-7406-4583-bd60-f00a472b731f"

const getFromDB = async () => {
  try {
    const response =  await axiosInstance.get(`/getRecordByUserId/${tableName}/${userId}`)
    console.log("yay")
  } catch (error) {
    // console.log('---------------------------------------')
    // console.log("REQUEST HEADERS", error.request._header)
    console.log('---------------------------------------')
    console.log("RESPONSE HEADERS", error)
  }
}

getFromDB()


// ipvreturn-api_testcontainerimage