import { Account, AccountClaims, FindAccount } from 'oidc-provider';

interface UserProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  family_name: string;
  given_name: string;
}

const store = new Map<string, UserProfile>([
  ['23456789', {
    sub: '23456789',
    email: 'foo@example.com',
    email_verified: true,
    family_name: 'Doe',
    given_name: 'John',
  }],
]);

class MyAccount implements Account {
  readonly accountId: string;
  private profile: UserProfile;

  constructor(id: string, profile: UserProfile) {
    this.accountId = id;
    this.profile = profile;
  }
  [key: string]: unknown;

  // Use, scope, and claims are provided by the provider to filter data
  async claims(use: string, scope: string): Promise<AccountClaims> {
    return {
      sub: this.accountId,
      email: this.profile.email,
      email_verified: this.profile.email_verified,
      family_name: this.profile.family_name,
      given_name: this.profile.given_name,
    };
  }

  static findAccount: FindAccount = async (ctx, id) => {
    const profile = store.get(id);
    if (!profile) return undefined;
    return new MyAccount(id, profile);
  };

  static async addAccount(newAccount: MyAccount): Promise<void> {
    store.set(newAccount.accountId, newAccount.profile)
  };

  static async findByLogin(login: string): Promise<MyAccount | undefined> {
    const profile = Array.from(store.values()).find(u => u.email === login);
    return profile ? new MyAccount(profile.sub, profile) : undefined;
  }
}

export default MyAccount;
