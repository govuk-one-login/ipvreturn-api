// @ts-ignore 
import Provider from "oidc-provider";
// @ts-ignore
import serverless from "serverless-http";

const issuer = (process.env.OIDC_URL || "http://localhost:3000").replace(/\/$/, "");

const configuration: any = {
  clients: [
    {
      client_id: process.env.OIDC_CLIENT_ID,
      redirect_uris: [process.env.REDIRECT_URI],
      response_types: ["code"],
      grant_types: ["authorization_code"],
      token_endpoint_auth_method: "none",
    },
  ],

  pkce: {
    required: () => false,
  },

  routes: {
    authorization: "/authorize",
    token: "/token",
    jwks: "/.well-known/jwks.json",
  },

  features: {
    devInteractions: { enabled: false },
  },

  interactions: {
    url: async (_ctx: any, interaction: any) => `/interaction/${interaction.uid}`,
  },

  findAccount: async (_ctx: any, id: any) => ({
    accountId: id,
    async claims() {
      return { sub: id };
    },
  }),

  proxy: true,
};

const provider = new Provider(issuer, configuration);

provider.app.use(async (ctx: any, next: any) => {
  if (ctx.method === "GET" && ctx.path.startsWith("/interaction/")) {
    await provider.interactionDetails(ctx.req, ctx.res);

    await provider.interactionFinished(
      ctx.req,
      ctx.res,
      { login: { accountId: "stub-user" }, consent: {} },
      { mergeWithLastSubmission: false },
    );

    return;
  }

  await next();
});

export const handler = serverless(provider.app);