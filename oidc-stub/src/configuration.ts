import { Configuration } from 'oidc-provider';
import Account from './account.js';

const configuration: Configuration = {
  findAccount: Account.findAccount,
    clients: [
    {
      client_id: process.env.OIDC_CLIENT_ID || "123456789",
      redirect_uris: [process.env.REDIRECT_URI || "https://localhost:8080"],
      response_types: ["code"],
      grant_types: ["authorization_code"],
      token_endpoint_auth_method: "private_key_jwt",
      jwks_uri: process.env.JWKS_URI || "https://localhost:8080/.well-known/jwks.json"
    },
  ],
  interactions: {
    url(ctx, interaction) {
      return `/interaction/${interaction.uid}`;
    },
  },
  cookies: {
    keys: ['some secret key'],
    short: {
      httpOnly: true,
      overwrite: true,
      sameSite: 'none',
      secure: true,
    },
  },
  claims: {
    address: ['address'],
    email: ['email', 'email_verified'],
    phone: ['phone_number', 'phone_number_verified'],
    profile: ['birthdate', 'family_name', 'gender', 'given_name', 'locale', 'middle_name', 'name', 'nickname', 'picture', 'preferred_username', 'profile', 'updated_at', 'website', 'zoneinfo'],
  },
  features: {
    devInteractions: { enabled: false }, // Using custom routes instead
  },
  pkce: {
    required:() => false
  },
  routes: {
    authorization: "/authorize",
    token: '/token',
  }
};

export default configuration;
