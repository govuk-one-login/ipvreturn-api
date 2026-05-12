import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { constants } from "./ApiConstants";
import { randomUUID } from 'crypto';

// 1. Setup Axios with a Cookie Jar (Crucial for OIDC sessions)
const jar = new CookieJar();
const client = wrapper(axios.create({
    baseURL: constants.OIDC_IPR_API_URL, // Your OIDC Stub
    jar, // Automatically handles 'set-cookie' and sends 'cookie' back
    maxRedirects: 0, 
    validateStatus: (status) => status >= 200 && status < 400,
}));

export async function manualOidcLoginTest(userid: string) {
    try {

        // STEP 1: INITIAL AUTHORIZATION
        const step1 = await client.get('/authorize', {
            params: {
                client_id: constants.CLIENT_ID,
                response_type: 'code',
                scope: 'openid profile',
                redirect_uri: constants.REDIRECT_URI,
                nonce: randomUUID()
            }
        });

        const interactionUrl = step1.headers['location'] as string;
        const interactionUid = interactionUrl.substring(interactionUrl.lastIndexOf('/') + 1);

        // STEP 2: SUBMIT LOGIN CREDENTIALS
        const loginData = new URLSearchParams();
        loginData.append('login', userid + "@example.com");
        loginData.append('password', 'test-password');

        const step2 = await client.post(`/interaction/${interactionUid}/login`, loginData);
        const interactionUrl2 = step2.headers['location'] as string;

        const step21 = await client.get(interactionUrl2);
        const interactionUrl21 = step21.headers['location'] as string;

        const interactionUid2 = interactionUrl21.substring(interactionUrl21.lastIndexOf('/') + 1);
        
        
        // STEP 3: MANUAL CONSENT/CONFIRMATION
        const step3 = await client.post(`/interaction/${interactionUid2}/confirm`, {});
        const resumeUrl = step3.headers['location'] as string;
        console.log(`[3] Consent Given. Resuming at: ${resumeUrl}`);

        // STEP 4: RESUME AUTHORIZATION
        const step4 = await client.get(resumeUrl);
        const finalCallbackUrl = step4.headers['location'] as string;
        console.log(`[4] Final Callback URL: ${finalCallbackUrl}`);

        // STEP 5: EXTRACT THE CODE
        const url = new URL(finalCallbackUrl);
        const authCode = url.searchParams.get('code');

        if (!authCode) throw new Error("Code not found in final redirect!");

        console.log(`--- SUCCESS! Auth Code: ${authCode} ---`);
        return authCode;

    } catch (error: any) {
        console.error("Test Failed!");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Body:`, error.response.data);
        } else {
            console.error(error.message);
        }
        throw error;
    }
}