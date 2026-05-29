import express from 'express';
import { Provider } from 'oidc-provider';
import serverlessExpress from '@codegenie/serverless-express';
import configuration from './configuration';
import routes from './routes';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ejs from 'ejs';

const app = express();

// Basic middleware
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.set('views', path.join(__dirname, 'views'));

app.engine('ejs', ejs.renderFile);
app.set('view engine', 'ejs');

app.enable('trust proxy');

// We initialize these outside the handler to benefit from Lambda container reuse
let serverlessHandle: any;

const setup = async () => {
  const issuer = process.env.ISSUER || "localhost";
  const wrappedIssuer = "https://" + issuer+ "/";
  const provider = new Provider(wrappedIssuer, configuration);

  provider.proxy = true;

  routes(app, provider);

  app.use(provider.callback());

  return serverlessExpress({ app });
};

const handler = async (event: any, context: any) => {
  if (!serverlessHandle) {
    serverlessHandle = await setup();
  }
  return serverlessHandle(event, context);
};

export default handler;
