import { strict as assert } from 'node:assert';
import * as querystring from 'node:querystring';
import { inspect } from 'node:util';
import { Request, Response, NextFunction, Express, urlencoded } from 'express';
import isEmpty from 'lodash/isEmpty.js';
import { Provider, errors, InteractionResults } from 'oidc-provider';

import Account from './account';

const body = urlencoded({ extended: false });

const keys = new Set<string>();
const { SessionNotFound } = errors;

/**
 * Debug helper to stringify objects for the UI
 */
const debug = (obj: Record<string, any>): string => {
  return querystring.stringify(
    Object.entries(obj).reduce((acc: Record<string, any>, [key, value]) => {
      keys.add(key);
      if (isEmpty(value)) return acc;
      acc[key] = inspect(value, { depth: null });
      return acc;
    }, {}),
    '<br/>',
    ': ',
    {
      encodeURIComponent(value: string) {
        return keys.has(value) ? `<strong>${value}</strong>` : value;
      },
    }
  );
};

export default (app: Express, provider: Provider) => {
  
  // Middleware to handle a simple layout engine override
  app.use((req: Request, res: Response, next: NextFunction) => {
    const orig = res.render;
    
    // @ts-ignore - overriding express render behavior
    res.render = (view: string, locals: any) => {
      app.render(view, locals, (err: Error | null, html: string) => {
        if (err) throw err;
        orig.call(res, '_layout', {
          ...locals,
          body: html,
        });
      });
    };
    next();
  });

  function setNoCache(req: Request, res: Response, next: NextFunction) {
    res.set('cache-control', 'no-store');
    next();
  }

  app.get('/interaction/:uid', setNoCache, async (req: Request, res: Response, next: NextFunction) => {
    try {

      const details = await provider.interactionDetails(req, res);
      const { uid, prompt, params, session } = details;
      const client = await provider.Client.find(params.client_id as string);

      const commonLocals = {
        client,
        uid,
        details: prompt.details,
        params,
        session: session ? debug(session as unknown as Record<string, any>) : undefined,
        dbg: {
          params: debug(params as Record<string, any>),
          prompt: debug(prompt as unknown as Record<string, any>),
        },
      };

      switch (prompt.name) {
        case 'login': {
          return res.render('login', {
            ...commonLocals,
            title: 'Sign-in',
          });
        }
        case 'consent': {
          return res.render('interaction', {
            ...commonLocals,
            title: 'Authorize',
          });
        }
        default:
          return next(new Error('Unknown prompt name'));
      }
    } catch (err) {
      return next(err);
    }
  });

  app.post('/interaction/:uid/login', setNoCache, body, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { prompt: { name } } = await provider.interactionDetails(req, res);
      assert.equal(name, 'login');

      let account = await Account.findByLogin(req.body.login);

      const identifier = req.body.login.split('@')[0]
      if (!account) {
        account = new Account(identifier, {
          sub: identifier,
          email: req.body.login,
          email_verified: true,
          family_name: 'Doe',
          given_name: 'John',
        });
        await Account.addAccount(account);
      }

      const result: InteractionResults = {
        login: {
          accountId: account?.accountId,
        },
      };

      await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
    } catch (err) {
      next(err);
    }
  });

  app.post('/interaction/:uid/confirm', setNoCache, body, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const interactionDetails = await provider.interactionDetails(req, res);
      const { 
        prompt: { name, details }, 
        params, 
        session 
      } = interactionDetails;

      assert.equal(name, 'consent');
      const accountId = session?.accountId as string;

      let { grantId } = interactionDetails;
      let grant;

      if (grantId) {
        grant = await provider.Grant.find(grantId);
      } else {
        grant = new provider.Grant({
          accountId,
          clientId: params.client_id as string,
        });
      }

      if (grant) {
        if (details.missingOIDCScope) {
          grant.addOIDCScope((details.missingOIDCScope as string[]).join(' '));
        }
        if (details.missingOIDCClaims) {
          grant.addOIDCClaims(details.missingOIDCClaims as string[]);
        }
        if (details.missingResourceScopes) {
          for (const [indicator, scopes] of Object.entries(details.missingResourceScopes as Record<string, string[]>)) {
            grant.addResourceScope(indicator, scopes.join(' '));
          }
        }
        grantId = await grant.save();
      }

      const result: InteractionResults = {
        consent: {
          // If we didn't have a grantId before, we provide the new one
          grantId: interactionDetails.grantId ? undefined : grantId,
        },
      };

      await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
    } catch (err) {
      next(err);
    }
  });

  app.get('/interaction/:uid/abort', setNoCache, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result: InteractionResults = {
        error: 'access_denied',
        error_description: 'End-User aborted interaction',
      };
      await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
    } catch (err) {
      next(err);
    }
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SessionNotFound) {
      // handle interaction expired / session not found error
      return res.status(400).send('Session expired');
    }
    next(err);
  });
};
