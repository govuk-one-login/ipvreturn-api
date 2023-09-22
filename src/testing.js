const axios = require ("axios");
const { aws4Interceptor } = require ("aws4-axios");

const axiosInstance = axios.create({ baseURL: "https://test-harness-sigv4-enabled-testharness.return.dev.account.gov.uk" });

// console.log("process.env.AWS_ACCESS_KEY_ID", process.env.AWS_ACCESS_KEY_ID);
// console.log("process.env.AWS_SECRET_ACCESS_KEY", process.env.AWS_SECRET_ACCESS_KEY);
// console.log("process.env.AWS_SESSION_TOKEN", process.env.AWS_SESSION_TOKEN);

const awsSigv4Interceptor = aws4Interceptor({
	options: {
		region: "eu-west-2",
		service: "execute-api",
	},
	credentials: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		sessionToken: process.env.AWS_SESSION_TOKEN,
	},
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
    console.log("RESPONSE HEADERS", error.response.data)
  }
}

getFromDB()


// ipvreturn-api_testcontainerimage