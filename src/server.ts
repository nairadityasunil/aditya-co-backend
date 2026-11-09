import App from './app';
import AuthRoutes from './modules/auth/routes';
import UploadRoutes from './modules/upload/routes';
import SettingsRoutes from './modules/settings/routes';
import EnquiryRoutes from './modules/enquiries/routes';
import EmailTemplateRoutes from './modules/emailTemplates/routes';
import PublicRoutes from './modules/public/routes';
import AnalyticsRoutes from './modules/analytics/routes';
import ChatbotRoutes from './modules/chatbot/routes';
import MediaRoutes from './modules/media/routes';
import PageRoutes from './modules/pages/routes';
import PreviewRoutes from './modules/preview/routes';
import { contentRoutes } from './modules/content/routes';

const app = new App([
  new AuthRoutes(),
  new UploadRoutes(),
  new MediaRoutes(),
  new AnalyticsRoutes(),
  new ChatbotRoutes(),
  new SettingsRoutes(),
  new EnquiryRoutes(),
  new EmailTemplateRoutes(),
  new PublicRoutes(),
  new PageRoutes(),
  new PreviewRoutes(),
  ...contentRoutes(),
]);

app.listen().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
