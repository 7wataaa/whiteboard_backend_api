import { MailService } from '@sendgrid/mail';
import ExtensibleCustomError from 'extensible-custom-error';
import dotenv from 'dotenv';

export class ApiKeyNotFoundError extends ExtensibleCustomError {}

dotenv.config();

if (!process.env['SENDGRID_API_KEY']) {
  throw new ApiKeyNotFoundError();
}

const sendgrid = new MailService();

sendgrid.setApiKey(process.env['SENDGRID_API_KEY']);

export { sendgrid };
